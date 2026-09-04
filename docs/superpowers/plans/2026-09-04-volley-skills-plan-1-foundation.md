# Volley Skills App — Plan 1: Foundation (Scaffolding, Auth/Roles, Teams, Players, Skills)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working, testable player-management app: project scaffolding, Firebase Auth (email-link) with admin/viewer role resolution, team CRUD with email-keyed admin membership, player CRUD (contact info), the admin-editable skill guide, and player skill scoring with computed average/level.

**Architecture:** React + TypeScript + Vite SPA talking directly to Firestore via the Firebase client SDK — no custom backend. All authorization lives in Firestore Security Rules, verified by rules-unit-tests against the Firestore emulator. Routing is client-side (`react-router-dom`), state is local component state plus one `AuthContext`.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Firebase (Auth + Firestore, client SDK v10+), react-router-dom v6, Vitest, React Testing Library, `@firebase/rules-unit-testing`, ESLint, Prettier.

## Global Constraints

- Single club, not multi-tenant. Fixed 8-skill list (`serve`, `attack`, `set`, `defence`, `reception`, `jump`, `speed`, `iq`), 1-10 scale.
- No Cloud Functions — all authorization enforced in Firestore Security Rules only, so the app stays on Firebase's free Spark plan.
- No unbounded collection reads anywhere — every list query uses `limit()` + cursor pagination (`startAfter`), never fetch-all.
- `adminAllowlist/{email}` docs are never readable or writable by any client (`allow read, write: if false`) — the sole gate on who can become an admin.
- Team admin membership is **email-keyed** (`teams/{teamId}.adminEmails`), checked against `request.auth.token.email` — never uid-keyed, so granting access never requires resolving another user's uid.
- TypeScript `strict: true`. No secrets committed — Firebase web config comes from `.env.local` (gitignored); no service-account keys in the repo.
- Firestore rules tests are the highest-priority tests in this codebase — every access-control claim in a task must be backed by an `assertSucceeds`/`assertFails` pair, not just a unit test of application code.

---

## Task 1: Scaffold the Vite + React + TypeScript project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `.eslintrc.cjs`
- Create: `.prettierrc`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/index.css`
- Create: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: `App` component (`src/App.tsx`, default export-free named export `export function App()`), replaced entirely in Task 5.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "volley-skills-app",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:rules": "firebase emulators:exec --only firestore \"vitest run --config vitest.rules.config.ts\""
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@typescript-eslint/eslint-plugin": "^7.16.1",
    "@typescript-eslint/parser": "^7.16.1",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "eslint": "^8.57.0",
    "eslint-plugin-react-hooks": "^4.6.2",
    "eslint-plugin-react-refresh": "^0.4.9",
    "jsdom": "^24.1.1",
    "postcss": "^8.4.40",
    "prettier": "^3.3.3",
    "tailwindcss": "^3.4.7",
    "typescript": "^5.5.3",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules` created, no errors.

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Write `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.rules.config.ts"]
}
```

- [ ] **Step 5: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setupTests.ts',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/rules/**'],
  },
});
```

- [ ] **Step 6: Write `tests/setupTests.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Volley Skills</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Write `tailwind.config.js` and `postcss.config.js`**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

`postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 9: Write `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: Write `src/App.tsx`**

```tsx
export function App() {
  return <h1>Volley Skills</h1>;
}
```

- [ ] **Step 11: Write `src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 12: Write the failing test `src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('Volley Skills')).toBeInTheDocument();
  });
});
```

- [ ] **Step 13: Run the test to verify it passes**

Run: `npm test`
Expected: 1 test passes (App renders "Volley Skills").

- [ ] **Step 14: Write `.eslintrc.cjs` and `.prettierrc`**

`.eslintrc.cjs`:
```js
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
};
```

`.prettierrc`:
```json
{
  "singleQuote": true,
  "semi": true,
  "printWidth": 100
}
```

- [ ] **Step 15: Write `.gitignore`**

```
node_modules
dist
.env
.env.local
serviceAccountKey.json
.firebase
firebase-debug.log
firestore-debug.log
```

- [ ] **Step 16: Verify build and dev server**

Run: `npm run build`
Expected: builds without errors into `dist/`.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 17: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts index.html tailwind.config.js postcss.config.js .eslintrc.cjs .prettierrc .gitignore src tests
git commit -m "Scaffold Vite + React + TypeScript + Tailwind project"
```

---

## Task 2: Firebase SDK wiring

**Files:**
- Create: `.env.example`
- Create: `src/firebase/config.ts`
- Test: `src/firebase/config.test.ts`

**Interfaces:**
- Produces: `auth` (Firebase `Auth` instance) and `db` (Firestore instance) exported from `src/firebase/config.ts` — every later task that talks to Firebase imports these two.

- [ ] **Step 1: Install the Firebase SDK**

Run: `npm install firebase`
Expected: added to `dependencies` in `package.json`.

- [ ] **Step 2: Write `.env.example`**

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Then manually: copy this to `.env.local` (already gitignored) and fill in the real values from the Firebase console (Project Settings → General → "Your apps" → Web app) for the `volley-skills` project.

- [ ] **Step 3: Write the failing test `src/firebase/config.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';

const mockInitializeApp = vi.fn(() => 'app-instance');
const mockGetAuth = vi.fn(() => 'auth-instance');
const mockGetFirestore = vi.fn(() => 'firestore-instance');

vi.mock('firebase/app', () => ({ initializeApp: (...args: unknown[]) => mockInitializeApp(...args) }));
vi.mock('firebase/auth', () => ({ getAuth: (...args: unknown[]) => mockGetAuth(...args) }));
vi.mock('firebase/firestore', () => ({ getFirestore: (...args: unknown[]) => mockGetFirestore(...args) }));

describe('firebase config', () => {
  it('initializes the firebase app and exports auth/firestore instances', async () => {
    const { auth, db } = await import('./config');
    expect(mockInitializeApp).toHaveBeenCalled();
    expect(auth).toBe('auth-instance');
    expect(db).toBe('firestore-instance');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- src/firebase/config.test.ts`
Expected: FAIL with "Cannot find module './config'".

- [ ] **Step 5: Write `src/firebase/config.ts`**

```ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/firebase/config.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example src/firebase
git commit -m "Wire up Firebase SDK config"
```

---

## Task 3: Firestore rules skeleton + emulator test harness

**Prerequisite:** the Firestore emulator requires a Java runtime (JRE 11+) on `PATH`. Verify with `java -version` before running `npm run test:rules`; install a JRE first if that command fails.

**Files:**
- Create: `.firebaserc`
- Create: `firebase.json`
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `vitest.rules.config.ts`
- Create: `tests/rules/testEnv.ts`
- Test: `tests/rules/smoke.test.ts`

**Interfaces:**
- Produces: `getTestEnv(): Promise<RulesTestEnvironment>` from `tests/rules/testEnv.ts` — every subsequent rules-test file imports this.

- [ ] **Step 1: Install dev dependencies**

Run: `npm install -D firebase-tools @firebase/rules-unit-testing`
Expected: added to `devDependencies`.

- [ ] **Step 2: Write `.firebaserc`**

```json
{
  "projects": {
    "default": "volley-skills"
  }
}
```

- [ ] **Step 3: Write `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": true
    }
  }
}
```

- [ ] **Step 4: Write `firestore.indexes.json`**

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

- [ ] **Step 5: Write `firestore.rules` as deny-all**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 6: Write `vitest.rules.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
  },
});
```

- [ ] **Step 7: Write `tests/rules/testEnv.ts`**

```ts
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

let testEnv: RulesTestEnvironment | null = null;

export async function getTestEnv(): Promise<RulesTestEnvironment> {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId: 'volley-skills-test',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  }
  return testEnv;
}
```

- [ ] **Step 8: Write the failing test `tests/rules/smoke.test.ts`**

