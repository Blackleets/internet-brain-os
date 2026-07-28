# Hephaestus Dashboard Foundation + Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-quality local dashboard shell that authenticates to the existing Hephaestus Kernel and renders a truthful Overview from live Kernel data.

**Architecture:** A Next.js App Router client runs on a loopback web origin and calls the existing token-protected Kernel API directly. A small typed client validates responses and composes a partial-failure-tolerant `OverviewSnapshot`; React components render only persisted or explicitly reported state.

**Tech Stack:** Next.js 16.2.x, React 19.2.x, TypeScript 5.9.x, native Fetch API, Lucide React, Vitest 1.6.x, Testing Library 16.3.x, Playwright 1.62.x, CSS custom properties.

## Global Constraints

- Work only on `codex/dashboard-control-center`; never modify `main` directly.
- Preserve Kernel authority, Evidence, provenance, explicit state transitions, bounded retries, and existing extension contracts.
- The dashboard may run only against `localhost` or `127.0.0.1` Kernel URLs.
- The API token remains in tab memory by default and must never appear in logs, URLs, build output, or analytics.
- No normal product state may use fixture counts, invented activity, synthetic percentages, or unimplemented scheduler controls.
- The Efesto extension and dashboard share truth only through the Kernel; they do not read each other's browser storage.
- Mutations are not retried automatically.
- Every UI surface implements loading, empty, ready, partial, unauthorized, and Kernel-offline states.
- Primary design-QA viewport is `1536 x 1024`.
- Respect `prefers-reduced-motion` and WCAG AA contrast.

---

## File Structure

### Files created in this phase

- `apps/dashboard/app/layout.tsx` — root document metadata, font classes, and global providers.
- `apps/dashboard/app/page.tsx` — dashboard entry route.
- `apps/dashboard/app/globals.css` — design tokens, resets, responsive grid, focus, and reduced-motion rules.
- `apps/dashboard/components/app-shell.tsx` — sidebar, top command bar, main content frame.
- `apps/dashboard/components/connection-gate.tsx` — local Kernel URL/token connection flow.
- `apps/dashboard/components/overview/overview-screen.tsx` — orchestration of Overview sections.
- `apps/dashboard/components/overview/readiness-strip.tsx` — real subsystem status.
- `apps/dashboard/components/overview/metric-grid.tsx` — real record counts.
- `apps/dashboard/components/overview/mission-panel.tsx` — persisted mission phases and attempts.
- `apps/dashboard/components/overview/opportunity-panel.tsx` — Kernel-ranked Opportunities.
- `apps/dashboard/components/overview/activity-feed.tsx` — deterministic activity derived from records.
- `apps/dashboard/components/ui/panel.tsx` — reusable accessible surface.
- `apps/dashboard/components/ui/status-badge.tsx` — text + icon semantic state.
- `apps/dashboard/lib/kernel/contracts.ts` — response and view-model types.
- `apps/dashboard/lib/kernel/parse.ts` — dependency-free runtime parsers.
- `apps/dashboard/lib/kernel/client.ts` — authenticated loopback HTTP client.
- `apps/dashboard/lib/kernel/overview.ts` — partial-failure-tolerant Overview loader.
- `apps/dashboard/lib/kernel/url.ts` — strict loopback URL normalization.
- `apps/dashboard/lib/session/connection-store.ts` — tab-memory connection state.
- `apps/dashboard/public/forge-core.webp` — original approved hero artwork produced through Product Design.
- `apps/dashboard/test/fixtures.ts` — bounded truthful API response fixtures for tests only.
- `apps/dashboard/test/render.tsx` — test render helper.
- `apps/dashboard/e2e/overview.spec.ts` — browser connection and Overview journey.
- `apps/dashboard/playwright.config.ts` — local E2E configuration.

### Files modified in this phase

