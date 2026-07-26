# Control Center design QA — passed

## Normalized evidence and state

- Source: `C:\Users\Usuario\Downloads\Tablero de control cibernético inteligente.png` — 1536 × 1024 px.
- Target browser viewport: 1536 × 1024 CSS px; browser-reported DPR: 2.5.
- Final desktop implementation: `.superpowers/sdd/2026-07-26-dashboard-foundation-overview/task-12-implementation-pass-1.png` — 1536 × 980 px visible browser content. The document measured exactly 1536 × 1024 CSS px with no horizontal overflow.
- Full-view comparison: `.superpowers/sdd/2026-07-26-dashboard-foundation-overview/task-12-comparison-pass-1.png`.
- Focused hero comparison: `.superpowers/sdd/2026-07-26-dashboard-foundation-overview/task-12-focused-hero-pass-1.png`.
- Mobile diagnostic capture: `.superpowers/sdd/2026-07-26-dashboard-foundation-overview/task-12-mobile-pass-2.png` — 390 × 844 px.
- Rendered state: connected to the deterministic loopback Kernel fixture through the QA-only CORS proxy. Model Forge is intentionally unavailable; no Phase 2 modules or synthetic metrics were invented.

## Comparison history and corrections

| Severity | Visible finding | Smallest verified correction |
| --- | --- | --- |
| P1 | Pass 0 showed `Kernel sin conexión` in the persistent shell while the Overview was connected. | `AppShell` now subscribes to `connectionStore`; header and sidebar use the same live state. |
| P2 | The connected hero exposed a raw English bootstrap message in the Spanish operator UI. | The ready/paired state derives the concise truthful summary `Kernel local listo. Efesto está emparejado.` |
| P2 | Pass 0 reached 1065 px at the reference viewport and clipped lower operational panels. | Desktop sidebar and panel/grid spacing were tightened; pass 1 ends at 1024 px with no horizontal overflow. |
| P1 | Mobile QA at 390 px measured 422 px document width, three readiness columns and seven unreadable metric columns. | A malformed `repeat(4,minmax(0,1fr))` declaration was repaired, restoring the intended max-760 breakpoint. |
| P2 | The mobile diagnostic then exposed the decorative Forge image despite the mobile hide rule. | The mobile selector now matches the desktop selector specificity; the final E2E asserts the artwork is hidden. |

## Functional and visual checks

- Desktop comparison inspected source and pass-1 implementation together at the normalized connected state.
- The 208 px sidebar, command bar, readiness strip, hero, metrics and operational panels preserve the source system hierarchy without copying unavailable modules.
- Original Forge Core artwork is sharp, right-weighted and integrated without placeholder graphics.
- Header/sidebar readiness, Spanish hero copy, connect, refresh, keyboard focus order and disconnect were exercised.
- Mobile E2E at 390 × 844 asserts no clipped shell element, exact document/viewport width equality, one metric column at least 300 px wide, visible persistent actions and hidden Forge artwork.
- The in-app browser console returned no errors for the connected mobile state. The final mobile visual recapture after restarting the production server was blocked by the browser URL policy; the exact responsive regression is therefore closed by the canonical browser E2E rather than an additional screenshot.
- Canonical dashboard E2E: 3/3 passed. Dashboard tests: 73/73 passed. Production build passed.

## Residual P3

The reference contains more modules and color variance. Graph, Investigations, scheduling and synthetic telemetry remain intentionally absent until their Kernel contracts exist. This is a truthful Phase 1 boundary, not a visual omission to fake.

final result: passed