```ts
import { assertFails } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('firestore rules smoke test', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('denies all access by default to an unauthenticated user', async () => {
    const env = await getTestEnv();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(db.doc('anything/doc').get());
  });
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm run test:rules`
Expected: PASS — this proves the emulator + rules-test pipeline works end to end before any real rules are built on top of it.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json .firebaserc firebase.json firestore.rules firestore.indexes.json vitest.rules.config.ts tests/rules
git commit -m "Add Firestore rules skeleton and emulator rules-test harness"
```

---

## Task 4: Auth domain — `users`/`adminAllowlist` rules + role resolution

**Files:**
- Create: `src/types/auth.ts`
- Create: `src/auth/usersApi.ts`
- Modify: `firestore.rules` (replace deny-all with real `adminAllowlist`/`users` rules)
- Test: `src/auth/usersApi.test.ts`
- Test: `tests/rules/users.rules.test.ts`

**Interfaces:**
- Consumes: `db` from `src/firebase/config.ts` (Task 2).
- Produces: `ensureUserDoc(uid: string, email: string): Promise<AppUser>` from `src/auth/usersApi.ts`, and types `UserRole = 'admin' | 'viewer'`, `AppUser = { uid: string; email: string; role: UserRole }` from `src/types/auth.ts` — consumed by `AuthContext` in Task 5.

- [ ] **Step 1: Write `src/types/auth.ts`**

```ts
export type UserRole = 'admin' | 'viewer';

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
}
```

- [ ] **Step 2: Write the failing test `src/auth/usersApi.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ensureUserDoc } from './usersApi';

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('ensureUserDoc', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('returns the existing user doc without writing when one already exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ email: 'coach@example.com', role: 'admin' }),
    });

    const result = await ensureUserDoc('uid-1', 'coach@example.com');

    expect(result).toEqual({ uid: 'uid-1', email: 'coach@example.com', role: 'admin' });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('creates a role admin doc when the write succeeds', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const result = await ensureUserDoc('uid-2', 'coach@example.com');

    expect(result).toEqual({ uid: 'uid-2', email: 'coach@example.com', role: 'admin' });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('falls back to role viewer when the admin write is permission-denied', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc
      .mockRejectedValueOnce({ code: 'permission-denied' })
      .mockResolvedValueOnce(undefined);

    const result = await ensureUserDoc('uid-3', 'parent@example.com');

    expect(result).toEqual({ uid: 'uid-3', email: 'parent@example.com', role: 'viewer' });
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-permission errors instead of silently falling back', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockRejectedValueOnce({ code: 'unavailable' });

    await expect(ensureUserDoc('uid-4', 'coach@example.com')).rejects.toEqual({ code: 'unavailable' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/auth/usersApi.test.ts`
Expected: FAIL with "Cannot find module './usersApi'".

- [ ] **Step 4: Write `src/auth/usersApi.ts`**

```ts
import { doc, getDoc, setDoc, type FirestoreError } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AppUser, UserRole } from '../types/auth';

export async function ensureUserDoc(uid: string, email: string): Promise<AppUser> {
  const userRef = doc(db, 'users', uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    const data = existing.data() as { email: string; role: UserRole };
    return { uid, email: data.email, role: data.role };
  }

  try {
    await setDoc(userRef, { email, role: 'admin' });
    return { uid, email, role: 'admin' };
  } catch (error) {
    if ((error as FirestoreError).code !== 'permission-denied') {
      throw error;
    }
    await setDoc(userRef, { email, role: 'viewer' });
    return { uid, email, role: 'viewer' };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/auth/usersApi.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing rules test `tests/rules/users.rules.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('users and adminAllowlist rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('denies all reads and writes on adminAllowlist even when authenticated', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(db.doc('adminAllowlist/coach@example.com').get());
    await assertFails(db.doc('adminAllowlist/coach@example.com').set({}));
  });

  it('allows an allowlisted email to create their own user doc with role admin', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('adminAllowlist/coach@example.com').set({});
    });
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('users/coach-uid').set({ email: 'coach@example.com', role: 'admin' }));
  });

  it('denies a non-allowlisted email from creating a user doc with role admin', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(db.doc('users/parent-uid').set({ email: 'parent@example.com', role: 'admin' }));
  });

  it('allows any authenticated user to create their own user doc with role viewer', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertSucceeds(db.doc('users/parent-uid').set({ email: 'parent@example.com', role: 'viewer' }));
  });

  it("denies a user from reading another user's doc", async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('users/other-uid').set({ email: 'other@example.com', role: 'viewer' });
    });
    const db = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(db.doc('users/other-uid').get());
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — the deny-all rules block every case.

- [ ] **Step 8: Replace `firestore.rules` with real `adminAllowlist`/`users` rules**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /adminAllowlist/{email} {
      allow read, write: if false;
    }

    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.email == request.auth.token.email
        && request.resource.data.keys().hasOnly(['email', 'role'])
        && (
          request.resource.data.role == 'viewer' ||
          (request.resource.data.role == 'admin' &&
            exists(/databases/$(database)/documents/adminAllowlist/$(request.auth.token.email)))
        );
      allow update, delete: if false;
    }
  }
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm run test:rules`
Expected: PASS (5 tests in `users.rules.test.ts`, plus the Task 3 smoke test still passing).

- [ ] **Step 10: Commit**

```bash
git add src/types/auth.ts src/auth/usersApi.ts src/auth/usersApi.test.ts tests/rules/users.rules.test.ts firestore.rules
git commit -m "Add users/adminAllowlist rules and role resolution"
```

---

## Task 5: Email-link sign-in UI, AuthContext, route guard, routing skeleton

**Prerequisite:** in the Firebase console for the `volley-skills` project, enable the **Email Link (passwordless sign-in)** provider under Authentication → Sign-in method, and add `localhost` (and later the production Hosting domain) to Authentication → Settings → Authorized domains.

**Files:**
- Create: `src/auth/emailLinkStorage.ts`
- Create: `src/auth/AuthContext.tsx`
- Create: `src/auth/LoginPage.tsx`
- Create: `src/auth/FinishSignInPage.tsx`
- Create: `src/auth/RequireAuth.tsx`
- Modify: `src/App.tsx` (full replace — routing skeleton)
- Modify: `src/App.test.tsx` (full replace — tests routing/guard behavior instead of static text)
- Test: `src/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `auth` from `src/firebase/config.ts` (Task 2), `ensureUserDoc` from `src/auth/usersApi.ts` (Task 4).
- Produces: `useAuth(): { firebaseUser: User | null; appUser: AppUser | null; loading: boolean }` from `src/auth/AuthContext.tsx`, `<RequireAuth>{children}</RequireAuth>` from `src/auth/RequireAuth.tsx` — both consumed by every later page. The `/teams` route currently renders an inline placeholder; Task 7 replaces it with the real `TeamsListPage`.

- [ ] **Step 1: Install `react-router-dom`**

Run: `npm install react-router-dom`

- [ ] **Step 2: Write `src/auth/emailLinkStorage.ts`**

```ts
const EMAIL_STORAGE_KEY = 'emailForSignIn';

export function saveEmailForSignIn(email: string): void {
  window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
}

export function takeEmailForSignIn(): string | null {
  const email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
  window.localStorage.removeItem(EMAIL_STORAGE_KEY);
  return email;
}
```

- [ ] **Step 3: Write `src/auth/AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase/config';
import { ensureUserDoc } from './usersApi';
import type { AppUser } from '../types/auth';

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ firebaseUser: null, appUser: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user && user.email) {
        const resolved = await ensureUserDoc(user.uid, user.email);
        setAppUser(resolved);
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
```

- [ ] **Step 4: Write `src/auth/RequireAuth.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { firebaseUser, loading } = useAuth();

  if (loading) return <p>Loading...</p>;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 5: Write the failing test `src/auth/LoginPage.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';

const mockSendSignInLinkToEmail = vi.fn();

vi.mock('firebase/auth', () => ({
  sendSignInLinkToEmail: (...args: unknown[]) => mockSendSignInLinkToEmail(...args),
}));

vi.mock('../firebase/config', () => ({ auth: {} }));

describe('LoginPage', () => {
  beforeEach(() => {
    mockSendSignInLinkToEmail.mockReset();
    window.localStorage.clear();
  });

  it('sends a sign-in link and shows a confirmation message', async () => {
    mockSendSignInLinkToEmail.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coach@example.com' } });
    fireEvent.click(screen.getByText('Send sign-in link'));

    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument());
    expect(mockSendSignInLinkToEmail).toHaveBeenCalledWith(
      {},
      'coach@example.com',
      expect.objectContaining({ handleCodeInApp: true })
    );
    expect(window.localStorage.getItem('emailForSignIn')).toBe('coach@example.com');
  });

  it('shows an error message when sending the link fails', async () => {
    mockSendSignInLinkToEmail.mockRejectedValue(new Error('network error'));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'coach@example.com' } });
    fireEvent.click(screen.getByText('Send sign-in link'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/auth/LoginPage.test.tsx`
Expected: FAIL with "Cannot find module './LoginPage'".

- [ ] **Step 7: Write `src/auth/LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { sendSignInLinkToEmail } from 'firebase/auth';
import { auth } from '../firebase/config';
import { saveEmailForSignIn } from './emailLinkStorage';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/finish-sign-in`,
        handleCodeInApp: true,
      });
      saveEmailForSignIn(email);
      setSent(true);
    } catch {
      setError('Could not send sign-in link. Please check the email address and try again.');
    }
  }

  if (sent) {
    return <p>Check your email for a sign-in link.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <button type="submit">Send sign-in link</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/auth/LoginPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Write `src/auth/FinishSignInPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from '../firebase/config';
import { takeEmailForSignIn } from './emailLinkStorage';

export function FinishSignInPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function completeSignIn() {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        setError('This sign-in link is invalid or has expired.');
        return;
      }
      const email = takeEmailForSignIn();
      if (!email) {
        setError(
          'Could not find the email this link was sent to. Please request a new link from the same browser.'
        );
        return;
      }
      try {
        await signInWithEmailLink(auth, email, window.location.href);
        navigate('/teams', { replace: true });
      } catch {
        setError('This sign-in link could not be used. Please request a new one.');
      }
    }
    void completeSignIn();
  }, [navigate]);

  return error ? <p role="alert">{error}</p> : <p>Signing you in...</p>;
}
```

- [ ] **Step 10: Replace `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './auth/LoginPage';
import { FinishSignInPage } from './auth/FinishSignInPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/finish-sign-in" element={<FinishSignInPage />} />
          <Route
            path="/teams"
            element={
              <RequireAuth>
                <div>Signed in. Teams list coming in Task 7.</div>
              </RequireAuth>
            }
          />
          <Route path="/" element={<Navigate to="/teams" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 11: Replace `src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: null) => void) => {
    callback(null);
    return () => {};
  },
}));
vi.mock('./firebase/config', () => ({ auth: {}, db: {} }));

