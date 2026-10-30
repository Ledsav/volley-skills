# Onboarding tutorial — design

**Status:** approved and built, 2026-10-30. The user handed every decision to the designer ("just start, you decide"),
so every choice below is the designer's call unless marked otherwise. **User decision:** everything shows once per
*user*, not per device (§4).
**Mockup:** `docs/design/design-system/mockups/onboarding.html` (light and dark, phone and desktop).
**Rules it follows:** `docs/design/design-system/README.md` (v2), redesign spec `2026-10-28-ui-redesign-design.md`.

## 1. Intent

Today, a new club admin who finishes sign-up lands on an empty Today page. A coach who is added to a club lands on a
page full of things nobody has explained. Neither of them is told what the app is for, what to do first, or how the
less obvious gestures work, such as long-press, swipe, ⌘K, two-tap PDF sharing or undo in scouting.

The tutorial should get a new person from "I just got in" to having done the one thing they came for:

- **Club admin (founder):** a club that is actually set up, with a team, players, a second coach, a planned session
  and a scouted match.
- **Coach (team admin):** their first planned session and their first scouted match.
- **Member with view or section access only:** knowing where things are.

It does this the way Apple does it: no tour that greys out the screen and points arrows at buttons. Instead there are
three quiet layers.

1. **A welcome sheet**, shown once: what this app does for *you*, in three or four lines.
2. **A setup checklist on Today** that ticks itself off from real data and takes you straight to each action.
3. **Tips in place** (TipKit style): a small card on a screen the first time you reach it, explaining the one thing
   on that screen you wouldn't find on your own.

## 2. Goals, non-goals, anti-goals

**Goals**
- A new club gets set up without the founder needing help.
- Every step is something real the person does in the real app, not a demo.
- Content depends on what the person can do (`useAuth().access`). Nobody is told about a feature they can't use.
- It works fully offline once loaded, and in light, dark and reduced motion.

**Non-goals**
- No demo or sample data, and no sandbox club. The seed scripts stay the only fake data.
- No video, no animated walkthrough, no product tour library.
- No onboarding for the platform operator (`/platform`) or for the sign-up and legal screens, which already guide
  themselves.
- No email drip or other reminders outside the app.

**Anti-goals (a failure even if it works)**
- A modal coach-mark tour that blocks the screen or must be clicked through.
- Anything that interrupts **live scouting** once a rally has started (design system principle 6).
- Tracking or analytics of tutorial progress. The account remembers only what the user has seen (§4), for the user. The players are minors, and the app has no analytics.
- A checklist that nags. It can always be hidden, and it disappears by itself when done.
- Tips that keep coming back after they were dismissed.

## 3. The three layers

### 3.1 Welcome sheet

- **When:** the first time a person reaches Today (`/`) in a club, after `ClubGate` has let them through. It shows
  once per user, ever: on any device and in any club. Someone who later joins a second club doesn't see it again. It
  is never shown on `/platform`, scouting, awards or the diagram editor.
- **Form:** the standard `Sheet` (centred 560 px on desktop, a bottom sheet on a phone at its large detent). It is
  modelled on Apple's "What's New" sheet.
  - **Top:** the club's initials tile (the club owns the space, brand rule §10), 64 px with radius 16. Under it, the
    title "Welcome to {club name}" in `title-1`, and the subtitle "Volley Skills" in `ink-2`.
  - **Middle:** three or four feature rows, each with a 28 px lucide icon in `ink`, a bold `headline` and one
    `subhead` line in `ink-2`. There is no colour, because this is chrome (principle 1).
  - **Bottom:** one primary button, **Continue**, full width. The sheet has no header buttons or secondary actions,
    and closing it any other way (Escape, scrim, flick) counts as Continue.
- **Rows by role** (pick the first rows that apply, up to four; copy is final English and needs Italian):

| Role check | Icon | Title | Line |
|---|---|---|---|
| club admin | `Users` | Teams and players | Build your teams and keep a card for every player. |
| club admin | `UserPlus` | Bring your coaches | Add coaches and choose what each one can see. |
| team admin (any team) with `sections.trainings` (club admins have it) | `CalendarDays` | Plan every session | Put trainings on the calendar and share them as a PDF. |
| team admin (any team) | `Activity` | Scout live | Record a match point by point and get the stats after. |
| `sections.exercises` or `sections.trainings` | `Dumbbell` | One club library | Exercises with court diagrams, shared by every coach. |
| none of the above | `Eye` | See your teams | Follow the teams and players you've been given access to. |

A club admin is also a team admin of every team (they have everything), so a founder sees: Teams and players, Bring
your coaches, Plan every session, Scout live.

### 3.2 Setup checklist ("Get started" on Today)

- **Where:** the first block on Today, above Live now. It is one card (`surface`, radius 16, `shadow-card`) with the
  title **Get started**, a progress label "2 of 5" (`footnote`, `ink-2`, tabular figures), a "⋯" menu holding
  **Hide**, a 4 px progress bar (`surface-3` track, `ink` fill, radius 2) and a grouped list of steps.
