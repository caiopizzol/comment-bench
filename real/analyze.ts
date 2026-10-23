#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Row = {
	task: string;
	arm: "comments" | "stripped";
	model: string;
	valid: boolean;
	passed: boolean;
	fixed_fraction?: number;
	input_tokens?: number;
	output_tokens?: number;
	tool_calls?: number;
	reads?: number;
	searches?: number;
	seconds?: number;
	comments_added?: number;
	suspicious_lookups?: number;
};

const mean = (xs: number[]) =>
	xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN;

function bootstrap(
	pairs: [number[], number[]][],
	stat: (a: number[], b: number[]) => number,
	n = 4000,
): [number, number] {
	const draws: number[] = [];
	for (let i = 0; i < n; i++) {
		let a: number[] = [];
		let b: number[] = [];
		for (let k = 0; k < pairs.length; k++) {
			const [ca, cb] = pairs[Math.floor(Math.random() * pairs.length)]!;
			a = a.concat(ca.map(() => ca[Math.floor(Math.random() * ca.length)]!));
			b = b.concat(cb.map(() => cb[Math.floor(Math.random() * cb.length)]!));
		}
		const v = stat(a, b);
		if (Number.isFinite(v)) draws.push(v);
	}
	draws.sort((x, y) => x - y);
	return [
		draws[Math.floor(draws.length * 0.025)]!,
		draws[Math.floor(draws.length * 0.975)]!,
	];
}

function report(dir: string) {
	const rows: Row[] = readFileSync(join(dir, "results.jsonl"), "utf8")
		.split("\n")
		.filter(Boolean)
		.map((l) => JSON.parse(l));
	const valid = rows.filter((r) => r.valid);
	const model = rows[0]?.model ?? "?";
	console.log(`\n## ${model} (${dir.split("/").pop()})`);
	console.log(
		`trials: ${rows.length}, valid: ${valid.length}, looked outside snapshot: ${rows.filter((r) => (r.suspicious_lookups ?? 0) > 0).length}`,
	);
	const tasks = [...new Set(valid.map((r) => r.task))].sort();
	const metric = (r: Row, k: keyof Row) => Number(r[k] ?? 0);
	const keys: (keyof Row)[] = [
		"passed",
		"fixed_fraction",
		"input_tokens",
		"tool_calls",
		"seconds",
		"comments_added",
	];
	console.log(`\n| task | arm | n | ${keys.join(" | ")} |`);
	console.log(`|---|---|---|${keys.map(() => "---").join("|")}|`);
	for (const t of tasks) {
		for (const arm of ["comments", "stripped"] as const) {
			const g = valid.filter((r) => r.task === t && r.arm === arm);
			const cells = keys.map((k) => {
				const v = mean(g.map((r) => metric(r, k)));
				return k === "input_tokens" ? `${Math.round(v / 1000)}k` : v.toFixed(2);
			});
			console.log(`| ${t} | ${arm} | ${g.length} | ${cells.join(" | ")} |`);
		}
	}
	const pairs = (k: keyof Row) =>
		tasks
			.map(
				(t) =>
					[
						valid
							.filter((r) => r.task === t && r.arm === "comments")
							.map((r) => metric(r, k)),
						valid
							.filter((r) => r.task === t && r.arm === "stripped")
							.map((r) => metric(r, k)),
					] as [number[], number[]],
			)
			.filter(([a, b]) => a.length && b.length);
	console.log(
		"\nEffect of stripping comments (stripped minus comments), task-clustered bootstrap 95% CI:",
	);
	for (const k of ["passed", "fixed_fraction"] as (keyof Row)[]) {
		const p = pairs(k);
		const diff = (a: number[], b: number[]) => mean(b) - mean(a);
		const point = diff(
			p.flatMap((x) => x[0]),
			p.flatMap((x) => x[1]),
		);
		const [lo, hi] = bootstrap(p, diff);
		console.log(
			`- ${k}: ${(point * 100).toFixed(1)}pp [${(lo * 100).toFixed(1)}, ${(hi * 100).toFixed(1)}]`,
		);
	}
	for (const k of ["input_tokens", "tool_calls", "seconds"] as (keyof Row)[]) {
		const p = pairs(k);
		const ratio = (a: number[], b: number[]) => mean(b) / mean(a) - 1;
		const point = ratio(
			p.flatMap((x) => x[0]),
			p.flatMap((x) => x[1]),
		);
		const [lo, hi] = bootstrap(p, ratio);
		console.log(
			`- ${k}: ${(point * 100).toFixed(1)}% [${(lo * 100).toFixed(1)}, ${(hi * 100).toFixed(1)}]`,
		);
	}
}

for (const dir of process.argv.slice(2)) report(dir);