describe('App', () => {
  it('redirects an unauthenticated visitor at "/" to the login page', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
  });
});
```

- [ ] **Step 12: Run all tests to verify they pass**

Run: `npm test`
Expected: all tests pass, including the new `App.test.tsx`.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json src/auth src/App.tsx src/App.test.tsx
git commit -m "Add email-link sign-in, AuthContext, and route guard"
```

---

## Task 6: Teams data layer and rules

**Files:**
- Create: `src/types/team.ts`
- Create: `src/teams/teamsApi.ts`
- Modify: `firestore.rules` (append `teams/{teamId}` match block)
- Modify: `firestore.indexes.json` (add the `teams` composite index)
- Test: `src/teams/teamsApi.test.ts`
- Test: `tests/rules/teams.rules.test.ts`

**Interfaces:**
- Consumes: `db` from `src/firebase/config.ts`.
- Produces from `src/teams/teamsApi.ts`: `createTeam(input, creatorUid, creatorEmail): Promise<string>`, `listMyTeams(email, afterDoc): Promise<{ teams: Team[]; lastDoc: QueryDocumentSnapshot | null }>`, `getTeam(teamId): Promise<Team | null>`, `addTeamAdmin(teamId, email, currentAdmins): Promise<void>`, `removeTeamAdmin(teamId, email, currentAdmins): Promise<void>`, `updateTeamInfo(teamId, updates): Promise<void>`. `Team` type from `src/types/team.ts` — consumed by Tasks 7-8 and 13.

- [ ] **Step 1: Write `src/types/team.ts`**

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

export interface Team {
  id: string;
  name: string;
  club: string;
  ageGroup: string;
  season: string;
  description: string;
  notes: string;
  adminEmails: string[];
  developmentPlan: DevelopmentPlan;
  createdBy: string;
  createdAt: unknown;
}
```

- [ ] **Step 2: Write the failing test `src/teams/teamsApi.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createTeam, listMyTeams } from './teamsApi';

const mockAddDoc = vi.fn();
const mockCollection = vi.fn(() => 'teams-collection');
const mockGetDocs = vi.fn();
const mockQuery = vi.fn((...args: unknown[]) => args);
const mockWhere = vi.fn((...args: unknown[]) => ({ type: 'where', args }));
const mockOrderBy = vi.fn((...args: unknown[]) => ({ type: 'orderBy', args }));
const mockLimit = vi.fn((...args: unknown[]) => ({ type: 'limit', args }));

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

vi.mock('../firebase/config', () => ({ db: {} }));

describe('teamsApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('creates a team with the creator as the sole admin', async () => {
    mockAddDoc.mockResolvedValue({ id: 'team-1' });

    const id = await createTeam(
      { name: 'U17', club: 'VCB', ageGroup: 'U17', season: '2026-27', description: '' },
      'creator-uid',
      'coach@example.com'
    );

    expect(id).toBe('team-1');
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload).toMatchObject({
      name: 'U17',
      adminEmails: ['coach@example.com'],
      createdBy: 'creator-uid',
      developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
    });
  });

  it('lists teams filtered to the given admin email', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'team-1', data: () => ({ name: 'U17' }) }],
    });

    const { teams, lastDoc } = await listMyTeams('coach@example.com', null);

    expect(teams).toEqual([{ id: 'team-1', name: 'U17' }]);
    expect(lastDoc).toEqual({ id: 'team-1', data: expect.any(Function) });
    expect(mockWhere).toHaveBeenCalledWith('adminEmails', 'array-contains', 'coach@example.com');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/teams/teamsApi.test.ts`
Expected: FAIL with "Cannot find module './teamsApi'".

- [ ] **Step 4: Write `src/teams/teamsApi.ts`**

```ts
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Team } from '../types/team';

const TEAMS_PAGE_SIZE = 20;

export interface NewTeamInput {
  name: string;
  club: string;
  ageGroup: string;
  season: string;
  description: string;
}

export async function createTeam(input: NewTeamInput, creatorUid: string, creatorEmail: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'teams'), {
    ...input,
    notes: '',
    adminEmails: [creatorEmail],
    developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export interface TeamsPage {
  teams: Team[];
  lastDoc: QueryDocumentSnapshot | null;
}

export async function listMyTeams(email: string, afterDoc: QueryDocumentSnapshot | null = null): Promise<TeamsPage> {
  const base = collection(db, 'teams');
  const q = afterDoc
    ? query(base, where('adminEmails', 'array-contains', email), orderBy('createdAt', 'desc'), startAfter(afterDoc), limit(TEAMS_PAGE_SIZE))
    : query(base, where('adminEmails', 'array-contains', email), orderBy('createdAt', 'desc'), limit(TEAMS_PAGE_SIZE));
  const snapshot = await getDocs(q);
  const teams = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Team);
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { teams, lastDoc };
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const snapshot = await getDoc(doc(db, 'teams', teamId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Team;
}

export async function addTeamAdmin(teamId: string, email: string, currentAdmins: string[]): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), { adminEmails: [...currentAdmins, email] });
}

export async function removeTeamAdmin(teamId: string, email: string, currentAdmins: string[]): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), { adminEmails: currentAdmins.filter((e) => e !== email) });
}