- **Each step row:**
  - **Left:** a 22 px circle. Open is an outline in `ink-3`; done is filled `ink` with a check in `on-ink`. It is
    monochrome, because a finished step is progress, not data.
  - **Middle:** the title, plus one line of help while the step is open.
  - **Right:** a chevron.
  - **Done rows:** the title goes `ink-2`, the help line disappears and the row still navigates.
  - **Order:** steps keep their order and never re-sort.
  - **Tapping an open step** goes straight to the action, through the existing pending-action mechanism
    (`withPendingAction`, `useTeamAction` for team-scoped steps with the team picker when there are several teams).
- **Steps** (each shows only if the person can do it):

Help lines (open steps only): 1 "Start with the team you coach." · 2 "Add them one by one or import a list." ·
3 "Give another coach access to a team." · 4 "Put your next session on the calendar." · 5 "Record it live or import
a DataVolley file."

| # | Step | Who | Goes to | Done when |
|---|---|---|---|---|
| 1 | Create your first team | club admin | `/teams` + `new-team` | at least one team in the Today feed |
| 2 | Add your players | team admin | team roster + `add-player` (bulk import is offered there) | some loaded team has ≥ 1 player (`getTeamSummary`) |
| 3 | Add a coach | club admin | `/club?tab=people` (opens the add form if the tab gets a pending action) | the club has ≥ 2 member docs (one `count()` on `members`) |
| 4 | Plan a training | team admin with `sections.trainings` (the calendar tab and its rules need it) | team calendar + `new-session` | some loaded team has a calendar session (a `limit(1)` query per team) |
| 5 | Scout a match | team admin | team matches + `new-match` | some loaded team has a match (a `limit(1)` query per team) |

- A coach who is not a club admin sees steps 2, 4 and 5 (step 4 only with Trainings access; without it, steps 2 and 5). Step 2 shows only if one of their teams has no players. A
  person with no team admin rights sees no checklist.
- **Fetching:** the done checks run only while the checklist is visible, cover only the teams already loaded on
  Today (the first page), and are aggregations or `limit(1)` reads. There is no collection scan (spec §8). Any new
  query gets its index. A failed check counts as "not done", silently, with no error UI, because the checklist is
  optional help.
- **Completion:** when every visible step is done, the card turns into one line with a check, for that visit
  only: "Your club is ready." for a club admin and "You're all set." for everyone else. It is shown once: when the
  facts first come back all done and the club is not yet in `hiddenChecklists`, the card shows the line and writes
  `hideChecklist(clubId)`; on the next visit nothing renders. With reduced motion it simply swaps.
- **Hide:** goes through `useNotify()` with **Undo** (6 s), following the undo-notice pattern. After that the card
  stays hidden until "Show tips again" (§3.4).

### 3.3 Tips in place

A tip is an inline card that sits in the page's flow at the top of the relevant content. It is not a popover and
not glass. It uses the `surface-2` fill, radius 12, a 20 px icon in `ink-2`, a bold title, one `footnote`
line and a 44 px "×" button labelled "Dismiss tip". It enters with the page-change motion (fade plus 6 px rise) and
leaves with the list-delete motion (height collapse plus fade, 200 ms); with reduced motion it cross-fades.
The type scale has no `subhead` role, so the title uses `text-callout` (semibold), as the rest of onboarding does.

**Rules**
- One tip per screen at most, and only after the welcome sheet has been closed.
- It shows once. It is gone for good when dismissed, or when the person does the thing it explains.
- Never over a sheet; inside a sheet only in a read-only `variant="view"` sheet (the `pdf-share` tip sits in the
  training view sheet). Never on a screen that is loading or in an error state.
- **Scouting:** only before the first rally of the person's first scouted match, above the court. It disappears on
  the first recorded tap, with no animation (recording never animates).
- Platform-aware copy: "right-click" on a fine pointer, "long-press" and "swipe" on touch (`useMediaQuery`).

**The tips** (the builder confirms each behaviour exists as described before shipping its tip, and drops any tip
whose behaviour has changed):

| Id | Screen | Title | Line | Also ends when |
|---|---|---|---|---|
| `search` | Today | Find anything | Press ⌘K (Ctrl K) to jump to any team, player, match or exercise. On a phone, tap the search icon. | search palette opened |
| `row-actions` | Team roster | Quick actions | Long-press or swipe a player for quick actions. (Fine pointer: "Right-click a player…") | a context menu or swipe opened on a roster row |
| `scout-start` | Live scouting | How scouting works | Tap a player, then the skill and the grade. The likely next action is suggested; Undo fixes the last tap. | first recorded tap |
| `pdf-share` | Training view | Sharing a PDF | Tap Share PDF to build it, then Share PDF ready to send it. | a PDF built |
| `diagram` | Diagram editor | Draw a drill | Tap a player, ball or arrow in the palette to add it to the court. | first element added |

The `undo` tip is dropped (ruling 1): the undo notice already carries its own Undo button, and tracking "the first
undoable delete" would couple `Notice` to onboarding for little gain.

