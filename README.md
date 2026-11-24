# dev-pipeline-kit

Ready-made commands, skills and helper agents for **Claude Code**.

Install it once, and Claude Code works like a small development team. A request is planned first. Then each part is written, reviewed and tested by its own helper agent, and you approve every step. Mistakes found in reviews are remembered, so they are not repeated.

## Contents

- [What you need](#what-you-need)
- [Install](#install)
- [How to use it](#how-to-use-it)
- [What's inside](#whats-inside)
- [Optional extras](#optional-extras)
- [Update or remove](#update-or-remove)
- [More documentation](#more-documentation)

## What you need

- [Claude Code](https://docs.claude.com/en/docs/claude-code), installed and signed in
- `git`
- Linux or macOS (on Windows, use WSL)

## Install

Copy and paste this into a terminal:

```bash
git clone https://github.com/mxrpr/dev-pipeline-kit
cd dev-pipeline-kit
mkdir -p ~/.claude/commands ~/.claude/skills ~/.claude/agents
cp claude/commands/*.md ~/.claude/commands/
cp -r claude/skills/* ~/.claude/skills/
cp claude/agents/*.md ~/.claude/agents/
```

Then restart Claude Code. That's it: the kit now works in all your projects.

> **Note:** this overwrites any files with the same names in `~/.claude/`. If you have your own commands or agents named like the ones here, back them up first.

## How to use it

Open Claude Code in your project folder and type one of these.

**Build or fix something** (use this most of the time):

```
/dev-pipeline Fix the sync so a deleted user's rows are skipped instead of failing the batch
```

What happens:

1. Claude writes a plan in `plan.md`, split into small parts, and **stops**.
2. You read the plan, answer any open questions, and say **go**.
3. Each part is written, reviewed and tested by a separate agent. Claude asks before starting the next part.
4. If something keeps failing, Claude stops and tells you instead of guessing.

If the session is interrupted, run the same command again: it continues from `plan.md`.

**Carry out a plan that already exists** (a Markdown file or a GitHub issue number):

```
/feature docs/plans/login-rework.md
/feature 142
```

This also creates a separate branch and folder (a worktree) for the work, and asks you before every commit, push or pull request.

**Which one should I use?**

| If you… | Use |
|---|---|
| have an idea, a bug or a rough description | `/dev-pipeline` |
| already have a written, agreed plan | `/feature` |

## What's inside

You don't need to call most of these yourself: the two commands above use them.

### Agents (helpers that each do one job)

| Agent | Job | Model |
|---|---|---|
| `planning` | splits the request into small parts in `plan.md` | Opus |
| `code-agent` | writes the code for one part | Opus |
| `code-review` | checks the code and says PASS or FAIL | Opus |
| `test-planner` | decides which tests are needed | Opus |
| `test-implementer`, `test-writer` | write the tests | Haiku |
| `test-executor`, `test-runner` | run the tests and report results | Haiku |
| `git-runner` | runs git commands (asks before risky ones like push) | Haiku |
| `os-agent` | runs shell commands (asks before risky ones like delete) | Haiku |

Thinking work runs on the strong model (Opus); simple, mechanical work runs on the cheap one (Haiku).

### Skills (rules and routines Claude loads when needed)

| Skill | What it does |
|---|---|
| `quality-bar` | the standard all code must meet, plus the lessons learned from past reviews |
| `feature` | the `/feature` command |
| `model-selector` | picks the right agent and model for a task |
| `commit-clean` | writes clean commit messages |
| `create-worktree` | creates worktrees inside the project, under `worktrees/` |
| `csharp-style` | C# style rules |
| `learn-from-review` | turns a finished full code review into lessons (`/learn-from-review`) |
| `lessons-compact` | merges and trims the stored lessons (`/lessons-compact`), about once a month |

### How it learns

Every review can add a short, general lesson (for example "a failed lookup never blanks a stored value"). Lessons are stored once in `~/.claude/skills/quality-bar/` and read before the next plan, the next code and the next review, in every project. How it works in detail: [docs/learning-loop.md](docs/learning-loop.md).

## Optional extras

### Delegation hook

Reminds Claude to hand git, test and shell commands to the cheap helper agents instead of running them itself. Needs `jq`.

```bash
mkdir -p ~/.claude/hooks
cp claude/hooks/delegate-guard.sh ~/.claude/hooks/ && chmod +x ~/.claude/hooks/delegate-guard.sh
```

Then add this to `~/.claude/settings.json`:

```json
"hooks": {
  "PreToolUse": [
    { "matcher": "Bash",
      "hooks": [ { "type": "command", "command": "~/.claude/hooks/delegate-guard.sh" } ] }
  ]
}
```

Add `NODELEGATE` to a command to skip the reminder.

### UI mods

```bash
mkdir -p ~/.claude/mods
cp -r claude/mods/dev-pipeline-mode claude/mods/colorsage ~/.claude/mods/
```

Restart Claude Code. Then:

| Mod | What you get | Toggle |
|---|---|---|
| `dev-pipeline-mode` | a side pane with the model, plan steps, running agents and most-used skills | `/dev-pipeline-mode` |
| `colorsage` | two color themes: calm Sage dark and warm Newspaper | `/colorsage`, `/colornewspaper` |

### Other plugins that work well with this kit

Install commands are in [plugins.md](plugins.md).

| Plugin | What it adds |
|---|---|
| [caveman](https://github.com/juliusbrussee/caveman) | shorter, token-saving answers and helper agents |
| [comprehensive-review](https://github.com/anthropics/claude-code-security-review) | a full, multi-agent review of a whole branch; its results feed `/learn-from-review` |
| code-simplifier | cleans up recently changed code without changing what it does |

## Update or remove

- **Update:** `git pull` in the `dev-pipeline-kit` folder, then run the `cp` commands from [Install](#install) again.
- **Remove:** delete the copied files from `~/.claude/commands/`, `~/.claude/skills/`, `~/.claude/agents/` (and `~/.claude/hooks/`, `~/.claude/mods/` if you installed the extras).

## More documentation

| Document | Covers |
|---|---|
| [docs/dev-pipeline.md](docs/dev-pipeline.md) | `/dev-pipeline` step by step, with a diagram |
| [docs/feature.md](docs/feature.md) | `/feature` phases, fix rounds and the files it keeps |
| [docs/learning-loop.md](docs/learning-loop.md) | how review findings become lessons |
| [plugins.md](plugins.md) | install commands for the other plugins |

**For a single project only:** copy the files into `<project>/.claude/commands/`, `<project>/.claude/skills/` and `<project>/.claude/agents/` instead of `~/.claude/`. Keep `quality-bar` in `~/.claude/skills/` in any case, because the lessons are stored there.