export async function updateTeamInfo(
  teamId: string,
  updates: Partial<Pick<Team, 'name' | 'description' | 'notes'>>
): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), updates);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/teams/teamsApi.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write the failing rules test `tests/rules/teams.rules.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('teams rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a user create a team that lists themselves as an admin', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(
      db.collection('teams').add({ name: 'U17', adminEmails: ['coach@example.com'], createdBy: 'coach-uid' })
    );
  });

  it('denies creating a team that does not include the creator in adminEmails', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(
      db.collection('teams').add({ name: 'U17', adminEmails: ['someone-else@example.com'], createdBy: 'coach-uid' })
    );
  });

  it('lets a team admin read the team, denies a non-admin', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    });

    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('teams/team-1').get());

    const outsiderDb = env.authenticatedContext('other-uid', { email: 'other@example.com' }).firestore();
    await assertFails(outsiderDb.doc('teams/team-1').get());
  });

  it('lets an existing admin add another admin by email', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    });

    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(
      adminDb.doc('teams/team-1').update({ adminEmails: ['coach@example.com', 'assistant@example.com'] })
    );
  });

  it('denies leaving a team with zero admins', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    });

    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(adminDb.doc('teams/team-1').update({ adminEmails: [] }));
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — `teams` isn't matched by any rule yet, so every case is denied.

- [ ] **Step 8: Append the `teams` match block to `firestore.rules`**

Insert the following inside `match /databases/{database}/documents { ... }`, after the `users/{uid}` block:

```
    match /teams/{teamId} {
      allow read: if request.auth != null
        && request.auth.token.email in resource.data.adminEmails;
      allow create: if request.auth != null
        && request.auth.token.email in request.resource.data.adminEmails
        && request.resource.data.createdBy == request.auth.uid;
      allow update: if request.auth != null
        && request.auth.token.email in resource.data.adminEmails
        && request.auth.token.email in request.resource.data.adminEmails
        && request.resource.data.adminEmails.size() > 0;
      allow delete: if false;
    }
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm run test:rules`
Expected: PASS (all `teams.rules.test.ts` cases, plus all previously passing rules tests).

- [ ] **Step 10: Add the composite index to `firestore.indexes.json`**

```json
{
  "indexes": [
    {
      "collectionGroup": "teams",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "adminEmails", "arrayConfig": "CONTAINS" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 11: Commit**

```bash
git add src/types/team.ts src/teams firestore.rules firestore.indexes.json
git commit -m "Add teams data layer and email-keyed admin access rules"
```

---

## Task 7: Teams UI — list page and create dialog

**Files:**
- Create: `src/teams/CreateTeamDialog.tsx`
- Create: `src/teams/TeamsListPage.tsx`
- Modify: `src/App.tsx:11-18` (swap the `/teams` placeholder route for `<TeamsListPage />`)
- Test: `src/teams/CreateTeamDialog.test.tsx`

**Interfaces:**
- Consumes: `createTeam`, `listMyTeams` from `src/teams/teamsApi.ts` (Task 6); `useAuth` from `src/auth/AuthContext.tsx` (Task 5).
- Produces: `TeamsListPage` component, registered at `/teams`.

- [ ] **Step 1: Write `src/teams/CreateTeamDialog.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createTeam } from './teamsApi';

interface CreateTeamDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTeamDialog({ onClose, onCreated }: CreateTeamDialogProps) {
  const { firebaseUser } = useAuth();
  const [name, setName] = useState('');
  const [club, setClub] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [season, setSeason] = useState('');
  const [description, setDescription] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!firebaseUser?.email) return;
    await createTeam({ name, club, ageGroup, season, description }, firebaseUser.uid, firebaseUser.email);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Create team">
      <label htmlFor="team-name">Name</label>
      <input id="team-name" value={name} onChange={(e) => setName(e.target.value)} required />

      <label htmlFor="team-club">Club</label>
      <input id="team-club" value={club} onChange={(e) => setClub(e.target.value)} required />

      <label htmlFor="team-age-group">Age group</label>
      <input id="team-age-group" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} required />

      <label htmlFor="team-season">Season</label>
      <input id="team-season" value={season} onChange={(e) => setSeason(e.target.value)} required />

      <label htmlFor="team-description">Description</label>
      <textarea id="team-description" value={description} onChange={(e) => setDescription(e.target.value)} />

      <button type="submit">Create</button>
      <button type="button" onClick={onClose}>
        Cancel
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Write the failing test `src/teams/CreateTeamDialog.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateTeamDialog } from './CreateTeamDialog';
import * as teamsApi from './teamsApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./teamsApi');
vi.mock('../auth/AuthContext');

describe('CreateTeamDialog', () => {
  it('submits the form fields to createTeam and calls onCreated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
    });
    const createTeamSpy = vi.spyOn(teamsApi, 'createTeam').mockResolvedValue('team-1');
    const onCreated = vi.fn();

    render(<CreateTeamDialog onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'U17' } });
    fireEvent.change(screen.getByLabelText('Club'), { target: { value: 'VCB' } });
    fireEvent.change(screen.getByLabelText('Age group'), { target: { value: 'U17' } });
    fireEvent.change(screen.getByLabelText('Season'), { target: { value: '2026-27' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createTeamSpy).toHaveBeenCalledWith(
      { name: 'U17', club: 'VCB', ageGroup: 'U17', season: '2026-27', description: '' },
      'coach-uid',
      'coach@example.com'
    );
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npm test -- src/teams/CreateTeamDialog.test.tsx`
Expected: PASS.

- [ ] **Step 4: Write `src/teams/TeamsListPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { listMyTeams } from './teamsApi';
import { CreateTeamDialog } from './CreateTeamDialog';
import type { Team } from '../types/team';

export function TeamsListPage() {
  const { appUser } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function loadFirstPage() {
    if (!appUser) return;
    const page = await listMyTeams(appUser.email);
    setTeams(page.teams);
    setLastDoc(page.lastDoc);
    setHasMore(page.teams.length > 0 && page.lastDoc !== null);
  }

  async function loadMore() {
    if (!appUser || !lastDoc) return;
    const page = await listMyTeams(appUser.email, lastDoc);
    setTeams((current) => [...current, ...page.teams]);
    setLastDoc(page.lastDoc);
    setHasMore(page.teams.length > 0);
  }

  useEffect(() => {
    void loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.email]);

  return (
    <div>
      <h1>Teams</h1>
      <button onClick={() => setShowCreate(true)}>Create team</button>
      <ul>
        {teams.map((team) => (
          <li key={team.id}>
            <Link to={`/teams/${team.id}`}>{team.name}</Link>
          </li>
        ))}
      </ul>
      {hasMore && <button onClick={() => void loadMore()}>Load more</button>}
      {showCreate && (
        <CreateTeamDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void loadFirstPage();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Modify `src/App.tsx`** — replace the `/teams` placeholder route

Replace:
```tsx
          <Route
            path="/teams"
            element={
              <RequireAuth>
                <div>Signed in. Teams list coming in Task 7.</div>
              </RequireAuth>
            }
          />
```
With:
```tsx
          <Route
            path="/teams"
            element={
              <RequireAuth>
                <TeamsListPage />
              </RequireAuth>
            }
          />
```
And add the import: `import { TeamsListPage } from './teams/TeamsListPage';`

- [ ] **Step 6: Run all tests to verify they pass**

Run: `npm test`
Expected: all tests pass (the `App.test.tsx` case from Task 5 is unaffected since it only exercises the unauthenticated `/login` redirect).

- [ ] **Step 7: Commit**

```bash
git add src/teams src/App.tsx
git commit -m "Add teams list page and create-team dialog"
```

---

## Task 8: Team page shell and Settings tab

**Files:**
- Create: `src/teams/TeamSettingsTab.tsx`
- Create: `src/teams/TeamPage.tsx`
- Modify: `src/App.tsx` (add the `/teams/:teamId` route)
- Test: `src/teams/TeamSettingsTab.test.tsx`

**Interfaces:**
- Consumes: `getTeam`, `addTeamAdmin`, `removeTeamAdmin` from `src/teams/teamsApi.ts` (Task 6).
- Produces: `TeamPage` component registered at `/teams/:teamId`, with an "Overview" tab (placeholder text, replaced by the roster table in Task 14) and a "Settings" tab.

- [ ] **Step 1: Write the failing test `src/teams/TeamSettingsTab.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamSettingsTab } from './TeamSettingsTab';
import * as teamsApi from './teamsApi';
import type { Team } from '../types/team';

vi.mock('./teamsApi');

const baseTeam: Team = {
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

describe('TeamSettingsTab', () => {
  it('adds a new admin email and reflects it in the list', async () => {
    vi.spyOn(teamsApi, 'addTeamAdmin').mockResolvedValue(undefined);
    const onTeamUpdated = vi.fn();

    render(<TeamSettingsTab team={baseTeam} onTeamUpdated={onTeamUpdated} />);
    fireEvent.change(screen.getByLabelText('Add admin by email'), { target: { value: 'assistant@example.com' } });
    fireEvent.click(screen.getByText('Grant access'));

    await waitFor(() =>
      expect(onTeamUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ adminEmails: ['coach@example.com', 'assistant@example.com'] })
      )
    );
  });

  it('does not show a remove button when there is only one admin', () => {
    render(<TeamSettingsTab team={baseTeam} onTeamUpdated={vi.fn()} />);
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/teams/TeamSettingsTab.test.tsx`
Expected: FAIL with "Cannot find module './TeamSettingsTab'".

- [ ] **Step 3: Write `src/teams/TeamSettingsTab.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { addTeamAdmin, removeTeamAdmin } from './teamsApi';
import type { Team } from '../types/team';

interface TeamSettingsTabProps {
  team: Team;
  onTeamUpdated: (team: Team) => void;
}

export function TeamSettingsTab({ team, onTeamUpdated }: TeamSettingsTabProps) {
  const [newAdminEmail, setNewAdminEmail] = useState('');

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!newAdminEmail) return;
    await addTeamAdmin(team.id, newAdminEmail, team.adminEmails);
    onTeamUpdated({ ...team, adminEmails: [...team.adminEmails, newAdminEmail] });
    setNewAdminEmail('');
  }

  async function handleRemove(email: string) {
    await removeTeamAdmin(team.id, email, team.adminEmails);
    onTeamUpdated({ ...team, adminEmails: team.adminEmails.filter((e) => e !== email) });
  }

  return (
    <div>
      <h2>Admins</h2>
      <ul>
        {team.adminEmails.map((email) => (
          <li key={email}>
            {email}
            {team.adminEmails.length > 1 && <button onClick={() => void handleRemove(email)}>Remove</button>}
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd}>
        <label htmlFor="new-admin-email">Add admin by email</label>
        <input
          id="new-admin-email"
          type="email"
          value={newAdminEmail}
          onChange={(e) => setNewAdminEmail(e.target.value)}
          required
        />
        <button type="submit">Grant access</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/teams/TeamSettingsTab.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write `src/teams/TeamPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getTeam } from './teamsApi';
import { TeamSettingsTab } from './TeamSettingsTab';
import type { Team } from '../types/team';

type Tab = 'overview' | 'settings';

export function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!teamId) return;
    void getTeam(teamId).then(setTeam);
  }, [teamId]);

  if (!team || !teamId) return <p>Loading team...</p>;

  return (
    <div>
      <h1>{team.name}</h1>
      <p>{team.description}</p>
      <nav>
        <button onClick={() => setTab('overview')}>Overview</button>
        <button onClick={() => setTab('settings')}>Settings</button>
      </nav>
      {tab === 'overview' && <p>Roster overview coming in Task 14.</p>}
      {tab === 'settings' && <TeamSettingsTab team={team} onTeamUpdated={setTeam} />}
    </div>
  );
}
```

- [ ] **Step 6: Modify `src/App.tsx`** — add the team detail route

Add the import `import { TeamPage } from './teams/TeamPage';` and, inside `<Routes>`, add:
```tsx
          <Route
            path="/teams/:teamId"
            element={
              <RequireAuth>
                <TeamPage />
              </RequireAuth>
            }
          />
```

- [ ] **Step 7: Run all tests to verify they pass**

Run: `npm test`

- [ ] **Step 8: Commit**

```bash
git add src/teams/TeamSettingsTab.tsx src/teams/TeamSettingsTab.test.tsx src/teams/TeamPage.tsx src/App.tsx
git commit -m "Add team page shell and admin-management settings tab"
```

---

## Task 9: Players data layer and rules (contact fields)

**Files:**
- Create: `src/types/player.ts`
- Create: `src/players/playersApi.ts`
- Modify: `firestore.rules` (append `teams/{teamId}/players/{playerId}` match block)
- Test: `src/players/playersApi.test.ts`
- Test: `tests/rules/players.rules.test.ts`

**Interfaces:**
- Consumes: `db` from `src/firebase/config.ts`, `Team` from `src/types/team.ts`.
- Produces from `src/players/playersApi.ts`: `createPlayer(teamId, team, input, creatorUid): Promise<string>`, `listPlayers(teamId, afterDoc): Promise<{ players: Player[]; lastDoc }>`, `getPlayer(teamId, playerId): Promise<Player | null>`, `updatePlayerContact(teamId, playerId, updates): Promise<void>`. `Player`, `Guardian`, `SkillKey`, `Skills`, `Level` types from `src/types/player.ts` — consumed by Tasks 10-14.

- [ ] **Step 1: Write `src/types/player.ts`**

```ts
export interface Guardian {
  relation: 'mother' | 'father' | 'other';
  name: string;
  phone: string;
  email: string;
}

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

export type SkillKey = 'serve' | 'attack' | 'set' | 'defence' | 'reception' | 'jump' | 'speed' | 'iq';

export interface SkillEntry {
  score: number | null;
  notes: string;
  priority: boolean;
}

export type Skills = Record<SkillKey, SkillEntry>;

export type Level = 'Beginner' | 'Developing' | 'Advanced' | 'Elite';

export interface Player {
  id: string;
  number: number;
  fullName: string;
  dob: string;
  nationality: string;
  licenseNumber: string;
  position: string;
  playerPhone: string;
  guardians: Guardian[];
  viewerEmails: string[];
  teamName: string;
  ageGroup: string;
  season: string;
  skills: Skills;
  avgScore: number | null;
  level: Level | null;
  developmentPlan: DevelopmentPlan;
  consent: { given: boolean; date: string | null; confirmedBy: string | null };
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}
```

- [ ] **Step 2: Write the failing test `src/players/playersApi.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPlayer, listPlayers } from './playersApi';
import type { Team } from '../types/team';

const mockAddDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockCollection = vi.fn(() => 'players-collection');
const mockQuery = vi.fn((...args: unknown[]) => args);

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

vi.mock('../firebase/config', () => ({ db: {} }));

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

describe('playersApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('creates a player with empty skills and denormalized team fields', async () => {
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
        guardians: [],
      },
      'coach-uid'
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
      consent: { given: false, date: null, confirmedBy: null },
      skills: { serve: { score: null, notes: '', priority: false } },
    });
  });

  it('lists players ordered by number', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'player-1', data: () => ({ fullName: 'Test Player' }) }] });

    const { players, lastDoc } = await listPlayers('team-1');

    expect(players).toEqual([{ id: 'player-1', fullName: 'Test Player' }]);
    expect(lastDoc).toEqual({ id: 'player-1', data: expect.any(Function) });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/players/playersApi.test.ts`
Expected: FAIL with "Cannot find module './playersApi'".

- [ ] **Step 4: Write `src/players/playersApi.ts`**

```ts
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Player, SkillKey, Guardian } from '../types/player';
import type { Team } from '../types/team';

const PLAYERS_PAGE_SIZE = 25;

const EMPTY_SKILLS: Record<SkillKey, { score: null; notes: string; priority: boolean }> = {
  serve: { score: null, notes: '', priority: false },
  attack: { score: null, notes: '', priority: false },
  set: { score: null, notes: '', priority: false },
  defence: { score: null, notes: '', priority: false },
  reception: { score: null, notes: '', priority: false },
  jump: { score: null, notes: '', priority: false },
  speed: { score: null, notes: '', priority: false },
  iq: { score: null, notes: '', priority: false },
};

export interface NewPlayerInput {
  number: number;
  fullName: string;
  dob: string;
  nationality: string;
  licenseNumber: string;
  position: string;
  playerPhone: string;
  guardians: Guardian[];
}

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

export interface PlayersPage {
  players: Player[];
  lastDoc: QueryDocumentSnapshot | null;
}

export async function listPlayers(teamId: string, afterDoc: QueryDocumentSnapshot | null = null): Promise<PlayersPage> {
  const base = collection(db, 'teams', teamId, 'players');
  const q = afterDoc
    ? query(base, orderBy('number'), startAfter(afterDoc), limit(PLAYERS_PAGE_SIZE))
    : query(base, orderBy('number'), limit(PLAYERS_PAGE_SIZE));
  const snapshot = await getDocs(q);
  const players = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Player);
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { players, lastDoc };
}

export async function getPlayer(teamId: string, playerId: string): Promise<Player | null> {
  const snapshot = await getDoc(doc(db, 'teams', teamId, 'players', playerId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Player;
}

export async function updatePlayerContact(
  teamId: string,
  playerId: string,
  updates: Partial<NewPlayerInput>
): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'players', playerId), { ...updates, updatedAt: serverTimestamp() });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/players/playersApi.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write the failing rules test `tests/rules/players.rules.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

async function seedTeamAndPlayer(env: Awaited<ReturnType<typeof getTestEnv>>) {
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
  });
}

describe('player rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedTeamAndPlayer(env);
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets the team admin read and update the player', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1/players/player-1').get());
    await assertSucceeds(db.doc('teams/team-1/players/player-1').update({ fullName: 'Updated Name' }));
  });

  it('lets the linked viewer read but not write the player', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1/players/player-1').get());
    await assertFails(db.doc('teams/team-1/players/player-1').update({ fullName: 'Hacked' }));
  });

  it('denies an unrelated user from reading the player', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('stranger-uid', { email: 'stranger@example.com' }).firestore();
    await assertFails(db.doc('teams/team-1/players/player-1').get());
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — `teams/{teamId}/players/{playerId}` isn't matched by any rule yet.

- [ ] **Step 8: Append the players match block to `firestore.rules`**

Insert inside `match /teams/{teamId} { ... }`, as a nested match (so it can reference the parent `teamId` binding):

```
      match /players/{playerId} {
        function isTeamAdmin() {
          return request.auth.token.email in
            get(/databases/$(database)/documents/teams/$(teamId)).data.adminEmails;
        }

        allow read: if request.auth != null && (
          isTeamAdmin() || request.auth.token.email in resource.data.viewerEmails
        );
        allow create, update: if request.auth != null && isTeamAdmin();
        allow delete: if false;
      }
```

Note: this nests inside the existing `match /teams/{teamId} { ... }` block from Task 6, not as a new top-level `match`.

- [ ] **Step 9: Run test to verify it passes**

Run: `npm run test:rules`
Expected: PASS (all `players.rules.test.ts` cases, plus every previously passing rules test).

- [ ] **Step 10: Commit**

```bash
git add src/types/player.ts src/players firestore.rules
git commit -m "Add players data layer and viewer/admin access rules"
```

---

## Task 10: Player Card page — contact section

**Files:**
- Create: `src/players/PlayerContactSection.tsx`
- Create: `src/players/PlayerCardPage.tsx`
- Modify: `src/App.tsx` (add the `/teams/:teamId/players/:playerId` route)
- Test: `src/players/PlayerContactSection.test.tsx`

**Interfaces:**
- Consumes: `getPlayer`, `updatePlayerContact` from `src/players/playersApi.ts` (Task 9).
- Produces: `PlayerCardPage` registered at `/teams/:teamId/players/:playerId`. Renders `PlayerContactSection` now; Task 13 modifies this file to also render `PlayerSkillsSection`.

- [ ] **Step 1: Write the failing test `src/players/PlayerContactSection.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayerContactSection } from './PlayerContactSection';
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
  playerPhone: '00352 000 000',
  guardians: [],
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
  consent: { given: false, date: null, confirmedBy: null },
  createdBy: 'coach-uid',
  createdAt: null,
  updatedAt: null,
};

describe('PlayerContactSection', () => {
  it('edits and saves the name, position, and phone', async () => {
    vi.spyOn(playersApi, 'updatePlayerContact').mockResolvedValue(undefined);
    const onPlayerUpdated = vi.fn();

    render(
      <PlayerContactSection teamId="team-1" playerId="player-1" player={basePlayer} onPlayerUpdated={onPlayerUpdated} />
    );

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated Name' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(playersApi.updatePlayerContact).toHaveBeenCalledWith('team-1', 'player-1', {
        fullName: 'Updated Name',
        position: 'OH',
        playerPhone: '00352 000 000',
      })
    );
    expect(onPlayerUpdated).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Updated Name' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/players/PlayerContactSection.test.tsx`
Expected: FAIL with "Cannot find module './PlayerContactSection'".

- [ ] **Step 3: Write `src/players/PlayerContactSection.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { updatePlayerContact } from './playersApi';
import type { Player } from '../types/player';

interface PlayerContactSectionProps {
  teamId: string;
  playerId: string;
  player: Player;
  onPlayerUpdated: (player: Player) => void;
}

export function PlayerContactSection({ teamId, playerId, player, onPlayerUpdated }: PlayerContactSectionProps) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(player.fullName);
  const [position, setPosition] = useState(player.position);
  const [playerPhone, setPlayerPhone] = useState(player.playerPhone);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    await updatePlayerContact(teamId, playerId, { fullName, position, playerPhone });
    onPlayerUpdated({ ...player, fullName, position, playerPhone });
    setEditing(false);
  }

  if (!editing) {
    return (
      <section>
        <h2>Contact & Registration</h2>
        <p>Name: {player.fullName}</p>
        <p>Position: {player.position}</p>
        <p>Phone: {player.playerPhone}</p>
        <button onClick={() => setEditing(true)}>Edit</button>
      </section>
    );
  }

  return (
    <form onSubmit={handleSave} aria-label="Edit contact information">
      <label htmlFor="player-name">Name</label>
      <input id="player-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />

      <label htmlFor="player-position">Position</label>
      <input id="player-position" value={position} onChange={(e) => setPosition(e.target.value)} />

      <label htmlFor="player-phone">Phone</label>
      <input id="player-phone" value={playerPhone} onChange={(e) => setPlayerPhone(e.target.value)} />

      <button type="submit">Save</button>
      <button type="button" onClick={() => setEditing(false)}>
        Cancel
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/players/PlayerContactSection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write `src/players/PlayerCardPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPlayer } from './playersApi';
import { PlayerContactSection } from './PlayerContactSection';
import type { Player } from '../types/player';

