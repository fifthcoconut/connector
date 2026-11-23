// Shared helpers for the connector's scripts: find the connected project and its settings.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** The nearest folder (from `start` upwards) that has .fifthcoconut/config.json, or null. */
export function findProject(start = process.cwd()) {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, ".fifthcoconut", "config.json"))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

export const tfcDir = (root) => join(root, ".fifthcoconut");

export function readConfig(root) {
  return JSON.parse(readFileSync(join(tfcDir(root), "config.json"), "utf8"));
}

/** The brand's key, or null. Never print it. */
export function readKey(root) {
  const f = join(tfcDir(root), "key");
  return existsSync(f) ? readFileSync(f, "utf8").trim() || null : null;
}

export function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return fallback; }
}

/** The address that says whether an update is requested (config.json only stores the reports address). */
export const syncUrl = (config) => String(config.reports_url).replace(/\/reports\/?$/, "/sync");

// ---------------------------------------------------------------- file fingerprints (finding changes without git)

/** Files that are never read, hashed or reported. */
export const SECRET_FILE = /(^|\/)(\.env[^/]*|\.dev\.vars[^/]*|[^/]*\.(pem|key|p12|pfx)|id_[a-z0-9]+|\.npmrc|credentials[^/]*)$/i;

/** Folders that hold generated or third-party files, not the brand's own. */
const SKIP_DIRS = new Set([".git", ".hg", ".svn", ".fifthcoconut", "node_modules", "bower_components", "vendor", "dist", "build",
  "out", ".output", ".wrangler", ".next", ".nuxt", ".svelte-kit", ".astro", ".vercel", ".netlify", ".turbo", ".cache",
  ".parcel-cache", "coverage", "__pycache__", ".venv", "venv", "target", ".idea", ".vscode", "tmp", ".tmp"]);
const SKIP_FILES = /(^|\/)(\.DS_Store|Thumbs\.db|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|[^/]*\.log)$/i;
const MAX_FILES = 20000;
const MAX_HASH_BYTES = 5_000_000; // bigger files are compared by size and modification time

/** Simple .gitignore support (the common cases): names, folder/ names, * and ** patterns, anchored /paths. */
function ignoreRules(root) {
  let text = "";
  try { text = readFileSync(join(root, ".gitignore"), "utf8"); } catch { return () => false; }
  const rules = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("!")).map((l) => {
    const dirOnly = l.endsWith("/");
    let pat = l.replace(/\/+$/, "");
    const anchored = pat.startsWith("/") || pat.includes("/");
    pat = pat.replace(/^\//, "");
    const rx = pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/?/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, ".*");
    return { re: new RegExp(anchored ? `^${rx}(/|$)` : `(^|/)${rx}(/|$)`), dirOnly };
  });
  return (path, isDir) => rules.some((r) => (!r.dirOnly || isDir) && r.re.test(path));
}

/** Fingerprint every file of the project (paths relative to root). Returns null if the project is too large. */
export function fingerprints(root) {
  const ignored = ignoreRules(root);
  const files = {};
  let count = 0;
  const walk = (rel) => {
    let entries;
    try { entries = readdirSync(join(root, rel), { withFileTypes: true }); } catch { return true; }
    for (const e of entries) {
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || ignored(path, true)) continue;
        if (!walk(path)) return false;
      } else if (e.isFile()) {
        if (SECRET_FILE.test(path) || SKIP_FILES.test(path) || ignored(path, false)) continue;
        if (++count > MAX_FILES) return false;
        const st = lstatSync(join(root, path));
        files[path] = st.size > MAX_HASH_BYTES ? `size:${st.size}:mtime:${Math.floor(st.mtimeMs)}`
          : createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
      }
    }
    return true;
  };
  return walk("") ? files : null;
}

/** Compare two fingerprint maps: [{ path, change: added | modified | deleted }]. */
export function compareFingerprints(before, after) {
  const out = [];
  for (const [p, h] of Object.entries(after)) if (!(p in before)) out.push({ path: p, change: "added" }); else if (before[p] !== h) out.push({ path: p, change: "modified" });
  for (const p of Object.keys(before)) if (!(p in after)) out.push({ path: p, change: "deleted" });
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
