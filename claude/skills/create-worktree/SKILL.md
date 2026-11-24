---
name: create-worktree
description: >
  Create a git worktree in the correct location inside the project. Use when asked to
  "create a worktree", "make a worktree", "work on a branch in isolation", or before
  starting isolated parallel work. Places worktrees under project-root/.worktrees/,
  unless the project's CLAUDE.md names another location.
---

# Create a git worktree

Worktrees always live **under the project root**, in `.worktrees/`, never as sibling directories outside it.
If the project's CLAUDE.md gives a location or a branch naming rule, that rule wins.
Do not use the `EnterWorktree` tool with `name` to create one: it puts the worktree in `.claude/worktrees/`. Create it with the command below, then enter it with `EnterWorktree` and `path`.

---

## Command

```bash
git -C <project-root> worktree add .worktrees/<name> -b <name>
```

- `<name>`: used as both the directory name and the branch name, unless the project says otherwise.
- Drop `-b` to check out an existing branch.
- `git worktree add` creates `.worktrees/` when it does not exist.

## Rules

1. **Location is fixed:** `.worktrees/<name>` inside the project root. Never create worktrees as siblings of the project directory or anywhere outside it.
2. Make sure `.worktrees/` is in `.gitignore`.
3. Confirm the branch name with the user if not given. Don't invent one silently for shared/pushed branches.
4. **Uncommitted changes to move:** commit them, or use `git stash push -m <unique-tag>` and restore with `git stash apply <sha>` in the new worktree. The stash stack is shared across worktrees, so never use bare `git stash pop`.

## Existing branch (no new branch)

```bash
git -C <project-root> worktree add .worktrees/<name> <existing-branch>
```

## Cleanup

```bash
git worktree remove .worktrees/<name>
git worktree prune          # after manual deletion
git worktree list           # verify state
```
