// Shared helpers for the connector's scripts: find the connected project and its settings.
import { existsSync, readFileSync } from "node:fs";
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
