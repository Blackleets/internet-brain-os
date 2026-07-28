# Internet Brain OS dashboard — design QA

## Evidence

- Source visual truth: `/workspace/scratch/263f39061984/upload/01-1000032245.png`.
- Source pixels: 1536 × 1024.
- Most recent browser-rendered implementation before this correction: `/workspace/scratch/263f39061984/dashboard-runtime-chat-real.png`.
- Implementation pixels and CSS viewport: 1536 × 1024 at device scale factor 1.
- State: connected to the deterministic loopback Kernel fixture, with one configured local model.
- Full-view comparison evidence: the source and the previous implementation were opened at their original 1536 × 1024 dimensions.
- Focused comparison evidence: hero/readiness column and persistent chat composer were inspected because they contained the visible P1/P2 drift.

## Comparison history

### Pass 1

- P1: the readiness rail occupied the left side of the content, pushing the hero away from the sidebar. The reference places the secondary rail on the right.
- P1: the conversation composer was sticky in document flow rather than persistently attached to the bottom of the working viewport.
- P2: the page needed excessive vertical travel because the composer occupied a normal grid row before becoming sticky.

### Corrections

- The readiness rail now explicitly occupies grid columns 10–12 across the hero and module rows.
- The connected hero and module grid remain in columns 1–9, matching the reference hierarchy.
- The chat console is now fixed between the desktop sidebar and the right viewport edge.
- Workspace bottom padding reserves the composer footprint so it cannot cover the last controls.
- Tablet and mobile breakpoints reposition the fixed composer inside their actual viewport.

## Required fidelity surfaces

- Fonts and typography: the existing Inter/system stack, compact uppercase panel labels, weights and hierarchy remain aligned with the reference.
- Spacing and layout rhythm: the principal left/main/right composition and bottom composer geometry were corrected; panel radii and compact gaps remain unchanged.
- Colors and tokens: the black/navy surfaces, cyan data accents and violet AI accents remain consistent with the source.
- Image quality: the supplied cognitive-core raster asset remains sharp, uncropped in its hero slot, and is not replaced by CSS art or a placeholder.
- Copy and content: connected status, Kernel-backed counts, provider/model names and unverified-output boundary remain truthful; unavailable graph/scheduler data is not invented.

## Functional validation

- Dashboard component suite: 11 files / 80 tests passed.
- TypeScript: passed.
- Production build: passed.
- Existing Kernel/provider/chat behavior remains unchanged by this visual correction.

## Blocking verification issue

The cloud browser refused permission to open `http://terminal.local:4173/`. The current corrected build therefore has no post-fix browser screenshot, interaction replay, or console inspection. Per the design-QA contract, the code cannot be declared visually identical until that browser-rendered comparison is available.

final result: blocked

## Streaming and local history pass — 2026-07-28

- Added compact new-chat and history controls beside the provider/model selectors.
- The send control changes to an explicit stop control only while generation is active.
- Streamed assistant text renders incrementally inside the existing fixed composer.
- Completed conversations can be reopened from the bounded local-history panel.
- Cancelled partial output remains visible for operator context but is not committed to Kernel history.
- Component/browser-contract coverage: dashboard 11 files / 82 tests; full repository 98 files / 561 tests.
- TypeScript and production build passed.
- Source visual remains `/workspace/scratch/263f39061984/upload/01-1000032245.png` at 1536 × 1024.
- Post-change browser capture, interaction replay, and console inspection remain blocked because the saved browser permission denies `http://terminal.local:4173/`.

final result: blocked
