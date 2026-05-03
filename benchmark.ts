#!/usr/bin/env bun
// AIDEV-NOTE: Model-agnostic by design. `prep` and `score` are the only two
// commands; the agent edit between them is intentionally external. Don't add
// SDK dependencies, model-specific runners, or built-in agent loops - that
// breaks the "any model" property the benchmark exists to test.
import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir);
const SCENARIOS_DIR = join(ROOT, "scenarios");

const TREATMENTS = [
	"none",
	"what_paraphrase",
	"human_why_inline",
	"human_file_header",
	"aidev_anchor",
	"ai_generated_comment",
	"stale_misleading",
] as const;

type Treatment = (typeof TREATMENTS)[number];

type Meta = {
	id: string;
	description?: string;
	mechanism?: string;
	domain?: string;
	agent_visible: string[];
	editable: string[];
	trap?: string;
	invariant?: string;
};

function die(msg: string): never {
	console.error(msg);
	process.exit(1);
}

async function loadMeta(scenario: string): Promise<Meta> {
	const path = join(SCENARIOS_DIR, scenario, "meta.ts");
	if (!existsSync(path)) die(`unknown scenario: ${scenario}`);
	const mod = await import(path);
	return mod.default as Meta;
}

function listScenarios(): string[] {
	if (!existsSync(SCENARIOS_DIR)) return [];
	return readdirSync(SCENARIOS_DIR)
		.filter((name) => existsSync(join(SCENARIOS_DIR, name, "meta.ts")))
		.sort();
}

function copyFile(src: string, dest: string): void {
	mkdirSync(dirname(dest), { recursive: true });
	cpSync(src, dest);
}

function isDir(path: string): boolean {
	return existsSync(path) && statSync(path).isDirectory();
}

async function prep(
	scenario: string,
	treatment: string,
	out: string,
): Promise<void> {
	if (!TREATMENTS.includes(treatment as Treatment)) {
		die(`unknown treatment: ${treatment}`);
	}
	const meta = await loadMeta(scenario);
	const sc = join(SCENARIOS_DIR, scenario);
	const treatDir = join(sc, "treatments", treatment);
	if (!isDir(treatDir)) die(`${scenario} has no treatment: ${treatment}`);

	if (existsSync(out) && readdirSync(out).length > 0) {
		die(`--out exists and is not empty: ${out}`);
	}
	mkdirSync(out, { recursive: true });

	for (const rel of meta.agent_visible) {
		const candidates = [
			rel === "task.md" ? join(sc, "task.md") : null,
			join(treatDir, rel),
			join(sc, "shared", rel),
			join(sc, rel),
		].filter((p): p is string => p !== null);

		const src = candidates.find((p) => existsSync(p));
		if (!src) {
			rmSync(out, { recursive: true, force: true });
			die(`${scenario}/${treatment}: cannot resolve visible file ${rel}`);
		}
		copyFile(src, join(out, rel));
	}

	console.log(`workspace ready: ${out}`);
	console.log(`task:            ${join(out, "task.md")}`);
	console.log(`editable:        ${meta.editable.join(", ")}`);
}

type SuiteResult = { pass: number; fail: number; raw: string };

function runBunTest(testFile: string, cwd: string): SuiteResult {
	const proc = spawnSync("bun", ["test", testFile], {
		cwd,
		encoding: "utf-8",
	});
	const raw = (proc.stdout ?? "") + (proc.stderr ?? "");
	const pass = parseInt(raw.match(/(\d+) pass/)?.[1] ?? "0", 10);
	const fail = parseInt(raw.match(/(\d+) fail/)?.[1] ?? "0", 10);
	return { pass, fail, raw };
}

function failureLines(raw: string): string[] {
	return raw
		.split("\n")
		.filter((line) => line.includes("(fail)"))
		.map((line) => line.trim());
}

async function score(scenario: string, workspace: string): Promise<void> {
	const meta = await loadMeta(scenario);
	const sc = join(SCENARIOS_DIR, scenario);
	if (!isDir(workspace)) die(`workspace not a directory: ${workspace}`);

	const scoreDir = join(
		"/tmp",
		`cb_score_${Math.random().toString(16).slice(2, 10)}`,
	);
	mkdirSync(scoreDir, { recursive: true });
	try {
		const sourceFiles = meta.agent_visible.filter((f) => f !== "task.md");
		for (const rel of sourceFiles) {
			const src = join(workspace, rel);
			if (!existsSync(src)) die(`missing source file in workspace: ${rel}`);
			copyFile(src, join(scoreDir, rel));
		}
		const oracle = join(sc, "oracle");
		copyFile(
			join(oracle, "feature.test.ts"),
			join(scoreDir, "oracle/feature.test.ts"),
		);
		copyFile(
			join(oracle, "invariant.test.ts"),
			join(scoreDir, "oracle/invariant.test.ts"),
		);

		const feature = runBunTest("oracle/feature.test.ts", scoreDir);
		const invariant = runBunTest("oracle/invariant.test.ts", scoreDir);

		const taskDone = feature.fail === 0;
		const invariantHeld = invariant.fail === 0;
		console.log(`task_done:       ${taskDone}`);
		console.log(`invariant_held:  ${invariantHeld}`);
		if (!invariantHeld) {
			const failures = failureLines(invariant.raw);
			if (failures.length > 0) {
				console.log("invariant failures:");
				for (const f of failures) console.log(`  ${f}`);
			}
		}
		process.exit(taskDone && invariantHeld ? 0 : 1);
	} finally {
		rmSync(scoreDir, { recursive: true, force: true });
	}
}

async function list(): Promise<void> {
	for (const s of listScenarios()) {
		const meta = await loadMeta(s);
		const label = meta.mechanism ?? meta.domain ?? "";
		console.log(`${s.padEnd(36)} ${label}`);
	}
}

const args = process.argv.slice(2);
const cmd = args[0];

function parseFlag(name: string): string | undefined {
	const idx = args.indexOf(`--${name}`);
	if (idx < 0 || idx + 1 >= args.length) return undefined;
	return args[idx + 1];
}

switch (cmd) {
	case "list":
		await list();
		break;
	case "prep": {
		const scenario = args[1];
		const treatment = args[2];
		const out = parseFlag("out");
		if (!scenario || !treatment || !out) {
			die("usage: bun benchmark.ts prep <scenario> <treatment> --out <dir>");
		}
		await prep(scenario, treatment, resolve(out));
		break;
	}
	case "score": {
		const scenario = args[1];
		const workspace = args[2];
		if (!scenario || !workspace) {
			die("usage: bun benchmark.ts score <scenario> <workspace>");
		}
		await score(scenario, resolve(workspace));
		break;
	}
	default:
		console.error(
			"usage: bun benchmark.ts <list|prep|score> [...]",
			"\n",
			"  list                                              list scenarios",
			"\n",
			"  prep <scenario> <treatment> --out <dir>           prep workspace",
			"\n",
			"  score <scenario> <workspace>                      score workspace",
		);
		process.exit(1);
}
