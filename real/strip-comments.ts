import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const DIRECTIVE =
	/^(?:\/\/\/?|\/\*+)\s*(?:@ts-(?:expect-error|ignore|check|nocheck)\b|[@#]__PURE__|[@#]__NO_SIDE_EFFECTS__|@vitest-environment\b|@vite-ignore\b|@jsxImportSource\b|webpack[A-Z]\w*:|(?:eslint|oxlint|biome)-(?:disable|enable|ignore)\b|biome-ignore\b|prettier-ignore\b|istanbul\s|c8\s|v8\s|<reference\s|global\s|jshint|jscs)/;

export const STRIPPABLE = /\.(?:[cm]?[jt]s|[jt]sx)$/;

function scriptKind(file: string): ts.ScriptKind {
	if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
	if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
	if (/\.[cm]?js$/.test(file)) return ts.ScriptKind.JS;
	return ts.ScriptKind.TS;
}

const isJSDoc = (node: ts.Node): boolean =>
	node.kind >= ts.SyntaxKind.FirstJSDocNode &&
	node.kind <= ts.SyntaxKind.LastJSDocNode;

function commentRanges(source: string, file: string): [number, number][] {
	const sf = ts.createSourceFile(
		file,
		source,
		ts.ScriptTarget.Latest,
		true,
		scriptKind(file),
	);
	const found = new Map<number, number>();
	const jsxText: [number, number][] = [];
	const visit = (node: ts.Node): void => {
		if (isJSDoc(node)) return;
		if (node.kind === ts.SyntaxKind.JsxText) {
			jsxText.push([node.pos, node.end]);
			return;
		}
		for (const r of [
			...(ts.getLeadingCommentRanges(source, node.pos) ?? []),
			...(ts.getTrailingCommentRanges(source, node.pos) ?? []),
		]) {
			found.set(r.pos, r.end);
		}
		for (const child of node.getChildren(sf)) visit(child);
	};
	visit(sf);
	const eof = sf.endOfFileToken;
	for (const r of ts.getLeadingCommentRanges(source, eof.pos) ?? []) {
		found.set(r.pos, r.end);
	}
	return [...found]
		.filter(([pos]) => !jsxText.some(([s, e]) => pos >= s && pos < e))
		.filter(([pos, end]) => !DIRECTIVE.test(source.slice(pos, end)))
		.sort((a, b) => a[0] - b[0]);
}

export type KeepRule = (comment: string) => boolean;

const SPEC_REF =
	/§\s*\d|\bECMA-\d{3}\b|\bISO\/IEC\s*\d{4,5}\b|\bRFC\s?\d{3,5}\b/;
const ISSUE_REF =
	/https?:\/\/\S*(?:\/issues\/\d+|\/pull\/\d+|crbug\.com\/\d+|bugs\.\S+|bugzilla\S*|issuetracker\S*)/i;

export function referenceRule(ticket: RegExp, maxLines = 2): KeepRule {
	return (comment) =>
		comment.split("\n").length <= maxLines &&
		(ticket.test(comment) || SPEC_REF.test(comment) || ISSUE_REF.test(comment));
}

function blocks(
	source: string,
	ranges: [number, number][],
): [number, number][][] {
	const out: [number, number][][] = [];
	for (const range of ranges) {
		const current = out.at(-1);
		const last = current?.at(-1);
		if (
			current &&
			last &&
			/^[ \t]*\n[ \t]*$/.test(source.slice(last[1], range[0]))
		) {
			current.push(range);
		} else {
			out.push([range]);
		}
	}
	return out;
}

function removable(
	source: string,
	file: string,
	keep?: KeepRule,
): [number, number][] {
	const ranges = commentRanges(source, file);
	if (!keep) return ranges;
	return blocks(source, ranges)
		.filter((b) => !keep(source.slice(b[0]?.[0], b.at(-1)?.[1])))
		.flat();
}

export function countComments(source: string, file: string): number {
	const body = source.startsWith("#!")
		? source.slice(source.indexOf("\n") + 1)
		: source;
	return commentRanges(body, file).length;
}

export function stripComments(
	source: string,
	file: string,
	keep?: KeepRule,
): string {
	const shebang = source.startsWith("#!")
		? source.slice(0, source.indexOf("\n") + 1)
		: "";
	const body = source.slice(shebang.length);
	let out = "";
	let cursor = 0;
	for (const [pos, end] of removable(body, file, keep)) {
		if (pos < cursor) continue;
		const lineStart = body.lastIndexOf("\n", pos - 1) + 1;
		const nl = body.indexOf("\n", end);
		const lineEnd = nl === -1 ? body.length : nl;
		const before = body.slice(lineStart, pos);
		const after = body.slice(end, lineEnd);
		if (lineStart >= cursor && /^\s*$/.test(before) && /^\s*$/.test(after)) {
			out += body.slice(cursor, lineStart);
			cursor = nl === -1 ? body.length : nl + 1;
			continue;
		}
		const left = body[pos - 1] ?? " ";
		const right = body[end] ?? " ";
		const glue = /\s/.test(left) || /\s/.test(right) ? "" : " ";
		out += body.slice(cursor, pos).replace(/[ \t]+$/, "") + glue;
		cursor = end;
		if (/^[ \t]*$/.test(after)) {
			cursor = lineEnd;
		}
	}
	return shebang + out + body.slice(cursor);
}

function tokens(source: string, file: string): string[] {
	const sf = ts.createSourceFile(
		file,
		source,
		ts.ScriptTarget.Latest,
		true,
		scriptKind(file),
	);
	const out: string[] = [];
	const visit = (node: ts.Node): void => {
		if (isJSDoc(node)) return;
		const children = node.getChildren(sf);
		if (children.length === 0) {
			const text =
				node.kind === ts.SyntaxKind.JsxText
					? node.getText(sf).trim()
					: node.getText(sf);
			if (text) out.push(`${node.kind}:${text}`);
			return;
		}
		for (const child of children) visit(child);
	};
	visit(sf);
	return out;
}

export function sameCode(before: string, after: string, file: string): boolean {
	const a = tokens(before, file);
	const b = tokens(after, file);
	return a.length === b.length && a.every((t, i) => t === b[i]);
}

export function stripFile(
	path: string,
	keep?: KeepRule,
): {
	changed: boolean;
	removed: number;
	kept: number;
	identical: boolean;
} {
	const before = readFileSync(path, "utf8");
	const body = before.startsWith("#!")
		? before.slice(before.indexOf("\n") + 1)
		: before;
	const total = commentRanges(body, path).length;
	const ranges = removable(body, path, keep);
	if (ranges.length === 0)
		return { changed: false, removed: 0, kept: total, identical: true };
	const after = stripComments(before, path, keep);
	writeFileSync(path, after);
	return {
		changed: after !== before,
		removed: ranges.length,
		kept: total - ranges.length,
		identical: sameCode(before, after, path),
	};
}
