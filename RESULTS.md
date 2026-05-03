# Comment Bench results

This file describes what shapes of result to expect from the benchmark, not the result of any single run. For a snapshot from a specific model, see the blog post: [Comments only matter when they encode information the code does not](https://caiopizzol.com/writing/comments-matter-when-the-code-does-not).

## What you should see

Three patterns matter across the seven comment treatments:

1. **Structure-encoded scenarios should be flat.** When the cap lives in the code (`refund_window_branch`, `refund_window_accumulator`, `refund_window_helper`), treatments should perform similarly. `none`, `stale_misleading`, and `what_paraphrase` should land at roughly the same place as `human_why_inline` and `aidev_anchor`. If they don't, the structural protection isn't as strong as it looks.

2. **Comment-only scenario should split.** When the cap lives only in the comment (`refund_window_comment_only`), precise inline comments and `AIDEV-NOTE:` anchors should preserve the invariant; `none`, paraphrases, and stale comments should not. A clean split is the signal that the comment payload is doing the work.

3. **Module-level file headers are fragile.** Header docstrings stating an invariant tend to underperform inline comments at the call site, even when the rule is named explicitly. Worth probing if you care about where prose belongs in a codebase.

## Thesis

> Comments matter when they encode information the code does not. They do not reliably override strong task phrasing or code structure. Among comment shapes, precise comments at point of use and `AIDEV-NOTE:` anchors are the most reliable. Module-level documentation alone is not.

## How to run your own

```bash
bun benchmark.ts list
bun benchmark.ts prep refund_window_comment_only human_why_inline --out /tmp/work
# run your agent on /tmp/work
bun benchmark.ts score refund_window_comment_only /tmp/work
```
