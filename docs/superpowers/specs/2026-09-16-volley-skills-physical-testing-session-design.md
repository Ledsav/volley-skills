# Volley Skills — Physical Testing Session Design Spec

Date: 2026-09-16
Status: Approved for planning

## 1. Purpose

Today, recording a physical test means opening `AddPhysicalTestDialog` for one
player, one quality, filling every required attempt in one sitting, and
saving. That doesn't match how a real testing session runs: a coach lines up
several players and cycles through them (player 1 runs the sprint, rests,
player 2 runs while player 1 recovers, back to player 1 for attempt 2, ...).
There's no way to record "player 1's first sprint attempt" and come back for
the second one later without holding unsaved state in a browser tab for the
whole session.

This feature adds a **Physical Session** tab on the team page: a live,
multi-player recording workflow for a single testing event, with on-screen
timing tools where they make sense (10m sprint, 5-10-5 shuttle), and a
mobile-first layout since sessions run from a phone/tablet in the gym.

Driving use case: a coach runs a test day for the team, working through
players and qualities in whatever order is practical, without needing every
quality finished for every player before anything is saved.

## 2. Scope Decisions

- **New "session" data model** for in-progress recording, separate from the
  existing `physicalTests` collection. `physicalTests` stays exactly as it is
  today — one independent, complete-on-write doc per measurement event, per
  quality. Nothing partial is ever written there.
- **A quality, once started, must be finished before it counts** — but a
  session does not require all 8 qualities per player. A coach can test only
  sprint and jump for a given player and leave the rest untouched.
- **In-progress attempts are persisted immediately** (crash/refresh safe).
  Every attempt or field entered during recording writes to Firestore right
  away, before the quality is finished.
- **At most one open session per team.** A team either has no open session
  (show "Start new session") or exactly one (show the live recording view).
  Sessions can be closed and remain visible as read-only history.
- **Two on-screen stopwatches, nothing more.** 10m Sprint and 5-10-5 Shuttle
  (both time-based) get a start/stop/reset timer that fills the attempt
  field. The cm-based qualities (CMJ, broad jump, approach jump, reaction
  drop) and the plain-field ones (growth, strength) keep manual numeric
  entry, same fields as `AddPhysicalTestDialog` today.
- **Admin-write only**, mirroring the existing `physicalTests` rule
  (`isTeamAdmin()`). No new roles.
- **Mobile-first layout** for the recording view — see §6.

### Out of scope

- The camera-based flight-time jump timer for CMJ (deferred; recorded as a
  follow-up idea, not part of this spec).
