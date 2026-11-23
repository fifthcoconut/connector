#!/usr/bin/env node
// PostToolUse hook: when a Bash command deployed with Wrangler in a project connected to The Fifth Coconut,
// ask Claude to send a fresh report. Silent (and harmless) everywhere else.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;
let data;
try { data = JSON.parse(input); } catch { process.exit(0); }

const cmd = String(data?.tool_input?.command ?? "");
if (!/\bwrangler(@[\w.-]+)?\s+(deploy|publish|pages\s+deploy|versions\s+deploy)\b/.test(cmd) && !/\bnpm\s+run\s+deploy\b/.test(cmd)) process.exit(0);

let dir = data?.cwd || process.cwd();
for (;;) {
  if (existsSync(join(dir, ".fifthcoconut", "config.json"))) break;
  const up = dirname(dir);
  if (up === dir) process.exit(0);
  dir = up;
}

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: "That command deployed this project, which is connected to The Fifth Coconut. If the deploy succeeded, "
      + "run the /fifthcoconut:report skill now to send a fresh report (follow it fully). If the deploy failed, skip it.",
  },
}));
