// Thin git wrapper. Every call returns plain data or throws a short message.

import { spawn } from "node:child_process";

function run(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn("git", args, { cwd });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e: NodeJS.ErrnoException) =>
      reject(new Error(e.code === "ENOENT" ? "git could not start · check git is installed and the path exists" : e.message)),
    );
    p.on("close", (code) => {
      if (code === 0) return resolve(out.trim());
      reject(new Error((err || out).trim().split("\n").slice(0, 3).join(" ") || `git ${args[0]} failed`));
    });
  });
}

const lines = (s: string) => s ? s.split("\n").filter(Boolean) : [];

export async function repoRoot(cwd = process.cwd()) {
  return run(["rev-parse", "--show-toplevel"], cwd);
}

export type Worktree = { branch: string; path: string; head: string };

export async function listWorktrees(root: string): Promise<Worktree[]> {
  const raw = await run(["worktree", "list", "--porcelain"], root);
  const list: Worktree[] = [];
  for (const line of lines(raw)) {
    if (line.startsWith("worktree ")) list.push({ path: line.slice(9), branch: "", head: "" });
    else if (line.startsWith("HEAD ")) list[list.length - 1].head = line.slice(5).slice(0, 8);
    else if (line.startsWith("branch ")) list[list.length - 1].branch = line.slice(7).replace("refs/heads/", "");
  }
  return list;
}

export async function listBranches(root: string): Promise<string[]> {
  return lines(await run(["branch", "--format=%(refname:short)|%(worktreepath)"], root)).map((l) => {
    const [name, wt] = l.split("|");
    return wt ? `${name} *` : name;
  });
}

export async function hasBranch(root: string, name: string) {
  try {
    await run(["rev-parse", "--verify", name], root);
    return true;
  } catch {
    return false;
  }
}

export async function newWorktree(root: string, branch: string, path: string, base: string) {
  if (await hasBranch(root, branch)) return run(["worktree", "add", path, branch], root);
  // -b creates the branch at the same time, so base must be a separate argument.
  return run(["worktree", "add", "-b", branch, path, ...(base ? [base] : [])], root);
}

export async function removeWorktree(root: string, path: string, force: boolean) {
  return run(["worktree", "remove", ...(force ? ["--force"] : []), path], root);
}

export async function deleteBranch(root: string, name: string, force: boolean) {
  return run(["branch", ...(force ? ["-D"] : ["-d"]), name], root);
}

export async function moveWorktree(root: string, from: string, to: string) {
  return run(["worktree", "move", from, to], root);
}

export async function prune(root: string) {
  return run(["worktree", "prune"], root);
}

export async function status(root: string) {
  return run(["status", "--porcelain=v1", "-b"], root);
}

/** Empty string when HEAD does not exist yet (fresh repo, no commits). */
export async function currentBranch(root: string) {
  try {
    return await run(["rev-parse", "--abbrev-ref", "HEAD"], root);
  } catch {
    return "(no commits yet)";
  }
}