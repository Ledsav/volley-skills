# UI redesign — feature inventory (parity contract)

Branch: `feature/ui-redesign` · Written 2026-10-28 from the code and tests on `main` at `4137f33`.

The whole UI is being redesigned (visual language and UX, "Apple, 2050"), **keeping exactly the same
functionality**. These documents record what the app does today, screen by screen, so every redesigned
screen can be checked against them. They describe current behaviour only; they are not the new design.

## How to use this

- **Default rule: parity.** If a behaviour is listed here, the redesign keeps it — same actions, same
  results, same states, same permissions, same data written — unless it appears under
  [Agreed changes](#agreed-changes-to-behaviour) below. Layout, styling, wording tone and component
  choice are free to change; behaviour is not.
- **Each area has a "Must-keep invariants" list.** Those are the acceptance checklist for that area. A
  redesigned area is done when every invariant holds and its listed tests pass (updated only for
  markup/selector changes, never for behaviour).
- **"Pain points" are observations, not requirements.** They are input for the design, and become
  behaviour changes only once moved into [Agreed changes](#agreed-changes-to-behaviour).
- **Existing tests are the safety net.** Tests query by role and label, so most survive a restyle. A
  test that has to change its *assertion* (not just its selector) signals a behaviour change and needs
  an entry below.

## The documents

| # | Area | Screens | Invariants | Highest-risk items |
|---|---|---|---|---|
| [01](01-shell-auth-settings.md) | App shell, navigation, sign-in, club gate, legal signing, settings, shared primitives | 58 + route table | 58 | ClubGate status/time branches; legal texts hashed exactly as shown; Dialog/Menu/notify accessibility contracts; `vcb.*` storage keys |
| [02](02-home-teams-calendar-physical.md) | Home, teams list, team page tabs (roster, calendar, plan, physical, settings), add player, bulk import | 22 | 39 | Per-tab visibility and `?tab=` URL contract; bounded reads (month range, page sizes); consent defaults on add/import |
| [03](03-player-card.md) | Player card: identity, KPIs, 9 skills, plan, match stats, physical tests, contact, guardians, delete | 21 | 45 | Sections stay mounted (KPI tile depends on it); admin-only/privacy gating; derived fields computed on write; GDPR delete order |
| [04](04-scouting.md) | Matches tab, match setup/page, **live scouting**, text scouting, DataVolley import | 23 | 64 | Undo semantics; never-awaited writes (offline); hotkeys table; non-modal set-point prompt; 1–2 tap recording |
| [05](05-reports-stats-awards.md) | Match report, team stats tab, awards (prepare, present, cards, video) | 22 | 39 | Canvas output independent of app CSS; photo consent gate, photos never stored; two different rotation definitions |
| [06](06-trainings-exercises-diagrams.md) | Trainings library + builder, view sheet + PDF, exercises, court-diagram editor, AI drafting | 20 | 41 | Diagram editor gestures/shortcuts/autosave; PDF content and privacy rules; two-tap share; limit+cursor paging |
| [07](07-club-admin-platform.md) | Club area (profile, people & access, export, contract), guides, platform operator, leads | 14 | 35 | Lifecycle/date rules mirror `firestore.rules`; restricted club area lock-down; operator never sees club data; owner/last-admin safeguards |

## Cross-cutting rules (apply to every screen)

1. **No new data access patterns.** Components never call Firestore directly; `<feature>Api.ts` modules
   keep owning reads and writes. No unbounded collection reads; pagination stays limit + cursor; any new
   query ships with its index (CLAUDE.md "Fetching discipline").
2. **Authorization is enforced by the rules; the UI must not offer what the rules refuse**, and must not
   reveal existence: "not found" and "no access" render the same state wherever they do today.
3. **Offline behaviour stays as is.** Writes that are not awaited today (scouting events, physical tests)
   stay un-awaited; nothing new may block on the network in those paths.
4. **Accessibility contracts stay:** focus trap and return in dialogs, topmost-layer Escape, "Discard
   changes?" on dirty dialogs, ConfirmDialog opening on Cancel, one polite live region for success,
   inline `role="alert"` errors, focus to the page heading on route change, 44 px touch targets.
5. **Storage keys are frozen:** `vcb.*`, `theme`, `emailForSignIn`, and their sign-out cleanup.
6. **SEO:** `noindex` everywhere except `/login`, `/privacy`, `/request-access`.
7. **i18n:** every string stays translated in all shipped languages; number/date formats keep following
   the UI language (Italian decimal commas etc.).
8. **Privacy:** no third-party analytics; guardian data, photos and AI payloads keep their current limits
   (names stripped to jersey numbers, only library text sent, photos memory-only).
9. **Level bands and grade colours keep their meaning:** avg < 4 Beginner (red), < 6 Developing (orange),
   < 8 Advanced (blue), else Elite (green); scouting grades `=` red, `/` `-` orange, `!` neutral, `+` `#`
   green. Only the exact hues may change.
10. **Canvas outputs** (award cards, story slides, PNG, video) and the **training PDF** are outputs coaches
    share; they are *not* restyled by the app redesign unless listed under agreed changes.

## Facts the redesign must use (corrections to older docs)

- There are **9 skills**, not 8: serve, attack, block, set, defence, reception, jump, speed, iq
  (`SKILL_KEYS` in `src/types/player.ts`). CLAUDE.md's "8 skills" is out of date.
- The calendar is **per team** (a team tab), not a top-level destination.
- Navigation today: sidebar groups Home · Coaching (Teams, Trainings, Exercises) · Club (Skill guides,
  Members & settings) · Platform; the phone bar is Home + coaching pages + **More**. Design-system spec §7
  is out of date on this.
- There is **no free-text search** anywhere today (exercises filter by category chips only).

## Agreed changes to behaviour

Agreed with the user on 2026-10-28 (brainstorming session). Everything else is parity.

1. **Search everything** (Spotlight-style, ⌘K / Ctrl+K): players, exercises, trainings, matches. Must
   respect fetching discipline and permissions — the design doc defines exactly what it can match.
2. **Undo instead of "Are you sure?"** for everyday, reversible actions; confirmations stay for
   irreversible or high-impact ones (remove member, delete team/club, lifecycle actions, GDPR deletes).
   The design doc lists which confirm becomes an undo.
3. **Phone sheets** with detents: drag up to full height, flick down to close.
4. **Context actions:** right-click (desktop) and long-press (phone) on rows; swipe actions on phone lists.
   Scouting keeps its own long-press (500 ms → substitution).
5. **One place for the main action:** top-right of the toolbar, on every screen.
6. **Physical motion:** spring-based, interruptible, press feedback on every control.
7. **Respect system settings:** `prefers-reduced-motion`, `prefers-reduced-transparency`,
   `prefers-contrast`.

Visual direction agreed: "v2" — monochrome chrome, colour reserved for data (levels, grades), glass only on
floating chrome where content scrolls underneath (toolbar, phone tab bar, sheets, menus), true-black dark
mode, light and dark equal, Inter with size-specific tracking. Live scouting is always dark.

Further decisions, 2026-10-28 (user), specified in the design doc
[`2026-10-28-ui-redesign-design.md`](../2026-10-28-ui-redesign-design.md) §4:

8. **Fix the bugs found** (§4.2, B1–B13): Home session rows open the calendar; diagram editor autosaves
   honestly and keeps undo history; scouting error banner clears, a taken-over device is told, set 1 has no
   serve default, imports are not undoable; local (not UTC) "today" dates; People & access pages all teams;
   dead "Grant access" path removed; guide editors confirm saves; history overlay becomes a standard sheet;
   offline player-card saves queue.
9. **Shared outputs are redesigned** (award cards, story, video, training PDF), keeping content, sizes and
   privacy rules (§4.3, §9). This overrides cross-cutting rule 10.
10. **Never-built spec features are added:** Home shortcuts (as create actions), "Plan a training", player
    count and average level on team cards (§4.5).
11. **Club admins see every team in their club** (§4.4).

The minor open questions in each document are settled in the design doc §4.6.
