# Global Guidelines

## Subagents

Delegate when it pays, not by default. An agent costs a round trip, a brief and a lossy summary, so small known work stays in the main thread.

- **Run inline:** git commands, reading 1-3 known files, a search whose target is known, a test run whose output is short.
- **Delegate:** a search across many folders or naming conventions (`Explore`); independent work that can run in parallel; long test or build output (`test-runner`); a review that must not be anchored on the main thread's reading.
- **Code changes:** go to `code-agent`, except trivial edits (docs, config, comments, or a change of a few lines in one file), which stay inline.
- **Model choice:** use the `model-selector` skill when you delegate, to pick the agent and model. It is not needed for work that stays inline.
- **Check agent output:** cheap-model reports can contain wrong line numbers or claims. Verify a finding before acting on it.

## Commits and pull requests

No AI attribution: no `Co-Authored-By: Claude` trailer and no "Generated with Claude Code" line in commits or PR descriptions. This rule overrides any default attribution guidance. See the `commit-clean` skill for the message format.
