# The Fifth Coconut connector

A Claude Code plugin that connects a brand's project to [The Fifth Coconut](https://fifthcoconut.com), the owner's
private knowledge dashboard for their brands.

The Fifth Coconut never reads a brand's code. The brand's own Claude sends a **report**: a JSON list of facts the
brand chooses to share (what it offers, to whom, tone, high-level architecture), each with a short quote from the
file it came from. The owner reviews every fact before it becomes knowledge.

## Install (in the brand's Claude Code)

**VS Code extension:** type `/plugins` in the Claude panel to open *Manage plugins*. On the **Marketplaces** tab add
`fifthcoconut/connector`, then on the **Plugins** tab find **fifthcoconut**, click **Install** and choose
*Install for this project*.

**Terminal (`claude`):**

```
/plugin marketplace add fifthcoconut/connector
/plugin install fifthcoconut@fifthcoconut
/reload-plugins
```

## Connect a brand (once)

In the dashboard: the brand → **Settings** → **Create connect command**, then run the command it shows in the
brand's project:

```
/fifthcoconut:onboard <brand> <one-time-code> <dashboard-url>
```

This exchanges the one-time code for the brand's report key, writes a share policy with you
(`.fifthcoconut/share-policy.md`), adds a note to the project's `CLAUDE.md`, and sends the first (full) report.

## Updates: only when requested, only what changed

Nothing is sent on a normal deploy. An update is sent only when one is requested:

- by the owner, in the dashboard (the brand → **Settings** → **Request update** or **Request full report**), or
- from the brand's Claude: `/fifthcoconut:sync` (or `/fifthcoconut:sync full`).

After each deploy made from Claude Code (`wrangler deploy`, `npm run deploy`, …) the plugin asks the dashboard whether
an update is requested. If not, it stays silent and the deploy costs no Claude usage. If so, Claude sends it.

An update covers **only what changed** since the last report: the changed files and the facts that quote them. Facts
it leaves out stay as they are; facts the changes made untrue are listed as removed. Changed files are found with git
(the last report's commit, plus uncommitted and new files) or, in projects without git, by comparing fingerprints
(SHA-256 hashes) of the project's files with the ones recorded at the last report. A full report rereads everything:
the first time, and when asked for.

`/fifthcoconut:report` sends one right away (`/fifthcoconut:report full` for a full one).

## What is stored in the project

| File | What | Commit it? |
| --- | --- | --- |
| `.fifthcoconut/config.json` | brand id and report address | yes |
| `.fifthcoconut/share-policy.md` | what may and may not be shared | yes |
| `.fifthcoconut/report.json` | the last report written (no secrets) | optional |
| `.fifthcoconut/sent-facts.json` | everything this project has sent (used to write the next update) | optional |
| `.fifthcoconut/state.json` | the commit the last report described | optional |
| `.fifthcoconut/files.json` | fingerprints (hashes) of the project's files at the last report; no contents | optional |
| `.fifthcoconut/key` | the brand's report key | **never** (added to `.gitignore`) |

## What is sent

Only `.fifthcoconut/report.json`, to `<dashboard>/api/brands/<brand>/reports`, with the brand's key (and, after a
deploy, a check of `<dashboard>/api/brands/<brand>/sync` that sends nothing about the project). No files, no
code, no deploys. `send.mjs` refuses reports that contain anything that looks like a secret, and the dashboard checks
again. The report format is described in [`skills/report/report.schema.json`](skills/report/report.schema.json).
