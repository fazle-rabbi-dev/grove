# grove

Minimal TUI for git worktrees and branches. TypeScript, Bun, zero runtime deps.

## Run

```bash
bun install
bun run start
```

Global:

```bash
bun link
bun link grove
grove
```

## Use

Type `/` for the command list, `tab` to complete, `esc` or `ctrl+c` cancels anything, `ctrl+d` quits.

```
ls       list worktrees
bl       list branches
new <branch> [path]
add <path> <branch>
rm [path]
del [branch]
mv <from> <to>
prune
repo [path]
```

Docs: [USER-MANUAL.md](./USER-MANUAL.md) · [AGENTS.md](./AGENTS.md)