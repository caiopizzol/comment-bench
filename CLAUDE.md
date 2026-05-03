# Comment Bench

A benchmark for whether inline comments steer AI coding agents on small surgical edits.

## Comments

Follow `comment-policy.md`. This repo **is** the policy - anything here that violates it is a bug. Use `AIDEV-NOTE:` anchors for rules that must survive future agent edits. Treat stale comments as bugs.

## Scenarios are fixtures

`scenarios/**` files are load-bearing experimental data. Treatment directories deliberately contain bad comments (paraphrases, stale, generic AI-style). That's the experiment. Don't "improve" them. Biome lint is intentionally disabled on `scenarios/**` via `biome.json`; don't re-enable.

The seven comment treatments per scenario must stay aligned: same code shape, only the comment payload varies. If you change one, change them all.

## Oracle tests don't run on canonicals

`scenarios/<id>/oracle/feature.test.ts` and `invariant.test.ts` are designed to fail against canonical code (that's the trap). They run only via `bun benchmark.ts score` against a prepped + agent-edited `/tmp/work` directory. Don't add them to `bun test` defaults or pre-commit.

`tsconfig.json` excludes `scenarios/` from typecheck for the same reason - the canonical files have intentional gaps.

## Conventional commits

`semantic-release` reads commit messages on `main`:
- `feat:` -> minor bump
- `fix:` -> patch bump
- `BREAKING CHANGE:` in body -> major bump
- `chore:`, `docs:`, `ci:` -> no release

## Tooling

Bun + TypeScript strict + Biome for format/lint + Lefthook pre-commit (typecheck + `biome check`). semantic-release with `semantic-release-ai-notes` runs on push to `main` via `.github/workflows/release.yml`. CI checks run on every PR via `.github/workflows/ci.yml`.
