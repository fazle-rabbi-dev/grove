# AGENTS.md — grove

## What this is
A minimal terminal tool to manage git worktrees + branches.
Bun runtime, TypeScript, **zero runtime dependencies** (only `bun-types` for typechecking).

## Commands
```bash
bun run start       # run the TUI
bun run typecheck   # tsc --noEmit, must stay clean
```

## Rules for changing code
- **Do not add runtime dependencies.** Node/Bun built-ins only (`node:child_process`, `node:readline`, `node:process`). Types stay simple — no clever generics, no utility types.
- Bun package manager only. Never npm/pnpm/yarn.
- Keep it in 4 files: `index.ts` (entry), `app.ts` (commands), `git.ts` (git calls), `ui.ts` (rendering + input). Do not split further without a good reason.
- `git.ts` is the only place allowed to touch git. It returns plain data or throws a short one-line message. Never leak raw stack traces to the UI.
- **The app must never die.** Any operation is wrapped in try/catch in the command loop. Add new commands inside that same try/catch path, do not add a bare `throw` path out of `run()`.
- **Every input must be cancellable.** All prompts go through `prompt().ask/confirm/choose`. `esc` / `ctrl+c` return `null` / `false` and the caller must bail out early with `if (!x) return;`. `ctrl+d` quits.
- Non-TTY stdin (pipes, tests) must keep working: see the piped-line queue in `ui.ts`.
- Output ends with a newline and uses the `│ ❯` prompt markers from `ui.ts` so the input line stays at the bottom of the screen.
- Screen is cleared once on startup in `index.ts` (`clearScreen()`), not on every frame.

## Style
- Small functions, one job each.
- `const` over `let` unless reassigned.
- Comments only where the reason is not obvious.
- User-facing text is lowercase and short.

## Docs
`README.md` = quick start. `USER-MANUAL.md` = full command/prompt reference. Update both when behavior changes.