- `apps/dashboard/package.json` — application, test, and browser scripts/dependencies.
- `apps/dashboard/README.md` — local run and security behavior.
- `package.json` — root dashboard scripts and build integration.
- `pnpm-lock.yaml` — resolved dependency graph.
- `PROJECT_STATE.md` — only after the phase is verified; record the new real product surface and validation baseline.
- `ARCHITECTURE.md` — add the dashboard as a presentation-only Kernel client after implementation is proven.

---

### Task 1: Scaffold a Tested Next.js Dashboard Shell

**Files:**
- Modify: `apps/dashboard/package.json`
- Create: `apps/dashboard/tsconfig.json`
- Create: `apps/dashboard/next-env.d.ts`
- Create: `apps/dashboard/next.config.ts`
- Create: `apps/dashboard/app/layout.tsx`
- Create: `apps/dashboard/app/page.tsx`
- Create: `apps/dashboard/app/globals.css`
- Create: `apps/dashboard/components/app-shell.tsx`
- Create: `apps/dashboard/components/app-shell.test.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: existing pnpm workspace `apps/*` discovery.
- Produces: `AppShell({ children }: { children: ReactNode })` and runnable `dashboard:dev`, `dashboard:test`, `dashboard:build` scripts.

- [ ] **Step 1: Add exact dashboard dependencies and scripts**

Set `apps/dashboard/package.json` to:

```json
{
  "name": "@internet-brain-os/dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --hostname 127.0.0.1",
    "build": "next build",
    "start": "next start --hostname 127.0.0.1",
    "test": "vitest run --passWithNoTests",
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test"
  },
  "dependencies": {
    "lucide-react": "1.27.0",
    "next": "16.2.12",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@playwright/test": "1.62.0",
    "@testing-library/dom": "10.4.1",
    "@testing-library/react": "16.3.2",
    "@types/node": "^20.19.43",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "jsdom": "29.1.1",
    "typescript": "^5.9.3",
    "vitest": "^1.6.1"
  }
}
```

Add root scripts:

```json
"dashboard:dev": "pnpm --filter @internet-brain-os/dashboard dev",
"dashboard:test": "pnpm --filter @internet-brain-os/dashboard test",
"dashboard:build": "pnpm --filter @internet-brain-os/dashboard build"
```

Run: `pnpm install --frozen-lockfile=false`

- [ ] **Step 2: Write the shell test before the component**

Create `apps/dashboard/components/app-shell.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  it('exposes navigation, command entry, and main content landmarks', () => {
    render(<AppShell><h1>Overview</h1></AppShell>);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    expect(screen.getByRole('search', { name: 'Command center' })).toBeTruthy();
    expect(screen.getByRole('main').textContent).toContain('Overview');
  });
});
```

- [ ] **Step 3: Run the focused test and confirm red**

Run: `pnpm --filter @internet-brain-os/dashboard test -- components/app-shell.test.tsx`  
Expected: FAIL because `./app-shell` does not exist.

- [ ] **Step 4: Implement the minimal semantic shell and app entry**

Implement `AppShell` with a `nav` labelled `Primary`, a `form role="search"` labelled `Command center`, and `main` containing `children`. Configure the App Router layout and render `<AppShell><ConnectionGate /></AppShell>` later; for this task render `<AppShell><h1>Control Center</h1></AppShell>`.

Use `next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
```

Use the minimal shell contract:

```tsx
import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <nav aria-label="Primary">
        <a href="/" aria-current="page">Overview</a>
      </nav>
      <div className="app-workspace">
        <form role="search" aria-label="Command center">
          <label htmlFor="command">Comandos</label>
          <input id="command" type="search" placeholder="Buscar o ejecutar…" />
        </form>
        <main>{children}</main>
      </div>
    </div>
  );
}
```

Use `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "allowJs": false,
    "noEmit": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Verify shell, types, and production build**

Run:

```bash
pnpm --filter @internet-brain-os/dashboard test -- components/app-shell.test.tsx
pnpm --filter @internet-brain-os/dashboard typecheck
pnpm --filter @internet-brain-os/dashboard build
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard package.json pnpm-lock.yaml
git commit -m "feat(dashboard): scaffold control center shell"
```

---

### Task 2: Enforce Loopback-Only Kernel Connections

**Files:**
- Create: `apps/dashboard/lib/kernel/url.ts`
- Create: `apps/dashboard/lib/kernel/url.test.ts`

**Interfaces:**
- Produces: `normalizeKernelBaseUrl(value: string): string`.
- Throws: `KernelUrlError` with code `INVALID_KERNEL_URL` or `NON_LOOPBACK_KERNEL_URL`.

- [ ] **Step 1: Write URL policy tests**

Test exact accepted values `http://127.0.0.1:4000` and `http://localhost:4000/`, canonical trailing-slash removal, and rejection of credentials, paths, queries, fragments, HTTPS public hosts, and `0.0.0.0`.

```ts
expect(normalizeKernelBaseUrl('http://localhost:4000/')).toBe('http://localhost:4000');
expect(() => normalizeKernelBaseUrl('https://example.com')).toThrowError('NON_LOOPBACK_KERNEL_URL');
expect(() => normalizeKernelBaseUrl('http://user:pass@localhost:4000')).toThrowError('INVALID_KERNEL_URL');
```

- [ ] **Step 2: Confirm red**

Run: `pnpm dashboard:test -- lib/kernel/url.test.ts`  
Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement strict normalization**

Parse with `new URL(value)` and require:

```ts
const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const valid = url.protocol === 'http:'
  && allowedHosts.has(url.hostname)
  && url.username === ''
  && url.password === ''
  && (url.pathname === '/' || url.pathname === '')
  && url.search === ''
  && url.hash === '';
```

Return `url.origin` only.

- [ ] **Step 4: Verify and commit**

Run: `pnpm dashboard:test -- lib/kernel/url.test.ts`  
Expected: PASS.

```bash
git add apps/dashboard/lib/kernel/url.ts apps/dashboard/lib/kernel/url.test.ts
git commit -m "feat(dashboard): restrict Kernel connections to loopback"
```

---

### Task 3: Define and Parse Kernel Contracts

**Files:**
- Create: `apps/dashboard/lib/kernel/contracts.ts`
- Create: `apps/dashboard/lib/kernel/parse.ts`
- Create: `apps/dashboard/lib/kernel/parse.test.ts`
- Create: `apps/dashboard/test/fixtures.ts`

**Interfaces:**
- Produces: `KernelHealth`, `KernelStatus`, `BootstrapStatus`, `CaseSummary`, `GoalSummary`, `MissionSummary`, `OpportunitySummary`, `ModelForgeSummary`.
- Produces parsers `parseHealth`, `parseStatus`, `parseBootstrap`, `parseCases`, `parseGoals`, `parseMissions`, `parseOpportunities`, `parseModelForge`.
- Throws: `KernelContractError(path: string, message: string)`.

- [ ] **Step 1: Write parser tests with bounded fixtures**

Define fixtures matching current response envelopes:

```ts
export const casesResponse = { ok: true, cases: [{ id: 'case-1', title: 'Supplier research', createdAt: '2026-07-26T10:00:00.000Z' }] };
export const goalsResponse = { ok: true, goals: [{ id: 'goal-1', title: 'Find AI clients', priority: 'high', createdAt: '2026-07-26T10:00:00.000Z' }] };
export const missionsResponse = { ok: true, missions: [{ id: 'mission-1', goalId: 'goal-1', status: 'running', phase: 'investigating', attempts: 1, maxAttempts: 3, createdAt: '2026-07-26T10:00:00.000Z' }] };
```

Test acceptance of required fields, preservation of unknown optional fields, and rejection when envelopes, arrays, IDs, or state values are invalid.

- [ ] **Step 2: Confirm red**

Run: `pnpm dashboard:test -- lib/kernel/parse.test.ts`  
Expected: FAIL because parsers are absent.

- [ ] **Step 3: Implement dependency-free runtime validation**

Use focused helpers:

```ts
function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new KernelContractError(path, 'expected object');
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new KernelContractError(path, 'expected non-empty string');
  }
  return value;
}
```

Keep types limited to fields rendered in Phase 1. Do not duplicate the entire Kernel store schema.

- [ ] **Step 4: Verify and commit**

Run: `pnpm dashboard:test -- lib/kernel/parse.test.ts`  
Expected: PASS.

```bash
git add apps/dashboard/lib/kernel apps/dashboard/test/fixtures.ts
git commit -m "feat(dashboard): validate Kernel response contracts"
```

---

### Task 4: Build the Authenticated Kernel Client

**Files:**
- Create: `apps/dashboard/lib/kernel/client.ts`
- Create: `apps/dashboard/lib/kernel/client.test.ts`

**Interfaces:**
- Consumes: `normalizeKernelBaseUrl` and parser callbacks.
- Produces: `KernelClient` with `get<T>(path, parse, signal?)` and `request<T>(path, init, parse, signal?)`.
- Produces: `KernelClientError` codes `UNAUTHORIZED`, `OFFLINE`, `TIMEOUT`, `HTTP_ERROR`, `INVALID_RESPONSE`.

- [ ] **Step 1: Write client tests with injected fetch**

Test:

- `x-hephaestus-token` is present for `/api/*` and absent for `/health`, `/status`, `/bootstrap/status`.
- no token appears in thrown messages.
- `401` maps to `UNAUTHORIZED`.
- rejected fetch maps to `OFFLINE`.
- parser failures map to `INVALID_RESPONSE`.
- timeout aborts after the configured bound.

Use:

```ts
const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
const fetcher: typeof fetch = async (input, init) => {
  calls.push([input, init]);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
```

- [ ] **Step 2: Confirm red**

Run: `pnpm dashboard:test -- lib/kernel/client.test.ts`  
Expected: FAIL because `KernelClient` is absent.

- [ ] **Step 3: Implement the client**

Constructor:

```ts
type KernelClientOptions = {
  baseUrl: string;
  token: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};
```

Use `AbortSignal.any([callerSignal, AbortSignal.timeout(timeoutMs)])` when the runtime supports it; otherwise use an `AbortController` and clear its timer in `finally`. Set `cache: 'no-store'` and `accept: 'application/json'`. Add `content-type` only when a body exists.

- [ ] **Step 4: Verify and commit**

Run: `pnpm dashboard:test -- lib/kernel/client.test.ts`  
Expected: PASS.

```bash
git add apps/dashboard/lib/kernel/client.ts apps/dashboard/lib/kernel/client.test.ts
git commit -m "feat(dashboard): add authenticated Kernel client"
```

---

### Task 5: Compose a Truthful Partial-Failure Overview

**Files:**
- Create: `apps/dashboard/lib/kernel/overview.ts`
- Create: `apps/dashboard/lib/kernel/overview.test.ts`

**Interfaces:**
- Consumes: `KernelClient` and all Phase 1 parsers.
- Produces: `loadOverview(client, signal?): Promise<OverviewSnapshot>`.
- `OverviewSnapshot` contains `readiness`, `metrics`, `missions`, `opportunities`, `activity`, `loadedAt`, and `issues`.

- [ ] **Step 1: Write Overview composition tests**

Test a complete snapshot and a partial snapshot where Model Forge returns `404` while Cases, Goals, missions, and Opportunities remain visible.

Expected metric semantics:

```ts
{
  cases: cases.length,
  goals: goals.length,
  missions: missions.length,
  activeMissions: missions.filter(isActiveMission).length,
  opportunities: opportunities.length
}
```

Activity entries must be derived from record IDs, persisted timestamps, and states. Equal inputs must produce equal activity ordering.

- [ ] **Step 2: Confirm red**

Run: `pnpm dashboard:test -- lib/kernel/overview.test.ts`  
Expected: FAIL because `loadOverview` is absent.

- [ ] **Step 3: Implement bounded parallel reads**

Fetch `/health`, `/status`, `/bootstrap/status`, `/api/cases`, `/api/goals`, `/api/agent-missions`, `/api/opportunities`, and `/api/model-forge` with `Promise.allSettled`.

Rules:

- Health failure marks Kernel offline and stops protected reads only when connection is impossible.
- `UNAUTHORIZED` is promoted to the caller.
- Optional `404` responses become a typed unavailable issue.
- Other endpoint failures are retained in `issues` without erasing successful data.
- Sort activity descending by real timestamp, then stable ID.
- Never manufacture a historical series from current counts.

- [ ] **Step 4: Verify and commit**

Run: `pnpm dashboard:test -- lib/kernel/overview.test.ts`  
Expected: PASS.

```bash
git add apps/dashboard/lib/kernel/overview.ts apps/dashboard/lib/kernel/overview.test.ts
git commit -m "feat(dashboard): compose truthful Overview data"
```

---

### Task 6: Implement Secure Connection State and Gate

**Files:**
- Create: `apps/dashboard/lib/session/connection-store.ts`
- Create: `apps/dashboard/lib/session/connection-store.test.ts`
- Create: `apps/dashboard/components/connection-gate.tsx`
- Create: `apps/dashboard/components/connection-gate.test.tsx`
- Modify: `apps/dashboard/app/page.tsx`

**Interfaces:**
- Produces: `ConnectionStore` methods `get()`, `set(connection)`, `clear()`, `subscribe(listener)`.
- Produces: `ConnectionGate`, which renders connection form or `OverviewScreen`.
- Consumes: `normalizeKernelBaseUrl`, `KernelClient`, `loadOverview`.

- [ ] **Step 1: Write memory and UI tests**

Verify:

- initial state is empty;
- token is stored only in the in-memory store;
- clearing removes the token;
- successful `/health` then protected read opens the Overview;
- `401` shows a Spanish reconnection message;
- token input has `type="password"` and `autocomplete="off"`;
- the token never appears in rendered errors.

- [ ] **Step 2: Confirm red**

Run: `pnpm dashboard:test -- lib/session/connection-store.test.ts components/connection-gate.test.tsx`  
Expected: FAIL because store and gate are absent.

- [ ] **Step 3: Implement the smallest connection flow**

Default base URL: `http://127.0.0.1:4000`.

Form fields:

```tsx
<input name="baseUrl" type="url" defaultValue="http://127.0.0.1:4000" />
<input name="token" type="password" autoComplete="off" />
<button type="submit">Conectar al Kernel</button>
```

On submit, normalize the URL, create the client, load Overview, then set connection state. Do not persist credentials.

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm dashboard:test -- lib/session/connection-store.test.ts components/connection-gate.test.tsx
pnpm --filter @internet-brain-os/dashboard typecheck
```

Expected: PASS.

```bash
git add apps/dashboard/lib/session apps/dashboard/components/connection-gate* apps/dashboard/app/page.tsx
git commit -m "feat(dashboard): add secure Kernel connection gate"
```

---

### Task 7: Build the Forge Intelligence Visual System

**Files:**
- Modify: `apps/dashboard/app/globals.css`
- Modify: `apps/dashboard/components/app-shell.tsx`
- Create: `apps/dashboard/components/ui/panel.tsx`
- Create: `apps/dashboard/components/ui/status-badge.tsx`
- Create: `apps/dashboard/components/ui/ui.test.tsx`

**Interfaces:**
- Produces: `Panel` and `StatusBadge` primitives.
- Consumes: semantic states `healthy`, `attention`, `working`, `unavailable`, `failed`.

- [ ] **Step 1: Write accessibility tests**

Verify navigation labels, active route with `aria-current="page"`, visible status text, status icon `aria-hidden="true"`, command input label, and panel headings.

- [ ] **Step 2: Confirm red**

Run: `pnpm dashboard:test -- components/ui/ui.test.tsx components/app-shell.test.tsx`  
Expected: FAIL until primitives and updated shell exist.

- [ ] **Step 3: Implement tokens and responsive shell**

Define tokens:

```css
:root {
  color-scheme: dark;
  --bg-canvas: #070b11;
  --bg-surface: #0c131d;
  --bg-elevated: #111b27;
  --line-subtle: #1c2b3a;
  --text-primary: #f2f7fb;
  --text-secondary: #91a4b7;
  --accent-data: #42d7ff;
  --accent-forge: #ffb347;
  --accent-ai: #a879ff;
  --status-ok: #46e39a;
  --status-error: #ff6b7a;
  --radius-panel: 14px;
  --shadow-panel: 0 18px 48px rgb(0 0 0 / 0.24);
}
```

Use a desktop sidebar and content grid, collapse the sidebar below `1100px`, and switch main sections to one column below `760px`. Add `:focus-visible` and reduced-motion rules.

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm dashboard:test -- components/ui/ui.test.tsx components/app-shell.test.tsx
pnpm dashboard:build
```

Expected: PASS.

```bash
git add apps/dashboard/app/globals.css apps/dashboard/components
git commit -m "feat(dashboard): establish Forge Intelligence design system"
```

---

### Task 8: Render the Live Overview

**Files:**
- Create: `apps/dashboard/components/overview/overview-screen.tsx`
- Create: `apps/dashboard/components/overview/readiness-strip.tsx`
- Create: `apps/dashboard/components/overview/metric-grid.tsx`
- Create: `apps/dashboard/components/overview/mission-panel.tsx`
- Create: `apps/dashboard/components/overview/opportunity-panel.tsx`
- Create: `apps/dashboard/components/overview/activity-feed.tsx`
- Create: `apps/dashboard/components/overview/overview-screen.test.tsx`
- Modify: `apps/dashboard/components/connection-gate.tsx`

**Interfaces:**
- Consumes: `OverviewSnapshot` and `reload(): Promise<void>`.
- Produces: `OverviewScreen({ snapshot, reload, disconnect })`.

- [ ] **Step 1: Write behavior-first Overview tests**

Verify:

- metrics render exact live counts;
- missing Entity/Relationship projections display `Aún no expuesto por el Kernel` rather than zero;
- mission phase uses the persisted name, not percentage;
- Opportunities retain `Lead no verificado`;
- partial endpoint failures keep successful cards visible;
- empty collections display intentional empty states;
- disconnect clears credentials;
- reload has an accessible working label.

- [ ] **Step 2: Confirm red**

Run: `pnpm dashboard:test -- components/overview/overview-screen.test.tsx`  
Expected: FAIL because the Overview components are absent.

- [ ] **Step 3: Implement deterministic panels**

Panel order at `1536 x 1024`:

1. Readiness strip.
2. Hero summary with original Forge Core asset slot and current system message.
3. Metric grid.
4. Active missions.
5. Opportunity priority.
6. Recent activity.
7. Model/Obsidian readiness.

Do not render resource donuts, historical charts, storage growth, or automation schedules in this phase.

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm dashboard:test -- components/overview/overview-screen.test.tsx
pnpm --filter @internet-brain-os/dashboard typecheck
pnpm dashboard:build
```

Expected: PASS.

```bash
git add apps/dashboard/components/overview apps/dashboard/components/connection-gate.tsx
git commit -m "feat(dashboard): render live Kernel Overview"
```

---

### Task 9: Add an Original Forge Core Hero Asset

**Files:**
- Create: `apps/dashboard/public/forge-core.webp`
- Modify: `apps/dashboard/components/overview/overview-screen.tsx`
- Modify: `apps/dashboard/app/globals.css`

**Interfaces:**
- Consumes: source visual `C:\Users\Usuario\Downloads\Tablero de control cibernético inteligente.png` as art-direction evidence.
- Produces: optimized original asset with transparent or naturally integrated dark background.

- [ ] **Step 1: Invoke Product Design image-to-code and image generation workflows**

Generate an original Hephaestus cognitive-forge centerpiece: a luminous forged core or neural anvil, graphite/cyan/ember/violet palette, no copied brain silhouette, no text, no logos, no fake interface elements.

- [ ] **Step 2: Inspect the generated asset**

Confirm correct subject, crop, sharpness, masking, absence of compression artifacts, and no embedded text. Reject any asset that looks like a generic stock AI brain.

- [ ] **Step 3: Integrate with accessible responsive rendering**

Use Next `Image` with meaningful alt text only when the image conveys status; otherwise use empty alt text and nearby real status copy. Preserve aspect ratio and avoid cropping the focal core below `760px`.

- [ ] **Step 4: Verify**

Run: `pnpm dashboard:build`  
Expected: PASS with no image optimization error.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/public/forge-core.webp apps/dashboard/components/overview/overview-screen.tsx apps/dashboard/app/globals.css
git commit -m "feat(dashboard): add original Forge Core artwork"
```

---

### Task 10: Add Browser-Level Overview Verification

**Files:**
- Create: `apps/dashboard/playwright.config.ts`
- Create: `apps/dashboard/e2e/overview.spec.ts`
- Create: `apps/dashboard/e2e/kernel-fixture.mjs`

**Interfaces:**
- Produces: deterministic loopback test Kernel on `127.0.0.1:4100`.
- Exercises: connection, live metrics, partial unavailable state, disconnect, and responsive shell.

- [ ] **Step 1: Write the failing E2E journey**

```ts
test('connects to a local Kernel and renders truthful Overview data', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Kernel URL').fill('http://127.0.0.1:4100');
  await page.getByLabel('Token local').fill('test-token-that-is-long-enough-for-kernel-validation');
  await page.getByRole('button', { name: 'Conectar al Kernel' }).click();
  await expect(page.getByRole('heading', { name: 'Control Center' })).toBeVisible();
  await expect(page.getByText('Supplier research')).toBeVisible();
  await expect(page.getByText('Lead no verificado')).toBeVisible();
});
```

- [ ] **Step 2: Confirm red**

Run: `pnpm --filter @internet-brain-os/dashboard e2e`  
Expected: FAIL before the fixture and web server configuration exist.

- [ ] **Step 3: Implement bounded fixture server and Playwright config**

The fixture server must:

- bind only to `127.0.0.1:4100`;
- require the exact test token for `/api/*`;
- expose only Phase 1 routes;
- return fixtures from `apps/dashboard/test/fixtures.ts` or an ESM-safe equivalent;
- close cleanly after tests.

Configure a dashboard web server on `127.0.0.1:3000` and run Chromium with viewport `1536 x 1024`.

- [ ] **Step 4: Verify desktop, mobile, keyboard, and console**

Add assertions for:

- `1536 x 1024` layout;
- `390 x 844` navigation collapse;
- keyboard focus through connection and Overview controls;
- no horizontal overflow hiding persistent controls;
- no page errors or unexpected console errors.

Run: `pnpm --filter @internet-brain-os/dashboard e2e`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/e2e apps/dashboard/playwright.config.ts
git commit -m "test(dashboard): verify live Overview journey"
```

---

### Task 11: Integrate Repository Gates and Documentation

**Files:**
- Modify: `package.json`
- Modify: `apps/dashboard/README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `PROJECT_STATE.md`

**Interfaces:**
- Produces: one documented local startup path and a repository-wide build that includes the dashboard.

- [ ] **Step 1: Add root verification wiring**

Update root scripts so `build` runs `tsc -b` and the dashboard production build. Keep `verify:first-run` unchanged except that its existing `pnpm build` now includes the dashboard.

The exact root script becomes:

```json
"build": "tsc -b && pnpm --filter @internet-brain-os/dashboard build"
```

- [ ] **Step 2: Document exact startup**

`apps/dashboard/README.md` must include:

```bash
pnpm kernel:serve
pnpm dashboard:dev
```

Document `http://127.0.0.1:3000`, token-in-tab-memory behavior, Kernel token location without printing its contents, and the current Phase 1 module boundary.

- [ ] **Step 3: Update architecture and project checkpoint truthfully**

Add the dashboard as a presentation-only authenticated loopback client. Record only tests actually run and their actual counts. Do not claim Knowledge Graph, full Investigations, or scheduler completion.

- [ ] **Step 4: Run the complete repository gates**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm verify:first-run
pnpm --filter @internet-brain-os/dashboard e2e
```

Expected: every command exits 0. Record exact test totals in `PROJECT_STATE.md` only after this output exists.

- [ ] **Step 5: Commit**

```bash
git add package.json apps/dashboard/README.md ARCHITECTURE.md PROJECT_STATE.md
git commit -m "docs(dashboard): record verified Control Center foundation"
```

---

### Task 12: Run Iterative Product Design QA

**Files:**
- Create: `design-qa.md`
- Create: browser screenshots under a gitignored local artifact directory.
- Modify: dashboard visual files only when evidence identifies a P0/P1/P2 mismatch.

**Interfaces:**
- Consumes: source image and browser-rendered dashboard.
- Produces: `design-qa.md` with `final result: passed`.

- [ ] **Step 1: Capture normalized evidence**

Open:

- Source: `C:\Users\Usuario\Downloads\Tablero de control cibernético inteligente.png`.
- Implementation: `http://127.0.0.1:3000` connected to the deterministic local test Kernel.
- Viewport: `1536 x 1024`.
- Device scale factor: `1`.

Capture the browser-rendered implementation and record source/implementation pixel dimensions.

- [ ] **Step 2: Compare both images together**

Invoke Product Design `design-qa` and explicitly review:

- typography and numerical hierarchy;
- spacing, grid proportions, density, radii, and persistent controls;
- color tokens and accessible contrast;
- Forge Core asset subject, crop, sharpness, and integration;
- all visible copy and honest system states;
- responsive behavior and focus states.

- [ ] **Step 3: Iterate on every P0/P1/P2 finding**

For each finding:

1. record severity, location, evidence, impact, and concrete fix;
2. implement the smallest visual correction;
3. rerun focused tests and build;
4. recapture at the same viewport/state;
5. compare again with the source and previous finding.

- [ ] **Step 4: Complete the QA report**

`design-qa.md` must include source path, implementation screenshot path, viewport, density normalization, state, full-view comparison, focused comparisons, tested interactions, console result, comparison history, residual P3 polish, and exactly:

```text
final result: passed
```

- [ ] **Step 5: Final verification and commit**

Run:

```bash
pnpm dashboard:test
pnpm dashboard:build
pnpm --filter @internet-brain-os/dashboard e2e
git diff --check
git status --short
```

Expected: all verification passes and only intended files remain changed.

```bash
git add apps/dashboard design-qa.md
git commit -m "style(dashboard): pass visual design QA"
```

---

## Phase Completion Boundary

This plan is complete only when:

- the dashboard connects to the real loopback Kernel;
- Overview shows real current data with honest partial states;
- the source project and existing extension/Replay Lab behavior remain intact;
- repository and browser tests pass;
- visual QA passes at `1536 x 1024`;
- no Phase 2 Knowledge Graph or scheduler feature is represented as complete.

Follow-on implementation plans:

1. Investigations + Replay Lab integration.
2. Evidence, Claims, Entities, Relationships, and Knowledge Graph projections.
3. Goals, Agent Hub, Opportunities, and operator-safe mutations.
4. Existing automation observability, followed by a separately designed scheduler.
