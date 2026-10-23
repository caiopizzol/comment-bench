#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { trial, useSuite } from "./run";
import { loadSuite, type Task } from "./suite";

type Validated = {
	fix: string;
	ticket: string;
	usable: boolean;
	installDir: string;
	testCwd: string;
	runner: Task["runner"];
	parent: { total: number; failed: number };
};

function flag(name: string, fallback: string): string {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

if (import.meta.main) {
	const suitePath = flag("suite", "");
	const validatedPath = flag("validated", "");
	if (!suitePath || !validatedPath) {
		throw new Error(
			"usage: bun real/calibrate.ts --suite <suite.ts> --validated <validated.jsonl> [--model m] [--trials n]",
		);
	}
	const suite = await loadSuite(suitePath);
	const missing = (t: string) => !existsSync(join(suite.ticketsDir, `${t}.md`));
	const tasks: Task[] = readFileSync(validatedPath, "utf8")
		.split("\n")
		.filter(Boolean)
		.map((l) => JSON.parse(l) as Validated)
		.filter((v) => v.usable && v.ticket && !missing(v.ticket))
		.filter((v) => !suite.tasks.some((t) => t.fix === v.fix))
		.map((v) => ({
			id: `${v.ticket.toLowerCase()}-${v.fix.slice(0, 6)}`,
			fix: v.fix,
			ticket: v.ticket,
			installDir: v.installDir,
			testCwd: v.testCwd,
			runner: v.runner,
			expectedTests: v.parent.total,
			failingAtParent: v.parent.failed,
		}));
	useSuite({ ...suite, tasks });
	const model = flag("model", "sonnet");
	const trials = Number(flag("trials", "1"));
	const concurrency = Number(flag("concurrency", "3"));
	const out = resolve(
		flag(
			"out",
			join(import.meta.dir, "..", "outputs", `calibrate_${Date.now()}`),
		),
	);
	mkdirSync(out, { recursive: true });
	writeFileSync(join(out, "tasks.json"), JSON.stringify(tasks, null, 2));
	const jobs = tasks.flatMap((t) =>
		Array.from({ length: trials }, (_, n) => [t, n + 1] as const),
	);
	let next = 0;
	await Promise.all(
		Array.from({ length: concurrency }, async () => {
			while (next < jobs.length) {
				const [task, n] = jobs[next++]!;
				await trial(task, "comments", n, out, model, 30 * 60_000);
			}
		}),
	);
	console.log(`done: ${out} (${tasks.length} tasks)`);
}
