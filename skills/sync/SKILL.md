---
name: sync
description: Request an update for The Fifth Coconut. Nothing is sent now; the update is sent after this project's next successful deploy. Use only when the user runs /fifthcoconut:sync.
argument-hint: "[full]"
disable-model-invocation: true
---

# Request an update for The Fifth Coconut

Arguments: $ARGUMENTS
(`full` asks for a complete report that rechecks everything; without it, the update covers only what changed since
the last report.)

From the project root, run the script that sits next to this file (in this skill's base directory):

```
node "<this skill's base directory>/sync.mjs" [full]
```

Then tell the user in one or two sentences what it printed: the update is requested and is sent after the next
successful deploy made from Claude Code. Do not write or send a report now, and do not read the project.
