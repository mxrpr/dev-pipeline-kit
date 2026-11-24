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

Give it a short description, or a plan you already wrote:

```
/dev-pipeline Fix the sync so a deleted user's rows are skipped instead of failing the batch
/dev-pipeline docs/plans/login-rework.md
```

What happens:

1. Claude turns the description or plan into a checklist of small parts in `plan.md`, and **stops**.
2. You read the plan, answer any open questions, and say **go**.
3. Each part is written by one agent, tested, then reviewed by another. A part counts as done only when its tests pass and the review passes. Small parts are tested by the agent that wrote them; documentation-only parts skip review and tests. Claude asks before starting the next part.
4. If something keeps failing, Claude stops and tells you instead of guessing.

If the session is interrupted, run the same command again: it continues from `plan.md`.

**Carry out a plan that already exists** (a Markdown file or a GitHub issue number):

```
/feature docs/plans/login-rework.md
/feature 142
```

This also creates a separate branch and folder (a worktree) for the work, and asks you before every commit, push or pull request.

### Which one should I use?

Both break the work into parts and hand each part to helper agents. The difference is what they start from and how far they go.

- **Use `/dev-pipeline`** when you know *what* you want but not exactly *how* to split it, and you will handle git yourself.
- **Use `/feature`** when someone has already written the plan or issue, and you want it carried out from start to pull request.

| | `/dev-pipeline` | `/feature` |
|---|---|---|
| **Best for** | everyday work, from a bug fix to a multi-part feature | carrying out a plan that is already agreed |
| **Input** | a short description or a plan file | a plan file or a GitHub issue number |
| **Planning** | the `planning` agent splits the input into parts in `plan.md` and lists open decisions | never plans: the plan is used as written; if it is unclear, Claude stops and asks |
| **Order per part** | write → test → review | write → test → review |
| **Branch and worktree** | not handled; works in your current checkout | creates its own branch and worktree first |
| **Commit, push, pull request** | not handled | each one done only after you approve it separately |
| **Progress tracking** | checkboxes in `plan.md` | a status board in `.claude/feature/status.md`, plus one log file per agent |
| **When it stops** | after 2 fix rounds on a part (test and review failures together), it stops and reports | after 3 failed fix rounds, the part is marked blocked and you decide |
| **Speed** | lighter: small parts test themselves, documentation-only parts skip review and tests | heavier: every part gets the full test-planning, test-writing and test-running steps |

Both pick up where they stopped if the session is interrupted: `/dev-pipeline` from `plan.md`, `/feature` from `.claude/feature/status.md`.

## What's inside

You don't need to call most of these yourself: the two commands above use them.

### Agents (helpers that each do one job)

| Agent | Job | Model |
|---|---|---|
| `planning` | splits the request into small parts in `plan.md` | Opus |
| `code-agent` | writes the code for one part | Opus |
| `code-review` | checks the code and says PASS or FAIL | Opus |
| `test-planner` | decides which tests are needed | Opus |
| `test-implementer` | writes the tests and runs them | Haiku |
| `test-runner` | runs existing tests and reports results | Haiku |
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
