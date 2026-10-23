---
name: plan-team-training
description: Use when a coach asks for a training session built for a specific team or group of players (names, a roster screenshot, a player count with a tolerance like "+-3", a focus such as reception or attack, a session length), in production or on the emulator, or asks for per-player notes for a session.
---

# Plan a team training

Same steps, same scripts, every time. The scripts reuse the app's own validators, naming rules and PDF builder, so nothing is re-invented per request. Work files go in `.superpowers/plan-training/<date>/` (gitignored).

## Steps

1. **Recon (read-only).**
   `node .claude/skills/plan-team-training/scripts/recon.mjs --team "<team>" --players "Name; Name" [--club <id>] [--emulator]`
   Production is the default target. On the multi-club layout the script refuses to run without `--club`. Read the summary: `MISSING` and `CONFIRM` names, `NO SCORES` players, priorities.
2. **Ask the gating questions in one message** (AskUserQuestion), only those whose answer changes the plan:
   - the level of each `MISSING` player (never invent one), and whether to add them to the roster (the app records guardian consent: add only after the coach confirms it);
   - which player each `CONFIRM` name is;
   - the slot length, and how much of it is setup;
   - how a focus maps to categories when it isn't one (e.g. "free ball" → reception, "block" → defense).
   Don't ask about injuries or health: that is health data and must not be stored.
3. **Design.** Copy `proposal.example.mjs` to the work folder and edit it:
   - `plan.expectedPlayers` = the players listed; every step must run with `expectedPlayers - playerSlack`.
   - Work time stays below the slot (about 80 of 90): leave setup time.
   - Variety: recon lists the team's last sessions and their exercises. Don't reuse those drills; where the library has nothing fresh, write a new exercise. The validator warns on every repeat — fix them unless the coach asked for a repeat.
   - Library exercises first (fresh ones); a new one where nothing fits. New names follow "Focus: what it trains", descriptions use Purpose / Setup / How it runs / Coaching points / Easier / Harder, and each new exercise has a minimum players value and a diagram (conventions in `scripts/scene.mjs`).
   - Pitch to the roster's level mix (from recon). Describe levels ("2 advanced, 4 developing, 3 beginner"), never names. Advanced players get the Harder options and serve or feed; beginners get the Easier ones.
   - The training name is "Focus + focus: objective". The description has Purpose, a numbered session flow (`#1…#N` in plan order), Levels, Group size (how to run it at both ends of the range) and What success looks like.
4. **Validate and preview.**
   `npx vite-node .claude/skills/plan-team-training/scripts/validate.ts <proposal.mjs> --recon <recon.json> --out <dir>/preview.pdf`
   Fix every `ERROR` until it prints `RESULT: OK`. Then **Read the preview PDF** and look at every new diagram: overlaps, arrows through tokens, text off the court. Fix and re-render.
5. **Ask for approval.** Show the plan table (#, exercise, minutes, min players, new or library), the new exercises and the preview path. Writing waits for an explicit yes.
6. **Apply.** Run it as a dry run first, then again with `--apply`:
   `node .claude/skills/plan-team-training/scripts/apply.mjs <proposal.mjs> --owner <coach email> [--club <id>] [--emulator] [--calendar YYYY-MM-DD]`
   Pass `--calendar` only if the coach asked for a calendar entry. Report the businessId and the `applied-*.json` log. Undo is `apply.mjs --rollback <log> --apply`.
7. **Notes, if asked.** One line per player, for the Team notes step of the PDF export. Refer to parts as "#6 Free ball: …", never "block 6". Base each note on the player's level and priority skills from recon. No health or injury details.

## Self-check

After changing the app's data model, validators or these scripts, run
`bash .claude/skills/plan-team-training/scripts/e2e.sh`. It covers recon, validate, apply, duplicate refusal and rollback on a throwaway emulator (side ports, so a running dev emulator is untouched), and must print `E2E PASSED`.

## Red flags — stop

| Thought | Do instead |
|---|---|
| "I'll write a quick script for this" | Use the four scripts; fix them if they lack something. |
| "The table is enough; skip the PDF" | Render and read the preview. Diagram defects only show there. |
| "Fill the whole slot" | Leave setup time. |
| "Olivia isn't in the app; call her developing" | Ask for her level. |
| "Coach said do it, write straight away" | Dry run first; `--apply` only after the plan is approved. |
| "Mention Chloé leads the line" (in a description) | Levels in descriptions; names only in Team notes. |
