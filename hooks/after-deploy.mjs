#!/usr/bin/env node
// PostToolUse hook. After a deploy in a project connected to The Fifth Coconut, ask the dashboard whether an update
// was requested. Only if one was does Claude get a note to send it; otherwise this prints nothing, so a deploy costs
// no Claude usage. Silent (and harmless) in every other project and for every other command.
import { findProject, readConfig, readKey, syncUrl } from "../lib/project.mjs";

let input = "";
for await (const chunk of process.stdin) input += chunk;
let data;
try { data = JSON.parse(input); } catch { process.exit(0); }

const cmd = String(data?.tool_input?.command ?? "");
if (!/\bwrangler(@[\w.-]+)?\s+(deploy|publish|pages\s+deploy|versions\s+deploy)\b/.test(cmd) && !/\bnpm\s+run\s+deploy\b/.test(cmd)) process.exit(0);

const root = findProject(data?.cwd || process.cwd());
if (!root) process.exit(0);
let config, key;
try { config = readConfig(root); key = readKey(root); } catch { process.exit(0); }
if (!key || !config?.reports_url) process.exit(0);

let status;
try {
  const res = await fetch(syncUrl(config), { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) process.exit(0);
  status = await res.json();
} catch { process.exit(0); } // offline or dashboard unreachable: the request stays open for the next deploy
if (!status?.requested) process.exit(0);

const full = status.scope === "full";
const who = status.requested_by === "claude" ? "from this project's Claude" : "by the owner";
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: `That command deployed this project, which is connected to The Fifth Coconut, and ${full ? "a full report" : "an update"} `
      + `was requested ${who}. If the deploy succeeded, run the /fifthcoconut:report skill now${full ? " with the argument full" : ""} and `
      + "follow it fully. If the deploy failed, do nothing: the request stays open until the next deploy.",
  },
}));
