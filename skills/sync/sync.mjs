#!/usr/bin/env node
// Request an update for The Fifth Coconut. It is sent after this project's next successful deploy.
// Usage (from the project root): node sync.mjs [full]
import { findProject, readConfig, readKey, syncUrl } from "../../lib/project.mjs";

const fail = (msg) => { console.error(`Not requested: ${msg}`); process.exit(1); };
const full = process.argv.slice(2).some((a) => /^-*full$/i.test(a));

const root = findProject();
if (!root) fail("this project is not connected (.fifthcoconut/config.json not found). Run /fifthcoconut:onboard first.");
const config = readConfig(root);
const key = readKey(root);
if (!key) fail(".fifthcoconut/key is missing. Ask the owner for a new connection code and run /fifthcoconut:onboard.");

let res, body;
try {
  res = await fetch(syncUrl(config), {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ scope: full ? "full" : "changes" }),
  });
  body = await res.json().catch(() => ({}));
} catch (e) { fail(`could not reach ${syncUrl(config)} (${e.message}).`); }
if (res.status === 401) fail("the key was refused (the brand was disconnected or deleted). Ask the owner for a new connection code.");
if (!res.ok) fail(body.error ?? `the server answered ${res.status}.`);

console.log(`${body.scope === "full" ? "A full report" : "An update"} is requested for '${config.brand}'. `
  + "It is sent after the next successful deploy from Claude Code (the plugin checks after every deploy).");
