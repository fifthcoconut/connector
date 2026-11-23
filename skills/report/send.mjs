#!/usr/bin/env node
// Check .fifthcoconut/report.json and send it to The Fifth Coconut with this brand's key.
// Usage (from the project root): node send.mjs [path-to-report]   (default .fifthcoconut/report.json)
// Prints the server's answer. The key is read from .fifthcoconut/key and never printed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const fail = (msg) => { console.error(`Not sent: ${msg}`); process.exit(1); };

let root = process.cwd();
while (!existsSync(join(root, ".fifthcoconut", "config.json"))) {
  const up = dirname(root);
  if (up === root) fail("this project is not connected (.fifthcoconut/config.json not found). Run /fifthcoconut:onboard first.");
  root = up;
}
const dir = join(root, ".fifthcoconut");
const config = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
if (!existsSync(join(dir, "key"))) fail(".fifthcoconut/key is missing. Ask the owner for a new connection code and run /fifthcoconut:onboard.");
const key = readFileSync(join(dir, "key"), "utf8").trim();
const file = resolve(process.argv[2] ?? join(dir, "report.json"));
if (!existsSync(file)) fail(`${file} does not exist. Write the report first.`);
const raw = readFileSync(file, "utf8");

// Local checks (the server checks again).
let report;
try { report = JSON.parse(raw); } catch (e) { fail(`report is not valid JSON: ${e.message}`); }
const problems = [];
if (report.format !== "fifthcoconut-report/1") problems.push('format must be "fifthcoconut-report/1"');
if (report.brand !== config.brand) problems.push(`brand must be "${config.brand}"`);
if (!report.generated_at) problems.push("generated_at is missing");
if (!Array.isArray(report.facts)) problems.push("facts must be a list");
const SECRET = /(sk_live_|sk_test_|sk-ant-|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJhbGciOi[A-Za-z0-9_\-]{10,}|xox[abp]-|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_\-]{30,}|t?fck_[A-Za-z0-9_\-]{10,})/;
if (SECRET.test(raw) || raw.includes(key)) problems.push("the report contains something that looks like a secret or key: remove it");
for (const [i, f] of (Array.isArray(report.facts) ? report.facts : []).entries()) {
  const miss = ["key", "domain", "category", "title", "statement", "confidence"].filter((k) => !f?.[k]);
  if (miss.length) problems.push(`facts[${i}] is missing ${miss.join(", ")}`);
  if (!Array.isArray(f?.evidence) || !f.evidence.length || f.evidence.some((e) => !e?.path || !e?.quote))
    problems.push(`facts[${i}] (${f?.key ?? "?"}) needs evidence: [{ "path": ..., "quote": ... }]`);
}
if (Buffer.byteLength(raw) > 2_000_000) problems.push("report is larger than 2 MB");
if (problems.length) fail(`fix the report first:\n- ${problems.slice(0, 20).join("\n- ")}`);

let res, body;
try {
  res = await fetch(config.reports_url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: raw });
  body = await res.json().catch(() => ({}));
} catch (e) { fail(`could not reach ${config.reports_url} (${e.message}).`); }

if (res.status === 401) fail("the key was refused (the brand was disconnected or deleted). Ask the owner for a new connection code, then run /fifthcoconut:onboard.");
writeFileSync(join(dir, "last-sent.json"), JSON.stringify({ at: new Date().toISOString(), http_status: res.status, answer: body }, null, 2) + "\n");
console.log(JSON.stringify({ http_status: res.status, ...body }, null, 2));
if (!res.ok) process.exit(1);
