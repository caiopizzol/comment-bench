# Comment Bench v2: what comments are worth to agents

v1 asked whether a comment can steer an agent on a one-file edit. v2 asks what
comments are worth to an agent working in a real codebase, and when.

This file is written before v2 data exists. Hypotheses and decision rules here
are fixed in advance; results go in a separate file.

## What v1 showed, and didn't

Verified 2026-10-23 against the repo and the May pilot outputs.

- The `comment_only` split (inline 3/3, anchor 3/3, others 0/3) is the only
  measured comment effect. Fisher exact p = 0.10 two-sided; 95% interval for
  3/3 is 29-100%. It shows a comment can supply a missing requirement. It
  does not show how often that matters in real work.
- `AIDEV-NOTE` was never separated from placement. Tagged and untagged
  inline comments sat in the same place and both scored 3/3.
- The file-header failure is "read but not followed", not "not found": the
  file is 37 lines. Header and inline payloads also differ in length and
  content, so placement is confounded.
- Stale comments could not show harm: the `none` baseline was already 0.
- The `comment_only` oracle accepts a wrong rule (24h cap only for expedited
  gift cards). `score` reads pass counts from output and ignores the exit
  code; a module calling `process.exit(0)` on import scores as a pass.
- The May `folder_prompt` run: inline 5/5, header 1/5, anchor 0/5. The anchor
  failures obeyed the doc but wrote `"gift-card"` because the doc never named
  the literal `"gift_card"`. 46 other May runs died on "Credit balance is too
  low" and were scored anyway.

## Track 1: real tasks, comments on vs off

The primary measurement. It answers "what are this codebase's comments worth
to an agent" directly, on code no model trained on.

**Tasks.** Past fix commits in a private production monorepo that change 1-4
source files and add or change unit tests. The agent starts at the parent
commit with the original ticket text as its task. The fix commit's tests are
the hidden oracle. Every task is validated before use: the oracle fails at
the parent and passes with the real fix, with the expected test count.

**Arms.** Same snapshot, same task:

| Arm | Snapshot |
| --- | --- |
| `comments` | Repository as it was |
| `stripped` | Every non-directive comment removed from every JS/TS file |

The stripper is checked on every snapshot: each file's syntax-tree tokens
must be identical before and after. On a full snapshot of that monorepo it removes
140,762 comments from 6,980 files with zero token mismatches.

**Metrics per trial.** Oracle pass (valid only if the expected tests ran),
input and output tokens, turns, wall time, files read, searches, files
changed, comments added and removed by the agent, and whether the agent
looked outside the snapshot.

**Analysis.** Paired by task: the effect is the per-task difference in pass
rate and tokens between arms, aggregated with task as a random effect.

**Later arms**, once the pair works: comments stripped only near the edited
code; only stale comments stripped; only ticket refs and one-line whys kept;
a second codebase.

## Track 2: lab scenarios

Synthetic fixtures for questions real tasks can't isolate. Each module varies
one or two factors around a fixed default (5-file package, ticket-style task,
add-feature operation, single shot, no instruction files, no visible tests).

| Module | Varies |
| --- | --- |
| A. Where the rule lives | none, task prompt, code guard, unused constant, type, visible test, inline, inline `AIDEV-NOTE`, file header, folder `AGENTS.md`, root `AGENTS.md`, ADR |
| B. Comment content | precise, wrong identifier, vague, paraphrase, generic docstring, stale, ticket ref only, ref + one-line why |
| C. Distance x scale | same text at increasing distance, 5 to 5,000 files, with and without the snippet supplied up front |
| D. Task operation | add feature, refactor, nearby bug fix, dead-code cleanup, cross-file rename |
| E. Stale and conflicting | on templates where `none` passes 20-80% |
| F. Contagion | 0 / 5 / 20 workaround comments in the repo; does the agent copy the pattern |
| G. Investigation | find-the-cause tasks; tokens and files read to a correct answer |

Rule templates: refund cap, tenant authorization, idempotency, timezone
boundary, money rounding, no PII in logs, API compatibility, lock ordering.
At least two stay private.

## Hypotheses

Committed before data. Each names the position it tests.

- **H1** (Track 1): stripping comments changes pass rate by less than 10pp on
  ordinary fix tasks. Tests the ratchet's premise that comments are mostly
  noise to agents.
- **H2** (Track 1): stripping comments reduces input tokens. Tests the
  "comments waste tokens" claim.
- **H3** (A): a rule absent from code is followed at least 30pp more often
  with a precise inline comment than with none.
- **H4** (A): with a code guard or visible test present, adding a comment
  changes pass rate by less than 10pp. Tests "encode it instead".
- **H5** (B): ticket ref + one-line why performs within 10pp of a full
  rationale comment.
- **H6** (C): with identical text, header and inline differ by less than 10pp
  in small files; the gap grows with distance and scale.
- **H7** (E): a stale comment lowers pass rate below `none` where `none` is
  between 20 and 80%.
- **H8** (F): workaround comments in the repo raise the rate at which agents
  add workarounds instead of root-cause fixes.

## Decision rules

- **Matters**: the 95% interval for the effect excludes zero and its lower
  bound is at least 10pp (or 10% of tokens).
- **Doesn't matter**: the whole interval sits within ±15pp.
- **Unresolved**: anything else. Report it as unresolved.

Lab cells start at 15 trials (86% power for 80% vs 20%). Claims of no effect
need about 40 per arm.

## Harness rules

- `prep` and `score` stay model-agnostic. Agent runners live in `real/` and
  `runners/`.
- Every trial runs with a fresh Claude config directory and a minimal PATH,
  so user-level instructions, memories, plugins, and credentials don't leak
  in. Web tools are disabled.
- A trial whose agent fails to run, or whose oracle runs the wrong number of
  tests, is invalid and retried, never scored.
- Order of arms is randomized within each task.
- Results are kept with the model, harness version, transcript, and patch.
