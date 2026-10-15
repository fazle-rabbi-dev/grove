// REPL: one command per line, every operation is cancellable and never crashes.

import { c, clearScreen, fail, heading, hint, info, ok, out, prompt, rule, table } from "./ui.ts";
import * as git from "./git.ts";

const p = prompt();

const COMMANDS = [
  "ls · list worktrees",
  "bl · list branches",
  "new <branch> [path] · create branch + worktree",
  "add <path> <branch> · attach existing branch",
  "rm <path> · remove a worktree",
  "del <branch> · delete a branch",
  "mv <from> <to> · move a worktree",
  "prune · clean stale worktree records",
  "repo [path] · switch repository",
  "help · this list",
  "clear · clear the terminal",
  "exit · quit",
];

p.setCommands(COMMANDS.map((x) => x.split(" ")[0]));

let root = "";

async function worktreeTable() {
  const list = await git.listWorktrees(root);
  heading(`worktrees (${list.length})`);
  table(list.map((w) => [w.branch || "(detached)", w.path, w.head]), ["BRANCH", "PATH", "HEAD"]);
}

async function branchTable() {
  const list = await git.listBranches(root);
  heading(`branches (${list.length})`);
  table(list.map((b) => [b]), ["NAME   * = checked out"]);
}

async function pickWorktree(action: string): Promise<string | null> {
  const list = await git.listWorktrees(root);
  if (list.length < 2) {
    hint("nothing to pick");
    return null;
  }
  const i = await p.choose(`select worktree to ${action}`, list.map((w) => `${w.branch || "(detached)"}  ${w.path}`));
  return i === null ? null : list[i].path;
}

async function run(input: string) {
  const [cmd, ...a] = input.replace(/^\//, "").split(/\s+/);

  switch (cmd) {
    case "help":
    case "?":
      heading("commands");
      COMMANDS.forEach((x) => out(`  ${c.cyan}${x}${c.reset}`));
      return;

    case "ls":
      return worktreeTable();

    case "bl":
    case "branches":
      return branchTable();

    case "new": {
      let branch = a[0];
      if (!branch) {
        branch = (await p.ask("branch name")) ?? "";
        if (!branch) return;
      }
      const path = a[1] ?? `../${root.split(/[\\/]/).pop()}-${branch.replace(/\//g, "-")}`;
      const base = await p.ask(`base for ${branch} (default: current HEAD)`);
      await git.newWorktree(root, branch, path, base || "");
      ok(`created ${branch}`);
      info(path);
      return worktreeTable();
    }

    case "add": {
      let [path, branch] = a;
      if (!path) path = (await pickWorktree("attach")) ?? "";
      if (!path) return;
      if (!branch) branch = (await p.ask("branch")) ?? "";
      if (!branch) return;
      await git.newWorktree(root, branch, path, "");
      ok(`added ${branch} at ${path}`);
      return worktreeTable();
    }

    case "rm": {
      let path = a[0];
      if (!path) path = (await pickWorktree("remove")) ?? "";
      if (!path) return;
      if (path === root) return fail("cannot remove the main worktree");
      const force = await p.confirm(`force remove ${path}?`);
      await git.removeWorktree(root, path, force);
      ok(`removed ${path}`);
      return worktreeTable();
    }

    case "del": {
      let branch = a[0];
      if (!branch) {
        const list = (await git.listBranches(root)).filter((b) => !b.endsWith(" *"));
        const i = await p.choose("select branch to delete", list);
        if (i === null) return;
        branch = list[i];
      }
      const force = await p.confirm(`delete branch ${branch}?`);
      await git.deleteBranch(root, branch, force);
      ok(`deleted ${branch}`);
      return branchTable();
    }

    case "mv": {
      let [from, to] = a;
      if (!from) from = (await pickWorktree("move")) ?? "";
      if (!from) return;
      if (!to) to = (await p.ask("new path")) ?? "";
      if (!to) return;
      await git.moveWorktree(root, from, to);
      ok(`moved ${from} → ${to}`);
      return worktreeTable();
    }

    case "prune":
      await git.prune(root);
      ok("pruned stale worktrees");
      return worktreeTable();

    case "repo": {
      const target = a[0] ?? (await p.ask("repo path")) ?? "";
      if (!target) return;
      const next = await git.repoRoot(target);
      root = next;
      ok(`repo: ${next}`);
      return;
    }

    case "clear":
      clearScreen();
      return;

    case "exit":
    case "quit":
      out(`${c.gray}bye${c.reset}`);
      process.exit(0);
  }

  fail(`unknown command "${cmd}" · type help`);
}

async function main() {
  clearScreen();
  try {
    root = await git.repoRoot();
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
    const path = await p.ask("repo path (empty = quit)");
    if (!path) return;
    try {
      root = await git.repoRoot(path);
    } catch (e2) {
      fail(e2 instanceof Error ? e2.message : String(e2));
      return;
    }
  }
  const branch = await git.currentBranch(root);
  const name = root.split(/[\\/]/).pop() ?? "repo";

  out(rule(c.magenta));
  heading(`grove  ${c.dim}${name} @ ${branch}${c.reset}`);
  hint("type / for commands, help for details · esc or ctrl+c cancels any input · ctrl+d quits");
  out(rule(c.magenta));

  while (true) {
    const line = await p.ask(`${name} @ ${branch}`);
    if (!line) continue;
    try {
      await run(line);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
      hint("operation failed, still alive");
    }
  }
}

// Nothing may ever escape and kill the session.
main().catch((e) => {
  fail(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});

process.on("unhandledRejection", (e) => fail(e instanceof Error ? e.message : String(e)));