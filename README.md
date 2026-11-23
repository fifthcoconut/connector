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

In the dashboard: the brand → **Settings** → **Create connection code**, then run the command it shows in the
brand's project:

```
/fifthcoconut:onboard <brand> <one-time-code> <dashboard-url>
```

This exchanges the one-time code for the brand's report key, writes a share policy with you
(`.fifthcoconut/share-policy.md`), adds a note to the project's `CLAUDE.md`, and sends the first report.

## Reports

- `/fifthcoconut:report` sends a fresh, complete report at any time.
- After a `wrangler deploy` in a connected project, the plugin reminds Claude to send one.

## What is stored in the project

| File | What | Commit it? |
| --- | --- | --- |
| `.fifthcoconut/config.json` | brand id and report address | yes |
| `.fifthcoconut/share-policy.md` | what may and may not be shared | yes |
| `.fifthcoconut/report.json` | the last report written (no secrets) | optional |
| `.fifthcoconut/key` | the brand's report key | **never** (added to `.gitignore`) |

## What is sent

Only `.fifthcoconut/report.json`, to `<dashboard>/api/brands/<brand>/reports`, with the brand's key. No files, no
code, no deploys. `send.mjs` refuses reports that contain anything that looks like a secret, and the dashboard checks
again. The report format is described in [`skills/report/report.schema.json`](skills/report/report.schema.json).
