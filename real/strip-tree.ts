import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { STRIPPABLE, stripFile } from "./strip-comments";

export type StripReport = {
	files: number;
	changed: number;
	comments: number;
	mismatched: string[];
	failed: string[];
};

export function stripTree(root: string, keep: Set<string>): StripReport {
	const files = execFileSync("git", ["ls-files", "-z"], {
		cwd: root,
		encoding: "utf8",
		maxBuffer: 256 * 1024 * 1024,
	})
		.split("\0")
		.filter((f) => STRIPPABLE.test(f) && !f.endsWith(".d.ts") && !keep.has(f));
	const report: StripReport = {
		files: files.length,
		changed: 0,
		comments: 0,
		mismatched: [],
		failed: [],
	};
	for (const file of files) {
		try {
			const r = stripFile(join(root, file));
			if (r.changed) report.changed++;
			report.comments += r.removed;
			if (!r.identical) report.mismatched.push(file);
		} catch {
			report.failed.push(file);
		}
	}
	return report;
}

if (import.meta.main) {
	const root = process.argv[2];
	if (!root) throw new Error("usage: bun real/strip-tree.ts <git-root>");
	const report = stripTree(root, new Set());
	console.log(
		JSON.stringify(
			{
				...report,
				mismatched: report.mismatched.slice(0, 20),
				failed: report.failed.slice(0, 20),
			},
			null,
			2,
		),
	);
}