export function PlayerCardPage() {
  const { teamId, playerId } = useParams<{ teamId: string; playerId: string }>();
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (!teamId || !playerId) return;
    void getPlayer(teamId, playerId).then(setPlayer);
  }, [teamId, playerId]);

  if (!player || !teamId || !playerId) return <p>Loading player...</p>;

  return (
    <div>
      <h1>{player.fullName}</h1>
      <PlayerContactSection teamId={teamId} playerId={playerId} player={player} onPlayerUpdated={setPlayer} />
      <p>Skills section coming in Task 13.</p>
    </div>
  );
}
```

- [ ] **Step 6: Modify `src/App.tsx`** — add the player card route

Add the import `import { PlayerCardPage } from './players/PlayerCardPage';` and, inside `<Routes>`, add:
```tsx
          <Route
            path="/teams/:teamId/players/:playerId"
            element={
              <RequireAuth>
                <PlayerCardPage />
              </RequireAuth>
            }
          />
```

- [ ] **Step 7: Run all tests to verify they pass**

Run: `npm test`

- [ ] **Step 8: Commit**

```bash
git add src/players/PlayerContactSection.tsx src/players/PlayerContactSection.test.tsx src/players/PlayerCardPage.tsx src/App.tsx
git commit -m "Add player card page with editable contact section"
```

---

## Task 11: Skill guide — data, rules, and admin editor UI

**Files:**
- Create: `src/types/skillGuide.ts`
- Create: `src/skillGuide/skillGuideApi.ts`
- Create: `src/skillGuide/SkillGuidePage.tsx`
- Modify: `firestore.rules` (add `isAdmin()` helper + `skillGuide/config` match block)
- Modify: `src/App.tsx` (add the `/admin/guides` route)
- Test: `src/skillGuide/SkillGuidePage.test.tsx`
- Test: `tests/rules/skillGuide.rules.test.ts`

**Interfaces:**
- Consumes: `db` from `src/firebase/config.ts`, `SkillKey` from `src/types/player.ts` (Task 9), `useAuth` from `src/auth/AuthContext.tsx`.
- Produces: `getSkillGuide(): Promise<SkillGuideConfig | null>`, `updateSkillGuide(skills, updatedBy): Promise<void>` from `src/skillGuide/skillGuideApi.ts`; `SkillGuidePage` registered at `/admin/guides`.

- [ ] **Step 1: Write `src/types/skillGuide.ts`**

```ts
import type { SkillKey } from './player';

export interface SkillGuideRange {
  min: number;
  max: number;
  description: string;
}

export interface SkillGuideEntry {
  key: SkillKey;
  label: string;
  ranges: SkillGuideRange[];
  howToEvaluate: string;
}

export interface SkillGuideConfig {
  skills: SkillGuideEntry[];
  updatedBy: string;
  updatedAt: unknown;
}
```

- [ ] **Step 2: Write `src/skillGuide/skillGuideApi.ts`** (no test needed here — a 5-line pass-through wrapper around `doc`/`getDoc`/`setDoc`; it's exercised end-to-end by the `SkillGuidePage` component test in Step 6 and the rules tests in Step 8)

```ts
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { SkillGuideConfig, SkillGuideEntry } from '../types/skillGuide';

export async function getSkillGuide(): Promise<SkillGuideConfig | null> {
  const snapshot = await getDoc(doc(db, 'skillGuide', 'config'));
  return snapshot.exists() ? (snapshot.data() as SkillGuideConfig) : null;
}

export async function updateSkillGuide(skills: SkillGuideEntry[], updatedBy: string): Promise<void> {
  await setDoc(doc(db, 'skillGuide', 'config'), { skills, updatedBy, updatedAt: serverTimestamp() });
}
```

- [ ] **Step 3: Write the failing test `src/skillGuide/SkillGuidePage.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillGuidePage } from './SkillGuidePage';
import * as skillGuideApi from './skillGuideApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./skillGuideApi');
vi.mock('../auth/AuthContext');

describe('SkillGuidePage', () => {
  it('loads the guide, edits a range description, and saves', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
    });
    vi.spyOn(skillGuideApi, 'getSkillGuide').mockResolvedValue({
      skills: [
        {
          key: 'serve',
          label: 'Serve',
          ranges: [{ min: 1, max: 3, description: 'Inconsistent' }],
          howToEvaluate: 'Count % of serves in.',
        },
      ],
      updatedBy: 'someone',
      updatedAt: null,
    });
    const updateSpy = vi.spyOn(skillGuideApi, 'updateSkillGuide').mockResolvedValue(undefined);

    render(<SkillGuidePage />);

    await screen.findByText('Serve');
    fireEvent.change(screen.getByLabelText('1-3'), { target: { value: 'Updated description' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            key: 'serve',
            ranges: [{ min: 1, max: 3, description: 'Updated description' }],
          }),
        ],
        'coach-uid'
      )
    );
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- src/skillGuide/SkillGuidePage.test.tsx`
Expected: FAIL with "Cannot find module './SkillGuidePage'".

- [ ] **Step 5: Write `src/skillGuide/SkillGuidePage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getSkillGuide, updateSkillGuide } from './skillGuideApi';
import type { SkillGuideEntry } from '../types/skillGuide';

