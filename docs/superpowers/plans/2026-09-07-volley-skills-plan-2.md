# Volley Skills App — Plan 2: Backlog Cleanup, Development Plans, Physical Testing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps Plan 1's final review surfaced (add-player flow with guardians/consent, navigation shell, two parked bugfixes), then add development-plan editing (team + player) and the full physical-testing feature (8 test qualities, protocol-exact computations, guide editor) on top of Plan 1's foundation.

**Architecture:** Same as Plan 1 — React + TypeScript + Vite SPA, Firebase Auth + Firestore, all authorization in Security Rules, no Cloud Functions. New UI is built from the shared `Button`/`Input` primitives Plan 1's fix wave introduced, and follows the same file-per-concern layout (`typesApi.ts` data layer, presentational components, colocated tests).

**Tech Stack:** Same as Plan 1, plus `lucide-react` (icons for the navigation shell, MIT-licensed, matches the design system's stroke spec).

## Global Constraints

- Everything from Plan 1's Global Constraints still applies: fixed 8-skill list, no Cloud Functions, no unbounded reads (`limit()` + cursor pagination everywhere), `adminAllowlist` locked, team admin membership is email-keyed, TypeScript `strict: true`, no secrets committed, Firestore rules tests are the highest-priority tests, UI follows `docs/superpowers/specs/2026-09-04-volley-skills-design-system.md`.
- **Admin status for UI gating is determined by team membership** (`team.adminEmails.includes(currentUserEmail)`), never by the global `appUser.role` field — Plan 1 got this wrong on the player card (global role gate) while the actual Firestore rules authorize on team membership; this plan corrects that and every new component follows the corrected pattern from the start.
- **Objective status** (development plans, and later training sessions) is a fixed 5-value enum — `'Active' | 'In progress' | 'Completed' | 'Not started' | 'Attention'` — per the design system's Section 6 status vocabulary, always rendered as color + label together, never color alone.
- **Physical test computations are never done by the coach by hand** — every protocol value (best-of-N, approach-jump subtraction, reaction discard-and-average, body-mass ratio) is computed by the app from raw attempts, per `docs/superpowers/specs/2026-09-07-volley-skills-plan-2-design.md` Section 4.
- **Consent is captured at player creation**, not assumed — the add-player form's consent checkbox is required to submit, matching the legal/compliance requirement in the app design spec.

---

## Task 1: Consolidate the duplicated `DevelopmentPlan` type

**Files:**
- Create: `src/types/developmentPlan.ts`
- Modify: `src/types/team.ts` (remove the duplicated types, import from the new module)
- Modify: `src/types/player.ts` (remove the duplicated types, import from the new module)

**Interfaces:**
- Produces: `ObjectiveStatus`, `ShortTermObjective`, `SeasonObjective`, `DevelopmentPlan` from `src/types/developmentPlan.ts` — consumed by Tasks 7-10 and already-referenced by `Team`/`Player`.

Note: Plan 1 modeled both short-term and season objectives with the same shape (`targetDate` on both). The app design spec actually distinguishes them (season objectives use a free-text `target`, not a date) — since no dev-plan UI existed yet in Plan 1, nothing depended on the distinction, so this task corrects it now rather than carrying the simplification forward into the editor UI this plan builds.

- [ ] **Step 1: Write `src/types/developmentPlan.ts`**

```ts
export type ObjectiveStatus = 'Active' | 'In progress' | 'Completed' | 'Not started' | 'Attention';

export interface ShortTermObjective {
  objective: string;
  targetDate: string;
  status: ObjectiveStatus;
  coachComment: string;
}

export interface SeasonObjective {
  objective: string;
  target: string;
  status: ObjectiveStatus;
  coachComment: string;
}

export interface DevelopmentPlan {
  shortTermObjectives: ShortTermObjective[];
  seasonObjectives: SeasonObjective[];
  generalNotes: string;
}
```

- [ ] **Step 2: Modify `src/types/team.ts`**

Replace:
```ts
export interface DevelopmentPlanObjective {
  objective: string;
  targetDate: string;
  status: string;
  coachComment: string;
}

export interface DevelopmentPlan {
  shortTermObjectives: DevelopmentPlanObjective[];
  seasonObjectives: DevelopmentPlanObjective[];
  generalNotes: string;
}
```
With:
```ts
export type { DevelopmentPlan } from './developmentPlan';
```
Keep the rest of `team.ts` (the `Team` interface) unchanged — it already references `DevelopmentPlan` by name, which now resolves via this re-export.

- [ ] **Step 3: Modify `src/types/player.ts`**

Apply the identical change: replace the duplicated `DevelopmentPlanObjective`/`DevelopmentPlan` interfaces with `export type { DevelopmentPlan } from './developmentPlan';`. Keep the rest of `player.ts` unchanged.

- [ ] **Step 4: Verify the build**

Run: `npx tsc -b --force`
Expected: 0 errors — confirms every existing reference to `Team['developmentPlan']`/`Player['developmentPlan']` still resolves correctly through the re-export.

Run: `npm test`
Expected: full suite still passes (this is a pure type refactor, no runtime code changed).

- [ ] **Step 5: Commit**

```bash
git add src/types/developmentPlan.ts src/types/team.ts src/types/player.ts
git commit -m "Consolidate duplicated DevelopmentPlan type, split short-term/season objective shapes"
```

---

## Task 2: Fix `PlayerCardPage`'s admin gate to use team membership, not global role

**Files:**
- Modify: `src/players/PlayerCardPage.tsx`
- Modify: `src/players/PlayerCardPage.test.tsx`

**Interfaces:**
- Consumes: `getTeam(teamId): Promise<Team | null>` from `src/teams/teamsApi.ts` (already exists, Plan 1 Task 6).
- No new exports — this is a bugfix to existing behavior. `PlayerContactSection`/`PlayerSkillsSection`'s `isAdmin` prop contract (from Plan 1's fix wave) is unchanged; only how `PlayerCardPage` computes the value going into that prop changes.

Currently `PlayerCardPage` computes `isAdmin = appUser?.role === 'admin'` — the *global* role. But `firestore.rules` authorizes player writes on *team* membership (`isTeamAdmin()`, i.e. the signed-in email is in the parent team's `adminEmails`). An assistant coach granted team-admin access (via `TeamSettingsTab`) without also being in the global `adminAllowlist` would see a read-only card despite the rules permitting every edit. This task fixes the UI to check the same thing the rules check.

- [ ] **Step 1: Rewrite `src/players/PlayerCardPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getPlayer } from './playersApi';
import { getTeam } from '../teams/teamsApi';
import { PlayerContactSection } from './PlayerContactSection';
import { PlayerSkillsSection } from './PlayerSkillsSection';
import type { Player } from '../types/player';

export function PlayerCardPage() {
  const { teamId, playerId } = useParams<{ teamId: string; playerId: string }>();
  const { firebaseUser } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId || !playerId) return;
    setError(null);
    void Promise.all([getPlayer(teamId, playerId), getTeam(teamId)])
      .then(([fetchedPlayer, fetchedTeam]) => {
        setPlayer(fetchedPlayer);
        setIsAdmin(Boolean(firebaseUser?.email && fetchedTeam?.adminEmails.includes(firebaseUser.email)));
      })
      .catch(() => setError("You don't have access to this player."));
  }, [teamId, playerId, firebaseUser?.email]);

  if (error) {
    return (
      <p role="alert" className="p-6 text-red">
        {error}
      </p>
    );
  }

  if (!player || !teamId || !playerId) return <p className="p-6 text-slate">Loading player...</p>;

  return (
    <div className="mx-auto max-w-2xl bg-bg p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">{player.fullName}</h1>
      <PlayerContactSection
        teamId={teamId}
        playerId={playerId}
        player={player}
        onPlayerUpdated={setPlayer}
        isAdmin={isAdmin}
      />
      <PlayerSkillsSection
        teamId={teamId}
        playerId={playerId}
        player={player}
        onPlayerUpdated={setPlayer}
        isAdmin={isAdmin}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update `src/players/PlayerCardPage.test.tsx`**

The existing test only mocked `./playersApi`. Since `PlayerCardPage` now also calls `getTeam` from `../teams/teamsApi`, add a mock for that module so the test doesn't hit the real (unmocked) Firestore SDK:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PlayerCardPage } from './PlayerCardPage';
import * as playersApi from './playersApi';
import * as teamsApi from '../teams/teamsApi';

vi.mock('./playersApi');
vi.mock('../teams/teamsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

describe('PlayerCardPage', () => {
  it('shows an access message instead of loading forever when the read is rejected', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/teams/team-1/players/player-1']}>
        <Routes>
          <Route path="/teams/:teamId/players/:playerId" element={<PlayerCardPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent("You don't have access to this player.");
    expect(screen.queryByText('Loading player...')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- src/players/PlayerCardPage.test.tsx`
Expected: PASS.

Run: `npm test && npx tsc -b --force`
Expected: full suite passes, 0 type errors.

- [ ] **Step 4: Commit**

```bash
git add src/players/PlayerCardPage.tsx src/players/PlayerCardPage.test.tsx
git commit -m "Gate player-card editing on team admin membership, not global role"
```

---

## Task 3: Handle skill-guide load failures instead of risking a silent overwrite

**Files:**
- Modify: `src/skillGuide/SkillGuidePage.tsx`
- Modify: `src/skillGuide/SkillGuidePage.test.tsx`

**Interfaces:** No new exports — internal error-handling fix only.

Currently `getSkillGuide()`'s read has no `.catch`, and "Save" is always enabled. If the read fails (network blip), `skills` stays `[]` and an admin who doesn't notice could click Save and overwrite the stored guide with an empty list. This task adds a load-error state (blocking the page entirely) and gates "Save" on a successful load.

- [ ] **Step 1: Write the failing tests** — append to `src/skillGuide/SkillGuidePage.test.tsx`

```tsx
  it('shows an error and no form when loading the guide fails', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    vi.spyOn(skillGuideApi, 'getSkillGuide').mockRejectedValue({ code: 'unavailable' });

    render(<SkillGuidePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the skill guide.');
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });

  it('disables Save until the guide has loaded', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    let resolveLoad: (value: { skills: never[]; updatedBy: string; updatedAt: null }) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveLoad = resolve;
    });
    vi.spyOn(skillGuideApi, 'getSkillGuide').mockReturnValue(pending as ReturnType<typeof skillGuideApi.getSkillGuide>);

    render(<SkillGuidePage />);

    expect(screen.getByText('Save')).toBeDisabled();

    resolveLoad({ skills: [], updatedBy: '', updatedAt: null });
    await waitFor(() => expect(screen.getByText('Save')).not.toBeDisabled());
  });
```

Add `waitFor` to the existing `import { render, screen, fireEvent, waitFor } from '@testing-library/react';` line if not already imported (it already is, per the existing file).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/skillGuide/SkillGuidePage.test.tsx`
Expected: FAIL — no load-error handling and no `disabled` state exist yet.

- [ ] **Step 3: Rewrite `src/skillGuide/SkillGuidePage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Textarea } from '../components/Input';
import { getSkillGuide, updateSkillGuide } from './skillGuideApi';
import type { SkillGuideEntry } from '../types/skillGuide';

