#!/usr/bin/env node
// Decide what the next report has to cover, so Claude reads as little as possible.
// Usage (from the project root): node changes.mjs [full]
//
// Prints JSON:
//   { "mode": "full", "reason": ..., "head": ..., "known_facts": [...] }
//   { "mode": "changes", "since": <commit of the last report>, "head": ..., "changed_files": [{ path, change }],
//     "skipped_secret_files": [...], "affected_facts": [...], "other_known_facts": [{ key, title }] }
// A full report is needed the first time, when asked for, when the project is not a git repository, or when the last
// report's commit can't be found. Otherwise only the files changed since that commit (including uncommitted and new
// files) need reading, plus the facts already sent that quote them.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { findProject, readJson, tfcDir } from "../../lib/project.mjs";

const root = findProject();
if (!root) { console.error("This project is not connected. Run /fifthcoconut:onboard first."); process.exit(1); }
const dir = tfcDir(root);
const wantFull = process.argv.slice(2).some((a) => /^-*full$/i.test(a));

const git = (...args) => {
  try { return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
};
const head = git("rev-parse", "--short=12", "HEAD");
const state = readJson(join(dir, "state.json"), null); // written by send.mjs after each accepted report
const sent = readJson(join(dir, "sent-facts.json"), null); // what this project has sent so far
const known = Array.isArray(sent?.facts) ? sent.facts : [];
const brief = (f) => ({ key: f.key, title: f.title, statement: f.statement, evidence_paths: [...new Set((f.evidence ?? []).map((e) => e.path))] });

const full = (reason) => {
  console.log(JSON.stringify({ mode: "full", reason, head, known_facts: known.map((f) => ({ key: f.key, title: f.title })) }, null, 2));
  process.exit(0);
};
if (wantFull) full("a full report was requested");
if (!sent || !state) full("no earlier report from this project is on record here (.fifthcoconut/state.json)");
if (!head) full("this project is not a git repository, so changes can't be listed");
if (!state.commit) full("the last report did not record a commit");
if (git("cat-file", "-e", `${state.commit}^{commit}`) === null) full(`the last report's commit ${state.commit} is not in this repository`);

// Changes since the last report's commit, including uncommitted work, plus new untracked files.
const changes = new Map();
for (const line of (git("diff", "--name-status", "--relative", "-M", state.commit) ?? "").split("\n").filter(Boolean)) {
  const [st, a, b] = line.split("\t");
  const kind = st[0] === "A" ? "added" : st[0] === "D" ? "deleted" : st[0] === "R" ? "renamed" : "modified";
  if (kind === "renamed") { changes.set(a, "deleted (renamed)"); changes.set(b, `renamed from ${a}`); }
  else changes.set(a, kind);
}
for (const p of (git("ls-files", "--others", "--exclude-standard") ?? "").split("\n").filter(Boolean)) if (!changes.has(p)) changes.set(p, "added");

const SECRET_FILE = /(^|\/)(\.env[^/]*|\.dev\.vars[^/]*|[^/]*\.(pem|key|p12|pfx)|id_[a-z0-9]+|\.npmrc|credentials[^/]*)$/i;
const changed = [];
const secret = [];
for (const [path, change] of changes) {
  if (path.startsWith(".fifthcoconut/")) continue;
  (SECRET_FILE.test(path) ? secret : changed).push({ path, change });
}
const touched = new Set(changed.map((c) => c.path));
const affected = known.filter((f) => (f.evidence ?? []).some((e) => touched.has(e.path)));
const affectedKeys = new Set(affected.map((f) => f.key));

console.log(JSON.stringify({
  mode: "changes", since: state.commit, head,
  changed_files: changed,
  skipped_secret_files: secret.map((c) => c.path),
  affected_facts: affected.map(brief),
  other_known_facts: known.filter((f) => !affectedKeys.has(f.key)).map((f) => ({ key: f.key, title: f.title })),
  note: changed.length > 150 ? "Many files changed: consider a full report instead (run this script with: full)." : undefined,
}, null, 2));
