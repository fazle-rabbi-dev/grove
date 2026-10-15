// Terminal UI primitives: colors, panels, and a bottom-pinned prompt.

const E = "\x1b[";

export const c = {
  reset: `${E}0m`,
  bold: `${E}1m`,
  dim: `${E}2m`,
  yellow: `${E}33m`,
  cyan: `${E}36m`,
  magenta: `${E}95m`,
  gray: `${E}90m`,
  green: `${E}32m`,
  red: `${E}31m`,
};

export const clearScreen = () => process.stdout.write(`${E}2J${E}3J${E}H`);

export const width = () => Math.max(20, process.stdout.columns ?? 80);

export const out = (line = "") => process.stdout.write(line + "\n");

export function rule(color = c.gray) {
  return `${color}${"─".repeat(width())}${c.reset}`;
}

export function heading(text: string) {
  out(`${c.yellow}${c.bold}${text}${c.reset}`);
}

export function info(msg: string) {
  out(`${c.gray}•${c.reset} ${msg}`);
}

export function ok(msg: string) {
  out(`${c.green}✓${c.reset} ${msg}`);
}

export function fail(msg: string) {
  out(`${c.red}✗ ${msg}${c.reset}`);
}

export function hint(msg: string) {
  out(`${c.gray}  ${msg}${c.reset}`);
}

export function table(rows: string[][], head: string[]) {
  if (!rows.length) return hint("(empty)");
  const all = [head, ...rows];
  const w = head.map((_, i) => Math.max(...all.map((r) => (r[i] ?? "").length)));
  const line = (r: string[], col = c.reset) =>
    col + r.map((cell, i) => cell.padEnd(w[i])).join("  ") + c.reset;
  out(line(head, `${c.bold}${c.cyan}`));
  out(c.gray + "─".repeat(w.reduce((a, b) => a + b + 2, 0)) + c.reset);
  rows.forEach((r) => out(line(r)));
}

// ---------------------------------------------------------------- input line

import { emitKeypressEvents } from "node:readline";

type Result = { value: string } | { cancelled: true } | { exit: true };

let commands: string[] = [];

export type Prompt = {
  /** Reads one line. Resolves to null when the user cancels. */
  ask: (label?: string) => Promise<string | null>;
  confirm: (question: string) => Promise<boolean>;
  choose: (title: string, items: string[]) => Promise<number | null>;
  say: (text: string) => void;
  /** Command names shown by the `/` suggestion menu. */
  setCommands: (names: string[]) => void;
};

// Piped stdin: split into lines, hand them out in order, EOF resolves null.
const piped: string[] = [];
const waiters: ((line: string | null) => void)[] = [];
let pipedEnded = false;



if (!process.stdin.isTTY) {
  let rest = "";
  process.stdin.on("data", (d) => {
    rest += String(d);
    const parts = rest.split(/\r?\n/);
    rest = parts.pop() ?? "";
    piped.push(...parts);
    while (piped.length && waiters.length) waiters.shift()!(piped.shift()!);
  });
  process.stdin.on("end", () => {
    if (rest.trim()) piped.push(rest.trim());
    pipedEnded = true;
    while (waiters.length) waiters.shift()!(piped.shift() ?? null);
  });
  process.stdin.resume();
}

function nextPipedLine(): Promise<string | null> {
  if (piped.length) return Promise.resolve(piped.shift()!);
  if (pipedEnded) return Promise.resolve(null);
  return new Promise((resolve) => waiters.push(resolve));
}

function readLine(initial = ""): Promise<Result> {
  return new Promise((resolve) => {
    let buf = initial;
    let done = false;
    let menuRows = 0; // suggestion lines currently drawn under the input

    // Suggestion menu: typing `/` lists every command, filtering as you type.
    const matches = () => {
      if (!buf.startsWith("/")) return [];
      const q = buf.slice(1).toLowerCase();
      if (!q) return commands.slice(0, 8);
      return commands.filter((n) => n.toLowerCase().startsWith(q)).slice(0, 8);
    };

    const wipeMenu = () => {
      if (!menuRows) return;
      process.stdout.write(`${E}${menuRows}A`);
      for (let i = 0; i < menuRows; i++) process.stdout.write(`\r${E}2K\n`);
      process.stdout.write(`${E}${menuRows}A`);
      menuRows = 0;
    };

    const draw = () => {
      wipeMenu();
      process.stdout.write(`\r${E}2K${c.gray}│${c.reset} ${c.cyan}❯${c.reset} ${buf}`);
      const list = matches();
      if (!list.length) return;
      menuRows = list.length;
      for (const name of list) {
        process.stdout.write(`\r${E}2K${c.gray}│${c.reset}   ${c.magenta}/${name}${c.reset}\n`);
      }
      process.stdout.write(`${E}${menuRows}B`); // back down to the input line
    };

    const finish = (result: Result) => {
      if (done) return;
      done = true;
      wipeMenu();
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
      process.stdout.write(`${E}0m\r\n`);
      resolve(result);
    };

    function onKey(str: string, key: { ctrl?: boolean; name?: string }) {
      if (key.ctrl && key.name === "c") return finish({ cancelled: true });
      if (key.ctrl && key.name === "d") return finish({ exit: true });
      if (key.name === "escape") return finish({ cancelled: true });
      if (key.name === "return" || key.name === "enter") return finish({ value: buf.trim() });
      if (key.name === "backspace") {
        buf = buf.slice(0, -1);
        return draw();
      }
      if (key.name === "tab") {
        // Tab accepts the first suggestion.
        const [first] = matches();
        if (first) {
          buf = `/${first} `;
          draw();
        }
        return;
      }
      if (key.name && !str) return; // arrows / function keys
      if (str && str >= " ") buf += str;
      draw();
    }

    // Piped input (scripts, tests) has no raw mode: take queued lines.
    if (!process.stdin.isTTY) {
      nextPipedLine().then((line) => finish(line === null ? { exit: true } : { value: line }));
      return;
    }

    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("keypress", onKey);
    draw();
  });
}

export const prompt = (): Prompt => ({
  say: (text) => out(`${c.gray}│${c.reset} ${c.dim}${text}${c.reset}`),

  setCommands: (names) => {
    commands = [...names].sort();
  },

  async ask(label = "") {
    out(rule());
    if (label) out(`${c.magenta}${label}${c.reset}`);
    const res = await readLine();
    if (!("value" in res)) {
      if ("exit" in res) process.exit(0);
      hint("cancelled · (esc or ctrl+c)");
      return null;
    }
    if (!res.value) return null;
    this.say(res.value);
    return res.value;
  },

  async confirm(question: string) {
    const a = await this.ask(`${question} ${c.dim}(y/n · esc cancels)${c.reset}`);
    return !!a && /^y(es)?$/i.test(a);
  },

  async choose(title: string, items: string[]) {
    if (!items.length) return null;
    out(`${c.bold}${title}${c.reset}`);
    items.forEach((it, i) => out(`  ${c.gray}${i + 1})${c.reset} ${it}`));
    const a = await this.ask(`${title} #`);
    if (!a) return null;
    const n = Number(a);
    if (Number.isInteger(n) && n >= 1 && n <= items.length) return n - 1;
    const found = items.findIndex((it) => it.toLowerCase().includes(a.toLowerCase()));
    if (found === -1) hint("no match");
    return found === -1 ? null : found;
  },
});