export function SkillGuidePage() {
  const { firebaseUser } = useAuth();
  const [skills, setSkills] = useState<SkillGuideEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSkillGuide()
      .then((guide) => {
        setSkills(guide.skills);
        setLoaded(true);
      })
      .catch(() => setLoadError('Could not load the skill guide. Please refresh the page.'));
  }, []);

  function updateHowToEvaluate(key: string, value: string) {
    setSkills((current) => current.map((s) => (s.key === key ? { ...s, howToEvaluate: value } : s)));
  }

  function updateRangeDescription(key: string, rangeIndex: number, value: string) {
    setSkills((current) =>
      current.map((s) =>
        s.key === key
          ? { ...s, ranges: s.ranges.map((r, i) => (i === rangeIndex ? { ...r, description: value } : r)) }
          : s
      )
    );
  }

  async function handleSave() {
    setError(null);
    if (!firebaseUser) return;
    try {
      await updateSkillGuide(skills, firebaseUser.uid);
    } catch {
      setError('Could not save the skill guide. Please try again.');
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="p-6 text-red">
        {loadError}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl bg-bg p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Skill Guide</h1>
      <div className="space-y-6">
        {skills.map((skill) => (
          <section key={skill.key} className="rounded-lg border border-border bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{skill.label}</h2>
            <div className="mt-3 space-y-3">
              {skill.ranges.map((range, index) => (
                <div key={`${range.min}-${range.max}`}>
                  <label
                    htmlFor={`${skill.key}-range-${index}`}
                    className="mb-1 block text-sm font-medium text-ink"
                  >{`${range.min}-${range.max}`}</label>
                  <Textarea
                    id={`${skill.key}-range-${index}`}
                    value={range.description}
                    onChange={(e) => updateRangeDescription(skill.key, index, e.target.value)}
                  />
                </div>
              ))}
              <div>
                <label htmlFor={`${skill.key}-how-to-evaluate`} className="mb-1 block text-sm font-medium text-ink">
                  How to evaluate
                </label>
                <Textarea
                  id={`${skill.key}-how-to-evaluate`}
                  value={skill.howToEvaluate}
                  onChange={(e) => updateHowToEvaluate(skill.key, e.target.value)}
                />
              </div>
            </div>
          </section>
        ))}
      </div>
      <Button variant="primary" onClick={() => void handleSave()} className="mt-6" disabled={!loaded}>
        Save
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/skillGuide/SkillGuidePage.test.tsx`
Expected: PASS (4 tests: the 2 pre-existing plus the 2 new ones).

- [ ] **Step 5: Run the full suite**

Run: `npm test && npx tsc -b --force`

- [ ] **Step 6: Commit**

```bash
git add src/skillGuide/SkillGuidePage.tsx src/skillGuide/SkillGuidePage.test.tsx
git commit -m "Handle skill-guide load failures and gate Save on a successful load"
```

---

## Task 4: Navigation shell (sidebar + bottom tab bar + sign out)

**Files:**
- Create: `src/layout/AppShell.tsx`
- Create: `src/layout/AppShell.test.tsx`
- Modify: `src/App.tsx` (restructure into a layout route wrapping the authenticated pages in `AppShell`)

**Interfaces:**
- Produces: `AppShell` component (`{ children: ReactNode }`), rendering the design system's Section 7 navigation pattern — navy sidebar on desktop (≥1024px, Tailwind's `lg:` breakpoint), white bottom tab bar on mobile, same nav items/order/icons in both.

- [ ] **Step 1: Install `lucide-react`**

Run: `npm install lucide-react`

- [ ] **Step 2: Write the failing test `src/layout/AppShell.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const mockSignOut = vi.fn();

vi.mock('firebase/auth', () => ({ signOut: (...args: unknown[]) => mockSignOut(...args) }));
vi.mock('../firebase/config', () => ({ auth: {} }));

describe('AppShell', () => {
  it('renders the same nav destinations in both the sidebar and the bottom tab bar', () => {
    render(
      <MemoryRouter initialEntries={['/teams']}>
        <AppShell>
          <p>Page content</p>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getAllByText('Teams')).toHaveLength(2);
    expect(screen.getAllByText('Guides')).toHaveLength(2);
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('signs out and redirects to /login when a sign-out button is clicked', async () => {
    mockSignOut.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={['/teams']}>
        <AppShell>
          <p>Page content</p>
        </AppShell>
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByText('Sign out')[0]);

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/layout/AppShell.test.tsx`
Expected: FAIL with "Cannot find module './AppShell'".

- [ ] **Step 4: Write `src/layout/AppShell.tsx`**

```tsx
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, LogOut, Users } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';

const NAV_ITEMS = [
  { to: '/teams', label: 'Teams', Icon: Users },
  { to: '/admin/guides', label: 'Guides', Icon: BookOpen },
];

function sidebarLinkClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
  }`;
}

function bottomTabClass({ isActive }: { isActive: boolean }): string {
  return `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
    isActive ? 'text-blue' : 'text-slate'
  }`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut(auth);
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <aside className="hidden w-56 flex-col bg-navy p-4 lg:flex">
        <span className="mb-6 px-3 text-lg font-semibold tracking-[-0.01em] text-white">Volley Skills</span>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={sidebarLinkClass}>
              <Icon size={20} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => void handleSignOut()}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
        >
          <LogOut size={20} strokeWidth={1.5} />
          Sign out
        </button>
      </aside>

      <div className="flex-1 pb-16 lg:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface lg:hidden">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={bottomTabClass}>
            <Icon size={22} strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
        <button
          onClick={() => void handleSignOut()}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-slate"
        >
          <LogOut size={22} strokeWidth={1.5} />
          Sign out
        </button>
      </nav>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/layout/AppShell.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Restructure `src/App.tsx`** to wrap the authenticated pages in a layout route

```tsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { RequireAdmin } from './auth/RequireAdmin';
import { AppShell } from './layout/AppShell';
import { LoginPage } from './auth/LoginPage';
import { FinishSignInPage } from './auth/FinishSignInPage';
import { TeamsListPage } from './teams/TeamsListPage';
import { TeamPage } from './teams/TeamPage';
import { PlayerCardPage } from './players/PlayerCardPage';
import { SkillGuidePage } from './skillGuide/SkillGuidePage';

function AuthenticatedLayout() {
  return (
    <RequireAuth>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireAuth>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/finish-sign-in" element={<FinishSignInPage />} />
          <Route element={<AuthenticatedLayout />}>
            <Route path="/teams" element={<TeamsListPage />} />
            <Route path="/teams/:teamId" element={<TeamPage />} />
            <Route path="/teams/:teamId/players/:playerId" element={<PlayerCardPage />} />
            <Route
              path="/admin/guides"
              element={
                <RequireAdmin>
                  <SkillGuidePage />
                </RequireAdmin>
              }
            />
          </Route>
          <Route path="/" element={<Navigate to="/teams" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 7: Run the full suite to verify nothing broke**

Run: `npm test`
Expected: all tests pass, including `App.test.tsx`'s unauthenticated-redirect test (RequireAuth's redirect behavior is unchanged, just nested one level deeper under the new layout route).

Run: `npx tsc -b --force`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/layout src/App.tsx
git commit -m "Add navigation shell (sidebar + bottom tab bar + sign out)"
```

---

## Task 5: Add-player form (guardians + required consent)

**Files:**
- Modify: `src/players/playersApi.ts` (`createPlayer` gains a `confirmedByEmail` param and always sets `consent.given: true`)
- Modify: `src/players/playersApi.test.ts` (update the existing `createPlayer` test for the new signature/consent shape)
- Create: `src/players/AddPlayerDialog.tsx`
- Create: `src/players/AddPlayerDialog.test.tsx`
- Modify: `src/teams/TeamPage.tsx` (add a "+ Add player" trigger in the Overview tab, refresh the roster on creation)

**Interfaces:**
- Consumes: `Button`/`Input`/`Textarea` from `src/components/`, `Guardian` from `src/types/player.ts`.
- Produces: `AddPlayerDialog` component (`{ teamId: string; team: Team; onClose: () => void; onCreated: () => void }`). `createPlayer`'s new signature: `createPlayer(teamId, team, input: NewPlayerInput, creatorUid: string, confirmedByEmail: string): Promise<string>`.

- [ ] **Step 1: Write the failing test** — update the "creates a player" test in `src/players/playersApi.test.ts`

Replace the existing `it('creates a player with empty skills and denormalized team fields', ...)` block with:

```ts
  it('creates a player with empty skills, denormalized team fields, and given consent', async () => {
    mockAddDoc.mockResolvedValue({ id: 'player-1' });

    const id = await createPlayer(
      'team-1',
      team,
      {
        number: 7,
        fullName: 'Test Player',
        dob: '2012-01-01',
        nationality: 'BEL',
        licenseNumber: 'J-000001',
        position: 'OH',
        playerPhone: '',
        guardians: [{ relation: 'mother', name: 'Jane Doe', phone: '+352 000 000', email: 'jane@example.com' }],
      },
      'coach-uid',
      'coach@example.com'
    );

    expect(id).toBe('player-1');
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload).toMatchObject({
      fullName: 'Test Player',
      teamName: 'U17',
      ageGroup: 'U17',
      season: '2026-27',
      viewerEmails: [],
      avgScore: null,
      level: null,
      guardians: [{ relation: 'mother', name: 'Jane Doe', phone: '+352 000 000', email: 'jane@example.com' }],
      consent: { given: true, confirmedBy: 'coach@example.com' },
      skills: { serve: { score: null, notes: '', priority: false } },
    });
    expect(payload.consent.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/players/playersApi.test.ts`
Expected: FAIL — `createPlayer` doesn't yet accept a 5th argument, and still sets `consent.given: false`.

- [ ] **Step 3: Modify `createPlayer` in `src/players/playersApi.ts`**

Replace:
```ts
export async function createPlayer(
  teamId: string,
  team: Team,
  input: NewPlayerInput,
  creatorUid: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'teams', teamId, 'players'), {
    ...input,
    viewerEmails: [],
    teamName: team.name,
    ageGroup: team.ageGroup,
    season: team.season,
    skills: EMPTY_SKILLS,
    avgScore: null,
    level: null,
    developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
    consent: { given: false, date: null, confirmedBy: null },
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}
```
With:
```ts
export async function createPlayer(
  teamId: string,
  team: Team,
  input: NewPlayerInput,
  creatorUid: string,
  confirmedByEmail: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'teams', teamId, 'players'), {
    ...input,
    viewerEmails: [],
    teamName: team.name,
    ageGroup: team.ageGroup,
    season: team.season,
    skills: EMPTY_SKILLS,
    avgScore: null,
    level: null,
    developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
    consent: { given: true, date: new Date().toISOString().slice(0, 10), confirmedBy: confirmedByEmail },
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}
```

(The consent checkbox in `AddPlayerDialog`, built in Step 6, is required to submit — by the time this function is called, consent has already been confirmed in the UI.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/players/playersApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test `src/players/AddPlayerDialog.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddPlayerDialog } from './AddPlayerDialog';
import * as playersApi from './playersApi';
import { useAuth } from '../auth/AuthContext';
import type { Team } from '../types/team';

vi.mock('./playersApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const team: Team = {
  id: 'team-1',
  name: 'U17',
  club: 'VCB',
  ageGroup: 'U17',
  season: '2026-27',
  description: '',
  notes: '',
  adminEmails: ['coach@example.com'],
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  createdBy: 'coach-uid',
  createdAt: null,
};

describe('AddPlayerDialog', () => {
  it('submits the form with guardians and confirmed consent', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    const createPlayerSpy = vi.spyOn(playersApi, 'createPlayer').mockResolvedValue('player-1');
    const onCreated = vi.fn();

    render(<AddPlayerDialog teamId="team-1" team={team} onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test Player' } });
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2012-01-01' } });
    fireEvent.change(screen.getByLabelText('Nationality'), { target: { value: 'BEL' } });
    fireEvent.change(screen.getByLabelText('License #'), { target: { value: 'J-000001' } });
    fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'OH' } });
    fireEvent.change(screen.getByLabelText('Guardian name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText('Guardian phone'), { target: { value: '+352 000 000' } });
    fireEvent.change(screen.getByLabelText('Guardian email'), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByLabelText(/confirm parental\/guardian consent/i));
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createPlayerSpy).toHaveBeenCalledWith(
      'team-1',
      team,
      expect.objectContaining({
        number: 7,
        fullName: 'Test Player',
        guardians: [{ relation: 'mother', name: 'Jane Doe', phone: '+352 000 000', email: 'jane@example.com' }],
      }),
      'coach-uid',
      'coach@example.com'
    );
  });

  it('does not submit when consent is not confirmed', () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    const createPlayerSpy = vi.spyOn(playersApi, 'createPlayer').mockResolvedValue('player-1');

    render(<AddPlayerDialog teamId="team-1" team={team} onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test Player' } });
    fireEvent.change(screen.getByLabelText('Guardian name'), { target: { value: 'Jane Doe' } });
    fireEvent.click(screen.getByText('Create'));

    expect(createPlayerSpy).not.toHaveBeenCalled();
  });

  it('adds a second guardian row', () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });

    render(<AddPlayerDialog teamId="team-1" team={team} onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getAllByLabelText('Guardian name')).toHaveLength(1);
    fireEvent.click(screen.getByText('+ Add guardian'));
    expect(screen.getAllByLabelText('Guardian name')).toHaveLength(2);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/players/AddPlayerDialog.test.tsx`
Expected: FAIL with "Cannot find module './AddPlayerDialog'".

- [ ] **Step 7: Write `src/players/AddPlayerDialog.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Input, FIELD_CLASS } from '../components/Input';
import { createPlayer } from './playersApi';
import type { Guardian } from '../types/player';
import type { Team } from '../types/team';

interface AddPlayerDialogProps {
  teamId: string;
  team: Team;
  onClose: () => void;
  onCreated: () => void;
}

const labelClass = 'mb-1 block text-sm font-medium text-ink';
const fieldClass = 'mb-4';

function emptyGuardian(): Guardian {
  return { relation: 'mother', name: '', phone: '', email: '' };
}

export function AddPlayerDialog({ teamId, team, onClose, onCreated }: AddPlayerDialogProps) {
  const { firebaseUser } = useAuth();
  const [number, setNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [position, setPosition] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  const [guardians, setGuardians] = useState<Guardian[]>([emptyGuardian()]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateGuardian(index: number, updates: Partial<Guardian>) {
    setGuardians((current) => current.map((g, i) => (i === index ? { ...g, ...updates } : g)));
  }

  function addGuardian() {
    setGuardians((current) => [...current, emptyGuardian()]);
  }

  function removeGuardian(index: number) {
    setGuardians((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!firebaseUser?.email || !consentGiven) return;
    try {
      await createPlayer(
        teamId,
        team,
        {
          number: Number(number),
          fullName,
          dob,
          nationality,
          licenseNumber,
          position,
          playerPhone,
          guardians,
        },
        firebaseUser.uid,
        firebaseUser.email
      );
    } catch {
      setError('Could not create the player. Please try again.');
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Add player"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">Add player</h2>

        <div className={fieldClass}>
          <label htmlFor="player-number" className={labelClass}>
            Number
          </label>
          <Input id="player-number" type="number" value={number} onChange={(e) => setNumber(e.target.value)} required />
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-full-name" className={labelClass}>
            Full name
          </label>
          <Input id="player-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-dob" className={labelClass}>
            Date of birth
          </label>
          <Input id="player-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-nationality" className={labelClass}>
            Nationality
          </label>
          <Input id="player-nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} />
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-license" className={labelClass}>
            License #
          </label>
          <Input id="player-license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-position" className={labelClass}>
            Position
          </label>
          <Input id="player-position" value={position} onChange={(e) => setPosition(e.target.value)} />
        </div>

        <div className={fieldClass}>
          <label htmlFor="player-phone" className={labelClass}>
            Phone
          </label>
          <Input id="player-phone" value={playerPhone} onChange={(e) => setPlayerPhone(e.target.value)} />
        </div>

        <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate">Guardians</h3>
        {guardians.map((guardian, index) => (
          <div key={index} className="mb-4 rounded-md border border-border p-3">
            <div className={fieldClass}>
              <label htmlFor={`guardian-relation-${index}`} className={labelClass}>
                Relation
              </label>
              <select
                id={`guardian-relation-${index}`}
                className={FIELD_CLASS}
                value={guardian.relation}
                onChange={(e) => updateGuardian(index, { relation: e.target.value as Guardian['relation'] })}
              >
                <option value="mother">Mother</option>
                <option value="father">Father</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className={fieldClass}>
              <label htmlFor={`guardian-name-${index}`} className={labelClass}>
                Guardian name
              </label>
              <Input
                id={`guardian-name-${index}`}
                value={guardian.name}
                onChange={(e) => updateGuardian(index, { name: e.target.value })}
                required
              />
            </div>
            <div className={fieldClass}>
              <label htmlFor={`guardian-phone-${index}`} className={labelClass}>
                Guardian phone
              </label>
              <Input
                id={`guardian-phone-${index}`}
                value={guardian.phone}
                onChange={(e) => updateGuardian(index, { phone: e.target.value })}
              />
            </div>
            <div className={fieldClass}>
              <label htmlFor={`guardian-email-${index}`} className={labelClass}>
                Guardian email
              </label>
              <Input
                id={`guardian-email-${index}`}
                type="email"
                value={guardian.email}
                onChange={(e) => updateGuardian(index, { email: e.target.value })}
              />
            </div>
            {guardians.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeGuardian(index)}>
                Remove guardian
              </Button>
            )}
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addGuardian} className="mb-4">
          + Add guardian
        </Button>

        <label className="mb-4 flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            required
            className="mt-1"
          />
          I confirm parental/guardian consent has been obtained to store this player's data.
        </label>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Create
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-right text-sm text-red">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
```

Note: `guardian-name-${index}`'s `Input`/`label` pair, when queried by `getByLabelText('Guardian name')` in the test with a single guardian (index 0), resolves via the `htmlFor`/`id` association — `getAllByLabelText` is used once a second guardian exists, since the label text is identical across rows and only the `id` differs.

- [ ] **Step 8: Export `FIELD_CLASS` from `src/components/Input.tsx`**

It's already exported per Task 4's/Plan 1's `Input.tsx` (`export const FIELD_CLASS = ...`) — no change needed here, just confirming the import in Step 7 resolves.

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- src/players/AddPlayerDialog.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 10: Wire into `src/teams/TeamPage.tsx`**

Add state for the dialog and a refresh key, and a trigger button in the Overview tab:

Add imports: `import { useState } from 'react';` (already imported), `import { AddPlayerDialog } from '../players/AddPlayerDialog';`

Add to the component body (alongside the existing `tab`/`team`/`error` state):
```tsx
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [rosterRefreshKey, setRosterRefreshKey] = useState(0);
```

Replace:
```tsx
        <div className="mt-6">
          {tab === 'overview' && <TeamRosterTable teamId={teamId} />}
          {tab === 'settings' && <TeamSettingsTab team={team} onTeamUpdated={setTeam} />}
        </div>
      </div>
    </div>
  );
```
With:
```tsx
        <div className="mt-6">
          {tab === 'overview' && (
            <>
              <div className="mb-4 flex justify-end">
                <Button variant="primary" size="sm" onClick={() => setShowAddPlayer(true)}>
                  + Add player
                </Button>
              </div>
              <TeamRosterTable key={rosterRefreshKey} teamId={teamId} />
            </>
          )}
          {tab === 'settings' && <TeamSettingsTab team={team} onTeamUpdated={setTeam} />}
        </div>
      </div>
      {showAddPlayer && (
        <AddPlayerDialog
          teamId={teamId}
          team={team}
          onClose={() => setShowAddPlayer(false)}
          onCreated={() => {
            setShowAddPlayer(false);
            setRosterRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
```

Add the import `import { Button } from '../components/Button';` at the top of the file.

- [ ] **Step 11: Run the full suite**

Run: `npm test && npx tsc -b --force`
Expected: all tests pass, 0 type errors.

- [ ] **Step 12: Commit**

```bash
git add src/players/playersApi.ts src/players/playersApi.test.ts src/players/AddPlayerDialog.tsx src/players/AddPlayerDialog.test.tsx src/teams/TeamPage.tsx
git commit -m "Add player creation form with guardians and required consent"
```

---

## Task 6: Guardians section on the player card

**Files:**
- Modify: `src/players/playersApi.ts` (add `updatePlayerGuardians`)
- Create: `src/players/GuardiansSection.tsx`
- Create: `src/players/GuardiansSection.test.tsx`
- Modify: `src/players/PlayerCardPage.tsx` (render `GuardiansSection`)

**Interfaces:**
- Produces: `updatePlayerGuardians(teamId, playerId, guardians: Guardian[]): Promise<void>` in `playersApi.ts`; `GuardiansSection` component (`{ teamId, playerId, player, onPlayerUpdated, isAdmin }` — same prop shape as `PlayerContactSection`/`PlayerSkillsSection`, so `PlayerCardPage` passes it identically).

Guardians exist in the data model (populated at player creation, Task 5) but have no display/edit UI on the player card until this task.

- [ ] **Step 1: Add `updatePlayerGuardians` to `src/players/playersApi.ts`**

Append after `updatePlayerContact`:

```ts
export async function updatePlayerGuardians(teamId: string, playerId: string, guardians: Guardian[]): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'players', playerId), { guardians, updatedAt: serverTimestamp() });
}
```

- [ ] **Step 2: Write the failing test `src/players/GuardiansSection.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuardiansSection } from './GuardiansSection';
import * as playersApi from './playersApi';
import type { Player } from '../types/player';

vi.mock('./playersApi');

const basePlayer: Player = {
  id: 'player-1',
  number: 7,
  fullName: 'Test Player',
  dob: '2012-01-01',
  nationality: 'BEL',
  licenseNumber: 'J-000001',
  position: 'OH',
  playerPhone: '',
  guardians: [{ relation: 'mother', name: 'Jane Doe', phone: '+352 000 000', email: 'jane@example.com' }],
  viewerEmails: [],
  teamName: 'U17',
  ageGroup: 'U17',
  season: '2026-27',
  skills: {
    serve: { score: null, notes: '', priority: false },
    attack: { score: null, notes: '', priority: false },
    set: { score: null, notes: '', priority: false },
    defence: { score: null, notes: '', priority: false },
    reception: { score: null, notes: '', priority: false },
    jump: { score: null, notes: '', priority: false },
    speed: { score: null, notes: '', priority: false },
    iq: { score: null, notes: '', priority: false },
  },
  avgScore: null,
  level: null,
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  consent: { given: true, date: '2026-09-07', confirmedBy: 'coach@example.com' },
  createdBy: 'coach-uid',
  createdAt: null,
  updatedAt: null,
};

describe('GuardiansSection', () => {
  it('shows guardians read-only and hides Edit when isAdmin is false', () => {
    render(
      <GuardiansSection teamId="team-1" playerId="player-1" player={basePlayer} onPlayerUpdated={vi.fn()} isAdmin={false} />
    );

    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('edits a guardian and saves', async () => {
    vi.spyOn(playersApi, 'updatePlayerGuardians').mockResolvedValue(undefined);
    const onPlayerUpdated = vi.fn();

    render(
      <GuardiansSection
        teamId="team-1"
        playerId="player-1"
        player={basePlayer}
        onPlayerUpdated={onPlayerUpdated}
        isAdmin={true}
      />
    );

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Guardian phone'), { target: { value: '+352 111 111' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(playersApi.updatePlayerGuardians).toHaveBeenCalledWith('team-1', 'player-1', [
        { relation: 'mother', name: 'Jane Doe', phone: '+352 111 111', email: 'jane@example.com' },
      ])
    );
    expect(onPlayerUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        guardians: [{ relation: 'mother', name: 'Jane Doe', phone: '+352 111 111', email: 'jane@example.com' }],
      })
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/players/GuardiansSection.test.tsx`
Expected: FAIL with "Cannot find module './GuardiansSection'".

- [ ] **Step 4: Write `src/players/GuardiansSection.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Input, FIELD_CLASS } from '../components/Input';
import { updatePlayerGuardians } from './playersApi';
import type { Guardian, Player } from '../types/player';

interface GuardiansSectionProps {
  teamId: string;
  playerId: string;
  player: Player;
  onPlayerUpdated: (player: Player) => void;
  isAdmin: boolean;
}

const RELATION_LABEL: Record<Guardian['relation'], string> = {
  mother: 'Mother',
  father: 'Father',
  other: 'Other',
};

export function GuardiansSection({ teamId, playerId, player, onPlayerUpdated, isAdmin }: GuardiansSectionProps) {
  const [editing, setEditing] = useState(false);
  const [guardians, setGuardians] = useState<Guardian[]>(player.guardians);
  const [error, setError] = useState<string | null>(null);

  function updateGuardian(index: number, updates: Partial<Guardian>) {
    setGuardians((current) => current.map((g, i) => (i === index ? { ...g, ...updates } : g)));
  }

  function addGuardian() {
    setGuardians((current) => [...current, { relation: 'mother', name: '', phone: '', email: '' }]);
  }

  function removeGuardian(index: number) {
    setGuardians((current) => current.filter((_, i) => i !== index));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await updatePlayerGuardians(teamId, playerId, guardians);
    } catch {
      setError('Could not save guardians. Please try again.');
      return;
    }
    onPlayerUpdated({ ...player, guardians });
    setEditing(false);
  }

  if (!editing || !isAdmin) {
    return (
      <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Guardians</h2>
        {player.guardians.length === 0 && <p className="mt-3 text-slate">No guardians on file.</p>}
        {player.guardians.map((guardian, index) => (
          <p key={index} className="mt-3 text-slate">
            {RELATION_LABEL[guardian.relation]}: {guardian.name} — {guardian.phone} — {guardian.email}
          </p>
        ))}
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="mt-4">
            Edit
          </Button>
        )}
      </section>
    );
  }

  return (
    <form onSubmit={handleSave} aria-label="Edit guardians" className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
      <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">Guardians</h2>
      {guardians.map((guardian, index) => (
        <div key={index} className="mb-4 rounded-md border border-border p-3">
          <label htmlFor={`edit-guardian-relation-${index}`} className="mb-1 block text-sm font-medium text-ink">
            Relation
          </label>
          <select
            id={`edit-guardian-relation-${index}`}
            className={`${FIELD_CLASS} mb-3 w-full`}
            value={guardian.relation}
            onChange={(e) => updateGuardian(index, { relation: e.target.value as Guardian['relation'] })}
          >
            <option value="mother">Mother</option>
            <option value="father">Father</option>
            <option value="other">Other</option>
          </select>

          <label htmlFor={`edit-guardian-name-${index}`} className="mb-1 block text-sm font-medium text-ink">
            Guardian name
          </label>
          <Input
            id={`edit-guardian-name-${index}`}
            value={guardian.name}
            onChange={(e) => updateGuardian(index, { name: e.target.value })}
            required
            className="mb-3 w-full"
          />

          <label htmlFor={`edit-guardian-phone-${index}`} className="mb-1 block text-sm font-medium text-ink">
            Guardian phone
          </label>
          <Input
            id={`edit-guardian-phone-${index}`}
            value={guardian.phone}
            onChange={(e) => updateGuardian(index, { phone: e.target.value })}
            className="mb-3 w-full"
          />

          <label htmlFor={`edit-guardian-email-${index}`} className="mb-1 block text-sm font-medium text-ink">
            Guardian email
          </label>
          <Input
            id={`edit-guardian-email-${index}`}
            type="email"
            value={guardian.email}
            onChange={(e) => updateGuardian(index, { email: e.target.value })}
            className="mb-3 w-full"
          />

          {guardians.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => removeGuardian(index)}>
              Remove guardian
            </Button>
          )}
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addGuardian} className="mb-4">
        + Add guardian
      </Button>

      <div className="flex gap-3">
        <Button variant="primary" type="submit">
          Save
        </Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}
    </form>
  );
}
```

Note: `Guardian phone`/`Guardian name`/`Guardian email` labels here reuse the same text as `AddPlayerDialog`'s guardian fields — this test's `getByLabelText` calls are scoped to a single-guardian player so `getByLabelText` (not `getAllByLabelText`) resolves unambiguously within this render.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/players/GuardiansSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Modify `src/players/PlayerCardPage.tsx`** — render `GuardiansSection`

Add the import `import { GuardiansSection } from './GuardiansSection';` and add, after the `<PlayerSkillsSection ... />` element:
```tsx
      <GuardiansSection
        teamId={teamId}
        playerId={playerId}
        player={player}
        onPlayerUpdated={setPlayer}
        isAdmin={isAdmin}
      />
```

- [ ] **Step 7: Run the full suite**

Run: `npm test && npx tsc -b --force`

- [ ] **Step 8: Commit**

```bash
git add src/players/playersApi.ts src/players/GuardiansSection.tsx src/players/GuardiansSection.test.tsx src/players/PlayerCardPage.tsx
git commit -m "Add guardians display/edit section to the player card"
```

---

## Task 7: Shared status vocabulary (`StatusChip` + `STATUS_OPTIONS`)

**Files:**
- Create: `src/components/StatusChip.tsx`
- Create: `src/components/StatusChip.test.tsx`

**Interfaces:**
- Consumes: `ObjectiveStatus` from `src/types/developmentPlan.ts` (Task 1).
- Produces: `STATUS_OPTIONS: ObjectiveStatus[]` (the 5 values in a sensible edit-dropdown order) and `StatusChip({ status }): JSX` — consumed by Task 8's `DevelopmentPlanEditor`, and by Plan 3's training-session status display later (per the design system, the same vocabulary is shared across dev-plan objectives and training sessions).

- [ ] **Step 1: Write the failing test `src/components/StatusChip.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusChip, STATUS_OPTIONS } from './StatusChip';

describe('StatusChip', () => {
  it('lists all 5 statuses in STATUS_OPTIONS', () => {
    expect(STATUS_OPTIONS).toEqual(['Not started', 'In progress', 'Active', 'Attention', 'Completed']);
  });

  it('renders Active with the green tint class', () => {
    render(<StatusChip status="Active" />);
    expect(screen.getByText('Active')).toHaveClass('bg-green/10', 'text-green');
  });

  it('renders Completed with the solid ink fill', () => {
    render(<StatusChip status="Completed" />);
    expect(screen.getByText('Completed')).toHaveClass('bg-ink', 'text-white');
  });

  it('renders Not started with the muted slate treatment', () => {
    render(<StatusChip status="Not started" />);
    expect(screen.getByText('Not started')).toHaveClass('bg-bg', 'text-slate');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/StatusChip.test.tsx`
Expected: FAIL with "Cannot find module './StatusChip'".

- [ ] **Step 3: Write `src/components/StatusChip.tsx`**

```tsx
import type { ObjectiveStatus } from '../types/developmentPlan';

export const STATUS_OPTIONS: ObjectiveStatus[] = ['Not started', 'In progress', 'Active', 'Attention', 'Completed'];

const STATUS_CLASS: Record<ObjectiveStatus, string> = {
  Active: 'bg-green/10 text-green',
  'In progress': 'bg-blue/10 text-blue',
  Completed: 'bg-ink text-white',
  'Not started': 'bg-bg text-slate',
  Attention: 'bg-orange/10 text-orange',
};

export function StatusChip({ status }: { status: ObjectiveStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {status}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/StatusChip.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/StatusChip.tsx src/components/StatusChip.test.tsx
git commit -m "Add shared status vocabulary component (StatusChip + STATUS_OPTIONS)"
```

---

## Task 8: `DevelopmentPlanEditor` shared component

**Files:**
- Create: `src/components/DevelopmentPlanEditor.tsx`
- Create: `src/components/DevelopmentPlanEditor.test.tsx`

**Interfaces:**
- Consumes: `DevelopmentPlan`, `ShortTermObjective`, `SeasonObjective`, `ObjectiveStatus` from `src/types/developmentPlan.ts`; `StatusChip`, `STATUS_OPTIONS` from `src/components/StatusChip.tsx`; `Button`, `Input`, `Textarea` from `src/components/`.
- Produces: `DevelopmentPlanEditor({ plan: DevelopmentPlan; onSave: (plan: DevelopmentPlan) => Promise<void>; isAdmin: boolean })` — used identically by Task 9 (team) and Task 10 (player), following the same view/edit-toggle + `isAdmin`-gating pattern established by `PlayerContactSection`/`GuardiansSection`.

- [ ] **Step 1: Write the failing test `src/components/DevelopmentPlanEditor.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DevelopmentPlanEditor } from './DevelopmentPlanEditor';
import type { DevelopmentPlan } from '../types/developmentPlan';

const emptyPlan: DevelopmentPlan = { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' };

describe('DevelopmentPlanEditor', () => {
  it('shows objectives read-only and hides Edit when isAdmin is false', () => {
    const plan: DevelopmentPlan = {
      shortTermObjectives: [{ objective: 'Improve serve', targetDate: '2026-12-01', status: 'In progress', coachComment: 'Good progress' }],
      seasonObjectives: [],
      generalNotes: 'Focused player',
    };

    render(<DevelopmentPlanEditor plan={plan} onSave={vi.fn()} isAdmin={false} />);

    expect(screen.getByText(/Improve serve/)).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('adds a short-term objective and saves the whole plan', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<DevelopmentPlanEditor plan={emptyPlan} onSave={onSave} isAdmin={true} />);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('+ Add short-term objective'));
    fireEvent.change(screen.getByLabelText('Objective'), { target: { value: 'Improve serve accuracy' } });
    fireEvent.change(screen.getByLabelText('Target date'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Active' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        shortTermObjectives: [
          { objective: 'Improve serve accuracy', targetDate: '2026-12-01', status: 'Active', coachComment: '' },
        ],
        seasonObjectives: [],
        generalNotes: '',
      })
    );
  });

  it('shows a save error without discarding edits', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('nope'));
    render(<DevelopmentPlanEditor plan={emptyPlan} onSave={onSave} isAdmin={true} />);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/DevelopmentPlanEditor.test.tsx`
Expected: FAIL with "Cannot find module './DevelopmentPlanEditor'".

- [ ] **Step 3: Write `src/components/DevelopmentPlanEditor.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Button } from './Button';
import { Input, Textarea } from './Input';
import { StatusChip, STATUS_OPTIONS } from './StatusChip';
import type { DevelopmentPlan, ObjectiveStatus, SeasonObjective, ShortTermObjective } from '../types/developmentPlan';

interface DevelopmentPlanEditorProps {
  plan: DevelopmentPlan;
  onSave: (plan: DevelopmentPlan) => Promise<void>;
  isAdmin: boolean;
}

const selectClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue';

export function DevelopmentPlanEditor({ plan, onSave, isAdmin }: DevelopmentPlanEditorProps) {
  const [editing, setEditing] = useState(false);
  const [shortTermObjectives, setShortTermObjectives] = useState<ShortTermObjective[]>(plan.shortTermObjectives);
  const [seasonObjectives, setSeasonObjectives] = useState<SeasonObjective[]>(plan.seasonObjectives);
  const [generalNotes, setGeneralNotes] = useState(plan.generalNotes);
  const [error, setError] = useState<string | null>(null);

  function updateShortTerm(index: number, updates: Partial<ShortTermObjective>) {
    setShortTermObjectives((current) => current.map((o, i) => (i === index ? { ...o, ...updates } : o)));
  }
  function addShortTerm() {
    setShortTermObjectives((current) => [
      ...current,
      { objective: '', targetDate: '', status: 'Not started', coachComment: '' },
    ]);
  }
  function removeShortTerm(index: number) {
    setShortTermObjectives((current) => current.filter((_, i) => i !== index));
  }

  function updateSeason(index: number, updates: Partial<SeasonObjective>) {
    setSeasonObjectives((current) => current.map((o, i) => (i === index ? { ...o, ...updates } : o)));
  }
  function addSeason() {
    setSeasonObjectives((current) => [...current, { objective: '', target: '', status: 'Not started', coachComment: '' }]);
  }
  function removeSeason(index: number) {
    setSeasonObjectives((current) => current.filter((_, i) => i !== index));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await onSave({ shortTermObjectives, seasonObjectives, generalNotes });
    } catch {
      setError('Could not save the development plan. Please try again.');
      return;
    }
    setEditing(false);
  }

  if (!editing || !isAdmin) {
    return (
      <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Development Plan</h2>

        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate">Short-term objectives</h3>
        {plan.shortTermObjectives.length === 0 && <p className="mt-2 text-slate">None yet.</p>}
        {plan.shortTermObjectives.map((o, i) => (
          <p key={i} className="mt-2 text-slate">
            {o.objective} — {o.targetDate} — <StatusChip status={o.status} /> — {o.coachComment}
          </p>
        ))}

        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate">Season objectives</h3>
        {plan.seasonObjectives.length === 0 && <p className="mt-2 text-slate">None yet.</p>}
        {plan.seasonObjectives.map((o, i) => (
          <p key={i} className="mt-2 text-slate">
            {o.objective} — {o.target} — <StatusChip status={o.status} /> — {o.coachComment}
          </p>
        ))}

        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate">General notes</h3>
        <p className="mt-2 whitespace-pre-wrap text-slate">{plan.generalNotes || 'None yet.'}</p>

        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="mt-4">
            Edit
          </Button>
        )}
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      aria-label="Edit development plan"
      className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card"
    >
      <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">Development Plan</h2>

      <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate">Short-term objectives</h3>
      {shortTermObjectives.map((o, i) => (
        <div key={i} className="mt-3 rounded-md border border-border p-3">
          <label htmlFor={`short-term-objective-${i}`} className="mb-1 block text-sm font-medium text-ink">
            Objective
          </label>
          <Input
            id={`short-term-objective-${i}`}
            value={o.objective}
            onChange={(e) => updateShortTerm(i, { objective: e.target.value })}
            className="mb-3 w-full"
          />

          <label htmlFor={`short-term-date-${i}`} className="mb-1 block text-sm font-medium text-ink">
            Target date
          </label>
          <Input
            id={`short-term-date-${i}`}
            type="date"
            value={o.targetDate}
            onChange={(e) => updateShortTerm(i, { targetDate: e.target.value })}
            className="mb-3 w-full"
          />

          <label htmlFor={`short-term-status-${i}`} className="mb-1 block text-sm font-medium text-ink">
            Status
          </label>
          <select
            id={`short-term-status-${i}`}
            className={`${selectClass} mb-3`}
            value={o.status}
            onChange={(e) => updateShortTerm(i, { status: e.target.value as ObjectiveStatus })}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <label htmlFor={`short-term-comment-${i}`} className="mb-1 block text-sm font-medium text-ink">
            Coach comment
          </label>
          <Textarea
            id={`short-term-comment-${i}`}
            value={o.coachComment}
            onChange={(e) => updateShortTerm(i, { coachComment: e.target.value })}
            className="w-full"
          />

          <Button variant="ghost" size="sm" onClick={() => removeShortTerm(i)} className="mt-2">
            Remove
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addShortTerm} className="mt-3">
        + Add short-term objective
      </Button>

      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate">Season objectives</h3>
      {seasonObjectives.map((o, i) => (
        <div key={i} className="mt-3 rounded-md border border-border p-3">
          <label htmlFor={`season-objective-${i}`} className="mb-1 block text-sm font-medium text-ink">
            Objective
          </label>
          <Input
            id={`season-objective-${i}`}
            value={o.objective}
            onChange={(e) => updateSeason(i, { objective: e.target.value })}
            className="mb-3 w-full"
          />

          <label htmlFor={`season-target-${i}`} className="mb-1 block text-sm font-medium text-ink">
            Target
          </label>
          <Input
            id={`season-target-${i}`}
            value={o.target}
            onChange={(e) => updateSeason(i, { target: e.target.value })}
            className="mb-3 w-full"
          />

          <label htmlFor={`season-status-${i}`} className="mb-1 block text-sm font-medium text-ink">
            Status
          </label>
          <select
            id={`season-status-${i}`}
            className={`${selectClass} mb-3`}
            value={o.status}
            onChange={(e) => updateSeason(i, { status: e.target.value as ObjectiveStatus })}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <label htmlFor={`season-comment-${i}`} className="mb-1 block text-sm font-medium text-ink">
            Coach comment
          </label>
          <Textarea
            id={`season-comment-${i}`}
            value={o.coachComment}
            onChange={(e) => updateSeason(i, { coachComment: e.target.value })}
            className="w-full"
          />

          <Button variant="ghost" size="sm" onClick={() => removeSeason(i)} className="mt-2">
            Remove
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addSeason} className="mt-3">
        + Add season objective
      </Button>

      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate">General notes</h3>
      <Textarea
        value={generalNotes}
        onChange={(e) => setGeneralNotes(e.target.value)}
        className="mt-2 min-h-[100px] w-full"
      />

      <div className="mt-6 flex gap-3">
        <Button variant="primary" type="submit">
          Save
        </Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/DevelopmentPlanEditor.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test && npx tsc -b --force`

- [ ] **Step 6: Commit**

```bash
git add src/components/DevelopmentPlanEditor.tsx src/components/DevelopmentPlanEditor.test.tsx
git commit -m "Add shared DevelopmentPlanEditor component"
```

---

## Task 9: Team development plan tab

**Files:**
- Modify: `src/teams/teamsApi.ts` (add `updateTeamDevelopmentPlan`)
- Modify: `src/teams/teamsApi.test.ts` (test the new function)
- Modify: `src/teams/TeamPage.tsx` (add a "Development Plan" tab)

**Interfaces:**
- Produces: `updateTeamDevelopmentPlan(teamId: string, plan: DevelopmentPlan): Promise<void>` in `teamsApi.ts`.

Note: `firestore.rules`'s `teams/{teamId}` read rule only grants access to admins in `adminEmails` — a viewer can never load `TeamPage` at all (they only ever read their own player doc directly). So anyone who successfully renders `TeamPage` is, by construction, a team admin — `DevelopmentPlanEditor`'s `isAdmin` prop is passed as the literal `true` here, unlike the player card where both admins and (eventually) viewers can load the same page.

- [ ] **Step 1: Write the failing test** — append to `src/teams/teamsApi.test.ts`

```ts
  it('updates the team development plan', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateTeamDevelopmentPlan('team-1', {
      shortTermObjectives: [{ objective: 'Improve serve', targetDate: '2026-12-01', status: 'Active', coachComment: '' }],
      seasonObjectives: [],
      generalNotes: 'On track',
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', {
      developmentPlan: {
        shortTermObjectives: [{ objective: 'Improve serve', targetDate: '2026-12-01', status: 'Active', coachComment: '' }],
        seasonObjectives: [],
        generalNotes: 'On track',
      },
    });
  });
```

This requires `mockUpdateDoc` to exist as a named mock in the file's `vi.mock('firebase/firestore', ...)` block. The file's actual current mock setup (confirmed by reading it, not assumed) already uses `vi.hoisted()` with direct assignment for its other mocks, with `updateDoc: vi.fn()` still inline/unnamed:

```ts
const { mockAddDoc, mockCollection, mockGetDocs, mockQuery, mockWhere, mockOrderBy, mockLimit } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockCollection: vi.fn(() => 'teams-collection'),
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn((...args: unknown[]) => args),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  mockOrderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  mockLimit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  serverTimestamp: () => 'server-timestamp',
  doc: vi.fn(() => 'doc-ref'),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
}));
```

**`mockUpdateDoc` must join the existing `vi.hoisted()` destructuring** — a separate bare `const mockUpdateDoc = vi.fn();` declared outside `vi.hoisted()` would hit the exact TDZ `ReferenceError` that made Plan 1's Task 6 introduce `vi.hoisted()` in the first place (`vi.mock` is hoisted above normal `const` declarations by Vitest's transform, so referencing a plain, un-hoisted const inside the factory is unsafe). Replace the block above with:

```ts
const { mockAddDoc, mockCollection, mockGetDocs, mockQuery, mockWhere, mockOrderBy, mockLimit, mockUpdateDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockCollection: vi.fn(() => 'teams-collection'),
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn((...args: unknown[]) => args),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  mockOrderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  mockLimit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  mockUpdateDoc: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  serverTimestamp: () => 'server-timestamp',
  doc: vi.fn(() => 'doc-ref'),
  getDoc: vi.fn(),
  updateDoc: mockUpdateDoc,
}));
```

Add `updateTeamDevelopmentPlan` to the existing `import { createTeam, listMyTeams } from './teamsApi';` line at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/teams/teamsApi.test.ts`
Expected: FAIL — `updateTeamDevelopmentPlan` doesn't exist yet.

- [ ] **Step 3: Add `updateTeamDevelopmentPlan` to `src/teams/teamsApi.ts`**

Append after `updateTeamInfo`, and add the import `import type { DevelopmentPlan } from '../types/developmentPlan';` at the top:

```ts
export async function updateTeamDevelopmentPlan(teamId: string, plan: DevelopmentPlan): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), { developmentPlan: plan });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/teams/teamsApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Modify `src/teams/TeamPage.tsx`** — add the Development Plan tab

Add the import `import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';` and add `updateTeamDevelopmentPlan` to the existing `import { getTeam } from './teamsApi';` line (becomes `import { getTeam, updateTeamDevelopmentPlan } from './teamsApi';`).

Change the `Tab` type and tab nav:
```ts
type Tab = 'overview' | 'plan' | 'settings';
```
Add a third tab button alongside Overview/Settings:
```tsx
          <button onClick={() => setTab('plan')} className={tabClass(tab === 'plan')}>
            Development Plan
          </button>
```
(placed between the Overview and Settings buttons in the `<nav>`)

Add the tab's content alongside the existing `{tab === 'overview' && ...}` / `{tab === 'settings' && ...}` blocks:
```tsx
          {tab === 'plan' && (
            <DevelopmentPlanEditor
              plan={team.developmentPlan}
              onSave={(plan) => updateTeamDevelopmentPlan(teamId, plan).then(() => setTeam({ ...team, developmentPlan: plan }))}
              isAdmin={true}
            />
          )}
```

- [ ] **Step 6: Run the full suite**

Run: `npm test && npx tsc -b --force`
Expected: all pass, 0 errors. `TeamPage.test.tsx`'s only case tests the rejected-read error path and never queries the tab list, so adding a third tab does not affect it.

- [ ] **Step 7: Commit**

```bash
git add src/teams/teamsApi.ts src/teams/teamsApi.test.ts src/teams/TeamPage.tsx
git commit -m "Add team development plan tab"
```

---

## Task 10: Player development plan section

**Files:**
- Modify: `src/players/playersApi.ts` (add `updatePlayerDevelopmentPlan`)
- Modify: `src/players/playersApi.test.ts` (test the new function)
- Modify: `src/players/PlayerCardPage.tsx` (render `DevelopmentPlanEditor`)

**Interfaces:**
- Produces: `updatePlayerDevelopmentPlan(teamId, playerId, plan: DevelopmentPlan): Promise<void>` in `playersApi.ts`.

Unlike the team page (Task 9), a linked viewer CAN eventually load `PlayerCardPage` (once the invite flow ships), so this reuses the real `isAdmin` value already computed in `PlayerCardPage` from Task 2's fix (team-membership based), not a literal `true`.

- [ ] **Step 1: Write the failing test** — append to `src/players/playersApi.test.ts`

```ts
  it('updates the player development plan', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updatePlayerDevelopmentPlan('team-1', 'player-1', {
      shortTermObjectives: [],
      seasonObjectives: [{ objective: 'Make varsity', target: 'Consistent 6+ average', status: 'In progress', coachComment: '' }],
      generalNotes: '',
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({
        developmentPlan: {
          shortTermObjectives: [],
          seasonObjectives: [{ objective: 'Make varsity', target: 'Consistent 6+ average', status: 'In progress', coachComment: '' }],
          generalNotes: '',
        },
      })
    );
  });
```

This requires `updateDoc` to be a named `mockUpdateDoc` in this test file's `vi.mock('firebase/firestore', ...)` block. `src/players/playersApi.test.ts`'s actual current setup is:

```ts
const { mockAddDoc, mockGetDocs, mockCollection, mockQuery } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn(() => 'players-collection'),
  mockQuery: vi.fn((...args: unknown[]) => args),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  startAfter: vi.fn((...args: unknown[]) => ({ type: 'startAfter', args })),
  serverTimestamp: () => 'server-timestamp',
  doc: vi.fn(() => 'doc-ref'),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
}));
```

As with Task 9's identical fix for `teamsApi.test.ts`: **`mockUpdateDoc` must join the existing `vi.hoisted()` destructuring**, not be declared as a separate bare `const` (which would reintroduce the TDZ `ReferenceError` `vi.hoisted()` exists to avoid). Replace the block above with:

```ts
const { mockAddDoc, mockGetDocs, mockCollection, mockQuery, mockUpdateDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn(() => 'players-collection'),
  mockQuery: vi.fn((...args: unknown[]) => args),
  mockUpdateDoc: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  startAfter: vi.fn((...args: unknown[]) => ({ type: 'startAfter', args })),
  serverTimestamp: () => 'server-timestamp',
  doc: vi.fn(() => 'doc-ref'),
  getDoc: vi.fn(),
  updateDoc: mockUpdateDoc,
}));
```

Add `updatePlayerDevelopmentPlan` to the existing `import { createPlayer, listPlayers } from './playersApi';` line.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/players/playersApi.test.ts`
Expected: FAIL — `updatePlayerDevelopmentPlan` doesn't exist yet.

- [ ] **Step 3: Add `updatePlayerDevelopmentPlan` to `src/players/playersApi.ts`**

Append, and add the import `import type { DevelopmentPlan } from '../types/developmentPlan';`:

```ts
export async function updatePlayerDevelopmentPlan(teamId: string, playerId: string, plan: DevelopmentPlan): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'players', playerId), { developmentPlan: plan, updatedAt: serverTimestamp() });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/players/playersApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Modify `src/players/PlayerCardPage.tsx`** — render `DevelopmentPlanEditor`

Add the imports `import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';` and add `updatePlayerDevelopmentPlan` to the existing `import { getPlayer } from './playersApi';` line.

Add, after the `<GuardiansSection ... />` element (from Task 6):
```tsx
      <DevelopmentPlanEditor
        plan={player.developmentPlan}
        onSave={(plan) =>
          updatePlayerDevelopmentPlan(teamId, playerId, plan).then(() => setPlayer({ ...player, developmentPlan: plan }))
        }
        isAdmin={isAdmin}
      />
```

- [ ] **Step 6: Run the full suite**

Run: `npm test && npx tsc -b --force`

- [ ] **Step 7: Commit**

```bash
git add src/players/playersApi.ts src/players/playersApi.test.ts src/players/PlayerCardPage.tsx
git commit -m "Add player development plan section"
```

---

## Task 11: Physical test types

**Files:**
- Create: `src/types/physicalTest.ts`

**Interfaces:**
- Produces: `PhysicalTestType`, the 8 per-type entry interfaces, `PhysicalTestData` (their union), `PhysicalTest` (a stored doc — the union combined with common fields `id`/`date`/`notes`/`recordedBy`/`createdAt`), `NewPhysicalTestInput` (the union without `id`/`createdAt`, for writes) — consumed by Tasks 12-18.

This mirrors the Firestore document shape exactly as specified in the app design spec §5 and the Plan 2 design doc §4: a flat document per test type with a `testType` discriminant, not a nested sub-object — so `PhysicalTest` is a discriminated union of `{ common fields } & { per-type fields }`, narrowable via `test.testType`.

- [ ] **Step 1: Write `src/types/physicalTest.ts`**

```ts
export type PhysicalTestType =
  | 'growth'
  | 'cmj'
  | 'approachJump'
  | 'broadJump'
  | 'sprint10m'
  | 'shuttle5105'
  | 'reaction'
  | 'strength';

export interface GrowthData {
  testType: 'growth';
  heightCm: number;
  bodyMassKg: number;
}

export interface CmjData {
  testType: 'cmj';
  attemptsCm: number[];
  bestCm: number;
}

export interface ApproachJumpData {
  testType: 'approachJump';
  standingReachCm: number;
  attemptsTouchCm: number[];
  bestTouchCm: number;
  approachJumpCm: number;
}

export interface BroadJumpData {
  testType: 'broadJump';
  attemptsCm: number[];
  bestCm: number;
}

export interface Sprint10mData {
  testType: 'sprint10m';
  attemptsSeconds: number[];
  bestSeconds: number;
}

export interface Shuttle5105Data {
  testType: 'shuttle5105';
  rightFirstSeconds: number;
  leftFirstSeconds: number;
}

export interface ReactionData {
  testType: 'reaction';
  attemptsCm: number[];
  averageCm: number;
  reactionTimeMs: number;
}

export type WeightedExercise = 'trapBarDeadlift' | 'squat' | 'gobletSquat';
export type BodyweightExercise = 'pushUps' | 'splitSquat';

export interface WeightedStrengthData {
  testType: 'strength';
  mode: 'weighted';
  exercise: WeightedExercise;
  weightKg: number;
  reps6RM: 6;
  bodyMassRatio: number | null;
}

export interface BodyweightStrengthData {
  testType: 'strength';
  mode: 'bodyweight';
  exercise: BodyweightExercise;
  reps: number;
}

export type StrengthData = WeightedStrengthData | BodyweightStrengthData;

export type PhysicalTestData =
  | GrowthData
  | CmjData
  | ApproachJumpData
  | BroadJumpData
  | Sprint10mData
  | Shuttle5105Data
  | ReactionData
  | StrengthData;

export interface PhysicalTestCommon {
  id: string;
  date: string;
  notes: string;
  recordedBy: string;
  createdAt: unknown;
}

export type PhysicalTest =
  | (PhysicalTestCommon & GrowthData)
  | (PhysicalTestCommon & CmjData)
  | (PhysicalTestCommon & ApproachJumpData)
  | (PhysicalTestCommon & BroadJumpData)
  | (PhysicalTestCommon & Sprint10mData)
  | (PhysicalTestCommon & Shuttle5105Data)
  | (PhysicalTestCommon & ReactionData)
  | (PhysicalTestCommon & StrengthData);

export type NewPhysicalTestInput = PhysicalTestData & { date: string; notes: string };

export const PHYSICAL_TEST_LABELS: Record<PhysicalTestType, string> = {
  growth: 'Growth',
  cmj: 'Countermovement Jump',
  approachJump: 'Approach Jump',
  broadJump: 'Standing Broad Jump',
  sprint10m: '10m Sprint',
  shuttle5105: '5-10-5 Shuttle',
  reaction: 'Reaction Time',
  strength: 'Strength',
};

export const PHYSICAL_TEST_ORDER: PhysicalTestType[] = [
  'growth',
  'cmj',
  'approachJump',
  'broadJump',
  'sprint10m',
  'shuttle5105',
  'reaction',
  'strength',
];
```

- [ ] **Step 2: Verify the build**

Run: `npx tsc -b --force`
Expected: 0 errors (this file has no runtime logic to test — it's exercised indirectly by every task from here on that imports it).

- [ ] **Step 3: Commit**

```bash
git add src/types/physicalTest.ts
git commit -m "Add physical test types"
```

---

## Task 12: `physicalTestMath` — protocol-exact computations

**Files:**
- Create: `src/players/physicalTestMath.ts`
- Create: `src/players/physicalTestMath.test.ts`

**Interfaces:**
- Produces: `bestOf(attempts: number[], mode: 'max' | 'min'): number`, `computeApproachJump(standingReachCm: number, attemptsTouchCm: number[]): { bestTouchCm: number; approachJumpCm: number }`, `computeReaction(attemptsCm: number[]): { averageCm: number; reactionTimeMs: number }`, `computeBodyMassRatio(weightKg: number, bodyMassKg: number): number` — consumed by Tasks 15-16's entry dialogs.

Test values are the coach's own worked examples from the protocol notes, so a correct implementation is directly checkable against them: CMJ best of 3 = 34cm; approach jump standing reach 222cm / max touch 267cm = 45cm; reaction 20cm average ≈ 202ms; trap-bar deadlift 55kg / 50kg body mass = 1.10 ratio.

- [ ] **Step 1: Write the failing test `src/players/physicalTestMath.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { bestOf, computeApproachJump, computeReaction, computeBodyMassRatio } from './physicalTestMath';

describe('bestOf', () => {
  it('returns the max for jump-type tests', () => {
    expect(bestOf([30, 34, 32], 'max')).toBe(34);
  });

  it('returns the min for time-type tests', () => {
    expect(bestOf([1.85, 1.79, 1.9], 'min')).toBe(1.79);
  });
});

describe('computeApproachJump', () => {
  it('matches the coach\'s worked example: 222cm reach, 267cm best touch, 45cm approach jump', () => {
    const result = computeApproachJump(222, [260, 267, 265]);
    expect(result.bestTouchCm).toBe(267);
    expect(result.approachJumpCm).toBe(45);
  });
});

describe('computeReaction', () => {
  it('discards the min and max of 5 attempts, averages the middle 3, and converts to ms', () => {
    const result = computeReaction([15, 20, 20, 20, 30]);
    expect(result.averageCm).toBe(20);
    expect(result.reactionTimeMs).toBeCloseTo(201.93, 1);
  });
});

describe('computeBodyMassRatio', () => {
  it('matches the coach\'s worked example: 55kg / 50kg = 1.10', () => {
    expect(computeBodyMassRatio(55, 50)).toBeCloseTo(1.1, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/players/physicalTestMath.test.ts`
Expected: FAIL with "Cannot find module './physicalTestMath'".

- [ ] **Step 3: Write `src/players/physicalTestMath.ts`**

```ts
export function bestOf(attempts: number[], mode: 'max' | 'min'): number {
  return mode === 'max' ? Math.max(...attempts) : Math.min(...attempts);
}

export function computeApproachJump(
  standingReachCm: number,
  attemptsTouchCm: number[]
): { bestTouchCm: number; approachJumpCm: number } {
  const bestTouchCm = bestOf(attemptsTouchCm, 'max');
  return { bestTouchCm, approachJumpCm: bestTouchCm - standingReachCm };
}

export function computeReaction(attemptsCm: number[]): { averageCm: number; reactionTimeMs: number } {
  const sorted = [...attemptsCm].sort((a, b) => a - b);
  const middle = sorted.slice(1, -1);
  const averageCm = middle.reduce((sum, value) => sum + value, 0) / middle.length;
  const reactionTimeMs = Math.sqrt((2 * (averageCm / 100)) / 9.81) * 1000;
  return { averageCm, reactionTimeMs };
}

export function computeBodyMassRatio(weightKg: number, bodyMassKg: number): number {
  return weightKg / bodyMassKg;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/players/physicalTestMath.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/players/physicalTestMath.ts src/players/physicalTestMath.test.ts
git commit -m "Add physical test computation functions matching the coach's protocol"
```

---

## Task 13: Physical tests data layer and rules

**Files:**
- Create: `src/players/physicalTestsApi.ts`
- Create: `src/players/physicalTestsApi.test.ts`
- Modify: `firestore.rules` (nest a `physicalTests` match inside `teams/{teamId}/players/{playerId}`)
- Modify: `firestore.indexes.json` (add the `physicalTests` composite index)
- Create: `tests/rules/physicalTests.rules.test.ts`

**Interfaces:**
- Consumes: `NewPhysicalTestInput`, `PhysicalTest`, `PhysicalTestType` from `src/types/physicalTest.ts`.
- Produces: `createPhysicalTest(teamId, playerId, input, recordedByUid): Promise<string>`, `getLatestByType(teamId, playerId, testType): Promise<PhysicalTest | null>`, `listHistoryByType(teamId, playerId, testType, afterDoc): Promise<{ tests: PhysicalTest[]; lastDoc }>` — consumed by Tasks 15-18.

- [ ] **Step 1: Write the failing test `src/players/physicalTestsApi.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPhysicalTest, getLatestByType, listHistoryByType } from './physicalTestsApi';

const { mockAddDoc, mockGetDocs, mockCollection, mockQuery } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn(() => 'physical-tests-collection'),
  mockQuery: vi.fn((...args: unknown[]) => args),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  startAfter: vi.fn((...args: unknown[]) => ({ type: 'startAfter', args })),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('physicalTestsApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('creates a physical test entry stamped with the recorder and a server timestamp', async () => {
    mockAddDoc.mockResolvedValue({ id: 'test-1' });

    const id = await createPhysicalTest(
      'team-1',
      'player-1',
      { testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34, date: '2026-09-07', notes: '' },
      'coach-uid'
    );

    expect(id).toBe('test-1');
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload).toMatchObject({
      testType: 'cmj',
      bestCm: 34,
      recordedBy: 'coach-uid',
      createdAt: 'server-timestamp',
    });
  });

  it('gets the latest entry for a given test type', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'test-1', data: () => ({ testType: 'cmj', bestCm: 34, date: '2026-09-07' }) }],
    });

    const latest = await getLatestByType('team-1', 'player-1', 'cmj');

    expect(latest).toEqual({ id: 'test-1', testType: 'cmj', bestCm: 34, date: '2026-09-07' });
  });

  it('returns null when no entry exists yet for that type', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const latest = await getLatestByType('team-1', 'player-1', 'cmj');

    expect(latest).toBeNull();
  });

  it('lists history for one test type, paginated', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'test-1', data: () => ({ testType: 'cmj', bestCm: 34, date: '2026-09-07' }) }],
    });

    const { tests, lastDoc } = await listHistoryByType('team-1', 'player-1', 'cmj');

    expect(tests).toEqual([{ id: 'test-1', testType: 'cmj', bestCm: 34, date: '2026-09-07' }]);
    expect(lastDoc).toEqual({ id: 'test-1', data: expect.any(Function) });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/players/physicalTestsApi.test.ts`
Expected: FAIL with "Cannot find module './physicalTestsApi'".

- [ ] **Step 3: Write `src/players/physicalTestsApi.ts`**

```ts
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { NewPhysicalTestInput, PhysicalTest, PhysicalTestType } from '../types/physicalTest';

const HISTORY_PAGE_SIZE = 10;

export async function createPhysicalTest(
  teamId: string,
  playerId: string,
  input: NewPhysicalTestInput,
  recordedByUid: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'teams', teamId, 'players', playerId, 'physicalTests'), {
    ...input,
    recordedBy: recordedByUid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getLatestByType(
  teamId: string,
  playerId: string,
  testType: PhysicalTestType
): Promise<PhysicalTest | null> {
  const base = collection(db, 'teams', teamId, 'players', playerId, 'physicalTests');
  const q = query(base, where('testType', '==', testType), orderBy('date', 'desc'), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.docs.length === 0) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as PhysicalTest;
}

export interface PhysicalTestHistoryPage {
  tests: PhysicalTest[];
  lastDoc: QueryDocumentSnapshot | null;
}

export async function listHistoryByType(
  teamId: string,
  playerId: string,
  testType: PhysicalTestType,
  afterDoc: QueryDocumentSnapshot | null = null
): Promise<PhysicalTestHistoryPage> {
  const base = collection(db, 'teams', teamId, 'players', playerId, 'physicalTests');
  const q = afterDoc
    ? query(base, where('testType', '==', testType), orderBy('date', 'desc'), startAfter(afterDoc), limit(HISTORY_PAGE_SIZE))
    : query(base, where('testType', '==', testType), orderBy('date', 'desc'), limit(HISTORY_PAGE_SIZE));
  const snapshot = await getDocs(q);
  const tests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PhysicalTest);
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { tests, lastDoc };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/players/physicalTestsApi.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing rules test `tests/rules/physicalTests.rules.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

async function seedTeamPlayerAndTest(env: Awaited<ReturnType<typeof getTestEnv>>) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    await db.doc('teams/team-1/players/player-1').set({
      fullName: 'Test Player',
      viewerEmails: ['parent@example.com'],
      skills: {
        serve: { score: null }, attack: { score: null }, set: { score: null }, defence: { score: null },
        reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
      },
    });
    await db.doc('teams/team-1/players/player-1/physicalTests/test-1').set({
      testType: 'cmj',
      attemptsCm: [30, 34, 32],
      bestCm: 34,
      date: '2026-09-07',
    });
  });
}

describe('physicalTests rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedTeamPlayerAndTest(env);
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets the team admin read and write physical tests', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1/players/player-1/physicalTests/test-1').get());
    await assertSucceeds(
      db.collection('teams/team-1/players/player-1/physicalTests').add({
        testType: 'growth',
        heightCm: 160,
        bodyMassKg: 50,
        date: '2026-09-07',
      })
    );
  });

  it('lets the linked viewer read but not write physical tests', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1/players/player-1/physicalTests/test-1').get());
    await assertFails(db.doc('teams/team-1/players/player-1/physicalTests/test-1').update({ bestCm: 99 }));
  });

  it('denies an unrelated user from reading physical tests', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('stranger-uid', { email: 'stranger@example.com' }).firestore();
    await assertFails(db.doc('teams/team-1/players/player-1/physicalTests/test-1').get());
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `export PATH="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot/bin:$PATH" && npm run test:rules`
Expected: FAIL — `physicalTests` isn't matched by any rule yet.

- [ ] **Step 7: Nest the `physicalTests` match inside `firestore.rules`**

Insert this new match block inside `match /players/{playerId} { ... }`, after the existing `allow delete: if false;` line for players and before that block's closing `}` (so it's nested two levels deep: `teams/{teamId}/players/{playerId}/physicalTests/{testId}`, able to reuse the already-in-scope `isTeamAdmin()` function):

