# Efesto inline model selector — Design QA

source visual truth path: `https://chatbot.ai-sdk.dev/demo` (official Vercel AI chatbot with the model selector open)
implementation screenshot path: `https://efesto-five.vercel.app/?v=0ea28b4` (production with Efesto's selector open)
viewport: 1363 × 936 CSS px
source pixels: 1365 × 936; implementation pixels: 1365 × 936
state: desktop, empty Chat, model selector open; the source has populated hosted models while Efesto truthfully shows the disconnected Kernel state

## Full-view comparison evidence

The official reference and the production implementation were captured at the same viewport and placed side by side in one 2746 × 936 comparison image in the cloud browser. Both selectors originate from the model control inside the bottom composer, open upward over the starter prompts, preserve the conversation-first canvas and keep the send action stable.

Efesto intentionally retains its obsidian/copper system, visible Kernel boundary and disconnected empty state. It does not copy hosted model names or provider logos because the product only renders models returned by the user's Kernel.

## Focused selector comparison

The reference establishes the relevant interaction pattern: compact trigger, upward overlay, search, grouped models and a clearly selected option. Efesto now implements the same hierarchy with:

- a compact composer trigger with active/open state and chevron;
- search across real provider and model names;
- provider groups with type metadata;
- a selected-model row and check state;
- truthful disconnected and no-model empty states;
- a direct route to Kernel connection or model management.

## Findings

No actionable P0, P1 or P2 visual differences remain. The populated-versus-disconnected content difference is required product truth, not reference drift.

## Required fidelity surfaces

- Typography: compact labels, model names, provider metadata and empty-state copy remain legible without competing with the conversation.
- Spacing and geometry: the 344 px selector aligns to the composer control, opens upward and stays inside the desktop viewport.
- Lines and surfaces: one-pixel neutral boundaries, restrained copper selection and opaque obsidian panels replace generic dropdown styling.
- Assets: the existing Lucide icon system is reused consistently; no invented logo, provider badge or fake model art was added.
- Content: every populated option is derived from `providers[].models`; disconnected and empty states describe the actual Kernel condition.

## Primary interactions tested

- `Configurar modelo` opens the selector and exposes `aria-expanded`.
- Escape closes the selector and clears its open state.
- Clicking outside closes the selector.
- `Conectar Kernel` closes the selector and opens Settings.
- Goal remains independent: it becomes pressed, exposes the Goal textbox and hides the model selector.
- Desktop document width equals viewport width (1363 px); no horizontal overflow or framework error overlay is present.
- Browser console: no application-origin warnings or errors; unrelated `chrome-extension://` metadata errors were excluded.
- Vercel runtime errors: none in the last hour.
- GitHub/Vercel status for commit `0ea28b4211b9e6ec508ed015dd393e3c7fd232c0`: success.
- Production deployment `dpl_6oh9dNATW9AUCviLgJ5AFntPHhow`: READY and aliased to `efesto-five.vercel.app`.

## Comparison history

1. Baseline: the composer model control navigated away from Chat and had no inline selection state.
2. Implementation: added the upward selector, real provider grouping, search, selected state, truthful empty states and accessible dismissal.
3. Post-fix evidence: production was captured side by side with the official selector reference; interaction checks, console checks and runtime checks passed.

final result: passed
