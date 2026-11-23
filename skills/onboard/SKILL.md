---
name: onboard
description: Connect this project (a brand) to The Fifth Coconut - exchange the one-time code from the owner's dashboard for this brand's report key, agree what may be shared, and send the first report. Use when the user runs /fifthcoconut:onboard <brand> <code> <dashboard-url>.
argument-hint: <brand> <one-time-code> <dashboard-url>
---

# Connect this brand to The Fifth Coconut

Arguments: $ARGUMENTS
(Expected: `<brand> <one-time-code> <dashboard-url>`, e.g. `example-site-com tfc-example-site-com-… https://app.fifthcoconut.com`.
If any is missing, ask the user to copy the whole command from the dashboard: brand → Settings → Create connection code.)

## What this is (tell the user briefly before you start)

The Fifth Coconut is the owner's private knowledge dashboard for their brands. It never reads this project's code.
Instead, this project's Claude sends a **report**: a JSON list of facts about the brand (what it offers, to whom,
tone, high-level architecture) that the share policy allows, each with a short quote from the file it came from.
The owner reviews every fact before it becomes knowledge. Nothing is deployed and no files are uploaded.

The one-time code works once and expires after 1 hour. It is exchanged for this brand's own report key, which is
stored only in `.fifthcoconut/key` (git-ignored) and is never printed or committed.

## Steps

1. **Connect.** From the project root, run the script that sits next to this file (in this skill's base directory):

   ```
   node "<this skill's base directory>/enroll.mjs" <brand> <one-time-code> <dashboard-url>
   ```

   It writes `.fifthcoconut/config.json` and `.fifthcoconut/key`, and adds `.fifthcoconut/key` to `.gitignore`.
   Never print, `cat` or quote the key. If it fails with "Invalid, used or expired code", ask the owner for a new
   code (dashboard → the brand → Settings → New connection code) and stop.

2. **Agree what to share.** Create `.fifthcoconut/share-policy.md` from the template below, adjust it to this
   project (name the real folders that must never be shared), show it to the user and apply their changes.

   ```markdown
   # What this brand shares with The Fifth Coconut

   ## Share
   - What the business offers, to whom, prices and policies as stated on the public website.
   - Positioning, tone of voice, languages, contact channels that are public.
   - High-level architecture: the apps, Workers/services, main integrations, where content is published.

   ## Never share
   - Secrets, keys, tokens, passwords, environment values, anything under `.env*` or `.dev.vars`.
   - Customer, user or employee personal data; order or payment records; internal financials.
   - Security weaknesses or anything that would help someone attack the service.
   - Exports, backups, database dumps, logs.
   ```

3. **Note how updates work.** Add this section to the project's `CLAUDE.md` (create it if missing; keep the rest of
   the file as it is; if an older "The Fifth Coconut" section exists, replace it):

   ```markdown
   ## The Fifth Coconut
   This project sends The Fifth Coconut an update only when one is requested (by the owner in the dashboard, or with
   /fifthcoconut:sync). After a deploy the plugin says whether one is due; only then run /fifthcoconut:report.
   Never send reports on your own. What may be shared is in `.fifthcoconut/share-policy.md`.
   Never print or commit `.fifthcoconut/key`.
   ```

4. **First report.** Run the `/fifthcoconut:report` skill now with the argument `full` and follow it fully. This
   first report is complete: it covers the brand and the technical side as far as the share policy allows. Later
   updates cover only what changed.

5. **Finish** with a short message: connected brand, number of facts sent, the server's answer, that the owner now
   reviews the proposals in the dashboard, and that further updates are sent only when requested (in the dashboard or
   with `/fifthcoconut:sync`), after the next deploy.
