# Dashboard Control Center — handoff

## Safe continuation point

- Repository: `Blackleets/internet-brain-os`
- Base branch: `main`
- Feature branch: `codex/dashboard-control-center`
- Verified checkpoint pushed to GitHub: `b3059bb`
- Local isolated worktree: `C:\Users\Usuario\OneDrive\Documentos\Internet Brain Os\.worktrees\dashboard-control-center`
- Do not implement this work directly on `main` and do not remove the worktree until the PR is merged.

The dashboard foundation, secure loopback Kernel connection, truthful live Overview, original Forge artwork, responsive shell and normalized visual QA are implemented. Before the final review wave, these commands passed:

- `pnpm typecheck`
- `pnpm test` — 94 files / 543 tests
- `pnpm dashboard:test` — 73/73
- `pnpm verify:first-run`
- `pnpm --filter @internet-brain-os/dashboard e2e` — 3/3

Design evidence and comparison history are in `design-qa.md`; the implementation plan and contract are under `docs/superpowers/`.

## Final review findings still being closed

Work in this order and use TDD for every fix:

1. **Production dependency security (P0)**
   - Baseline `pnpm audit --prod`: **7 high / 6 moderate**.
   - A trial upgrade to `next@16.2.12` removed the direct Next advisories but still left **3 high / 1 moderate** because it resolved `postcss@8.4.31` and `sharp@0.34.5`.
   - Finish with a compatible Next patch and/or reviewed workspace overrides that resolve PostCSS to `>=8.5.18` and Sharp to `>=0.35.0`; do not stop merely because the direct Next advisories disappear.
   - The trial install hit Windows `EPERM` while renaming Next in `node_modules`; ensure no dev/build process owns that directory before retrying.
   - Regenerate `pnpm-lock.yaml` without weakening the repository minimum-release-age policy.
   - Gate: `pnpm audit --prod`, dashboard tests, typecheck and production build.

2. **Truthful Overview data (P1/P2) — completed in `9c64741`**
   - `waiting_for_agent` now counts and renders as active with `Esperando agente`.
   - Valid activity remains visible during partial source failure.
   - Verified: focused 24/24 and dashboard 77/77.

3. **Connection and shell truthfulness (P1) — completed in `f620559`**
   - Initial offline snapshots remain gated and do not persist the token/session.
   - Phase 2 navigation is explicitly disabled; commands show `Próximamente` without fictitious submit or shortcut behavior.
   - Verified: focused 10/10, dashboard 77/77, dashboard typecheck and E2E 3/3.

4. **Reconcile and verify the combined tree**
   - Inspect `git status`, review every new commit and resolve only real overlaps.
   - Update `design-qa.md`, `task-12-report.md` and the SDD ledger with the security/review closure.
   - Run `git diff --check`, `pnpm typecheck`, `pnpm test`, `pnpm dashboard:test`, `pnpm verify:first-run`, `pnpm audit --prod` and `pnpm --filter @internet-brain-os/dashboard e2e`.
   - Restore generated `apps/dashboard/next-env.d.ts` to `import "./.next/types/routes.d.ts";` and remove Playwright `test-results` before committing.

The branch and draft PR were pushed through `f620559`. The only unresolved P0 is dependency security, followed by combined-tree verification and a fresh independent review.

5. **Independent review and integration**
   - Request a fresh whole-branch review from the merge base `5904569d9ddbbe02a7d32cfe1b4bee461859bb5e` to the final HEAD.
   - Do not merge or delete the branch without the user's explicit choice.

## Safety constraints

- Kernel URLs remain loopback-only; never broaden to LAN/public origins as a convenience.
- The token stays only in memory and only travels in `x-hephaestus-token` to normalized `/api/*` paths.
- Do not invent Phase 2 graph, research, scheduling or telemetry data.
- Keep the original checkout on `main` untouched.
- Do not claim authentic Hermes runtime acceptance from synthetic fixtures; the existing project-level Hermes acceptance blocker remains separate from this dashboard PR.
