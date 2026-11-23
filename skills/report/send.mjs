#!/usr/bin/env node
// Check .fifthcoconut/report.json and send it to The Fifth Coconut with this brand's key.
// Usage (from the project root): node send.mjs [path-to-report]   (default .fifthcoconut/report.json)
// Prints the server's answer. The key is read from .fifthcoconut/key and never printed.
// After the dashboard accepts a report, .fifthcoconut/sent-facts.json (everything this project has sent),
// .fifthcoconut/state.json (the commit it described) and .fifthcoconut/files.json (file fingerprints) are updated, so
// the next update only covers what changed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findProject, fingerprints, readConfig, readJson, readKey, tfcDir } from "../../lib/project.mjs";

const fail = (msg) => { console.error(`Not sent: ${msg}`); process.exit(1); };

const root = findProject();
if (!root) fail("this project is not connected (.fifthcoconut/config.json not found). Run /fifthcoconut:onboard first.");
const dir = tfcDir(root);
const config = readConfig(root);
const key = readKey(root);
if (!key) fail(".fifthcoconut/key is missing. Ask the owner for a new connection code and run /fifthcoconut:onboard.");
const file = resolve(process.argv[2] ?? join(dir, "report.json"));
if (!existsSync(file)) fail(`${file} does not exist. Write the report first.`);
const raw = readFileSync(file, "utf8");

// Local checks (the server checks again).
let report;
try { report = JSON.parse(raw); } catch (e) { fail(`report is not valid JSON: ${e.message}`); }
const problems = [];
const scope = report.scope ?? "full";
if (report.format !== "fifthcoconut-report/1") problems.push('format must be "fifthcoconut-report/1"');
if (report.brand !== config.brand) problems.push(`brand must be "${config.brand}"`);
if (!["full", "changes"].includes(scope)) problems.push('scope must be "full" or "changes"');
if (!report.generated_at) problems.push("generated_at is missing");
if (!Array.isArray(report.facts)) problems.push("facts must be a list");
if (report.removed !== undefined && !Array.isArray(report.removed)) problems.push("removed must be a list");
if (scope === "full" && report.removed?.length) problems.push('removed is only for scope "changes" (a full report simply leaves those facts out)');
for (const [i, r] of (Array.isArray(report.removed) ? report.removed : []).entries())
  if (!r?.key) problems.push(`removed[${i}] needs a key: { "key": ..., "reason": ... }`);
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

if (res.ok && (body.status === "processed" || body.status === "unchanged")) {
  // Remember what has been sent, and which commit it described.
  const sentFile = join(dir, "sent-facts.json");
  let facts = report.facts;
  if (scope === "changes") {
    const byKey = new Map((readJson(sentFile, { facts: [] }).facts ?? []).map((f) => [f.key, f]));
    for (const r of report.removed ?? []) byKey.delete(r.key);
    for (const f of report.facts) byKey.set(f.key, f);
    facts = [...byKey.values()];
  }
  writeFileSync(sentFile, JSON.stringify({ brand: config.brand, updated_at: new Date().toISOString(), facts }, null, 2) + "\n");
  writeFileSync(join(dir, "state.json"), JSON.stringify({
    commit: report.source?.commit ?? null, scope, sent_at: new Date().toISOString(),
  }, null, 2) + "\n");
  // Fingerprints of the project's files as this report describes them, so the next update can find what changed
  // even without git. Hashes only: no file contents are stored, and secret files are skipped.
  const files = fingerprints(root);
  if (files) writeFileSync(join(dir, "files.json"), JSON.stringify({ at: new Date().toISOString(), files }, null, 2) + "\n");
}

console.log(JSON.stringify({ http_status: res.status, ...body }, null, 2));
if (!res.ok) process.exit(1);