```
        match /physicalTests/{testId} {
          allow read: if request.auth != null && (
            isTeamAdmin() ||
            request.auth.token.email in
              get(/databases/$(database)/documents/teams/$(teamId)/players/$(playerId)).data.viewerEmails
          );
          allow create, update: if request.auth != null && isTeamAdmin();
          allow delete: if false;
        }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `export PATH="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot/bin:$PATH" && npm run test:rules`
Expected: PASS (all `physicalTests.rules.test.ts` cases, plus every previously passing rules test).

- [ ] **Step 9: Add the composite index to `firestore.indexes.json`**

Add to the `indexes` array (alongside the existing `teams` entry):

```json
    {
      "collectionGroup": "physicalTests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "testType", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
```

- [ ] **Step 10: Run the full suite**

Run: `npm test && npx tsc -b --force`

- [ ] **Step 11: Commit**

```bash
git add src/players/physicalTestsApi.ts src/players/physicalTestsApi.test.ts firestore.rules firestore.indexes.json tests/rules/physicalTests.rules.test.ts
git commit -m "Add physical tests data layer and viewer/admin access rules"
```

---

## Task 14: `AttemptsInput` shared component

**Files:**
- Create: `src/components/AttemptsInput.tsx`
- Create: `src/components/AttemptsInput.test.tsx`

**Interfaces:**
- Produces: `AttemptsInput({ name, label, values, onChange, minCount, maxCount? })` — renders `values.length` numeric inputs labeled `"${label} ${index+1}"` with stable ids `${name}-attempt-${index}`, an optional "+ Add attempt" button when `values.length < maxCount`, and an optional "Remove last attempt" button when `values.length > minCount`. Consumed by Tasks 15-16 for CMJ/broad-jump/approach-jump-touch (fixed count, no `maxCount`), 10m sprint (`minCount: 2, maxCount: 3`), and reaction (fixed 5, no `maxCount`).

- [ ] **Step 1: Write the failing test `src/components/AttemptsInput.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttemptsInput } from './AttemptsInput';