- Any browser-based real-world distance/AR measurement tool — evaluated and
  rejected as not feasible free/reliably in a browser (see brainstorming
  discussion; WebXR hit-testing is Android-Chrome-only, needs calibration,
  and isn't worth the complexity for this app).
- Multi-session-per-team concurrency (e.g. two simultaneous test days for one
  team). Only one open session at a time.
- Changing anything about the existing single-player `AddPhysicalTestDialog`
  flow on the player card — it stays as the "edit one historical entry"
  path; the new session view is purely additive.
- Editing/deleting a *finished* session entry from within the session view
  (that's already covered by the existing physical-testing section on the
  player card, which can edit/delete any `physicalTests` doc).

## 3. Data model

New collection: `teams/{teamId}/testingSessions/{sessionId}`

```ts
interface TestingSession {
  id: string;
  date: string;          // ISO "YYYY-MM-DD", defaults to today at creation
  status: 'open' | 'closed';
  createdBy: string;     // uid
  createdAt: unknown;    // serverTimestamp()
  closedAt: unknown | null;
}
```

Subcollection `testingSessions/{sessionId}/entries/{entryId}` — one draft per
player+quality. `entryId = "${playerId}__${testType}"` (deterministic; a
second "start" of the same player+quality in the same session reopens the
same entry rather than creating a duplicate).

```ts
interface TestingSessionEntry {
  id: string;                 // "${playerId}__${testType}"
  playerId: string;
  testType: PhysicalTestType;
  status: 'in_progress' | 'complete';
  data: Partial<PhysicalTestData>; // same shape as that quality's data type,
                                    // filled in incrementally; attempts arrays
                                    // grow one element at a time
  resultTestId: string | null;     // set once finished: id of the written
                                    // physicalTests doc
  updatedAt: unknown;              // serverTimestamp(), bumped on every write
}
```

Reusing each quality's own `PhysicalTestData` shape (from `src/types/physicalTest.ts`)
for `data` means no new per-quality schema to maintain — an in-progress CMJ
entry's `data` is a partial `CmjData`, etc. "Required attempts met" is
determined by the same `minCount`/`maxCount` values already enforced in
`AddPhysicalTestDialog` (cmj/broadJump/approachJump touch: 3, sprint10m: 2–3,
reaction: 5, shuttle5105 and growth: both named fields present, strength:
mode-appropriate fields present).

**Finishing a quality for a player:**
1. Compute derived fields with the existing `physicalTestMath` helpers
   (`bestOf`, `computeApproachJump`, `computeReaction`, `computeBodyMassRatio`)
   — identical to what `AddPhysicalTestDialog.handleSubmit` does today.
2. Call the existing `createPhysicalTest(teamId, playerId, input, recordedByUid)`
   — no changes to that function or to `physicalTests` at all.
3. Update the entry doc: `status: 'complete'`, `resultTestId: <new doc id>`.

The entry is *not* deleted on completion — keeping it lets the session view
show "8/8 done" summaries and serve as the session's audit trail ("who was
tested, for what, in this session") without re-querying `physicalTests`.

## 4. Session lifecycle & rules

Firestore rules can only check exact-path `get()`/`exists()`, not "does any
doc in this collection have `status == 'open'`" — so the at-most-one-open
invariant can't be a pure rules predicate. Instead it reuses the pattern
already in this codebase for `counters/trainings` (`businessId` sequencing):
a single well-known doc read inside a `runTransaction`, with rules
authorizing the write, not computing the invariant.

- `teams/{teamId}` gains an `activeTestingSessionId: string | null` field
  (`null` when no session is open).
- **Start**: a transaction reads `teams/{teamId}`, aborts client-side if
  `activeTestingSessionId != null`, then creates the new
  `testingSessions/{sessionId}` doc (`status: 'open'`, `date` defaulting to
  today, editable before starting) and sets
  `teams/{teamId}.activeTestingSessionId = sessionId`.
- **Live**: the recording view (§5) operates against
  `teams/{teamId}.activeTestingSessionId`.
- **Close**: a transaction sets the session doc's `status: 'closed'` /
  `closedAt: serverTimestamp()` and resets
  `teams/{teamId}.activeTestingSessionId = null`. Entries become read-only.
  The session still appears in a "past sessions" list on the tab.
- **Rules** (`firestore.rules`), mirroring the existing `physicalTests`
  pattern:
  - `teams/{teamId}`: existing team-admin `update` rule extends to allow
    changing `activeTestingSessionId`; no new rule needed since team updates
    are already admin-gated.
  - `testingSessions/{sessionId}`: `read` if `isTeamAdmin()`; `create`/`update`
    if `isTeamAdmin()`.
  - `testingSessions/{sessionId}/entries/{entryId}`: `read`/`create`/`update`
    if `isTeamAdmin()` **and** the parent session's `status == 'open'`. No
    `delete` — entries are permanent once written, same posture as
    `physicalTests`.
  - No viewer access — this collection is a working/audit log for admins,
    not player-card-visible data (the finished `physicalTests` doc is what
    viewers eventually see, unchanged).
  - The uniqueness guarantee (at most one open session) rests on the
    transaction, the same trust model this codebase already accepts for
    `businessId` sequencing — not an independent rules predicate.

Every rules addition here needs a `tests/rules/` case per CLAUDE.md.

## 5. Recording UI (desktop)

New tab `TeamPage`'s `TeamTab` union gains `'physicalSession'`, gated the
same way `calendar` is gated today (an access check resolved from
`useAuth().access`, at minimum requiring team-admin — this tab has no
non-admin read view, so it's simplest to hide it entirely for non-admins
rather than show a disabled state).

`TeamPhysicalSessionTab` (new, `src/physicalSessions/`), self-contained like
`TeamCalendarTab`, takes only `teamId`:

- No open session → "Start new session" card (date field, defaults to
  today) + a list of past (closed) sessions for this team, most recent
  first, each expandable to see what was recorded.
- Open session → the live view:
  - **Left**: player roster picker (reuses the team's existing player list
    query), searchable, each row showing a small "n/8" progress chip driven
    by that player's entries.
  - **Right**: selected player's 8 quality tiles in `PHYSICAL_TEST_ORDER`,
    each showing **Not started** / **In progress (n of required)** /
    **Done** (with the finished value). Tapping a tile opens that quality's
    recording panel.
  - **Recording panel** (inline panel on desktop, full-screen sheet on
    mobile — see §6): the same fields as `AddPhysicalTestDialog` for that
    `testType`, except each attempt/field write goes straight to the draft
    entry (debounced on numeric input blur, immediate on "Add attempt")
    instead of waiting for a final submit. A **Finish** button is enabled
    only once the required attempts/fields are present; pressing it runs
    the finish sequence from §3 and returns to the quality-tile grid with
    that tile now showing **Done**.
  - For **sprint10m** and **shuttle5105**, each attempt/field has an inline
    stopwatch (start/stop/reset) next to it; stopping fills the value into
    the attempt input, still editable before "Add attempt"/save so a coach
    can correct a mistimed press.
  - **Close session** button, visible whenever a session is open (with a
    confirmation, since it's a one-way action per session).
- Entries for the open session are read via a live listener
  (`onSnapshot`) scoped to `testingSessions/{activeTestingSessionId}/entries`
  (id read off the team doc) — bounded
  to one session (at most `players × 8` docs), consistent with the fetching
  discipline in CLAUDE.md since it's not a scan of the historical collection.
  This also means two coaches on two devices recording into the same open
  session see each other's progress in near-real-time. Concurrent writes to
  the *same* player+quality entry from two devices at once are accepted as
  an unhandled edge case (last-write-wins) — unlikely in practice and not
  worth a transaction for this MVP.

## 6. Mobile layout

This is the primary usage mode (coach on a phone/tablet in the gym), not a
responsive afterthought:

- **Player picker** collapses from the desktop side rail to a searchable
  dropdown/combobox pinned above the quality grid.
- **Quality tiles** render as a 2-column grid (instead of desktop's row) to
  keep tap targets large.
- **Recording panel** opens as a full-screen sheet rather than an inline
  side panel, with a sticky header showing the player's name and progress so
  context isn't lost while the panel covers the screen.
- **Stopwatch** is one large start/stop button sized for a thumb tap. Reset
  requires a short confirm step to avoid an accidental mis-tap wiping a live
  timer mid-attempt.
- Numeric inputs use `inputMode="decimal"` so mobile keyboards show the
  right keypad.
- Layout is designed primarily for portrait orientation (realistic gym
  usage) but must not break in landscape — no fixed-width elements, existing
  Tailwind breakpoints only (no new breakpoints introduced).

## 7. Testing

Priority order per the app design spec §13: rules, then pure logic, then
components.

**Rules (`tests/rules/`)**

- Team admin can create a `testingSessions` doc and update the team doc's
  `activeTestingSessionId`; non-admin (viewer/no access) cannot do either.
- Team admin can create/update an `entries` doc under an open session;
  rejected once the parent session is `closed`.
- Non-admin cannot read/write `testingSessions` or `entries`.

**Pure unit tests**

- Entry "required attempts met" check per `testType`, reusing the same
  minCount/maxCount table as `AddPhysicalTestDialog` (one case per quality:
  under, exactly at, and — where `maxCount` applies — at the cap).
- Finish-sequence derived-field computation matches
  `AddPhysicalTestDialog.handleSubmit`'s existing per-type logic exactly (it
  calls the same `physicalTestMath` helpers, so this is mostly a
  regression-style check that the session code path builds the same
  `NewPhysicalTestInput` shape).
- `entryId` derivation (`playerId__testType`) is stable and collision-free
  across the 8 known test types.

**Component tests**

- Quality tile shows correct status (Not started / In progress / Done) from
  a given entry.
- Recording panel: entering attempts persists to the draft (mocked API) one
  at a time; Finish is disabled until the required count is met; pressing
  Finish calls `createPhysicalTest` with the expected derived fields and
  marks the entry complete.
- Stopwatch: start → elapsed increases; stop → value stops and populates the
  bound field; reset requires the confirm step.
- Session tab: no open session shows "Start new session" + past sessions
  list; starting one shows the live view; Close session requires
  confirmation and returns to the no-open-session state.

## 8. Known limitations (documented, not addressed here)

- No camera-based CMJ flight-time timer (deferred follow-up idea).
- No cross-device conflict resolution for two coaches editing the exact same
  player+quality entry at the same instant (last-write-wins).
- A session, once closed, cannot be reopened — a coach who needs to add one
  more quality after closing uses the existing single-entry
  `AddPhysicalTestDialog` on the player card instead.
- No way to delete a whole session (individual finished results can still be
  deleted via the existing `physicalTests` delete flow on the player card).
- Past-session history view is a simple expandable list, not a dashboard —
  no aggregate stats across sessions in this spec.
