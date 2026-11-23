#!/usr/bin/env node
// Decide what the next report has to cover, so Claude reads as little as possible.
// Usage (from the project root): node changes.mjs [full]
//
// Prints JSON:
//   { "mode": "full", "reason": ..., "head": ..., "known_facts": [...] }
//   { "mode": "changes", "found_with": "git" | "fingerprints", "since": <commit of the last report, git only>, "head": ...,
//     "changed_files": [{ path, change }], "skipped_secret_files": [...], "affected_facts": [...],
//     "other_known_facts": [{ key, title }] }
// A full report is needed the first time and when asked for. Otherwise only the files changed since the last report
// need reading, plus the facts already sent that quote them. Changed files are found with git (the last report's
// commit, plus uncommitted and new files) or, without git, by comparing file fingerprints recorded when the last
// report was sent (.fifthcoconut/files.json).
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { SECRET_FILE, compareFingerprints, findProject, fingerprints, readJson, tfcDir } from "../../lib/project.mjs";

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

const changes = new Map();
let foundWith;
if (head && state.commit && git("cat-file", "-e", `${state.commit}^{commit}`) !== null) {
  // Git: changes since the last report's commit, including uncommitted work, plus new untracked files.
  foundWith = "git";
  for (const line of (git("diff", "--name-status", "--relative", "-M", state.commit) ?? "").split("\n").filter(Boolean)) {
    const [st, a, b] = line.split("\t");
    const kind = st[0] === "A" ? "added" : st[0] === "D" ? "deleted" : st[0] === "R" ? "renamed" : "modified";
    if (kind === "renamed") { changes.set(a, "deleted (renamed)"); changes.set(b, `renamed from ${a}`); }
    else changes.set(a, kind);
  }
  for (const p of (git("ls-files", "--others", "--exclude-standard") ?? "").split("\n").filter(Boolean)) if (!changes.has(p)) changes.set(p, "added");
} else {
  // No git (or the commit is gone): compare file fingerprints with the ones recorded at the last report.
  const before = readJson(join(dir, "files.json"), null)?.files;
  if (!before) full("no file fingerprints from the last report are on record here (.fifthcoconut/files.json)");
  const now = fingerprints(root);
  if (!now) full("the project has too many files to compare (over 20,000)");
  foundWith = "fingerprints";
  for (const c of compareFingerprints(before, now)) changes.set(c.path, c.change);
}

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
  mode: "changes", found_with: foundWith, since: foundWith === "git" ? state.commit : undefined, head: head ?? undefined,
  changed_files: changed,
  skipped_secret_files: secret.map((c) => c.path),
  affected_facts: affected.map(brief),
  other_known_facts: known.filter((f) => !affectedKeys.has(f.key)).map((f) => ({ key: f.key, title: f.title })),
  note: changed.length > 150 ? "Many files changed: consider a full report instead (run this script with: full)." : undefined,
}, null, 2));