describe('AttemptsInput', () => {
  it('renders one labeled input per value', () => {
    render(<AttemptsInput name="cmj" label="Attempt" values={[30, 34, 32]} onChange={vi.fn()} minCount={3} />);

    expect(screen.getByLabelText('Attempt 1')).toHaveValue(30);
    expect(screen.getByLabelText('Attempt 2')).toHaveValue(34);
    expect(screen.getByLabelText('Attempt 3')).toHaveValue(32);
  });

  it('calls onChange with the updated array when an attempt value changes', () => {
    const onChange = vi.fn();
    render(<AttemptsInput name="cmj" label="Attempt" values={[30, 34, 32]} onChange={onChange} minCount={3} />);

    fireEvent.change(screen.getByLabelText('Attempt 2'), { target: { value: '40' } });

    expect(onChange).toHaveBeenCalledWith([30, 40, 32]);
  });

  it('does not show add/remove controls when maxCount is not provided', () => {
    render(<AttemptsInput name="cmj" label="Attempt" values={[30, 34, 32]} onChange={vi.fn()} minCount={3} />);

    expect(screen.queryByText('+ Add attempt')).not.toBeInTheDocument();
    expect(screen.queryByText('Remove last attempt')).not.toBeInTheDocument();
  });

  it('adds an attempt up to maxCount, and allows removing back down to minCount', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AttemptsInput name="sprint" label="Attempt" values={[1.85, 1.9]} onChange={onChange} minCount={2} maxCount={3} />
    );

    fireEvent.click(screen.getByText('+ Add attempt'));
    expect(onChange).toHaveBeenCalledWith([1.85, 1.9, NaN]);

    rerender(
      <AttemptsInput name="sprint" label="Attempt" values={[1.85, 1.9, 1.79]} onChange={onChange} minCount={2} maxCount={3} />
    );
    expect(screen.queryByText('+ Add attempt')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Remove last attempt'));
    expect(onChange).toHaveBeenCalledWith([1.85, 1.9]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/AttemptsInput.test.tsx`
Expected: FAIL with "Cannot find module './AttemptsInput'".

- [ ] **Step 3: Write `src/components/AttemptsInput.tsx`**

```tsx
import { Button } from './Button';
import { Input } from './Input';

interface AttemptsInputProps {
  name: string;
  label: string;
  values: number[];
  onChange: (values: number[]) => void;
  minCount: number;
  maxCount?: number;
}

export function AttemptsInput({ name, label, values, onChange, minCount, maxCount }: AttemptsInputProps) {
  function updateAt(index: number, raw: string) {
    const next = [...values];
    next[index] = raw === '' ? NaN : Number(raw);
    onChange(next);
  }

  function addAttempt() {
    onChange([...values, NaN]);
  }

  function removeLast() {
    if (values.length > minCount) onChange(values.slice(0, -1));
  }

  return (
    <div>
      {values.map((value, index) => (
        <div key={index} className="mb-3">
          <label htmlFor={`${name}-attempt-${index}`} className="mb-1 block text-sm font-medium text-ink">
            {label} {index + 1}
          </label>
          <Input
            id={`${name}-attempt-${index}`}
            type="number"
            step="any"
            value={Number.isNaN(value) ? '' : value}
            onChange={(e) => updateAt(index, e.target.value)}
            className="w-full"
          />
        </div>
      ))}
      {maxCount !== undefined && values.length < maxCount && (
        <Button variant="secondary" size="sm" onClick={addAttempt} className="mb-3">
          + Add attempt
        </Button>
      )}
      {maxCount !== undefined && values.length > minCount && (
        <Button variant="ghost" size="sm" onClick={removeLast} className="mb-3 ml-2">
          Remove last attempt
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/AttemptsInput.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AttemptsInput.tsx src/components/AttemptsInput.test.tsx
git commit -m "Add shared AttemptsInput component for multi-attempt physical tests"
```

---

## Task 15: `AddPhysicalTestDialog` — growth, CMJ, broad jump, approach jump

**Files:**
- Create: `src/players/AddPhysicalTestDialog.tsx`
- Create: `src/players/AddPhysicalTestDialog.test.tsx`

**Interfaces:**
- Consumes: `bestOf`, `computeApproachJump` from `physicalTestMath.ts`; `createPhysicalTest` from `physicalTestsApi.ts`; `AttemptsInput`, `Button`, `Input`, `Textarea`.
- Produces: `AddPhysicalTestDialog({ teamId, playerId, testType, recordedByUid, onClose, onSaved })`. This task implements 4 of the 8 `testType` branches (`growth`, `cmj`, `broadJump`, `approachJump`); Task 16 extends the same file with the remaining 4 (`sprint10m`, `shuttle5105`, `reaction`, `strength`). The component is only rendered for these 4 types until Task 16 lands — it's wired into the app in Task 17.

- [ ] **Step 1: Write the failing test `src/players/AddPhysicalTestDialog.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddPhysicalTestDialog } from './AddPhysicalTestDialog';
import * as physicalTestsApi from './physicalTestsApi';

vi.mock('./physicalTestsApi');

describe('AddPhysicalTestDialog', () => {
  it('submits a growth entry', async () => {
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');
    const onSaved = vi.fn();

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="growth" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={onSaved} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Height (cm)'), { target: { value: '160' } });
    fireEvent.change(screen.getByLabelText('Body mass (kg)'), { target: { value: '50' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith(
      'team-1',
      'player-1',
      { testType: 'growth', heightCm: 160, bodyMassKg: 50, date: '2026-09-07', notes: '' },
      'coach-uid'
    );
  });

  it('submits a CMJ entry with the computed best', async () => {
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="cmj" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Attempt (cm) 1'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Attempt (cm) 2'), { target: { value: '34' } });
    fireEvent.change(screen.getByLabelText('Attempt (cm) 3'), { target: { value: '32' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        { testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34, date: '2026-09-07', notes: '' },
        'coach-uid'
      )
    );
  });

  it("submits an approach jump entry matching the coach's worked example", async () => {
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="approachJump" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Standing reach (cm)'), { target: { value: '222' } });
    fireEvent.change(screen.getByLabelText('Touch attempt (cm) 1'), { target: { value: '260' } });
    fireEvent.change(screen.getByLabelText('Touch attempt (cm) 2'), { target: { value: '267' } });
    fireEvent.change(screen.getByLabelText('Touch attempt (cm) 3'), { target: { value: '265' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        {
          testType: 'approachJump',
          standingReachCm: 222,
          attemptsTouchCm: [260, 267, 265],
          bestTouchCm: 267,
          approachJumpCm: 45,
          date: '2026-09-07',
          notes: '',
        },
        'coach-uid'
      )
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/players/AddPhysicalTestDialog.test.tsx`
Expected: FAIL with "Cannot find module './AddPhysicalTestDialog'".

- [ ] **Step 3: Write `src/players/AddPhysicalTestDialog.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { AttemptsInput } from '../components/AttemptsInput';
import { bestOf, computeApproachJump } from './physicalTestMath';
import { createPhysicalTest } from './physicalTestsApi';
import { PHYSICAL_TEST_LABELS } from '../types/physicalTest';
import type { NewPhysicalTestInput, PhysicalTestType } from '../types/physicalTest';

interface AddPhysicalTestDialogProps {
  teamId: string;
  playerId: string;
  testType: PhysicalTestType;
  recordedByUid: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AddPhysicalTestDialog({
  teamId,
  playerId,
  testType,
  recordedByUid,
  onClose,
  onSaved,
}: AddPhysicalTestDialogProps) {
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [heightCm, setHeightCm] = useState('');
  const [bodyMassKg, setBodyMassKg] = useState('');

  const [cmjAttempts, setCmjAttempts] = useState<number[]>([NaN, NaN, NaN]);
  const [broadJumpAttempts, setBroadJumpAttempts] = useState<number[]>([NaN, NaN, NaN]);

  const [standingReachCm, setStandingReachCm] = useState('');
  const [touchAttempts, setTouchAttempts] = useState<number[]>([NaN, NaN, NaN]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    let input: NewPhysicalTestInput;

    if (testType === 'growth') {
      input = { testType: 'growth', heightCm: Number(heightCm), bodyMassKg: Number(bodyMassKg), date, notes };
    } else if (testType === 'cmj') {
      input = { testType: 'cmj', attemptsCm: cmjAttempts, bestCm: bestOf(cmjAttempts, 'max'), date, notes };
    } else if (testType === 'broadJump') {
      input = {
        testType: 'broadJump',
        attemptsCm: broadJumpAttempts,
        bestCm: bestOf(broadJumpAttempts, 'max'),
        date,
        notes,
      };
    } else if (testType === 'approachJump') {
      const { bestTouchCm, approachJumpCm } = computeApproachJump(Number(standingReachCm), touchAttempts);
      input = {
        testType: 'approachJump',
        standingReachCm: Number(standingReachCm),
        attemptsTouchCm: touchAttempts,
        bestTouchCm,
        approachJumpCm,
        date,
        notes,
      };
    } else {
      // sprint10m / shuttle5105 / reaction / strength are added in Task 16
      return;
    }

    try {
      await createPhysicalTest(teamId, playerId, input, recordedByUid);
    } catch {
      setError('Could not save the test entry. Please try again.');
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label={`Add ${PHYSICAL_TEST_LABELS[testType]} entry`}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">Add {PHYSICAL_TEST_LABELS[testType]}</h2>

        <div className="mb-4">
          <label htmlFor="physical-test-date" className="mb-1 block text-sm font-medium text-ink">
            Date
          </label>
          <Input id="physical-test-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full" />
        </div>

        {testType === 'growth' && (
          <>
            <div className="mb-4">
              <label htmlFor="growth-height" className="mb-1 block text-sm font-medium text-ink">
                Height (cm)
              </label>
              <Input
                id="growth-height"
                type="number"
                step="any"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="growth-body-mass" className="mb-1 block text-sm font-medium text-ink">
                Body mass (kg)
              </label>
              <Input
                id="growth-body-mass"
                type="number"
                step="any"
                value={bodyMassKg}
                onChange={(e) => setBodyMassKg(e.target.value)}
                required
                className="w-full"
              />
            </div>
          </>
        )}

        {testType === 'cmj' && (
          <AttemptsInput name="cmj" label="Attempt (cm)" values={cmjAttempts} onChange={setCmjAttempts} minCount={3} />
        )}

        {testType === 'broadJump' && (
          <AttemptsInput
            name="broad-jump"
            label="Attempt (cm)"
            values={broadJumpAttempts}
            onChange={setBroadJumpAttempts}
            minCount={3}
          />
        )}

        {testType === 'approachJump' && (
          <>
            <div className="mb-4">
              <label htmlFor="standing-reach" className="mb-1 block text-sm font-medium text-ink">
                Standing reach (cm)
              </label>
              <Input
                id="standing-reach"
                type="number"
                step="any"
                value={standingReachCm}
                onChange={(e) => setStandingReachCm(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <AttemptsInput
              name="approach-touch"
              label="Touch attempt (cm)"
              values={touchAttempts}
              onChange={setTouchAttempts}
              minCount={3}
            />
          </>
        )}

        <div className="mb-4 mt-4">
          <label htmlFor="physical-test-notes" className="mb-1 block text-sm font-medium text-ink">
            Notes
          </label>
          <Textarea id="physical-test-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-right text-sm text-red">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/players/AddPhysicalTestDialog.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test && npx tsc -b --force`

- [ ] **Step 6: Commit**

```bash
git add src/players/AddPhysicalTestDialog.tsx src/players/AddPhysicalTestDialog.test.tsx
git commit -m "Add physical test entry dialog: growth, CMJ, broad jump, approach jump"
```

---

## Task 16: `AddPhysicalTestDialog` — sprint, shuttle, reaction, strength

**Files:**
- Modify: `src/players/AddPhysicalTestDialog.tsx` (extend with the remaining 4 branches)
- Modify: `src/players/AddPhysicalTestDialog.test.tsx` (add tests for the 4 new branches)

**Interfaces:**
- Consumes: `computeReaction`, `computeBodyMassRatio` from `physicalTestMath.ts`; `getLatestByType` from `physicalTestsApi.ts` (to look up the most recent body mass for the strength ratio, per the Plan 2 design doc §4.4); `FIELD_CLASS` from `src/components/Input.tsx`.
- Completes: `AddPhysicalTestDialog` now handles all 8 `testType` values.

- [ ] **Step 1: Write the failing tests** — append to `src/players/AddPhysicalTestDialog.test.tsx`

```tsx
  it('submits a 10m sprint entry with the computed best (min)', async () => {
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="sprint10m" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Attempt (s) 1'), { target: { value: '1.85' } });
    fireEvent.change(screen.getByLabelText('Attempt (s) 2'), { target: { value: '1.79' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        { testType: 'sprint10m', attemptsSeconds: [1.85, 1.79], bestSeconds: 1.79, date: '2026-09-07', notes: '' },
        'coach-uid'
      )
    );
  });

  it('submits a 5-10-5 shuttle entry with separate right/left times', async () => {
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="shuttle5105" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Right-first (s)'), { target: { value: '5.12' } });
    fireEvent.change(screen.getByLabelText('Left-first (s)'), { target: { value: '5.48' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        { testType: 'shuttle5105', rightFirstSeconds: 5.12, leftFirstSeconds: 5.48, date: '2026-09-07', notes: '' },
        'coach-uid'
      )
    );
  });

  it('submits a reaction entry with the discard-extremes average and ms conversion', async () => {
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="reaction" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Drop attempt (cm) 1'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Drop attempt (cm) 2'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Drop attempt (cm) 3'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Drop attempt (cm) 4'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Drop attempt (cm) 5'), { target: { value: '30' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(spy).toHaveBeenCalled());
    const [, , payload] = spy.mock.calls[0];
    expect(payload).toMatchObject({ testType: 'reaction', averageCm: 20 });
    expect((payload as { reactionTimeMs: number }).reactionTimeMs).toBeCloseTo(201.93, 1);
  });

  it('submits a weighted strength entry with the body-mass ratio from the latest growth entry', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue({
      id: 'growth-1',
      testType: 'growth',
      heightCm: 160,
      bodyMassKg: 50,
      date: '2026-08-01',
      notes: '',
      recordedBy: 'coach-uid',
      createdAt: null,
    });
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="strength" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    await screen.findByText(/Body-mass ratio needs/);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '55' } });
    await screen.findByText('Body-mass ratio: 1.10');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        {
          testType: 'strength',
          mode: 'weighted',
          exercise: 'trapBarDeadlift',
          weightKg: 55,
          reps6RM: 6,
          bodyMassRatio: 1.1,
          date: '2026-09-07',
          notes: '',
        },
        'coach-uid'
      )
    );
  });

  it('submits a bodyweight strength entry', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="strength" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'bodyweight' } });
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '25' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        { testType: 'strength', mode: 'bodyweight', exercise: 'pushUps', reps: 25, date: '2026-09-07', notes: '' },
        'coach-uid'
      )
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/players/AddPhysicalTestDialog.test.tsx`
Expected: FAIL — the new branches aren't handled yet, so these fields don't render.

- [ ] **Step 3: Modify `src/players/AddPhysicalTestDialog.tsx`**

Update the imports at the top of the file:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Input, Textarea, FIELD_CLASS } from '../components/Input';
import { AttemptsInput } from '../components/AttemptsInput';
import { bestOf, computeApproachJump, computeReaction, computeBodyMassRatio } from './physicalTestMath';
import { createPhysicalTest, getLatestByType } from './physicalTestsApi';
import { PHYSICAL_TEST_LABELS } from '../types/physicalTest';
import type {
  BodyweightExercise,
  NewPhysicalTestInput,
  PhysicalTestType,
  WeightedExercise,
} from '../types/physicalTest';
```

Add these state declarations after the existing `touchAttempts` state:
```tsx
  const [sprintAttempts, setSprintAttempts] = useState<number[]>([NaN, NaN]);
  const [rightFirstSeconds, setRightFirstSeconds] = useState('');
  const [leftFirstSeconds, setLeftFirstSeconds] = useState('');
  const [reactionAttempts, setReactionAttempts] = useState<number[]>([NaN, NaN, NaN, NaN, NaN]);
  const [strengthMode, setStrengthMode] = useState<'weighted' | 'bodyweight'>('weighted');
  const [weightedExercise, setWeightedExercise] = useState<WeightedExercise>('trapBarDeadlift');
  const [weightKg, setWeightKg] = useState('');
  const [bodyweightExercise, setBodyweightExercise] = useState<BodyweightExercise>('pushUps');
  const [reps, setReps] = useState('');
  const [latestBodyMassKg, setLatestBodyMassKg] = useState<number | null>(null);

  useEffect(() => {
    if (testType !== 'strength') return;
    void getLatestByType(teamId, playerId, 'growth').then((latest) => {
      setLatestBodyMassKg(latest && latest.testType === 'growth' ? latest.bodyMassKg : null);
    });
  }, [teamId, playerId, testType]);
```

Replace the final `else { ... }` branch of the `if (testType === 'growth') { ... } else if ... else { // sprint10m / ... return; }` chain with:
```tsx
    } else if (testType === 'sprint10m') {
      input = {
        testType: 'sprint10m',
        attemptsSeconds: sprintAttempts,
        bestSeconds: bestOf(sprintAttempts, 'min'),
        date,
        notes,
      };
    } else if (testType === 'shuttle5105') {
      input = {
        testType: 'shuttle5105',
        rightFirstSeconds: Number(rightFirstSeconds),
        leftFirstSeconds: Number(leftFirstSeconds),
        date,
        notes,
      };
    } else if (testType === 'reaction') {
      const { averageCm, reactionTimeMs } = computeReaction(reactionAttempts);
      input = { testType: 'reaction', attemptsCm: reactionAttempts, averageCm, reactionTimeMs, date, notes };
    } else if (testType === 'strength' && strengthMode === 'weighted') {
      const bodyMassRatio = latestBodyMassKg !== null ? computeBodyMassRatio(Number(weightKg), latestBodyMassKg) : null;
      input = {
        testType: 'strength',
        mode: 'weighted',
        exercise: weightedExercise,
        weightKg: Number(weightKg),
        reps6RM: 6,
        bodyMassRatio,
        date,
        notes,
      };
    } else if (testType === 'strength' && strengthMode === 'bodyweight') {
      input = { testType: 'strength', mode: 'bodyweight', exercise: bodyweightExercise, reps: Number(reps), date, notes };
    } else {
      return;
    }
```

Add these render branches after the existing `{testType === 'approachJump' && ( ... )}` block, before the Notes field:
```tsx
        {testType === 'sprint10m' && (
          <AttemptsInput
            name="sprint"
            label="Attempt (s)"
            values={sprintAttempts}
            onChange={setSprintAttempts}
            minCount={2}
            maxCount={3}
          />
        )}

        {testType === 'shuttle5105' && (
          <>
            <div className="mb-4">
              <label htmlFor="shuttle-right" className="mb-1 block text-sm font-medium text-ink">
                Right-first (s)
              </label>
              <Input
                id="shuttle-right"
                type="number"
                step="any"
                value={rightFirstSeconds}
                onChange={(e) => setRightFirstSeconds(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="shuttle-left" className="mb-1 block text-sm font-medium text-ink">
                Left-first (s)
              </label>
              <Input
                id="shuttle-left"
                type="number"
                step="any"
                value={leftFirstSeconds}
                onChange={(e) => setLeftFirstSeconds(e.target.value)}
                required
                className="w-full"
              />
            </div>
          </>
        )}

        {testType === 'reaction' && (
          <AttemptsInput
            name="reaction"
            label="Drop attempt (cm)"
            values={reactionAttempts}
            onChange={setReactionAttempts}
            minCount={5}
          />
        )}

        {testType === 'strength' && (
          <>
            <div className="mb-4">
              <label htmlFor="strength-mode" className="mb-1 block text-sm font-medium text-ink">
                Mode
              </label>
              <select
                id="strength-mode"
                className={`${FIELD_CLASS} w-full`}
                value={strengthMode}
                onChange={(e) => setStrengthMode(e.target.value as 'weighted' | 'bodyweight')}
              >
                <option value="weighted">Weighted</option>
                <option value="bodyweight">Bodyweight</option>
              </select>
            </div>
            {strengthMode === 'weighted' ? (
              <>
                <div className="mb-4">
                  <label htmlFor="strength-exercise" className="mb-1 block text-sm font-medium text-ink">
                    Exercise
                  </label>
                  <select
                    id="strength-exercise"
                    className={`${FIELD_CLASS} w-full`}
                    value={weightedExercise}
                    onChange={(e) => setWeightedExercise(e.target.value as WeightedExercise)}
                  >
                    <option value="trapBarDeadlift">Trap-bar deadlift</option>
                    <option value="squat">Squat</option>
                    <option value="gobletSquat">Goblet squat</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="strength-weight" className="mb-1 block text-sm font-medium text-ink">
                    Weight (kg)
                  </label>
                  <Input
                    id="strength-weight"
                    type="number"
                    step="any"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>
                <p className="mb-4 text-sm text-slate">
                  {latestBodyMassKg !== null && weightKg !== ''
                    ? `Body-mass ratio: ${computeBodyMassRatio(Number(weightKg), latestBodyMassKg).toFixed(2)}`
                    : 'Body-mass ratio needs a Growth entry with body mass on file.'}
                </p>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label htmlFor="strength-bodyweight-exercise" className="mb-1 block text-sm font-medium text-ink">
                    Exercise
                  </label>
                  <select
                    id="strength-bodyweight-exercise"
                    className={`${FIELD_CLASS} w-full`}
                    value={bodyweightExercise}
                    onChange={(e) => setBodyweightExercise(e.target.value as BodyweightExercise)}
                  >
                    <option value="pushUps">Push-ups</option>
                    <option value="splitSquat">Split squat</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="strength-reps" className="mb-1 block text-sm font-medium text-ink">
                    Reps
                  </label>
                  <Input id="strength-reps" type="number" value={reps} onChange={(e) => setReps(e.target.value)} required className="w-full" />
                </div>
              </>
            )}
          </>
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/players/AddPhysicalTestDialog.test.tsx`
Expected: PASS (8 tests total).

- [ ] **Step 5: Run the full suite**

Run: `npm test && npx tsc -b --force`

- [ ] **Step 6: Commit**

```bash
git add src/players/AddPhysicalTestDialog.tsx src/players/AddPhysicalTestDialog.test.tsx
git commit -m "Complete physical test entry dialog: sprint, shuttle, reaction, strength"
```

---

## Task 17: `PhysicalTestingSection` — 8-row summary on the player card

**Files:**
- Create: `src/players/PhysicalTestingSection.tsx`
- Create: `src/players/PhysicalTestingSection.test.tsx`
- Modify: `src/players/PlayerCardPage.tsx` (render it)

**Interfaces:**
- Consumes: `getLatestByType` from `physicalTestsApi.ts`; `AddPhysicalTestDialog` from Tasks 15-16; `PHYSICAL_TEST_ORDER`, `PHYSICAL_TEST_LABELS`, `PhysicalTest`, `PhysicalTestType` from `src/types/physicalTest.ts`.
- Produces: `PhysicalTestingSection({ teamId, playerId, isAdmin })`. Fetches the latest entry per quality via 8 small indexed queries (never the whole subcollection), per the smart-fetching rule. "View history" is added in Task 18, extending this same file.

- [ ] **Step 1: Write the failing test `src/players/PhysicalTestingSection.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhysicalTestingSection } from './PhysicalTestingSection';
import * as physicalTestsApi from './physicalTestsApi';
import { useAuth } from '../auth/AuthContext';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';

vi.mock('./physicalTestsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const cmjEntry: PhysicalTest = {
  id: 'test-1',
  testType: 'cmj',
  attemptsCm: [30, 34, 32],
  bestCm: 34,
  date: '2026-09-01',
  notes: '',
  recordedBy: 'coach-uid',
  createdAt: null,
};

describe('PhysicalTestingSection', () => {
  it('shows the latest value per quality, and "No data yet" where none exists', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockImplementation((_teamId, _playerId, testType: PhysicalTestType) =>
      Promise.resolve(testType === 'cmj' ? cmjEntry : null)
    );

    render(<PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={true} />);

    expect(await screen.findByText(/34 cm — 2026-09-01/)).toBeInTheDocument();
    expect(screen.getAllByText('No data yet').length).toBe(7);
  });

  it('hides "Add new" when isAdmin is false', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);

    render(<PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={false} />);

    await waitFor(() => expect(screen.getAllByText('No data yet').length).toBe(8));
    expect(screen.queryByText('Add new')).not.toBeInTheDocument();
  });

  it('opens the add-test dialog for the clicked quality and refreshes on save', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);

    render(<PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={true} />);

    await waitFor(() => expect(screen.getAllByText('No data yet').length).toBe(8));
    fireEvent.click(screen.getAllByText('Add new')[0]);

    expect(await screen.findByLabelText('Height (cm)')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/players/PhysicalTestingSection.test.tsx`
Expected: FAIL with "Cannot find module './PhysicalTestingSection'".

- [ ] **Step 3: Write `src/players/PhysicalTestingSection.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { getLatestByType } from './physicalTestsApi';
import { AddPhysicalTestDialog } from './AddPhysicalTestDialog';
import { PHYSICAL_TEST_LABELS, PHYSICAL_TEST_ORDER } from '../types/physicalTest';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';

function formatSummary(test: PhysicalTest): string {
  switch (test.testType) {
    case 'growth':
      return `${test.heightCm} cm, ${test.bodyMassKg} kg`;
    case 'cmj':
      return `${test.bestCm} cm`;
    case 'approachJump':
      return `${test.approachJumpCm} cm (touch ${test.bestTouchCm} cm)`;
    case 'broadJump':
      return `${test.bestCm} cm`;
    case 'sprint10m':
      return `${test.bestSeconds} s`;
    case 'shuttle5105':
      return `R ${test.rightFirstSeconds}s / L ${test.leftFirstSeconds}s`;
    case 'reaction':
      return `${test.reactionTimeMs.toFixed(0)} ms`;
    case 'strength':
      return test.mode === 'weighted'
        ? `${test.weightKg} kg (${test.bodyMassRatio !== null ? test.bodyMassRatio.toFixed(2) : '—'})`
        : `${test.reps} reps`;
  }
}

interface PhysicalTestingSectionProps {
  teamId: string;
  playerId: string;
  isAdmin: boolean;
}

export function PhysicalTestingSection({ teamId, playerId, isAdmin }: PhysicalTestingSectionProps) {
  const { firebaseUser } = useAuth();
  const [latestByType, setLatestByType] = useState<Partial<Record<PhysicalTestType, PhysicalTest | null>>>({});
  const [activeDialogType, setActiveDialogType] = useState<PhysicalTestType | null>(null);

  async function loadAll() {
    const entries = await Promise.all(PHYSICAL_TEST_ORDER.map((t) => getLatestByType(teamId, playerId, t)));
    const next: Partial<Record<PhysicalTestType, PhysicalTest | null>> = {};
    PHYSICAL_TEST_ORDER.forEach((t, i) => {
      next[t] = entries[i];
    });
    setLatestByType(next);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, playerId]);

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Physical Testing</h2>
      <ul className="mt-3 divide-y divide-border">
        {PHYSICAL_TEST_ORDER.map((testType) => {
          const latest = latestByType[testType];
          return (
            <li key={testType} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-ink">{PHYSICAL_TEST_LABELS[testType]}</p>
                <p className="text-sm text-slate">{latest ? `${formatSummary(latest)} — ${latest.date}` : 'No data yet'}</p>
              </div>
              {isAdmin && (
                <Button variant="secondary" size="sm" onClick={() => setActiveDialogType(testType)}>
                  Add new
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {activeDialogType && firebaseUser && (
        <AddPhysicalTestDialog
          teamId={teamId}
          playerId={playerId}
          testType={activeDialogType}
          recordedByUid={firebaseUser.uid}
          onClose={() => setActiveDialogType(null)}
          onSaved={() => {
            setActiveDialogType(null);
            void loadAll();
          }}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/players/PhysicalTestingSection.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Modify `src/players/PlayerCardPage.tsx`** — render `PhysicalTestingSection`

Add the import `import { PhysicalTestingSection } from './PhysicalTestingSection';` and add, after `<DevelopmentPlanEditor ... />` (Task 10):
```tsx
      <PhysicalTestingSection teamId={teamId} playerId={playerId} isAdmin={isAdmin} />
```

- [ ] **Step 6: Run the full suite**

Run: `npm test && npx tsc -b --force`

- [ ] **Step 7: Commit**

```bash
git add src/players/PhysicalTestingSection.tsx src/players/PhysicalTestingSection.test.tsx src/players/PlayerCardPage.tsx
git commit -m "Add physical testing summary section to the player card"
```

---

## Task 18: `PhysicalTestHistoryList` — paginated per-quality history

**Files:**
- Create: `src/players/physicalTestFormat.ts` (extracted shared formatter)
- Create: `src/players/physicalTestFormat.test.ts`
- Modify: `src/players/PhysicalTestingSection.tsx` (use the shared formatter instead of its local copy; add "View history")
- Create: `src/players/PhysicalTestHistoryList.tsx`
- Create: `src/players/PhysicalTestHistoryList.test.tsx`

**Interfaces:**
- Produces: `formatPhysicalTestSummary(test: PhysicalTest): string` in `physicalTestFormat.ts` — extracted here because Task 17's local copy is now needed by both the summary section and the history list; `PhysicalTestHistoryList({ teamId, playerId, testType, onClose })`, reading via `listHistoryByType` (Task 13) with the same `limit`+cursor "Load more" pattern used everywhere else in this app.
- "View history" is visible to any user who can render the section (admin or, once the invite flow ships, a linked viewer) — unlike "Add new," which stays admin-only, since `physicalTests` reads are already permitted for both per the Task 13 rules.

- [ ] **Step 1: Write the failing test `src/players/physicalTestFormat.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatPhysicalTestSummary } from './physicalTestFormat';
import type { PhysicalTest } from '../types/physicalTest';

const common = { id: 't-1', date: '2026-09-07', notes: '', recordedBy: 'coach-uid', createdAt: null };

describe('formatPhysicalTestSummary', () => {
  it('formats each test type', () => {
    expect(formatPhysicalTestSummary({ ...common, testType: 'growth', heightCm: 160, bodyMassKg: 50 })).toBe('160 cm, 50 kg');
    expect(formatPhysicalTestSummary({ ...common, testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34 })).toBe('34 cm');
    expect(
      formatPhysicalTestSummary({
        ...common,
        testType: 'approachJump',
        standingReachCm: 222,
        attemptsTouchCm: [260, 267, 265],
        bestTouchCm: 267,
        approachJumpCm: 45,
      })
    ).toBe('45 cm (touch 267 cm)');
    expect(formatPhysicalTestSummary({ ...common, testType: 'broadJump', attemptsCm: [180, 181, 179], bestCm: 181 })).toBe('181 cm');
    expect(formatPhysicalTestSummary({ ...common, testType: 'sprint10m', attemptsSeconds: [1.85, 1.79], bestSeconds: 1.79 })).toBe('1.79 s');
    expect(
      formatPhysicalTestSummary({ ...common, testType: 'shuttle5105', rightFirstSeconds: 5.12, leftFirstSeconds: 5.48 })
    ).toBe('R 5.12s / L 5.48s');
    expect(
      formatPhysicalTestSummary({ ...common, testType: 'reaction', attemptsCm: [15, 20, 20, 20, 30], averageCm: 20, reactionTimeMs: 201.93 })
    ).toBe('202 ms');
    expect(
      formatPhysicalTestSummary({
        ...common,
        testType: 'strength',
        mode: 'weighted',
        exercise: 'trapBarDeadlift',
        weightKg: 55,
        reps6RM: 6,
        bodyMassRatio: 1.1,
      })
    ).toBe('55 kg (1.10)');
    expect(
      formatPhysicalTestSummary({ ...common, testType: 'strength', mode: 'bodyweight', exercise: 'pushUps', reps: 25 })
    ).toBe('25 reps');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/players/physicalTestFormat.test.ts`
Expected: FAIL with "Cannot find module './physicalTestFormat'".

- [ ] **Step 3: Write `src/players/physicalTestFormat.ts`**

```ts
import type { PhysicalTest } from '../types/physicalTest';

export function formatPhysicalTestSummary(test: PhysicalTest): string {
  switch (test.testType) {
    case 'growth':
      return `${test.heightCm} cm, ${test.bodyMassKg} kg`;
    case 'cmj':
      return `${test.bestCm} cm`;
    case 'approachJump':
      return `${test.approachJumpCm} cm (touch ${test.bestTouchCm} cm)`;
    case 'broadJump':
      return `${test.bestCm} cm`;
    case 'sprint10m':
      return `${test.bestSeconds} s`;
    case 'shuttle5105':
      return `R ${test.rightFirstSeconds}s / L ${test.leftFirstSeconds}s`;
    case 'reaction':
      return `${test.reactionTimeMs.toFixed(0)} ms`;
    case 'strength':
      return test.mode === 'weighted'
        ? `${test.weightKg} kg (${test.bodyMassRatio !== null ? test.bodyMassRatio.toFixed(2) : '—'})`
        : `${test.reps} reps`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/players/physicalTestFormat.test.ts`
Expected: PASS.

- [ ] **Step 5: Modify `src/players/PhysicalTestingSection.tsx`** to use the shared formatter

Remove the local `formatSummary` function definition entirely, and replace the import line `import { getLatestByType } from './physicalTestsApi';` with:
```tsx
import { getLatestByType } from './physicalTestsApi';
import { formatPhysicalTestSummary } from './physicalTestFormat';
```
Replace the one call site `${formatSummary(latest)}` with `${formatPhysicalTestSummary(latest)}`.

- [ ] **Step 6: Write the failing test `src/players/PhysicalTestHistoryList.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhysicalTestHistoryList } from './PhysicalTestHistoryList';
import * as physicalTestsApi from './physicalTestsApi';
import type { PhysicalTest } from '../types/physicalTest';

vi.mock('./physicalTestsApi');

function makeEntry(id: string, date: string): PhysicalTest {
  return { id, testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34, date, notes: '', recordedBy: 'coach-uid', createdAt: null };
}

describe('PhysicalTestHistoryList', () => {
  it('shows "No entries yet." when history is empty', async () => {
    vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({ tests: [], lastDoc: null });

    render(<PhysicalTestHistoryList teamId="team-1" playerId="player-1" testType="cmj" onClose={vi.fn()} />);

    expect(await screen.findByText('No entries yet.')).toBeInTheDocument();
  });

  it('loads the next page when "Load more" is clicked', async () => {
    const lastDocStub = { id: 'test-1' } as never;
    vi.spyOn(physicalTestsApi, 'listHistoryByType')
      .mockResolvedValueOnce({ tests: [makeEntry('test-1', '2026-08-01')], lastDoc: lastDocStub })
      .mockResolvedValueOnce({ tests: [makeEntry('test-2', '2026-09-01')], lastDoc: null });

    render(<PhysicalTestHistoryList teamId="team-1" playerId="player-1" testType="cmj" onClose={vi.fn()} />);

    await screen.findByText(/2026-08-01/);
    fireEvent.click(screen.getByText('Load more'));

    await waitFor(() => expect(screen.getByText(/2026-09-01/)).toBeInTheDocument());
    expect(physicalTestsApi.listHistoryByType).toHaveBeenCalledWith('team-1', 'player-1', 'cmj', lastDocStub);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- src/players/PhysicalTestHistoryList.test.tsx`
Expected: FAIL with "Cannot find module './PhysicalTestHistoryList'".

- [ ] **Step 8: Write `src/players/PhysicalTestHistoryList.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { listHistoryByType } from './physicalTestsApi';
import { formatPhysicalTestSummary } from './physicalTestFormat';
import { PHYSICAL_TEST_LABELS } from '../types/physicalTest';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';

interface PhysicalTestHistoryListProps {
  teamId: string;
  playerId: string;
  testType: PhysicalTestType;
  onClose: () => void;
}

export function PhysicalTestHistoryList({ teamId, playerId, testType, onClose }: PhysicalTestHistoryListProps) {
  const [tests, setTests] = useState<PhysicalTest[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadFirstPage() {
    const page = await listHistoryByType(teamId, playerId, testType);
    setTests(page.tests);
    setLastDoc(page.lastDoc);
    setHasMore(page.tests.length > 0 && page.lastDoc !== null);
    setLoaded(true);
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listHistoryByType(teamId, playerId, testType, lastDoc);
    setTests((current) => [...current, ...page.tests]);
    setLastDoc(page.lastDoc);
    setHasMore(page.tests.length > 0 && page.lastDoc !== null);
  }

  useEffect(() => {
    void loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, playerId, testType]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop">
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">{PHYSICAL_TEST_LABELS[testType]} history</h2>
        {loaded && tests.length === 0 && <p className="text-slate">No entries yet.</p>}
        <ul className="divide-y divide-border">
          {tests.map((test) => (
            <li key={test.id} className="py-2 text-sm text-ink">
              {test.date} — {formatPhysicalTestSummary(test)}
            </li>
          ))}
        </ul>
        {hasMore && (
          <Button variant="secondary" size="sm" onClick={() => void loadMore()} className="mt-3">
            Load more
          </Button>
        )}
        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- src/players/PhysicalTestHistoryList.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 10: Wire "View history" into `src/players/PhysicalTestingSection.tsx`**

Add the import `import { PhysicalTestHistoryList } from './PhysicalTestHistoryList';` and add state:
```tsx
  const [historyType, setHistoryType] = useState<PhysicalTestType | null>(null);
```
Add a "View history" button next to (before) the existing `isAdmin && <Button ...>Add new</Button>` block, inside a wrapping `<div className="flex gap-2">`:
```tsx
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setHistoryType(testType)}>
                  View history
                </Button>
                {isAdmin && (
                  <Button variant="secondary" size="sm" onClick={() => setActiveDialogType(testType)}>
                    Add new
                  </Button>
                )}
              </div>
```
(replacing the previous bare `{isAdmin && (...)}` block, which is now nested inside this wrapping div)

Add, alongside the existing `{activeDialogType && firebaseUser && (...)}` block:
```tsx
      {historyType && <PhysicalTestHistoryList teamId={teamId} playerId={playerId} testType={historyType} onClose={() => setHistoryType(null)} />}
```

- [ ] **Step 11: Run the full suite**

Run: `npm test && npx tsc -b --force`
Expected: all pass, 0 errors. (`PhysicalTestingSection.test.tsx`'s existing queries — `getAllByText('Add new')`, `getAllByText('No data yet')` — are unaffected by adding a sibling "View history" button, since none of those tests query by container structure.)

- [ ] **Step 12: Commit**

```bash
git add src/players/physicalTestFormat.ts src/players/physicalTestFormat.test.ts src/players/PhysicalTestingSection.tsx src/players/PhysicalTestHistoryList.tsx src/players/PhysicalTestHistoryList.test.tsx
git commit -m "Add paginated physical test history view"
```

---

## Task 19: Physical test guide — data, seed, rules

**Files:**
- Create: `src/types/physicalTestGuide.ts`
- Create: `src/physicalTestGuide/physicalTestGuideApi.ts`
- Create: `src/physicalTestGuide/physicalTestGuideApi.test.ts`
- Modify: `firestore.rules` (mirror `skillGuide/config`'s rule for `physicalTestGuide/config`)
- Create: `tests/rules/physicalTestGuide.rules.test.ts`

**Interfaces:**
- Produces: `PhysicalTestGuideEntry`, `PhysicalTestGuideConfig` types; `getPhysicalTestGuide(): Promise<PhysicalTestGuideConfig>` (with a `DEFAULT_PHYSICAL_TEST_GUIDE` fallback, same pattern as `skillGuideApi.ts`), `updatePhysicalTestGuide(tests, updatedBy): Promise<void>` — consumed by Task 20's `GuidesPage`.

- [ ] **Step 1: Write `src/types/physicalTestGuide.ts`**

```ts
import type { PhysicalTestType } from './physicalTest';

export interface PhysicalTestGuideEntry {
  key: PhysicalTestType;
  label: string;
  protocol: string;
}

export interface PhysicalTestGuideConfig {
  tests: PhysicalTestGuideEntry[];
  updatedBy: string;
  updatedAt: unknown;
}
```

- [ ] **Step 2: Write the failing test `src/physicalTestGuide/physicalTestGuideApi.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getPhysicalTestGuide, updatePhysicalTestGuide, DEFAULT_PHYSICAL_TEST_GUIDE } from './physicalTestGuideApi';

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('physicalTestGuideApi', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('falls back to the default guide when no doc exists yet', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const guide = await getPhysicalTestGuide();

    expect(guide.tests).toEqual(DEFAULT_PHYSICAL_TEST_GUIDE);
    expect(guide.tests).toHaveLength(8);
  });

  it('returns the stored guide when one exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ tests: [{ key: 'cmj', label: 'CMJ', protocol: 'Custom protocol' }], updatedBy: 'coach-uid', updatedAt: null }),
    });

    const guide = await getPhysicalTestGuide();

    expect(guide.tests).toEqual([{ key: 'cmj', label: 'CMJ', protocol: 'Custom protocol' }]);
  });

  it('saves the guide with a server timestamp', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    await updatePhysicalTestGuide(DEFAULT_PHYSICAL_TEST_GUIDE, 'coach-uid');

    expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', {
      tests: DEFAULT_PHYSICAL_TEST_GUIDE,
      updatedBy: 'coach-uid',
      updatedAt: 'server-timestamp',
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/physicalTestGuide/physicalTestGuideApi.test.ts`
Expected: FAIL with "Cannot find module './physicalTestGuideApi'".

- [ ] **Step 4: Write `src/physicalTestGuide/physicalTestGuideApi.ts`**

```ts
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { PhysicalTestGuideConfig, PhysicalTestGuideEntry } from '../types/physicalTestGuide';

/**
 * Fallback used until an admin saves `physicalTestGuide/config` for the first time,
 * so the editor is usable on a fresh project. Source: the coach's own written
 * testing protocol.
 */
export const DEFAULT_PHYSICAL_TEST_GUIDE: PhysicalTestGuideEntry[] = [
  {
    key: 'growth',
    label: 'Growth',
    protocol: 'Record height (cm) and body mass (kg). This is your main growth/context tracking metric — track exact figures over time.',
  },
  {
    key: 'cmj',
    label: 'Countermovement Jump',
    protocol:
      'Hands on hips if possible (arm swing adds variability). Quick downward movement, jump as high as possible. Record best of 3 attempts. Rest ~45-60s between attempts. Use a jump mat or phone app if available; otherwise use the same wall/chalk method every time.',
  },
  {
    key: 'approachJump',
    label: 'Approach Jump',
    protocol:
      'Use the same approach every test. Measure standing reach first, then measure maximum touch height with a 3-attempt approach jump. Approach jump height = maximum touch − standing reach. Record both figures — max touch is meaningful to the players too.',
  },
  {
    key: 'broadJump',
    label: 'Standing Broad Jump',
    protocol:
      'Toe behind the line, two-foot takeoff, two-foot controlled landing. Measure from the start line to the back heel. Three attempts, best result.',
  },
  {
    key: 'sprint10m',
    label: '10m Sprint',
    protocol:
      'Start 0.5-1m behind the line. Measure 10m. Two or three attempts, resting ~2 minutes between. Best time counts. Timing gates are ideal; otherwise use the same timer/method every session, or film the start/finish in slow motion.',
  },
  {
    key: 'shuttle5105',
    label: '5-10-5 Shuttle',
    protocol:
      'Place three cones/lines 5m apart, start at the middle. Sprint 5m one direction, turn and sprint 10m the other way, turn and sprint 5m back through the middle. Test both right-first and left-first — the asymmetry between them is often more useful than the overall time.',
  },
  {
    key: 'reaction',
    label: 'Reaction Time',
    protocol:
      'Ruler-drop test. Athlete holds thumb and finger around the bottom of a ruler without touching it; tester releases it unpredictably; athlete catches it. Record the distance fallen. Do 5 attempts, discard the best and worst, and average the middle 3. Treat this as a secondary metric — sport-specific reactive drills matter more for real game reaction ability.',
  },
  {
    key: 'strength',
    label: 'Strength',
    protocol:
      "For this age group, don't run a maximal 1RM test. Once technique is solid, use a clean 6RM in one standard exercise (trap-bar deadlift, squat, or goblet squat) and compare the athlete with herself over time. If there's no gym access, don't invent a lower-quality weighted test — track push-ups or split-squat reps as a muscular-endurance measure instead, using jumps as your lower-body power measure.",
  },
];

export async function getPhysicalTestGuide(): Promise<PhysicalTestGuideConfig> {
  const snapshot = await getDoc(doc(db, 'physicalTestGuide', 'config'));
  return snapshot.exists()
    ? (snapshot.data() as PhysicalTestGuideConfig)
    : { tests: DEFAULT_PHYSICAL_TEST_GUIDE, updatedBy: '', updatedAt: null };
}

export async function updatePhysicalTestGuide(tests: PhysicalTestGuideEntry[], updatedBy: string): Promise<void> {
  await setDoc(doc(db, 'physicalTestGuide', 'config'), { tests, updatedBy, updatedAt: serverTimestamp() });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/physicalTestGuide/physicalTestGuideApi.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing rules test `tests/rules/physicalTestGuide.rules.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('physicalTestGuide rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('users/admin-uid').set({ email: 'coach@example.com', role: 'admin' });
      await db.doc('users/viewer-uid').set({ email: 'parent@example.com', role: 'viewer' });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a global admin write the physical test guide, denies a non-admin write', async () => {
    const env = await getTestEnv();
    const adminDb = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('physicalTestGuide/config').set({ tests: [] }));

    const viewerDb = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(viewerDb.doc('physicalTestGuide/config').set({ tests: [] }));
  });

  it('lets any signed-in user read the physical test guide', async () => {
    const env = await getTestEnv();
    const viewerDb = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertSucceeds(viewerDb.doc('physicalTestGuide/config').get());
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `export PATH="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot/bin:$PATH" && npm run test:rules`
Expected: FAIL — `physicalTestGuide/config` isn't matched yet.

- [ ] **Step 8: Add the `physicalTestGuide/config` block to `firestore.rules`**

Add this block right after the existing `skillGuide/config` block (same nesting level, top of `match /databases/{database}/documents { ... }`):

```
    match /physicalTestGuide/config {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
```

- [ ] **Step 9: Run test to verify it passes**

Run: `export PATH="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot/bin:$PATH" && npm run test:rules`
Expected: PASS (all cases, plus every previously passing rules test).

- [ ] **Step 10: Run the full suite**

Run: `npm test && npx tsc -b --force`

- [ ] **Step 11: Commit**

```bash
git add src/types/physicalTestGuide.ts src/physicalTestGuide firestore.rules tests/rules/physicalTestGuide.rules.test.ts
git commit -m "Add physical test guide data layer, seed protocol text, and global-admin rules"
```

---

## Task 20: `GuidesPage` — tabbed Skill Guide + Physical Test Guide

**Files:**
- Create: `src/skillGuide/SkillGuideEditor.tsx` (extracted from `SkillGuidePage.tsx`, minus outer page chrome)
- Create: `src/skillGuide/SkillGuideEditor.test.tsx` (moved from `SkillGuidePage.test.tsx`)
- Delete: `src/skillGuide/SkillGuidePage.tsx`
- Delete: `src/skillGuide/SkillGuidePage.test.tsx`
- Create: `src/physicalTestGuide/PhysicalTestGuideEditor.tsx`
- Create: `src/physicalTestGuide/PhysicalTestGuideEditor.test.tsx`
- Create: `src/admin/GuidesPage.tsx`
- Create: `src/admin/GuidesPage.test.tsx`
- Modify: `src/App.tsx` (route `/admin/guides` renders `GuidesPage` instead of `SkillGuidePage`)

**Interfaces:**
- Produces: `SkillGuideEditor` (no props — same internal load/edit/save logic Task 3 finished, just without the page-level `<h1>`/outer container), `PhysicalTestGuideEditor` (same shape, for `physicalTestGuide/config`), `GuidesPage` (the actual routed page, owns the `<h1>Guides</h1>` + tab chrome and renders whichever editor is selected).

- [ ] **Step 1: Create `src/skillGuide/SkillGuideEditor.tsx`** with the content of `SkillGuidePage.tsx`, renamed and stripped of outer page chrome

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Textarea } from '../components/Input';
import { getSkillGuide, updateSkillGuide } from './skillGuideApi';
import type { SkillGuideEntry } from '../types/skillGuide';

export function SkillGuideEditor() {
  const { firebaseUser } = useAuth();
  const [skills, setSkills] = useState<SkillGuideEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSkillGuide()
      .then((guide) => {
        setSkills(guide.skills);
        setLoaded(true);
      })
      .catch(() => setLoadError('Could not load the skill guide. Please refresh the page.'));
  }, []);

  function updateHowToEvaluate(key: string, value: string) {
    setSkills((current) => current.map((s) => (s.key === key ? { ...s, howToEvaluate: value } : s)));
  }

  function updateRangeDescription(key: string, rangeIndex: number, value: string) {
    setSkills((current) =>
      current.map((s) =>
        s.key === key
          ? { ...s, ranges: s.ranges.map((r, i) => (i === rangeIndex ? { ...r, description: value } : r)) }
          : s
      )
    );
  }

  async function handleSave() {
    setError(null);
    if (!firebaseUser) return;
    try {
      await updateSkillGuide(skills, firebaseUser.uid);
    } catch {
      setError('Could not save the skill guide. Please try again.');
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="p-6 text-red">
        {loadError}
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-6">
        {skills.map((skill) => (
          <section key={skill.key} className="rounded-lg border border-border bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{skill.label}</h2>
            <div className="mt-3 space-y-3">
              {skill.ranges.map((range, index) => (
                <div key={`${range.min}-${range.max}`}>
                  <label
                    htmlFor={`${skill.key}-range-${index}`}
                    className="mb-1 block text-sm font-medium text-ink"
                  >{`${range.min}-${range.max}`}</label>
                  <Textarea
                    id={`${skill.key}-range-${index}`}
                    value={range.description}
                    onChange={(e) => updateRangeDescription(skill.key, index, e.target.value)}
                  />
                </div>
              ))}
              <div>
                <label htmlFor={`${skill.key}-how-to-evaluate`} className="mb-1 block text-sm font-medium text-ink">
                  How to evaluate
                </label>
                <Textarea
                  id={`${skill.key}-how-to-evaluate`}
                  value={skill.howToEvaluate}
                  onChange={(e) => updateHowToEvaluate(skill.key, e.target.value)}
                />
              </div>
            </div>
          </section>
        ))}
      </div>
      <Button variant="primary" onClick={() => void handleSave()} className="mt-6" disabled={!loaded}>
        Save
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/skillGuide/SkillGuideEditor.test.tsx`** with the content of `SkillGuidePage.test.tsx`, updating only the import and the two `render(...)` calls

Copy `src/skillGuide/SkillGuidePage.test.tsx` verbatim (all 4 existing `it` blocks), then:
- Change `import { SkillGuidePage } from './SkillGuidePage';` to `import { SkillGuideEditor } from './SkillGuideEditor';`
- Change every `render(<SkillGuidePage />)` to `render(<SkillGuideEditor />)`

Nothing else changes — none of the existing assertions reference the removed outer `<h1>Skill Guide</h1>`.

- [ ] **Step 3: Delete `src/skillGuide/SkillGuidePage.tsx` and `src/skillGuide/SkillGuidePage.test.tsx`**

```bash
rm src/skillGuide/SkillGuidePage.tsx src/skillGuide/SkillGuidePage.test.tsx
```

- [ ] **Step 4: Run test to verify the moved tests pass**

Run: `npm test -- src/skillGuide/SkillGuideEditor.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test `src/physicalTestGuide/PhysicalTestGuideEditor.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhysicalTestGuideEditor } from './PhysicalTestGuideEditor';
import * as physicalTestGuideApi from './physicalTestGuideApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./physicalTestGuideApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

describe('PhysicalTestGuideEditor', () => {
  it('loads the guide, edits a protocol, and saves', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    vi.spyOn(physicalTestGuideApi, 'getPhysicalTestGuide').mockResolvedValue({
      tests: [{ key: 'cmj', label: 'Countermovement Jump', protocol: 'Old protocol text' }],
      updatedBy: 'someone',
      updatedAt: null,
    });
    const updateSpy = vi.spyOn(physicalTestGuideApi, 'updatePhysicalTestGuide').mockResolvedValue(undefined);

    render(<PhysicalTestGuideEditor />);

    await screen.findByText('Countermovement Jump');
    fireEvent.change(screen.getByLabelText('Protocol'), { target: { value: 'Updated protocol text' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        [{ key: 'cmj', label: 'Countermovement Jump', protocol: 'Updated protocol text' }],
        'coach-uid'
      )
    );
  });

  it('shows an error and no form when loading the guide fails', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    vi.spyOn(physicalTestGuideApi, 'getPhysicalTestGuide').mockRejectedValue({ code: 'unavailable' });

    render(<PhysicalTestGuideEditor />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the physical test guide.');
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/physicalTestGuide/PhysicalTestGuideEditor.test.tsx`
Expected: FAIL with "Cannot find module './PhysicalTestGuideEditor'".

- [ ] **Step 7: Write `src/physicalTestGuide/PhysicalTestGuideEditor.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Textarea } from '../components/Input';
import { getPhysicalTestGuide, updatePhysicalTestGuide } from './physicalTestGuideApi';
import type { PhysicalTestGuideEntry } from '../types/physicalTestGuide';

export function PhysicalTestGuideEditor() {
  const { firebaseUser } = useAuth();
  const [tests, setTests] = useState<PhysicalTestGuideEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPhysicalTestGuide()
      .then((guide) => {
        setTests(guide.tests);
        setLoaded(true);
      })
      .catch(() => setLoadError('Could not load the physical test guide. Please refresh the page.'));
  }, []);

  function updateProtocol(key: string, value: string) {
    setTests((current) => current.map((t) => (t.key === key ? { ...t, protocol: value } : t)));
  }

  async function handleSave() {
    setError(null);
    if (!firebaseUser) return;
    try {
      await updatePhysicalTestGuide(tests, firebaseUser.uid);
    } catch {
      setError('Could not save the physical test guide. Please try again.');
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="p-6 text-red">
        {loadError}
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-6">
        {tests.map((test) => (
          <section key={test.key} className="rounded-lg border border-border bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{test.label}</h2>
            <label htmlFor={`${test.key}-protocol`} className="mb-1 mt-3 block text-sm font-medium text-ink">
              Protocol
            </label>
            <Textarea
              id={`${test.key}-protocol`}
              value={test.protocol}
              onChange={(e) => updateProtocol(test.key, e.target.value)}
              className="w-full min-h-[100px]"
            />
          </section>
        ))}
      </div>
      <Button variant="primary" onClick={() => void handleSave()} className="mt-6" disabled={!loaded}>
        Save
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/physicalTestGuide/PhysicalTestGuideEditor.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Write the failing test `src/admin/GuidesPage.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuidesPage } from './GuidesPage';

vi.mock('../skillGuide/SkillGuideEditor', () => ({ SkillGuideEditor: () => <div>Skill guide content</div> }));
vi.mock('../physicalTestGuide/PhysicalTestGuideEditor', () => ({
  PhysicalTestGuideEditor: () => <div>Physical test guide content</div>,
}));

describe('GuidesPage', () => {
  it('shows the skill guide tab by default and switches to the physical test guide tab', () => {
    render(<GuidesPage />);

    expect(screen.getByText('Skill guide content')).toBeInTheDocument();
    expect(screen.queryByText('Physical test guide content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Physical Test Guide'));

    expect(screen.getByText('Physical test guide content')).toBeInTheDocument();
    expect(screen.queryByText('Skill guide content')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm test -- src/admin/GuidesPage.test.tsx`
Expected: FAIL with "Cannot find module './GuidesPage'".

- [ ] **Step 11: Write `src/admin/GuidesPage.tsx`**

```tsx
import { useState } from 'react';
import { SkillGuideEditor } from '../skillGuide/SkillGuideEditor';
import { PhysicalTestGuideEditor } from '../physicalTestGuide/PhysicalTestGuideEditor';

type GuideTab = 'skills' | 'physicalTests';

const tabClass = (active: boolean) =>
  `border-b-2 px-1 py-3 text-sm font-medium ${
    active ? 'border-blue text-blue' : 'border-transparent text-slate hover:text-ink'
  }`;

export function GuidesPage() {
  const [tab, setTab] = useState<GuideTab>('skills');

  return (
    <div className="mx-auto max-w-2xl bg-bg p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Guides</h1>
      <nav className="mb-6 flex gap-6 border-b border-border">
        <button onClick={() => setTab('skills')} className={tabClass(tab === 'skills')}>
          Skill Guide
        </button>
        <button onClick={() => setTab('physicalTests')} className={tabClass(tab === 'physicalTests')}>
          Physical Test Guide
        </button>
      </nav>
      {tab === 'skills' && <SkillGuideEditor />}
      {tab === 'physicalTests' && <PhysicalTestGuideEditor />}
    </div>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm test -- src/admin/GuidesPage.test.tsx`
Expected: PASS.

- [ ] **Step 13: Modify `src/App.tsx`** — route `/admin/guides` to `GuidesPage`

Replace the import `import { SkillGuidePage } from './skillGuide/SkillGuidePage';` with `import { GuidesPage } from './admin/GuidesPage';`, and replace `<SkillGuidePage />` with `<GuidesPage />` in the `/admin/guides` route element.

- [ ] **Step 14: Run the full suite**

Run: `npm test`
Expected: all pass. The deleted `SkillGuidePage`/`SkillGuidePage.test.tsx` are gone; nothing else imports them (confirm with a repo-wide search for `SkillGuidePage` before deleting, per Step 3 — `App.tsx` is the only other reference, updated in this same step).

Run: `export PATH="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot/bin:$PATH" && npm run test:rules`
Run: `npx tsc -b --force`
Run: `npm run build`

- [ ] **Step 15: Commit**

```bash
git add src/skillGuide src/physicalTestGuide src/admin src/App.tsx
git commit -m "Split guides into a tabbed GuidesPage: Skill Guide + Physical Test Guide"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-09-07-volley-skills-plan-2-design.md`):
- §2.1 Add-player form (guardians + consent) — Task 5.
- §2.2 Guardians on the player card — Task 6.
- §2.3 Navigation shell — Task 4.
- §2.4 Parked fixes (role-gate mismatch, skill-guide error handling) — Tasks 2, 3.
- §3.1 Shared `DevelopmentPlan` type — Task 1.
- §3.2 Status vocabulary — Task 7.
- §3.3 `DevelopmentPlanEditor`, wired to both team and player — Tasks 8, 9, 10.
- §4.1 Pure computation module — Task 12.
- §4.2 Data layer — Task 13.
- §4.3 `PhysicalTestingSection` — Task 17.
- §4.4 Entry dialogs (all 8 test types) — Tasks 14, 15, 16.
- §4.5 History view — Task 18.
- §4.6 Physical Test Guide editor — Tasks 19, 20.
- §5 Security rules additions (`physicalTests`, `physicalTestGuide`) — Tasks 13, 19. Development plans correctly need no new rules (they're fields on already-covered `teams`/`players` docs).
- §6 Testing strategy (rules tests for both new rule additions, computation unit tests against the coach's worked examples, component tests for dialogs/editor) — covered throughout.

**Placeholder scan:** No "TBD"/vague deferrals. Task 15's incomplete `else { return; }` branch (4 of 8 test types) is an explicit, working, incremental step completed by Task 16 in the same file — the same pattern Plan 1 used repeatedly (e.g. "Teams list coming in Task 7"), not a vague placeholder.

**Type consistency:** Verified `DevelopmentPlan`/`ShortTermObjective`/`SeasonObjective`/`ObjectiveStatus` (Task 1) are the single definitions reused by Tasks 7-10 without redeclaration. Verified `PhysicalTestType`/`PhysicalTest`/`NewPhysicalTestInput`/`PHYSICAL_TEST_LABELS`/`PHYSICAL_TEST_ORDER` (Task 11) are the single definitions reused by Tasks 12-20. Verified function names (`bestOf`, `computeApproachJump`, `computeReaction`, `computeBodyMassRatio`, `createPhysicalTest`, `getLatestByType`, `listHistoryByType`, `formatPhysicalTestSummary`) are each defined exactly once and referenced identically by every consuming task.

**Corrected during self-review:** Tasks 9 and 10 originally instructed hoisting `mockUpdateDoc` as a bare `const` outside `vi.hoisted()` in `teamsApi.test.ts`/`playersApi.test.ts`. Reading the actual current content of both files (rather than relying on how Plan 1's plan text originally described them) showed they already use `vi.hoisted()` with direct-assignment mocks — a bare `const` alongside that would reintroduce the exact TDZ `ReferenceError` `vi.hoisted()` exists to prevent (the same bug Plan 1's Task 6 discovered and fixed). Both tasks now instruct joining the existing `vi.hoisted()` destructuring instead. Also tightened a hedge in Task 9 ("verify this by reading the test file if unsure") into a direct statement, having actually read `TeamPage.test.tsx` to confirm it only tests the rejected-read path.

**Scope check:** Large (20 tasks) but this is the user's explicit choice to keep backlog cleanup + development plans + physical testing bundled as one plan rather than split further. Each task still produces an independently testable, reviewable deliverable.
