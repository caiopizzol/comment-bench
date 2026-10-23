#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadSuite, type Task } from "./suite";

type Candidate = { fix: string; ticket: string; subject: string };
type Outcome = { tests: string[]; total: number; failed: number; code: number };

function sh(cmd: string, args: string[], cwd: string) {
	const r = spawnSync(cmd, args, {
		cwd,
		encoding: "utf8",
		maxBuffer: 512 * 1024 * 1024,
		timeout: 15 * 60_000,
	});
	return { code: r.status ?? -1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

function parse(out: string, runner: Task["runner"]) {
	if (runner === "bun") {
		const pass = Number(out.match(/(\d+) pass/)?.[1] ?? 0);
		const failed = Number(out.match(/(\d+) fail/)?.[1] ?? 0);
		return { total: pass + failed, failed };
	}
	const line = out.match(/Tests\s+(.+)\((\d+)\)/);
	return {
		total: Number(line?.[2] ?? 0),
		failed: Number(line?.[1]?.match(/(\d+) failed/)?.[1] ?? 0),
	};
}

function packageRoot(work: string, file: string): string {
	let dir = dirname(file);
	while (dir !== "." && !existsSync(join(work, dir, "package.json")))
		dir = dirname(dir);
	return dir;
}

if (import.meta.main) {
	const [suitePath, candidatesPath, outPath] = process.argv.slice(2);
	if (!suitePath || !candidatesPath || !outPath) {
		throw new Error(
			"usage: bun real/validate.ts <suite.ts> <candidates.txt> <out.jsonl>",
		);
	}
	const suite = await loadSuite(suitePath);
	const work = resolve("/tmp/cb-validate");
	if (!existsSync(work)) {
		const add = sh(
			"git",
			["worktree", "add", "--detach", work, "HEAD"],
			suite.repo,
		);
		if (add.code !== 0) throw new Error(add.out);
	}
	const done = new Set(
		existsSync(outPath)
			? readFileSync(outPath, "utf8")
					.split("\n")
					.filter(Boolean)
					.map((l) => JSON.parse(l).fix)
			: [],
	);
	const candidates: Candidate[] = readFileSync(candidatesPath, "utf8")
		.split("\n")
		.filter(Boolean)
		.map((l) => {
			const [fix, ticket, , ...subject] = l.split("|");
			return { fix: fix!, ticket: ticket ?? "", subject: subject.join("|") };
		});
	mkdirSync(dirname(outPath), { recursive: true });
	for (const c of candidates) {
		if (done.has(c.fix)) continue;
		const record: Record<string, unknown> = { ...c };
		try {
			sh("git", ["checkout", "-q", "--force", "--detach", `${c.fix}^`], work);
			sh("git", ["clean", "-fdq", "-e", "node_modules"], work);
			const files = sh(
				"git",
				["show", "--name-status", "--format=", c.fix],
				suite.repo,
			)
				.out.split("\n")
				.filter(Boolean)
				.map((l) => l.split("\t"));
			const changed = files.map((f) => f.at(-1)!);
			const tests = changed.filter((f) => /\.test\.[cm]?[jt]s$/.test(f));
			const support = changed.filter(
				(f) => /__tests__\//.test(f) && !tests.includes(f),
			);
			const sources = changed.filter(
				(f) =>
					/\.[cm]?[jt]s$/.test(f) &&
					!tests.includes(f) &&
					!support.includes(f) &&
					!/\.spec\./.test(f),
			);
			const installDir = suite.installDirFor(tests[0]!);
			const install = sh(
				suite.install[0]!,
				suite.install.slice(1),
				join(work, installDir),
			);
			if (install.code !== 0)
				throw new Error(`install: ${install.out.slice(-500)}`);
			const testCwd = packageRoot(work, tests[0]!);
			const runner: Task["runner"] = /from ['"]bun:test['"]/.test(
				sh("git", ["show", `${c.fix}:${tests[0]}`], suite.repo).out,
			)
				? "bun"
				: "vitest";
			const writeTests = () => {
				for (const t of [...tests, ...support]) {
					const body = sh("git", ["show", `${c.fix}:${t}`], suite.repo);
					if (body.code !== 0) continue;
					mkdirSync(dirname(join(work, t)), { recursive: true });
					writeFileSync(join(work, t), body.out);
				}
			};
			const run = (): Outcome => {
				const rel = tests.map((t) => t.slice(testCwd.length + 1));
				const r =
					runner === "bun"
						? sh("bun", ["test", ...rel], join(work, testCwd))
						: sh(
								suite.vitest[0]!,
								[...suite.vitest.slice(1), ...rel],
								join(work, testCwd),
							);
				return { tests: rel, ...parse(r.out, runner), code: r.code };
			};
			writeTests();
			const parent = run();
			for (const f of sources) {
				const body = sh("git", ["show", `${c.fix}:${f}`], suite.repo);
				if (body.code === 0) {
					mkdirSync(dirname(join(work, f)), { recursive: true });
					writeFileSync(join(work, f), body.out);
				}
			}
			const fixed = run();
			Object.assign(record, {
				installDir,
				testCwd,
				runner,
				parent: { total: parent.total, failed: parent.failed },
				fixed: { total: fixed.total, failed: fixed.failed, code: fixed.code },
				usable:
					parent.total > 0 &&
					parent.failed > 0 &&
					fixed.code === 0 &&
					fixed.failed === 0 &&
					fixed.total === parent.total,
			});
		} catch (e) {
			Object.assign(record, { usable: false, error: String(e).slice(0, 500) });
		}
		appendFileSync(outPath, `${JSON.stringify(record)}\n`);
		console.log(
			JSON.stringify({
				fix: c.fix,
				usable: record.usable,
				parent: record.parent,
				error: record.error ? "yes" : undefined,
			}),
		);
	}
}
