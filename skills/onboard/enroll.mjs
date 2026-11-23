#!/usr/bin/env node
// Exchange the one-time connection code for this brand's report key.
// Usage (from the project root): node enroll.mjs <brand> <one-time-code> <dashboard-url>
// Writes .fifthcoconut/config.json and .fifthcoconut/key (git-ignored). The key is never printed.
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [brand, code, url] = process.argv.slice(2);
const fail = (msg) => { console.error(`Not connected: ${msg}`); process.exit(1); };

if (!brand || !code || !url) fail("usage: enroll.mjs <brand> <one-time-code> <dashboard-url> (copy the whole command from the dashboard).");
if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(brand)) fail(`'${brand}' is not a valid brand id.`);
let origin;
try {
  const u = new URL(url);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))) throw new Error();
  origin = u.origin;
} catch { fail(`'${url}' is not an https:// address.`); }

let res, body;
try {
  res = await fetch(`${origin}/api/brands/${brand}/enroll`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
  });
  body = await res.json().catch(() => ({}));
} catch (e) { fail(`could not reach ${origin} (${e.message}).`); }
if (!res.ok || !body.key) fail(body.error ?? `the server answered ${res.status}.`);

const dir = join(process.cwd(), ".fifthcoconut");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "key"), body.key + "\n", { mode: 0o600 });
chmodSync(join(dir, "key"), 0o600);
writeFileSync(join(dir, "config.json"), JSON.stringify({
  brand, dashboard: origin, reports_url: body.reports_url ?? `${origin}/api/brands/${brand}/reports`, connected_at: new Date().toISOString(),
}, null, 2) + "\n");

// Keep the key out of version control.
const gi = join(process.cwd(), ".gitignore");
const line = ".fifthcoconut/key";
const current = existsSync(gi) ? readFileSync(gi, "utf8") : "";
if (!current.split(/\r?\n/).includes(line)) appendFileSync(gi, `${current && !current.endsWith("\n") ? "\n" : ""}# The Fifth Coconut report key (secret)\n${line}\n`);

console.log(`Connected '${brand}' to ${origin}. Key saved to .fifthcoconut/key (git-ignored, not shown). Reports go to ${body.reports_url ?? `${origin}/api/brands/${brand}/reports`}.`);