**Built as:** all five tips. The `diagram` copy was corrected from "Drag ..." to a tap, because the palette adds an
element with a tap and has no drag. In the editor it sits above the canvas (a floating card under the tabs on desktop,
a strip above the canvas on a phone) and ends when the total element count rises above what it was on open.
`pdf-share` shows only on a loaded sheet with no load error, and not when `autoBuildPdf` builds the PDF on open; a PDF
built before the tip was ever shown does not consume it. `scout-start` ends on the first recorded action or point (the
set-start event does not count), is not shown in quick score or on a short landscape phone (a first tap there still
consumes it), and has no motion.

### 3.4 Replay

Settings gets a row in the existing grouped list: **Show tips again**. It resets the welcome sheet, the checklist's
hidden state for the active club and every tip, on the user's account (so on every device), then confirms through `useNotify()` ("Tips will show
again."). Steps that are already done stay done, because they come from data.

## 4. State and privacy

**User decision: once per user.** Seen and dismissed state lives on the user's account, so it follows them to every
device.

- **Where:** a new `onboarding` map on `users/{uid}`, which today holds only `email` and `createdAt`:
  `{ welcomed: boolean, tips: string[], hiddenChecklists: string[] }`.
  - `tips` holds the dismissed or completed tip ids, once per user across clubs, because tips explain the app.
  - `hiddenChecklists` holds the club ids where the user hid Get started. Hiding is per club, because the checklist
    is about setting up that club.
  - The checklist's progress is never stored; it always comes from data.
- **Reads and writes:**
  - The doc is read once at sign-in, where `ensureUserDoc` already does a `getDoc`. It is extended to return the
    map, and `useAuth()` exposes it with a setter that writes through.
  - Writes are an `updateDoc` of `onboarding.*` fields: `arrayUnion` for ids, and `welcomed: true`. They are not
    awaited, so the persistent cache queues them offline like scouting events.
  - Until the doc has loaded, nothing onboarding-related renders, so there is no flash of a welcome sheet.
- **Rules** (`firestore.rules`, `match /users/{uid}`): create is unchanged. A new `allow update` applies only when:
  - it is the owner (`signedIn()`, `request.auth.uid == uid`);
  - the only changed key is `onboarding` (`diff().affectedKeys().hasOnly(['onboarding'])`);
  - the map has only `welcomed` (bool), `tips` (list, ≤ 32 entries) and `hiddenChecklists` (list, ≤ 64 entries).

  `email` and `createdAt` stay immutable, and delete stays `false`. The tests go in
  `tests/rules/users.rules.test.ts`:
  - the owner can set each field;
  - another user cannot;
  - email and createdAt can't change alongside;
  - unknown keys, wrong types and oversized lists are refused;
  - a not-verified email gets nothing.
- **Privacy notice:** the "Accounts of club staff and members" row lists what an account holds (email, sign-in
  times and metadata). It gains "which onboarding tips you have seen or dismissed". The privacy notice is a pinned,
  versioned text (`published.test.ts`), so this ships as a new dated privacy version in all five languages, with the
  English text prevailing. It is the privacy notice only, not the Terms or DPA, so no club has to re-accept anything.
- **Deletion:** it goes with the account; no separate handling is needed. It is not part of the club export, because
  it is the user's own UI state, not club data.
- It is never read by anyone but the user, and there is no analytics or server-side tracking.
- **Cost of the choice:** one rules change, one legal text version and one more field to keep when the user doc
  changes. This replaces the earlier per-device localStorage plan, which the user rejected.

## 5. Constraints

- Strings go in a new `src/i18n/en/onboarding.ts` and `src/i18n/it/onboarding.ts`. The Italian label budget and
  parity tests apply. Italian is still switched off (`ITALIAN_ENABLED = false`) but must be complete.
- Only existing primitives: `Sheet`, `GroupedList`/`ListRow`, `Menu`, `Button`, `useNotify`, `src/motion`. No new
  dependency.
- Club-agnostic: the club name comes only from the club doc.
- Accessibility: the welcome sheet traps focus with initial focus on Continue. Checklist rows are links with their
  state in the accessible name ("Create your first team, done"). The progress label is not a live region. Each tip's
  dismiss button has an accessible name. Tips are not announced, because they are ordinary page content.
- Tests: rules first (§4). Then pure logic: the step list per access, the done rules, merging and resetting the
  `onboarding` map, and the "one tip per screen" picker. Then component tests: the welcome sheet rows per role
  and Continue, the checklist (hide plus undo, completion line), and a tip dismissing and not coming back.

## 6. Left to the builder

- Where the logic lives. A `src/onboarding/` feature folder is suggested: `onboardingState.ts`, `steps.ts`,
  `WelcomeSheet.tsx`, `GetStartedCard.tsx`, `Tip.tsx`, `useTip(id)`.
- Whether step 3 gets an `add-member` pending action (preferred if the People tab has an add form) or just navigates.
- Exact icon picks where the table's icon reads poorly at size.
- How the existing empty states on Today read alongside the checklist. Where the checklist already says it (for
  example "Plan a training" on the empty Next 7 days block), keep both: the block is contextual, and the checklist is
  the overview.
