#!/usr/bin/env bun
// Entry point: clear the terminal, then hand over to the REPL.

import { clearScreen } from "./ui.ts";

clearScreen();
await import("./app.ts");