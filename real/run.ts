#!/usr/bin/env bun
import { spawn, spawnSync } from "node:child_process";
import {
	appendFileSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { countComments, STRIPPABLE } from "./strip-comments";
import { stripTree } from "./strip-tree";
import { ARMS, type Arm, loadSuite, type Suite, type Task } from "./suite";

const HERE = resolve(import.meta.dir);
const NODE_BIN = dirname(
	spawnSync("node", ["-p", "process.execPath"], {
		encoding: "utf8",
	}).stdout.trim(),
);
function which(bin: string): string {
	return spawnSync("sh", ["-c", `command -v ${bin}`], {
		encoding: "utf8",
	}).stdout.trim();
}
const AGENT_TOOLS: Record<string, string> = {
	node: join(NODE_BIN, "node"),
	npm: join(NODE_BIN, "npm"),
	npx: join(NODE_BIN, "npx"),
	pnpm: join(NODE_BIN, "pnpm"),
	corepack: join(NODE_BIN, "corepack"),
	bun: which("bun"),
	git: which("git"),
	rg: which("rg"),
};

function sh(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
	const r = spawnSync(cmd, args, {
		cwd,
		encoding: "utf8",
		maxBuffer: 512 * 1024 * 1024,
		env: env ?? process.env,
	});
	return { code: r.status ?? -1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

function must(cmd: string, args: string[], cwd: string): string {
	const r = sh(cmd, args, cwd);
	if (r.code !== 0)
		throw new Error(`${cmd} ${args.join(" ")} failed:\n${r.out.slice(-2000)}`);
	return r.out;
}

let SUITE: Suite;

export function useSuite(suite: Suite) {
	SUITE = suite;
}

function changedFiles(fix: string): { tests: string[]; sources: string[] } {
	const files = must(
		"git",
		["show", "--name-only", "--format=", fix],
		SUITE.repo,
	)
		.split("\n")
		.filter(Boolean);
	const isTest = (f: string) => /\.test\.|__tests__\//.test(f);
	return {
		tests: files.filter(isTest),
		sources: files.filter(
			(f) => STRIPPABLE.test(f) && !isTest(f) && !/\.spec\./.test(f),
		),
	};
}

export function prep(task: Task, arm: Arm, dir: string) {
	mkdirSync(dir, { recursive: true });
	const tar = spawnSync(
		"sh",
		["-c", `git -C '${SUITE.repo}' archive ${task.fix}^ | tar -x -C '${dir}'`],
		{ encoding: "utf8" },
	);
	if (tar.status !== 0) throw new Error(`archive failed: ${tar.stderr}`);
	let strip = null;
	if (arm === "stripped") {
		must("git", ["init", "-q"], dir);
		must("git", ["add", "-A"], dir);
		strip = stripTree(dir, new Set());
		if (strip.mismatched.length || strip.failed.length) {
			throw new Error(
				`strip changed code: ${strip.mismatched.concat(strip.failed).join(", ")}`,
			);
		}
		rmSync(join(dir, ".git"), { recursive: true, force: true });
	}
	const [installCmd, ...installArgs] = SUITE.install;
	must(installCmd!, installArgs, join(dir, task.installDir));
	must("git", ["init", "-q"], dir);
	must("git", ["config", "user.email", "agent@example.com"], dir);
	must("git", ["config", "user.name", "Agent"], dir);
	must("git", ["add", "-A"], dir);
	must("git", ["commit", "-qm", "baseline", "--no-verify"], dir);
	return strip;
}

const CODEX_GPT = /^gpt-/;

function agentEnv(trialDir: string, model: string): NodeJS.ProcessEnv {
	const bin = join(trialDir, "..", `${trialDir.split("/").pop()}-bin`);
	mkdirSync(bin, { recursive: true });
	for (const [name, target] of Object.entries(AGENT_TOOLS)) {
		const link = join(bin, name);
		if (!existsSync(link)) symlinkSync(target, link);
	}
	const cfg = join(trialDir, "..", `${trialDir.split("/").pop()}-agent`);
	mkdirSync(cfg, { recursive: true });
	const base = {
		HOME: process.env.HOME,
		USER: process.env.USER,
		LANG: "en_US.UTF-8",
		TERM: "dumb",
		PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`,
	};
	if (CODEX_GPT.test(model)) {
		copyFileSync(
			join(process.env.HOME ?? "", ".codex", "auth.json"),
			join(cfg, "auth.json"),
		);
		return { ...base, CODEX_HOME: cfg };
	}
	return {
		...base,
		CLAUDE_CONFIG_DIR: cfg,
		ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
		ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
		DISABLE_AUTOUPDATER: "1",
		CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
	};
}

function agentCommand(model: string, text: string): [string, string[]] {
	if (CODEX_GPT.test(model)) {
		return [
			which("codex"),
			[
				"exec",
				"--ignore-user-config",
				"--ignore-rules",
				"--ephemeral",
				"--skip-git-repo-check",
				"--dangerously-bypass-approvals-and-sandbox",
				"-m",
				model,
				"-c",
				"model_reasoning_effort=medium",
				"-c",
				"features.apps=false",
				"-c",
				"features.plugins=false",
				"-c",
				"features.image_generation=false",
				"-c",
				"web_search=disabled",
				"--json",
				text,
			],
		];
	}
	return [
		which("claude"),
		[
			"-p",
			text,
			"--model",
			model,
			"--permission-mode",
			"bypassPermissions",
			"--output-format",
			"stream-json",
			"--verbose",
			"--no-session-persistence",
			"--disallowedTools",
			"WebFetch",
			"WebSearch",
		],
	];
}

function prompt(task: Task): string {
	const ticket = readFileSync(
		join(SUITE.ticketsDir, `${task.ticket}.md`),
		"utf8",
	);
	return [
		SUITE.intro,
		`Dependencies are installed for \`${task.installDir}\`. The issue tracker, code host, and ticket attachments are not available.`,
		"Fix the issue below in the codebase. Run the relevant tests. Do not commit.",
		"",
		ticket,
	].join("\n");
}

async function runAgent(
	task: Task,
	dir: string,
	log: string,
	model: string,
	timeoutMs: number,
) {
	const started = Date.now();
	const [cmd, args] = agentCommand(model, prompt(task));
	const child = spawn(cmd, args, {
		cwd: dir,
		env: agentEnv(dir, model),
		stdio: ["ignore", "pipe", "pipe"],
	});
	const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
	child.stdout.on("data", (d) => appendFileSync(log, d));
	child.stderr.on("data", (d) => appendFileSync(`${log}.stderr`, d));
	const code: number = await new Promise((r) =>
		child.on("close", (c) => r(c ?? -1)),
	);
	clearTimeout(timer);
	return { code, seconds: Math.round((Date.now() - started) / 1000) };
}

type Usage = Partial<
	Record<
		| "input_tokens"
		| "output_tokens"
		| "cache_read_input_tokens"
		| "cache_creation_input_tokens"
		| "reasoning_output_tokens",
		number
	>
>;
type ToolUse = {
	type?: string;
	name?: string;
	input?: { command?: unknown } & Record<string, unknown>;
};
type AgentEvent = {
	type?: string;
	usage?: Usage;
	num_turns?: number;
	total_cost_usd?: number;
	is_error?: boolean;
	message?: { content?: ToolUse[] };
	item?: { type?: string; command?: string };
};

const READ_CMD = /\b(cat|sed -n|head|tail|nl|less|bat)\b/;
const SEARCH_CMD = /\b(rg|grep|find|fd|ag|git grep)\b/;
const OUTSIDE = (blob: string) =>
	blob.includes(SUITE.repo) || /git (log|show|reflog|blame)/.test(blob);

export function transcriptStats(log: string) {
	const lines = existsSync(log)
		? readFileSync(log, "utf8").split("\n").filter(Boolean)
		: [];
	const stats = {
		turns: 0,
		cost_usd: null as number | null,
		is_error: true,
		input_tokens: 0,
		output_tokens: 0,
		tool_calls: 0,
		reads: 0,
		searches: 0,
		suspicious_lookups: 0,
	};
	const shell = (cmd: string) => {
		stats.tool_calls++;
		if (READ_CMD.test(cmd)) stats.reads++;
		if (SEARCH_CMD.test(cmd)) stats.searches++;
		if (OUTSIDE(cmd)) stats.suspicious_lookups++;
	};
	for (const line of lines) {
		let ev: AgentEvent;
		try {
			ev = JSON.parse(line);
		} catch {
			continue;
		}
		if (ev.type === "result") {
			const u = ev.usage ?? {};
			stats.turns = ev.num_turns ?? 0;
			stats.cost_usd = ev.total_cost_usd ?? null;
			stats.is_error = ev.is_error ?? true;
			stats.input_tokens =
				(u.input_tokens ?? 0) +
				(u.cache_read_input_tokens ?? 0) +
				(u.cache_creation_input_tokens ?? 0);
			stats.output_tokens = u.output_tokens ?? 0;
		}
		if (ev.type === "assistant") {
			for (const c of ev.message?.content ?? []) {
				if (c.type !== "tool_use") continue;
				const input = JSON.stringify(c.input ?? {});
				if (c.name === "Bash") {
					shell(String(c.input?.command ?? ""));
					continue;
				}
				stats.tool_calls++;
				if (c.name === "Read") stats.reads++;
				if (c.name === "Grep" || c.name === "Glob") stats.searches++;
				if (OUTSIDE(input)) stats.suspicious_lookups++;
			}
		}
		if (ev.type === "item.completed") {
			const item = ev.item ?? {};
			if (item.type === "command_execution") shell(String(item.command ?? ""));
			else if (item.type === "file_change" || item.type === "mcp_tool_call")
				stats.tool_calls++;
		}
		if (ev.type === "turn.completed") {
			const u = ev.usage ?? {};
			stats.turns++;
			stats.is_error = false;
			stats.input_tokens += u.input_tokens ?? 0;
			stats.output_tokens +=
				(u.output_tokens ?? 0) + (u.reasoning_output_tokens ?? 0);
		}
		if (ev.type === "turn.failed" || ev.type === "error") stats.is_error = true;
	}
	return stats;
}

export function agentDiff(dir: string) {
	sh("git", ["add", "-A", "--", ".", ":(exclude)**/node_modules/**"], dir);
	const names = sh("git", ["diff", "--cached", "--name-only", "HEAD"], dir)
		.out.split("\n")
		.filter((f) => f && !f.includes("node_modules/"));
	let added = 0;
	let removed = 0;
	for (const f of names.filter((n) => STRIPPABLE.test(n))) {
		const before = sh("git", ["show", `HEAD:${f}`], dir);
		const after = existsSync(join(dir, f))
			? readFileSync(join(dir, f), "utf8")
			: "";
		const b = before.code === 0 ? countComments(before.out, f) : 0;
		const a = after ? countComments(after, f) : 0;
		if (a > b) added += a - b;
		else removed += b - a;
	}
	const patch = sh(
		"git",
		["diff", "--cached", "HEAD", "--", ".", ":(exclude)**/node_modules/**"],
		dir,
	).out;
	return {
		files: names,
		comments_added: added,
		comments_removed: removed,
		patch,
	};
}

export function score(task: Task, dir: string) {
	const { tests } = changedFiles(task.fix);
	const present = tests.filter(
		(t) =>
			sh("git", ["cat-file", "-e", `${task.fix}:${t}`], SUITE.repo).code === 0,
	);
	for (const t of present) {
		mkdirSync(dirname(join(dir, t)), { recursive: true });
		writeFileSync(
			join(dir, t),
			must("git", ["show", `${task.fix}:${t}`], SUITE.repo),
		);
	}
	const files = present
		.filter((t) => /\.test\.[cm]?[jt]s$/.test(t))
		.map((t) => t.slice(task.testCwd.length + 1));
	const r =
		task.runner === "bun"
			? sh("bun", ["test", ...files], join(dir, task.testCwd))
			: sh(
					SUITE.vitest[0]!,
					[...SUITE.vitest.slice(1), ...files],
					join(dir, task.testCwd),
				);
	let total = 0;
	let failed = 0;
	if (task.runner === "bun") {
		const pass = Number(r.out.match(/(\d+) pass/)?.[1] ?? 0);
		failed = Number(r.out.match(/(\d+) fail/)?.[1] ?? 0);
		total = pass + failed;
	} else {
		const line = r.out.match(/Tests\s+(.+)\((\d+)\)/);
		total = Number(line?.[2] ?? 0);
		failed = Number(line?.[1]?.match(/(\d+) failed/)?.[1] ?? 0);
	}
	const valid = total === task.expectedTests;
	return {
		valid,
		passed: valid && r.code === 0 && failed === 0,
		fixed_fraction: valid
			? Math.max(0, (task.failingAtParent - failed) / task.failingAtParent)
			: 0,
		tests_total: total,
		tests_failed: failed,
		output_tail: r.out.slice(-3000),
	};
}

export async function trial(
	task: Task,
	arm: Arm,
	n: number,
	out: string,
	model: string,
	timeoutMs: number,
) {
	const id = `${task.id}__${arm}__${n}`;
	const dir = join("/tmp/cb-real", out.split("/").pop() ?? "run", id);
	const log = join(out, "transcripts", `${id}.jsonl`);
	mkdirSync(dirname(log), { recursive: true });
	const record: Record<string, unknown> = {
		id,
		task: task.id,
		arm,
		trial: n,
		model,
	};
	try {
		record.strip = prep(task, arm, dir);
		const agent = await runAgent(task, dir, log, model, timeoutMs);
		Object.assign(
			record,
			{ exit: agent.code, seconds: agent.seconds },
			transcriptStats(log),
		);
		const diff = agentDiff(dir);
		writeFileSync(join(out, "transcripts", `${id}.patch`), diff.patch);
		Object.assign(record, {
			files_changed: diff.files.length,
			comments_added: diff.comments_added,
			comments_removed: diff.comments_removed,
		});
		const s = score(task, dir);
		writeFileSync(join(out, "transcripts", `${id}.score.txt`), s.output_tail);
		Object.assign(record, {
			valid: s.valid,
			passed: s.passed,
			fixed_fraction: s.fixed_fraction,
			tests_total: s.tests_total,
			tests_failed: s.tests_failed,
		});
	} catch (e) {
		Object.assign(record, {
			valid: false,
			passed: false,
			error: String(e).slice(0, 2000),
		});
	} finally {
		rmSync(dir, { recursive: true, force: true });
		appendFileSync(join(out, "results.jsonl"), `${JSON.stringify(record)}\n`);
		console.log(
			JSON.stringify({
				id,
				passed: record.passed,
				valid: record.valid,
				error: record.error ? "yes" : undefined,
			}),
		);
	}
}

function flag(name: string, fallback: string): string {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

if (import.meta.main) {
	const suitePath = flag("suite", "");
	if (!suitePath)
		throw new Error(
			"usage: bun real/run.ts --suite <suite.ts> [--model m] [--trials n] [--tasks a,b]",
		);
	SUITE = await loadSuite(suitePath);
	const model = flag("model", "opus");
	const trials = Number(flag("trials", "1"));
	const concurrency = Number(flag("concurrency", "2"));
	const timeoutMs = Number(flag("timeout-min", "40")) * 60_000;
	const only = flag("tasks", "").split(",").filter(Boolean);
	const out = resolve(
		flag("out", join(HERE, "..", "outputs", `real_${Date.now()}`)),
	);
	mkdirSync(out, { recursive: true });
	const jobs: [Task, Arm, number][] = [];
	for (let n = 1; n <= trials; n++) {
		for (const task of SUITE.tasks.filter(
			(t) => !only.length || only.includes(t.id),
		)) {
			const arms = Math.random() < 0.5 ? [...ARMS] : [...ARMS].reverse();
			for (const arm of arms) jobs.push([task, arm, n]);
		}
	}
	writeFileSync(
		join(out, "manifest.json"),
		JSON.stringify(
			{
				model,
				trials,
				timeoutMs,
				jobs: jobs.map(([t, a, n]) => `${t.id}__${a}__${n}`),
				started: new Date().toISOString(),
			},
			null,
			2,
		),
	);
	let next = 0;
	await Promise.all(
		Array.from({ length: concurrency }, async () => {
			while (next < jobs.length) {
				const [task, arm, n] = jobs[next++]!;
				await trial(task, arm, n, out, model, timeoutMs);
			}
		}),
	);
	console.log(`done: ${out}`);
}