export function SkillGuidePage() {
  const { firebaseUser } = useAuth();
  const [skills, setSkills] = useState<SkillGuideEntry[]>([]);

  useEffect(() => {
    void getSkillGuide().then((guide) => setSkills(guide?.skills ?? []));
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
    if (!firebaseUser) return;
    await updateSkillGuide(skills, firebaseUser.uid);
  }

  return (
    <div>
      <h1>Skill Guide</h1>
      {skills.map((skill) => (
        <section key={skill.key}>
          <h2>{skill.label}</h2>
          {skill.ranges.map((range, index) => (
            <div key={`${range.min}-${range.max}`}>
              <label htmlFor={`${skill.key}-range-${index}`}>{`${range.min}-${range.max}`}</label>
              <textarea
                id={`${skill.key}-range-${index}`}
                value={range.description}
                onChange={(e) => updateRangeDescription(skill.key, index, e.target.value)}
              />
            </div>
          ))}
          <label htmlFor={`${skill.key}-how-to-evaluate`}>How to evaluate</label>
          <textarea
            id={`${skill.key}-how-to-evaluate`}
            value={skill.howToEvaluate}
            onChange={(e) => updateHowToEvaluate(skill.key, e.target.value)}
          />
        </section>
      ))}
      <button onClick={() => void handleSave()}>Save</button>
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/skillGuide/SkillGuidePage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Write the failing test `tests/rules/skillGuide.rules.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('skillGuide rules', () => {
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

  it('lets a global admin write the skill guide, denies a non-admin write', async () => {
    const env = await getTestEnv();
    const adminDb = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('skillGuide/config').set({ skills: [] }));

    const viewerDb = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(viewerDb.doc('skillGuide/config').set({ skills: [] }));
  });

  it('lets any signed-in user read the skill guide', async () => {
    const env = await getTestEnv();
    const viewerDb = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertSucceeds(viewerDb.doc('skillGuide/config').get());
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — `skillGuide/config` isn't matched yet.

- [ ] **Step 9: Add the `isAdmin()` helper and `skillGuide/config` block to `firestore.rules`**

Add `isAdmin()` directly inside `match /databases/{database}/documents { ... }`, alongside the other top-level matches (not nested in `teams`):

```
    function isAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /skillGuide/config {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm run test:rules`
Expected: PASS (all `skillGuide.rules.test.ts` cases, plus every previously passing rules test).

- [ ] **Step 11: Modify `src/App.tsx`** — add the skill guide route

Add the import `import { SkillGuidePage } from './skillGuide/SkillGuidePage';` and, inside `<Routes>`, add:
```tsx
          <Route
            path="/admin/guides"
            element={
              <RequireAuth>
                <SkillGuidePage />
              </RequireAuth>
            }
          />
```

- [ ] **Step 12: Run all tests to verify they pass**

Run: `npm test`

- [ ] **Step 13: Commit**

```bash
git add src/types/skillGuide.ts src/skillGuide src/App.tsx firestore.rules tests/rules/skillGuide.rules.test.ts
git commit -m "Add admin-editable skill guide with global-admin rules"
```

---

## Task 12: `skillMath` — average/level computation

**Files:**
- Create: `src/players/skillMath.ts`
- Test: `src/players/skillMath.test.ts`

**Interfaces:**
- Consumes: `Skills`, `Level` types from `src/types/player.ts` (Task 9).
- Produces: `computeAvgScore(skills: Skills): number | null`, `computeLevel(avgScore: number | null): Level | null` — consumed by `PlayerSkillsSection` in Task 13.

- [ ] **Step 1: Write the failing test `src/players/skillMath.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { computeAvgScore, computeLevel } from './skillMath';
import type { Skills } from '../types/player';

function skillsWith(scores: Partial<Record<keyof Skills, number | null>>): Skills {
  const keys: (keyof Skills)[] = ['serve', 'attack', 'set', 'defence', 'reception', 'jump', 'speed', 'iq'];
  const skills = {} as Skills;
  for (const key of keys) {
    skills[key] = { score: scores[key] ?? null, notes: '', priority: false };
  }
  return skills;
}

describe('computeAvgScore', () => {
  it('returns null when no skills have a score', () => {
    expect(computeAvgScore(skillsWith({}))).toBeNull();
  });

  it('averages only the skills that have a score', () => {
    expect(computeAvgScore(skillsWith({ serve: 6, attack: 8 }))).toBe(7);
  });

  it('averages all 8 skills when fully scored', () => {
    expect(
      computeAvgScore(
        skillsWith({ serve: 5, attack: 5, set: 5, defence: 5, reception: 5, jump: 5, speed: 5, iq: 5 })
      )
    ).toBe(5);
  });
});

describe('computeLevel', () => {
  it('returns null for a null average', () => {
    expect(computeLevel(null)).toBeNull();
  });

  it('returns Beginner below 4', () => {
    expect(computeLevel(3.9)).toBe('Beginner');
  });

  it('returns Developing from 4 up to but excluding 6', () => {
    expect(computeLevel(4)).toBe('Developing');
    expect(computeLevel(5.9)).toBe('Developing');
  });

  it('returns Advanced from 6 up to but excluding 8', () => {
    expect(computeLevel(6)).toBe('Advanced');
    expect(computeLevel(7.9)).toBe('Advanced');
  });

  it('returns Elite at 8 and above', () => {
    expect(computeLevel(8)).toBe('Elite');
    expect(computeLevel(10)).toBe('Elite');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/players/skillMath.test.ts`
Expected: FAIL with "Cannot find module './skillMath'".

- [ ] **Step 3: Write `src/players/skillMath.ts`**

```ts
import type { Level, Skills } from '../types/player';

export function computeAvgScore(skills: Skills): number | null {
  const scores = Object.values(skills)
    .map((entry) => entry.score)
    .filter((score): score is number => score !== null && score !== undefined);
  if (scores.length === 0) return null;
  const sum = scores.reduce((total, score) => total + score, 0);
  return sum / scores.length;
}

export function computeLevel(avgScore: number | null): Level | null {
  if (avgScore === null) return null;
  if (avgScore < 4) return 'Beginner';
  if (avgScore < 6) return 'Developing';
  if (avgScore < 8) return 'Advanced';
  return 'Elite';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/players/skillMath.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/players/skillMath.ts src/players/skillMath.test.ts
git commit -m "Add skill average/level pure computation functions"
```

---

## Task 13: Player skills editing UI + score validation rule

**Files:**
- Modify: `src/players/playersApi.ts` (add `updatePlayerSkills`)
- Create: `src/players/PlayerSkillsSection.tsx`
- Modify: `src/players/PlayerCardPage.tsx` (render `PlayerSkillsSection` instead of the placeholder line)
- Modify: `firestore.rules` (add `validSkills()`/`validScore()` and require it on player create/update)
- Test: `src/players/PlayerSkillsSection.test.tsx`
- Test: `tests/rules/players.rules.test.ts` (append score-validation cases)

**Interfaces:**
- Consumes: `computeAvgScore`, `computeLevel` from `src/players/skillMath.ts` (Task 12).
- Produces: `updatePlayerSkills(teamId, playerId, skills, avgScore, level): Promise<void>` in `src/players/playersApi.ts`.

- [ ] **Step 1: Add `updatePlayerSkills` to `src/players/playersApi.ts`**

Append to the file (after `updatePlayerContact`):

```ts
export async function updatePlayerSkills(
  teamId: string,
  playerId: string,
  skills: Player['skills'],
  avgScore: number | null,
  level: Player['level']
): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'players', playerId), {
    skills,
    avgScore,
    level,
    updatedAt: serverTimestamp(),
  });
}
```

- [ ] **Step 2: Write the failing test `src/players/PlayerSkillsSection.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayerSkillsSection } from './PlayerSkillsSection';
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
  guardians: [],
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
  consent: { given: false, date: null, confirmedBy: null },
  createdBy: 'coach-uid',
  createdAt: null,
  updatedAt: null,
};

describe('PlayerSkillsSection', () => {
  it('sets a score, computes avg/level, and saves', async () => {
    vi.spyOn(playersApi, 'updatePlayerSkills').mockResolvedValue(undefined);
    const onPlayerUpdated = vi.fn();

    render(
      <PlayerSkillsSection teamId="team-1" playerId="player-1" player={basePlayer} onPlayerUpdated={onPlayerUpdated} />
    );

    fireEvent.change(screen.getByLabelText('Serve'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Attack'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('Save skills'));

    await waitFor(() =>
      expect(playersApi.updatePlayerSkills).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        expect.objectContaining({
          serve: expect.objectContaining({ score: 6 }),
          attack: expect.objectContaining({ score: 8 }),
        }),
        7,
        'Advanced'
      )
    );
    expect(onPlayerUpdated).toHaveBeenCalledWith(expect.objectContaining({ avgScore: 7, level: 'Advanced' }));
  });

  it('marks a skill as a focus area via the priority checkbox', () => {
    render(
      <PlayerSkillsSection teamId="team-1" playerId="player-1" player={basePlayer} onPlayerUpdated={vi.fn()} />
    );

    const checkboxes = screen.getAllByLabelText('Focus area');
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/players/PlayerSkillsSection.test.tsx`
Expected: FAIL with "Cannot find module './PlayerSkillsSection'".

- [ ] **Step 4: Write `src/players/PlayerSkillsSection.tsx`**

```tsx
import { useState } from 'react';
import { updatePlayerSkills } from './playersApi';
import { computeAvgScore, computeLevel } from './skillMath';
import type { Player, SkillKey, Skills } from '../types/player';

const SKILL_LABELS: Record<SkillKey, string> = {
  serve: 'Serve',
  attack: 'Attack',
  set: 'Set',
  defence: 'Defence',
  reception: 'Reception',
  jump: 'Jump',
  speed: 'Speed',
  iq: 'IQ',
};

const SKILL_ORDER = Object.keys(SKILL_LABELS) as SkillKey[];

interface PlayerSkillsSectionProps {
  teamId: string;
  playerId: string;
  player: Player;
  onPlayerUpdated: (player: Player) => void;
}

export function PlayerSkillsSection({ teamId, playerId, player, onPlayerUpdated }: PlayerSkillsSectionProps) {
  const [skills, setSkills] = useState<Skills>(player.skills);

  function updateScore(key: SkillKey, rawValue: string) {
    const score = rawValue === '' ? null : Number(rawValue);
    setSkills((current) => ({ ...current, [key]: { ...current[key], score } }));
  }

  function updatePriority(key: SkillKey, priority: boolean) {
    setSkills((current) => ({ ...current, [key]: { ...current[key], priority } }));
  }

  async function handleSave() {
    const avgScore = computeAvgScore(skills);
    const level = computeLevel(avgScore);
    await updatePlayerSkills(teamId, playerId, skills, avgScore, level);
    onPlayerUpdated({ ...player, skills, avgScore, level });
  }

  const previewAvg = computeAvgScore(skills);
  const previewLevel = computeLevel(previewAvg);

  return (
    <section>
      <h2>Skills</h2>
      {SKILL_ORDER.map((key) => (
        <div key={key}>
          <label htmlFor={`skill-${key}`}>{SKILL_LABELS[key]}</label>
          <input
            id={`skill-${key}`}
            type="number"
            min={1}
            max={10}
            value={skills[key].score ?? ''}
            onChange={(e) => updateScore(key, e.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={skills[key].priority}
              onChange={(e) => updatePriority(key, e.target.checked)}
            />
            Focus area
          </label>
        </div>
      ))}
      <p>
        Average: {previewAvg?.toFixed(1) ?? '—'} ({previewLevel ?? 'No scores yet'})
      </p>
      <button onClick={() => void handleSave()}>Save skills</button>
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/players/PlayerSkillsSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Modify `src/players/PlayerCardPage.tsx`**

Replace:
```tsx
      <p>Skills section coming in Task 13.</p>
```
With:
```tsx
      <PlayerSkillsSection teamId={teamId} playerId={playerId} player={player} onPlayerUpdated={setPlayer} />
```
And add the import: `import { PlayerSkillsSection } from './PlayerSkillsSection';`

- [ ] **Step 7: Append failing score-validation cases to `tests/rules/players.rules.test.ts`**

```ts
  it('allows a score within 1-10, denies a score outside that range', async () => {
    const env = await getTestEnv();
    const validSkills = {
      serve: { score: 7 }, attack: { score: null }, set: { score: null }, defence: { score: null },
      reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
    };
    const invalidSkills = { ...validSkills, serve: { score: 11 } };

    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('teams/team-1/players/player-1').update({ skills: validSkills }));
    await assertFails(adminDb.doc('teams/team-1/players/player-1').update({ skills: invalidSkills }));
  });
```

(Add this as a new `it` inside the existing `describe('player rules', ...)` block.)

- [ ] **Step 8: Run test to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — the current players rule doesn't check score ranges, so the invalid update incorrectly succeeds.

- [ ] **Step 9: Add `validScore()`/`validSkills()` to `firestore.rules` and require it on player writes**

Add these two functions inside `match /teams/{teamId} { ... }`, alongside `isTeamAdmin()`:

```
        function validScore(score) {
          return score == null || (score is number && score >= 1 && score <= 10);
        }

        function validSkills(skills) {
          return validScore(skills.serve.score) &&
            validScore(skills.attack.score) &&
            validScore(skills.set.score) &&
            validScore(skills.defence.score) &&
            validScore(skills.reception.score) &&
            validScore(skills.jump.score) &&
            validScore(skills.speed.score) &&
            validScore(skills.iq.score);
        }
```

Then change the players `allow create, update` line to:
```
        allow create, update: if request.auth != null && isTeamAdmin() && validSkills(request.resource.data.skills);
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm run test:rules`
Expected: PASS (all cases, including the new score-validation test).

- [ ] **Step 11: Run all tests to verify everything passes**

Run: `npm test && npm run test:rules`

- [ ] **Step 12: Commit**

```bash
git add src/players firestore.rules tests/rules/players.rules.test.ts
git commit -m "Add player skills editing UI with computed avg/level and score validation"
```

---

## Task 14: Team roster overview table

**Files:**
- Create: `src/teams/TeamRosterTable.tsx`
- Modify: `src/teams/TeamPage.tsx` (render `TeamRosterTable` in the Overview tab instead of the placeholder line)
- Test: `src/teams/TeamRosterTable.test.tsx`

**Interfaces:**
- Consumes: `listPlayers` from `src/players/playersApi.ts` (Task 9).
- Produces: `TeamRosterTable` component, mirroring the spreadsheet's Overview tab (number, name, position, 8 skill scores, avg, level), paginated per Section 8 of the spec (Smart Fetching).

- [ ] **Step 1: Write the failing test `src/teams/TeamRosterTable.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamRosterTable } from './TeamRosterTable';
import * as playersApi from '../players/playersApi';
import type { Player } from '../types/player';

vi.mock('../players/playersApi');

function makePlayer(id: string, number: number, fullName: string): Player {
  return {
    id,
    number,
    fullName,
    dob: '2012-01-01',
    nationality: 'BEL',
    licenseNumber: 'J-000001',
    position: 'OH',
    playerPhone: '',
    guardians: [],
    viewerEmails: [],
    teamName: 'U17',
    ageGroup: 'U17',
    season: '2026-27',
    skills: {
      serve: { score: 6, notes: '', priority: false },
      attack: { score: 7, notes: '', priority: false },
      set: { score: null, notes: '', priority: false },
      defence: { score: null, notes: '', priority: false },
      reception: { score: null, notes: '', priority: false },
      jump: { score: null, notes: '', priority: false },
      speed: { score: null, notes: '', priority: false },
      iq: { score: null, notes: '', priority: false },
    },
    avgScore: 6.5,
    level: 'Advanced',
    developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
    consent: { given: false, date: null, confirmedBy: null },
    createdBy: 'coach-uid',
    createdAt: null,
    updatedAt: null,
  };
}

describe('TeamRosterTable', () => {
  it('renders the first page of players with their skill scores', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('player-1', 1, 'Test Player')],
      lastDoc: null,
    });

    render(<TeamRosterTable teamId="team-1" />);

    await screen.findByText('Test Player');
    expect(screen.getByText('6.5')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });

  it('loads the next page when "Load more" is clicked', async () => {
    const lastDocStub = { id: 'player-1' } as never;
    vi.spyOn(playersApi, 'listPlayers')
      .mockResolvedValueOnce({ players: [makePlayer('player-1', 1, 'First Player')], lastDoc: lastDocStub })
      .mockResolvedValueOnce({ players: [makePlayer('player-2', 2, 'Second Player')], lastDoc: null });

    render(<TeamRosterTable teamId="team-1" />);

    await screen.findByText('First Player');
    fireEvent.click(screen.getByText('Load more'));

    await waitFor(() => expect(screen.getByText('Second Player')).toBeInTheDocument());
    expect(playersApi.listPlayers).toHaveBeenCalledWith('team-1', lastDocStub);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/teams/TeamRosterTable.test.tsx`
Expected: FAIL with "Cannot find module './TeamRosterTable'".

- [ ] **Step 3: Write `src/teams/TeamRosterTable.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { listPlayers } from '../players/playersApi';
import type { Player, SkillKey } from '../types/player';

const SKILL_COLUMNS: SkillKey[] = ['serve', 'attack', 'set', 'defence', 'reception', 'jump', 'speed', 'iq'];

export function TeamRosterTable({ teamId }: { teamId: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);

  async function loadFirstPage() {
    const page = await listPlayers(teamId);
    setPlayers(page.players);
    setLastDoc(page.lastDoc);
    setHasMore(page.players.length > 0 && page.lastDoc !== null);
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listPlayers(teamId, lastDoc);
    setPlayers((current) => [...current, ...page.players]);
    setLastDoc(page.lastDoc);
    setHasMore(page.players.length > 0 && page.lastDoc !== null);
  }

  useEffect(() => {
    void loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Position</th>
            {SKILL_COLUMNS.map((key) => (
              <th key={key}>{key}</th>
            ))}
            <th>Avg</th>
            <th>Level</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td>{player.number}</td>
              <td>
                <Link to={`/teams/${teamId}/players/${player.id}`}>{player.fullName}</Link>
              </td>
              <td>{player.position}</td>
              {SKILL_COLUMNS.map((key) => (
                <td key={key}>{player.skills[key].score ?? '—'}</td>
              ))}
              <td>{player.avgScore?.toFixed(1) ?? '—'}</td>
              <td>{player.level ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && <button onClick={() => void loadMore()}>Load more</button>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/teams/TeamRosterTable.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Modify `src/teams/TeamPage.tsx`**

Replace:
```tsx
      {tab === 'overview' && <p>Roster overview coming in Task 14.</p>}
```
With:
```tsx
      {tab === 'overview' && <TeamRosterTable teamId={teamId} />}
```
And add the import: `import { TeamRosterTable } from './TeamRosterTable';`

- [ ] **Step 6: Run all tests to verify everything passes**

Run: `npm test && npm run test:rules`

- [ ] **Step 7: Commit**

```bash
git add src/teams/TeamRosterTable.tsx src/teams/TeamRosterTable.test.tsx src/teams/TeamPage.tsx
git commit -m "Add paginated team roster overview table"
```

---

## Self-Review

**Spec coverage (Plan 1's scope only — physical testing, exercises/trainings, calendar, legal pages, migration, and CI/CD are Plans 2-4, out of scope here):**
- Tech stack (React/TS/Vite/Tailwind/Firebase/react-router-dom) — Tasks 1, 2, 5.
- Admin allowlist + role resolution (spec §6.1-6.2) — Task 4.
- Email-link sign-in (spec §4) — Task 5.
- Teams with email-keyed `adminEmails` (spec §5, §6.3, corrected during planning) — Tasks 6-8.
- Players: contact fields, denormalized team fields, `viewerEmails` reserved (spec §5) — Task 9.
- Player Card contact section (spec §7) — Task 10.
- Skill guide, admin-editable, readable by any signed-in user (spec §5, §6.8) — Task 11.
- Skill average/level computation matching the spreadsheet formula (spec §5) — Task 12.
- Player skills editing with score validation as defense in depth (spec §6.9) — Task 13.
- Roster overview mirroring the spreadsheet's Overview tab, with smart-fetching pagination (spec §7, §8) — Task 14.
- Not yet covered (by design, deferred to later plans): physical testing, exercises/trainings library, team calendar, development-plan editing UI (the `developmentPlan` field exists on both `Team` and `Player` docs but no editor UI is built in Plan 1 — flagging this as an explicit gap to close in Plan 2, since the spec's Screens section calls for it on both the team and player pages), consent-checkbox UI, privacy policy page, App Check, Dependabot, CSP headers, migration script, CI/CD, Firebase Hosting deploy.

**Placeholder scan:** No "TBD"/"TODO" strings. The only forward-references are the explicit inline placeholder texts ("Teams list coming in Task 7", "Roster overview coming in Task 14", etc.) that each subsequent task's steps explicitly locate and replace by exact string match — not vague deferrals.

**Type consistency:** `Player['skills']`, `SkillKey`, `Level` defined once in `src/types/player.ts` (Task 9) and reused verbatim by `skillMath.ts` (Task 12), `PlayerSkillsSection.tsx` (Task 13), and `TeamRosterTable.tsx` (Task 14). `Team` defined once in `src/types/team.ts` (Task 6), reused by `TeamSettingsTab`, `TeamPage`, `TeamsListPage`. Function names (`ensureUserDoc`, `createTeam`, `listMyTeams`, `getTeam`, `addTeamAdmin`, `removeTeamAdmin`, `createPlayer`, `listPlayers`, `getPlayer`, `updatePlayerContact`, `updatePlayerSkills`, `getSkillGuide`, `updateSkillGuide`, `computeAvgScore`, `computeLevel`) are each defined in exactly one task and referenced identically by every consuming task.

**Scope check:** Focused on one coherent deliverable — a working player-management app with real auth and real security rules. Development-plan editing UI was noticed as a gap during self-review (see above); it's small enough to fold into Plan 2's start rather than reopening Plan 1.
