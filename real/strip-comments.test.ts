import { describe, expect, it } from "bun:test";
import { referenceRule, sameCode, stripComments } from "./strip-comments";

const strip = (src: string, file = "f.ts") => stripComments(src, file);

describe("stripComments", () => {
	it("removes whole-line, trailing, and block comments", () => {
		const src = [
			"// header",
			"/**",
			" * doc",
			" */",
			"export const a = 1; // trailing",
			"const b = /* inline */ 2;",
			"",
		].join("\n");
		expect(strip(src)).toBe("export const a = 1;\nconst b = 2;\n");
	});

	it("keeps directives and strings that look like comments", () => {
		const src = [
			"// @ts-expect-error legacy",
			"const url = 'http://x//y';",
			"const re = /\\/\\/a/;",
			"const t = `/* not a comment */`;",
			"",
		].join("\n");
		expect(strip(src)).toBe(src);
	});

	it("never merges tokens when removing an inline comment", () => {
		const src = "const x = a/**/+b;\n";
		const out = strip(src);
		expect(sameCode(src, out, "f.ts")).toBe(true);
	});

	it("handles jsx comment expressions", () => {
		const src = "const v = <div>{/* note */}<span /></div>;\n";
		const out = strip(src, "f.tsx");
		expect(out).not.toContain("note");
		expect(sameCode(src, out, "f.tsx")).toBe(true);
	});

	it("keeps the shebang", () => {
		const src = "#!/usr/bin/env node\n// hi\nrun();\n";
		expect(strip(src, "f.mjs")).toBe("#!/usr/bin/env node\nrun();\n");
	});
});

describe("sameCode", () => {
	it("detects a real code change", () => {
		expect(sameCode("const a = 1;", "const a = 2;", "f.ts")).toBe(false);
	});
});

describe("jsdoc", () => {
	it("treats JSDoc blocks as comments, not code", () => {
		const src = "/**\n * Doc with http://x.y\n */\nexport const a = 1;\n";
		const out = stripComments(src, "f.ts");
		expect(out).toBe("export const a = 1;\n");
		expect(sameCode(src, out, "f.ts")).toBe(true);
	});
});

describe("referenceRule", () => {
	const keep = referenceRule(/\bSD-\d+\b/);
	const src = [
		"// SD-1234: Word drops empty runs here, so we keep one.",
		"const a = 1;",
		"// Per §17.11.23 the separator spans part of the extent.",
		"const b = 2;",
		"// We loop here because the list can be empty.",
		"const c = 3;",
		"// SD-99 started this, but the rest of the story is long",
		"// and goes on for several lines explaining history",
		"// that no longer matters to anyone.",
		"const d = 4;",
		"/* see https://github.com/acme/repo/issues/42 */",
		"const e = 5;",
		"",
	].join("\n");

	it("keeps short reference comments and drops everything else", () => {
		const out = stripComments(src, "f.ts", keep);
		expect(out).toContain("SD-1234");
		expect(out).toContain("§17.11.23");
		expect(out).toContain("issues/42");
		expect(out).not.toContain("We loop here");
		expect(out).not.toContain("SD-99");
		expect(sameCode(src, out, "f.ts")).toBe(true);
	});

	it("leaves directives alone", () => {
		const d = "// @ts-expect-error x\nconst a: number = 'x';\n";
		expect(stripComments(d, "f.ts", keep)).toBe(d);
	});
});
