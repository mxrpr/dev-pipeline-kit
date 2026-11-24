---
description: Run the plan→implement→review→test pipeline iteratively, part by part
argument-hint: [plan or feature description]
model: claude-opus-5-5
---

User-provided plan: $ARGUMENTS

Agent names in this file are the `devkit` plugin's agents: always pass them with the plugin prefix as `subagent_type`, e.g. `devkit:code-agent`, `devkit:code-review`, `devkit:test-planner`, `devkit:test-implementer`, `devkit:test-runner`, `devkit:git-runner`, `devkit:os-agent`, `devkit:planning`. A bare name may resolve to a different, user-defined agent.

0a. Routing rule: this pipeline orchestrates subagents, but it does not replace the global command-routing rule. Never run git commands (status/diff/log/add/commit) or shell/build/test commands (cargo/npm/make/…) directly in the orchestrator — delegate to `git-runner` and `os-agent`/`test-runner` respectively, same as outside the pipeline. The only exception is commands a pipeline stage (`code-agent`, `test-implementer`, `test-runner`) already runs as part of its own defined job.

0b. Investigation-dedup rule: if ground-truth facts about the codebase are needed before planning (current state, what's already done, what's dead vs live), gather them ONCE — either inline via Grep/Read or one investigation-agent pass — and feed the findings directly into the planning agent's prompt. Do not run a separate research agent and the planning agent in parallel/independently on the same question; that duplicates the grep work and wastes tokens re-deriving the same facts twice.

0c. Context-reuse rule (applies to every step below): each pipeline role (`code-agent`, `code-review`, `test-planner`, `test-implementer`, `test-runner`) is spawned via Agent ONCE, on the first part that role touches. Record each role's agentId. On every later part, resume that SAME agent via SendMessage(to: agentId) instead of spawning fresh — this carries the plan, ground-truth findings, and established conventions forward instead of re-deriving them from files every time. Only spawn a brand-new agent for a role if the existing one errors out or the user asks to reset it.
   - When resuming, keep the message terse: reference what the agent already established ("your Part 2 approach", "the golden-fixture convention you used") rather than re-explaining ground truth, file locations, or conventions it already read. Only spell things out in full the first time a role is spawned.
   - Do not let a review agent silently accept its own prior mistakes: it's fine for it to reuse context, but each review pass must still independently check the diff, not just confirm its earlier verdict from memory.
   - Checkpoint rule: every ~5 parts resumed by the same agent, ask it for a short condensed state summary (established conventions, key file locations/line numbers, decisions made) instead of resuming indefinitely. Start a fresh agent for that role seeded with the summary, and record the new agentId as the role's current one. This caps context growth on long plans instead of letting one agent's history grow for the whole plan.

0d. Doc/decision-only fast path: if a part touches no production code (pure documentation edit, a recorded keep/remove decision, drafted issue text, a plan-doc update) — check the files named in the part's checklist line — skip the review and test stages for it entirely. Make the edit directly (inline, or via a single `code-agent` call if the edit is nontrivial), mark it done in the plan checklist, and move to the next part. Reserve full implement→test→review for parts that change behavior or production/test code.

1. Resume first: if `plan.md` already holds a checklist for this work, do not plan again; continue at the first unchecked part.
Otherwise use the `planning` subagent to break the user-provided plan or description into small, ordered parts (each a self-contained unit of work). It always writes the checklist to `plan.md` in the project root. If the user passed a plan file, give that file to the planner as input; never overwrite it.
Do not start implementation; always wait for the user to give the command. After planning, allow the user to review the plan, ask questions, refine it.

2. For each part, in order. Use these agents (Agent `subagent_type`), never a general-purpose agent in their place: `code-agent` implements, `test-planner` plans tests, `test-implementer` writes and runs them, `test-runner` reruns them, `code-review` reviews.
   a. Implement: resume (or, on the first part, spawn) `code-agent` to implement just that part. It must return the changed files, with **new files listed separately**.
   b. Test:
      - Small part (roughly 1-3 files) whose `Decisions:` already name the tests: `code-agent` writes and runs them as part of step (a); skip `test-planner` and `test-implementer`.
      - Otherwise: resume (or spawn) `test-planner` for a test plan scoped to this part, then resume (or spawn) `test-implementer` to write the tests from it, run them and report pass/fail.
      - A failure goes back to the SAME agent that owns the broken side: code bug → `code-agent`, test bug → `test-implementer`. After the fix, `test-runner` reruns the tests. This counts as a fix round (step d).
   c. Review: resume (or spawn) `code-review` once the tests are green. Send it the part text, `code-agent`'s summary, the latest test report (command and pass/fail counts) and the **explicit list of changed and new files, tests included** (`git diff` does not show untracked files, so a new file not on the list goes unreviewed).
      - FAIL: send the findings to the SAME `code-agent` (or `test-implementer` for findings in tests), rerun the tests with `test-runner`, then review again. This counts as a fix round (step d).
      - Lessons: `code-review` records new lessons itself in the global `quality-bar` store (section 8 of its `SKILL.md` plus `review-lessons-<stack>.md`) and lists them under "Lessons recorded". Do not write lessons anywhere yourself, and never into the project; just relay that list to the user.
   d. Retry limit: a part gets at most 2 fix rounds, counting test failures and review failures together. Still failing after that: stop and report (see the end of this file).
   e. Done: only when the tests are green AND the review passes, mark the part `- [x]` in `plan.md`. Never mark it earlier.
   f. The plan document contains the truth. Whenever the session is reset, or the client restarts development, the plan's checklist state is how you know where the implementation process has stopped — not agent memory (agents may not survive a session reset, the plan doc must).
   g. Run parts one after another, even when they are independent: parallel agents in one checkout overwrite each other's files and mix their diffs.
   h. After a part is finished, ask the user to continue with the next part.

3. After all parts are done, run the project's full test suite (`test-runner`) and its lint checks (`os-agent`). Treat a regression like a failing part. Then report a summary of what was implemented and tested.

4. Quality standard: `planning`, `code-agent` and `code-review` all work to the `quality-bar` skill (preloaded via their `skills:` frontmatter), including its lessons from past reviews. When a comprehensive review (e.g. `/comprehensive-review:full-review`) is run on the result, scope it to the files changed by this plan, then run the `learn-from-review` skill on its `.full-review/` folder, so the next implementation avoids what it found.

Stop and report status if any part fails after retries, rather than continuing to the next part.
