---
name: comment-audit
description: Audit code comments and agent-facing docs against a repository's comment policy. Use when asked to review comments, audit stale or redundant comments, check AIDEV-NOTE anchors, evaluate comment-policy.md / CLAUDE.md / AGENTS.md compliance, or inspect changed files for comments that should be kept, deleted, updated, or investigated.
---

# Comment Audit

## Overview

Audit comments as prompt surface for future AI-assisted edits. The goal is not "more comments" or "fewer comments"; it is to preserve comments that carry information the code cannot recover and remove or repair comments that are redundant, vague, stale, or misleading.

Default to audit-only. Do not edit files unless the user explicitly asks for fixes.

## Workflow

1. **Load policy.** Read the repo's `comment-policy.md` if present. Also read relevant `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, or package-local policy files when they govern the audited path. If no local policy exists, use the fallback policy below.
2. **Choose scope.** If the user gives a file or directory, audit that. Otherwise audit changed files with `git diff --name-only --diff-filter=ACMR HEAD` and include staged files if relevant. If there is no git repo, ask for a scope.
3. **Skip noise.** Exclude dependencies, generated artifacts, lockfiles, vendored code, build outputs, minified files, snapshots, and test fixtures unless the user explicitly includes them.
4. **Detect language conventions.** Infer expectations from file extensions and local patterns. Do not apply TypeScript/JSDoc rules blindly to Python, Go, Rust, Java, or docs.
5. **Find candidate comments.** Use `rg` first for obvious comment markers and loaded terms. Then read nearby code before classifying.
6. **Classify each finding.** Use `keep`, `delete`, `update`, or `investigate`.
7. **Report.** Lead with the highest-risk findings. Include file, line, action, reason, and suggested replacement or next step.

## Fallback Policy

Use this only when the repo has no local policy.

- Keep comments that encode invariants, business rules, security constraints, compliance rules, non-local coupling, compatibility promises, or historical rationale the code cannot express.
- Delete comments that paraphrase the next line or restate obvious syntax.
- Update comments that are stale, misleading, vague, missing required annotations, or no longer match code behavior.
- Prefer specific comments near the code they constrain.
- Treat stale comments as bugs. In agent-heavy repos, stale comments can become bad input for the next agent run.
- Preserve public API documentation when the language ecosystem expects it, but verify it still matches behavior and types.

## Project-Specific Overlays

Local policy beats the fallback policy. If `comment-policy.md`, `CLAUDE.md`, `AGENTS.md`, or package docs define project-specific terms, enforce those definitions.

Common examples:

- `legacy` should say whether it means public compatibility, fallback behavior, old naming, or dead code.
- `deprecated` should name the replacement and removal policy.
- `temporary` should name the removal condition, issue, owner, or deadline.
- `compat-fallback` should name the trigger, normal path, and retirement condition.
- `removed-dead` or equivalent terms should not survive in comments that describe current behavior.

Do not generalize these labels across projects. Read the local policy first and use the repo's vocabulary.

## Classification

Use these labels:

- `keep` - The comment carries real context the code cannot recover, is accurate, and is placed where future edits will see it.
- `delete` - The comment restates nearby code, adds generic filler, or creates noise with no recoverable value.
- `update` - The comment is useful in principle but stale, vague, too far from the constrained code, or missing required project-specific metadata.
- `investigate` - The comment makes a claim that cannot be verified locally. Name what must be checked.

Prefer `investigate` over guessing when a comment refers to product, legal, compliance, migration, or incident context that is not in the repo.

## Language Awareness

Apply the repo policy through the conventions of the file being audited:

- **TypeScript / JavaScript**: JSDoc may define public API, generated docs, typedefs, deprecation contracts, or consumer-facing behavior. Deletion threshold is higher for exported symbols.
- **Python**: Docstrings can be runtime help, API docs, or behavior contracts. Check whether tests, callers, or generated docs rely on them.
- **Go**: Public package, type, function, and method comments are part of Go documentation conventions. Do not delete solely because they restate a name.
- **Rust**: `///` and `//!` comments may include examples, docs, and doctests. Verify examples still compile conceptually.
- **Java / Kotlin / C#**: Doc comments may define API contracts and generated documentation. Check `@deprecated`, replacement links, and version/removal notes.
- **Markdown / agent docs**: `CLAUDE.md`, `AGENTS.md`, README architecture notes, and policy docs are prompt surface. Stale statements here can be higher risk than inline comments.

Do not require every language to follow `AIDEV-NOTE:`. Treat it as one useful convention, not a universal syntax.

## Cheap Pre-Pass

Use `rg` to find likely issues before deeper reading. Adapt patterns to the repo.

Useful searches:

```bash
rg -n "AIDEV-NOTE|TODO|FIXME|HACK|temporary|deprecated|legacy|compat|fallback|workaround|remove|delete|old|special handling|returns the appropriate|helper function" .
rg -n "@deprecated|@todo|@fixme|@internal|@public" .
rg -n "for now|eventually|later|soon|should be removed|no longer used|not used|dead code" .
```

Flag these common problems:

- Bare `temporary`, `for now`, or `workaround` with no issue, owner, or removal condition.
- Bare `@deprecated` with no replacement or removal/version policy.
- `legacy` without explaining whether it means public compatibility, dead code, old name, or fallback.
- Vague warnings such as "special handling", "be careful", or "business logic" with no rule, file, symbol, or consequence.
- Generic AI-style comments such as "returns the appropriate value", "helper function", or "processes the data".
- Comments naming symbols, files, feature flags, APIs, or migrations that no longer exist.
- Comments far from the code they constrain, especially when the constrained code is likely to be edited without reading the header.

## Reading Nearby Code

For each candidate comment:

1. Read at least the surrounding function/class/module.
2. Check referenced symbols or files when named.
3. Check tests or callers when the comment states behavior not obvious from the local code.
4. Check recent diff context if auditing changed files.
5. Distinguish "stale comment" from "code bug": if the comment documents a real policy and code violates it, classify as `investigate` or `update code?` rather than deleting the comment.

## Output Format

Use this structure:

```text
Comment audit: <scope>

Summary
- keep: <n>
- delete: <n>
- update: <n>
- investigate: <n>

Findings
1. <action> <file>:<line>
   Comment: <short excerpt>
   Reason: <one or two sentences>
   Suggested action: <delete/update text/check X>

Notes
- <policy gaps, language-specific caveats, or files skipped>
```

If there are no findings, say that clearly and name the residual risk, for example: "No high-signal issues found in changed files. This did not audit unchanged architecture docs."

## Fix Mode

If the user asks to apply fixes:

1. Apply only low-risk deletes or local wording updates.
2. Do not invent business, legal, security, or historical context.
3. Preserve public API docs unless replacement wording is clearly known.
4. Leave `investigate` items as report findings unless the user provides the missing context.
5. After edits, summarize changed files and remaining risks.
