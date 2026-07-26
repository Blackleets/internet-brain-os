# Control Center design QA — visual fix pass 1 pending capture

## Normalized evidence and state

- Source: `C:\Users\Usuario\Downloads\Tablero de control cibernético inteligente.png` — 1536 × 1024 px.
- Browser viewport: 1536 × 1024 CSS px; browser-reported DPR: 2.5.
- Pass-0 implementation capture: `.superpowers/sdd/2026-07-26-dashboard-foundation-overview/task-12-implementation-pass-0.png` — 1521 × 970 px browser content capture; pass-0 document scroll height: 1065 px; no horizontal overflow.
- Pass-0 comparisons: `.superpowers/sdd/2026-07-26-dashboard-foundation-overview/task-12-comparison-pass-0.png` and `.superpowers/sdd/2026-07-26-dashboard-foundation-overview/task-12-focused-hero-pass-0.png`.
- Rendered state: connected to the deterministic loopback fixture, including intentionally unavailable Model Forge. No Phase 2 modules or synthetic metrics were added.

## Findings and applied corrections

| Severity | Location and evidence | Impact | Applied smallest correction |
| --- | --- | --- | --- |
| P1 | Pass-0 header and sidebar said `Kernel sin conexión` while the connected Overview said `Kernel conectado`. | Contradictory readiness state. | `AppShell` is now a client subscriber to `connectionStore`; both persistent badges use the live healthy/unavailable semantic state. The unreachable duplicate mobile badge was removed. |
| P2 | Pass-0 connected hero displayed the successful bootstrap’s raw English service message. | Spanish operator UI contained raw technical copy. | Ready/paired state now derives the concise truthful summary `Kernel local listo. Efesto está emparejado.`; non-ready and unavailable fallbacks remain unchanged. |
| P2 | Pass-0 had 1065 px document height at the reference viewport, clipping lower panels compared with the dense source composition. | Important overview panels did not fit in the initial frame. | Desktop sidebar is 13rem (208 px); workspace, command bar, panel, grid, readiness, metric, hero, and list spacing were tightened while primary navigation and action targets retain their prior 44 px/40 px minimum heights. |

## Verification completed before visual recapture

- Focused behavioral/copy regression: `pnpm --filter @internet-brain-os/dashboard exec vitest run components/app-shell.test.tsx components/overview/overview-screen.test.tsx` — 2 files, 17 tests passed.
- The new AppShell test observes a real store `set` and `clear`, confirming both shell badges update and tests reset the singleton store between cases.
- The new Overview test confirms ready/paired state is rendered in Spanish instead of the raw bootstrap message.

## Required pass-1 browser comparison

The main task owner must recapture the connected deterministic fixture at the same 1536 × 1024 viewport, compare it side-by-side with the source and pass 0, and record:

1. final scroll height (target: no more than 1024 px) and horizontal-overflow result;
2. full viewport and hero-focused pass-1 screenshots;
3. header/sidebar connected badges, Spanish hero copy, keyboard refresh/disconnect flow, responsive 1280/tablet/mobile layout, focus visibility, and browser console result;
4. any residual P0/P1/P2 finding before changing this result.

## Residual P3

The source contains more modules and color variance. Those unavailable Phase 2 projections and synthetic metrics remain intentionally absent; the current Forge palette and original cognitive-core art stay within the truthful Phase 1 boundary.

final result: blocked
