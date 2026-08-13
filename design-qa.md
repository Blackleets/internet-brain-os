# Efesto professional conversation redesign — Design QA

source visual truth path: `docs/design/efesto-conversation-mobile-reference.png`
implementation screenshot path: browser-rendered inline capture; the cloud browser did not expose a filesystem-backed screenshot path
viewport: desktop 1363×936; responsive iframe 390×844
source pixels: 944×1680; implementation CSS viewport: 390×844 at device scale 1
state: offline/local-first Home; the source reference depicts a connected example state, so data content is not compared as if it were identical

## Full-view comparison evidence

The source mobile concept and the rendered implementation were both opened and inspected. The implementation preserves the selected atmosphere: obsidian surfaces, restrained copper, a compact Efesto smith identity, conversation-first hierarchy, persistent bottom composer, and explicit `Chat / Goal` modes.

The first desktop render exposed one broken optimized-image request in the static QA server. The forge asset was changed to direct local delivery and a second browser pass confirmed zero broken images.

The first 390×844 render exposed a 215 px composer and crowded top-bar metadata. The mobile rules were tightened: nonessential top metadata is hidden, the composer identity collapses to the smith mark, the trust note is hidden at this breakpoint, and the composer is now 134 px high with no horizontal overflow.

## Focused-region comparison evidence

- Composer: rendered at 351 px wide inside a 390 px viewport, with `Chat / Goal`, Efesto identity, real textarea, disabled submit state, and safe bottom inset.
- Header: menu, page identity, refresh and Kernel connection remain reachable; desktop-only privacy copy is hidden at mobile width.
- Forge presence: the existing smith and brain assets remain visible, while motion and status continue to depend on observable phases.
- Evidence/Finds: the real context controls remain below the primary conversation and call the existing navigation handlers.

## Findings

- [P2] The browser-rendered screenshot cannot be persisted from the cloud-browser session.
  - Location: QA artifact pipeline.
  - Evidence: both desktop and mobile captures rendered successfully inline, but no filesystem-backed image path was returned.
  - Impact: a deterministic side-by-side image artifact cannot be committed for later pixel comparison.
  - Fix: retain a screenshot artifact from GitHub browser acceptance or the next Vercel preview capture, then normalize it against the 390×844 viewport.

## Required fidelity surfaces

- Fonts and typography: hierarchy, weights, wrapping and 16 px mobile input sizing were visually checked; the implementation intentionally retains the product's existing system font stack.
- Spacing and layout rhythm: desktop and 390×844 layouts were checked; mobile scroll width equals viewport width and the sticky composer remains inside the viewport.
- Colors and visual tokens: the implementation uses the existing Efesto obsidian/copper tokens with restrained green only for verified state.
- Image quality and asset fidelity: existing repository smith and brain assets are reused; the direct local brain asset has zero broken-image requests.
- Copy and content: the interface no longer names another product. It explains Efesto, Goal preparation, Kernel authority, Evidence, and memory boundaries in product-specific language.

## Primary interactions tested

- `Chat` selects the real Chat mode and exposes the truthful unavailable-provider placeholder when no model is configured.
- `Goal` restores Goal mode and its explicit preparation contract.
- A starter Goal populates the real Goal textarea.
- Browser console inspection found no warnings or errors from `terminal.local`; unrelated cloud-browser extension diagnostics were excluded.

## Comparison history

1. Initial render: broken optimized forge image, crowded mobile top bar and 215 px mobile composer.
2. Fix pass: direct local image delivery, mobile metadata removed, compact identity, 134 px composer.
3. Post-fix evidence: zero broken images, `390 px` document width at a `390 px` viewport, composer bounds `x=12`, `width=351`, `bottom=822`, and no app-origin console errors.

final result: blocked
