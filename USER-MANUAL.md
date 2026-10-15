# User manual — grove

A terminal tool for git worktrees and branches. Nothing to configure.

## Install / run

```bash
cd grove
bun install
bun run start
```

Start it from inside a git repository. The terminal is cleared on launch and the
header shows `repo-name @ current-branch`.

Not in a repo? The tool asks for a path; give it any repo folder or press
`esc` to quit.

## The screen

```
────────────────────────────────────────────
 grove             wt-demo @ main
  type help · esc or ctrl+c cancels any input · ctrl+d quits
────────────────────────────────────────────
worktrees (2)
BRANCH     PATH                HEAD
main       C:/dev/wt-demo      4f2a1b9
feature/x  C:/dev/wt-demo-x    4f2a1b9
────────────────────────────────────────────
wt-demo @ main
│ new feature/y
```

- A rule line separates every prompt from the output above it.
- The magenta line above `❯` is context: which repo and branch you are in.
- The `❯` line is always the last thing on screen — that is where you type.
- Your typed line is echoed dim above the next rule, so the history of what you
  ran stays visible.

## Keys

| key | effect |
| --- | --- |
| `/` | open the command suggestion menu |
| `tab` | accept the highlighted suggestion (first match) |
| `esc` | cancel the current input, prompt, picker, or confirmation |
| `ctrl+c` | same as `esc` — cancels, never kills the app |
| `ctrl+d` | quit |
| `enter` | submit |
| `backspace` | delete last character |

Cancelling mid-operation is safe. Nothing is half-applied, and you land back on
the prompt.

## Command suggestions

Type `/` and every command is listed right under the input line:

```
❯ /
│   /add
│   /bl
│   /clear
│   /del
│   /exit
│   /help
│   /ls
│   /mv
```

Keep typing to filter (`/re` → `/repo`, `/rm`), and press `tab` to accept the
first match, or `enter` to run it. Both `/ls` and `ls` work — the leading slash
is optional. The menu disappears as soon as you delete the slash or submit.

## Commands

### `ls` — list worktrees
Table of branch, path, and short HEAD.

### `bl` (or `branches`) — list branches
One column. `*` marks a branch that is checked out in a worktree.

### `new <branch> [path]`
Creates a branch and its worktree in one step.

```
❯ new feature/login
base for feature/login (default: current HEAD) ❯ main
✓ created feature/login
• ../wt-demo-feature-login
```

- `branch` — the new branch name. Omit it and the tool asks.
- `path` — where the worktree goes. Default `../<repo>-<branch with / replaced by ->`.
- `base` — branch or commit to branch from. Press enter for current HEAD.

If the branch already exists, git attaches to it instead of creating it.

### `add <path> <branch>`
Attaches an existing branch to a new path. Either argument may be omitted — the
tool asks for whatever is missing, or shows a picker.

### `rm [path]`
Removes a worktree. Omit the path and you get a numbered picker. Asks for
confirmation (`y/n`, `esc` cancels). Answering `y` adds `--force`, which is what
you need when the worktree has uncommitted changes. The main worktree is
protected.

### `del [branch]`
Deletes a branch. Omit it and you get a picker of branches that are not checked
out anywhere. `y` uses `git branch -D` (force), anything else uses `-d`.

### `mv <from> <to>`
Moves a worktree directory. Omit either side and you are prompted (or shown a
picker for the source).

### `prune`
Runs `git worktree prune` — cleans up records of directories that no longer exist.

### `repo [path]`
Points the tool at a different repository for the rest of the session.

### `help`
Lists all commands.

### `clear`
Clears the terminal and redraws the prompt (same as on launch).

### `exit` (or `quit`)
Leaves the tool.

## Examples

```bash
❯ new hotfix/typo                 # branch + worktree from HEAD
❯ new hotfix/typo ../wt-typo      # explicit path
❯ ls                              # see what you made
❯ rm                              # picker → pick one → y
❯ del hotfix/typo                 # picker → pick → y
❯ prune                           # tidy up leftovers
```

## Error handling

Nothing is swallowed silently and nothing crashes the app.

- A failing git command prints its first few lines in red, then
  `operation failed, still alive`, and you get a fresh prompt.
- An unknown command prints `unknown command "xyz" · type help`.
- Piped/non-interactive input (scripts, CI) is read line by line from stdin.

## Notes

- `git` must be installed and on `PATH`.
- Only `git` commands are run — no file writes outside the paths you create
  yourself.