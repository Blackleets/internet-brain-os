# Task 9 report — Original Forge Core Hero Asset

## Delivered

- Integrated the approved original `apps/dashboard/public/forge-core.webp` asset through `next/image`.
- The asset is decorative (`alt=""`): the adjacent, persisted Kernel status copy remains the accessible source of operational meaning.
- Preserved its intrinsic `1672 × 941` aspect ratio with responsive `sizes`, `object-fit: contain`, and no mobile hide/crop rule. At widths below 760 px, the hero reflows and the complete image remains visible beneath the status copy.

## Asset evidence

- File: `apps/dashboard/public/forge-core.webp`
- Size: 216,664 bytes
- SHA-256: `7475A6556AADB20AD428DE52F88813E80227081AB621305BA2A2D0CC943EF3BD`
- The approved asset was supplied as an original sharp, text-free, logo-free Forge Core composition with the subject on the right and dark negative space on the left; it was not regenerated or overwritten during this task.

## Test evidence

- Added a focused Overview test for the real rendered artwork URL, decorative alt decision, intrinsic dimensions, and adjacent Kernel status copy.
- Red: the test failed against the former pending placeholder because it rendered no image.
- Green and final validation (2026-07-26):
  - `pnpm --filter @internet-brain-os/dashboard test` — 9 files, 69 tests passed.
  - `pnpm --filter @internet-brain-os/dashboard typecheck` — passed.
  - `pnpm dashboard:build` — passed; Next image optimization completed without error.
  - `pnpm typecheck` — passed.
  - `pnpm test` — 93 files, 539 tests passed.
  - `pnpm build` — passed.

## Note

The dashboard build emits the pre-existing Next.js workspace-root warning about multiple `pnpm-workspace.yaml` files. It does not affect the completed build.
