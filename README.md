# Comment Bench

[![Release](https://img.shields.io/github/v/release/caiopizzol/comment-bench?label=release)](https://github.com/caiopizzol/comment-bench/releases)

Measures whether inline comments steer AI coding agents on small surgical edits.

The deliverable is [`comment-policy.md`](comment-policy.md). Drop it into your `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, or any agent-instruction file.

Blog post: [Comments only matter when they encode information the code does not](https://caiopizzol.com/posts/comments-matter-when-the-code-does-not). What the benchmark probes: [`RESULTS.md`](RESULTS.md).

## Use this in your repo

```bash
curl -O https://raw.githubusercontent.com/caiopizzol/comment-bench/main/comment-policy.md
```

`@`-import it from your `CLAUDE.md` / `AGENTS.md`, or paste the contents in.

## Run the benchmark on any model

Model-agnostic. Two commands: `prep` a workspace for the agent to edit, `score` the result against hidden tests. The middle step is yours.

```bash
git clone https://github.com/caiopizzol/comment-bench
cd comment-bench
bun install
```

```bash
# List scenarios
bun benchmark.ts list

# Prep a workspace for a (scenario, treatment) pair
bun benchmark.ts prep refund_window_branch human_why_inline --out /tmp/work

# Run YOUR agent on /tmp/work however you want. The agent reads task.md
# and edits the file(s) listed under `editable` in meta.ts.
#   Claude Code:  cd /tmp/work && claude
#   Cursor:       open /tmp/work, point Cursor at task.md
#   Codex CLI:    codex exec --cd /tmp/work
#   Aider:        cd /tmp/work && aider
#   Manual edit:  edit /tmp/work/src/refunds.ts yourself for a sanity check

# Score the result
bun benchmark.ts score refund_window_branch /tmp/work
```

`score` exits 0 if both task and invariant passed, 1 otherwise.

## What's in a scenario

```
scenarios/<id>/
  meta.ts                 metadata: agent_visible files, editable files, trap, invariant
  task.md                 agent-visible task description
  src/                    (optional) read-only files visible to the agent
  treatments/             seven comment payload variants
    <treatment>/src/<file>.ts
  oracle/                 hidden tests, never shown to the agent
    feature.test.ts       did the new feature work
    invariant.test.ts     did the protected invariant hold
```

The seven treatments (only the comment payload varies):

- `none` - no comment
- `what_paraphrase` - restates what the code does
- `human_why_inline` - precise intent at point of use
- `human_file_header` - module-level rule listing
- `aidev_anchor` - tagged as `// AIDEV-NOTE:`
- `ai_generated_comment` - generic plausible AI-style docstring
- `stale_misleading` - comment contradicts the code or rule

## The scenarios

All four use the gift-card refund domain. They differ in where the 24-hour gift-card cap is enforced.

| id | where the cap lives |
|---|---|
| `refund_window_branch` | inside an `if (order.productType === "gift_card")` branch |
| `refund_window_accumulator` | applied via `Math.min(window, processorCap)` after tier selection |
| `refund_window_helper` | inside a sibling helper (`capRefundWindow`) imported from `./processor_rules` |
| `refund_window_comment_only` | nowhere in the code; lives only in the comment payload |

The first three test "comments did nothing" - the cap is in the code, the agent preserves it regardless of comment. The fourth tests "comments decided everything" - the cap exists only in the comment, so the comment payload determines whether the agent honors it.

## Adding a scenario

1. Copy any directory under `scenarios/`.
2. Edit `task.md`, the seven treatments, and the oracle tests.
3. Update `meta.ts`: list every agent-visible file under `agent_visible`, every editable file under `editable`.
4. The trap should fire on a tempting wrong fix and pass on the right one. Validate the canonical (`none`) treatment plus a manually-applied wrong fix against the oracle before launching trial sweeps.

## Limitations

- Single-shot edits in small workspaces. Multi-turn sessions and large repos are out of scope.
- Tests are TypeScript via Bun. The benchmark idea is language-agnostic; port the scenarios to run against Python or Go.

## License

MIT. See [LICENSE](LICENSE).
