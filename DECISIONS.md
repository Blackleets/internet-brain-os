# DECISIONS

This file records major product and technical decisions.

Do not delete old decisions. If a decision changes, add a new entry explaining why.

## 2026-10-10 — MCP has no reconciliation authority

Read stored snapshots directly rather than calling lifecycle managers. Kernel APIs retain all repair/write authority. Stdio trusts authorized local process/file access; a legacy token-format field is diagnostic only. Document client-provider disclosure and preserve tool compatibility. See docs/changes/mcp-snapshot-reads.md.

## 2026-10-10 — Keywords refine discovery, not replace the Goal

Keep persisted intent/authorization unchanged. The discovery adapter searches the complete sanitized title first and combines title terms with keywords for bounded alternatives/selection context. Retain numeric restrictions without losing the subject. No synonym invention, SUPPORT changes or migration. See docs/changes/goal-query-context.md.

## 2026-10-08 — Recover historical revision blocks through existing confirmation

Expose search_more only for the known revision-mismatch block after an attempt finished and no live lease exists. The existing Kernel endpoint decides whether to create a fresh current-revision attempt or preserve active work. Archive the literal known denial, retain prior data and never replay the stale batch. No automatic repair, migration or authority extension. Founder explicitly requested improvements first, merging later; keep this candidate draft and unmerged.

## 2026-10-08 — Keep Goal revision stable through verification

Pending source verification is active work even after the Hermes lease is released. Reject changed revisions in the existing atomic Goal transaction and explain the wait in the existing editor. Reuse the settlement contract rather than adding another lifecycle or extending execution authority. Do not renew stale receipts or repair old policy blocks automatically. Preserve the visual design and user stores. Scope, acceptance and rollback are in docs/changes/goal-edit-verification-reliability.md.

## 2026-10-05 — Remember web authorization in the paired extension

Decision: satisfy the founder's daily startup request with an explicit per-user Windows startup shortcut and an opt-in extension proxy for the canonical Efesto web origin. Do not persist the private Kernel token in the hosted dashboard. Keep the existing manual connection path and require Kernel confirmations for mutations. Web disconnect revokes its extension consent. Avoid privileged machine-wide services and installation work during login; preserve healthy processes and unrelated shortcuts. See `docs/changes/efesto-daily-start.md` for the reviewed boundary and `docs/efesto-daily-start.md` for owner setup and rollback. This is candidate .87; real founder-PC UAT and final-head CI remain distinct from local tests.

## 2026-08-12 - Canonical Efesto constitution

Decision: `CONSTITUTION.md` is the single canonical project constitution and agent preflight contract for Efesto.

It governs product identity, Kernel sovereignty, evidence-before-memory, safety and privacy, truthful autonomy, engineering discipline, institutional memory, and constitutional amendments. `AI_CONSTITUTION.md` remains only as a compatibility pointer. Hermes and every coordinated worker must read the canonical constitution before planning or changing repository artifacts.

Reason:

Efesto needs one durable North Star that prevents product drift, authority bypass, and contradictory instructions as multiple agents and contributors work across the repository.

## 2026-07-10 - Product identity

Decision: Internet Brain OS is not a generic scraper.

It is a local-first AI web intelligence system that uses scraping, extraction, memory, evidence, Obsidian notes, agents, and Skills to turn public web information into decisions.

Reason:

A generic scraper is easy to copy and low-value. A memory/evidence/intelligence system is more defensible and useful.

## 2026-07-10 - Local-first and free-first

Decision: The product must work locally and with free/low-cost models first.

Reason:

The founder has limited budget. The architecture must not depend on expensive paid APIs to function.

Implications:

- Ollama support is important.
- Local storage is required.
- Cloud sync is optional, not mandatory.
- Paid LLMs are used only for high-value tasks.

## 2026-07-10 - Obsidian as memory layer

Decision: Obsidian is a first-class integration, not a simple export.

Reason:

Human-readable Markdown notes make the system durable, portable, and user-owned.

Implications:

- Cases should export to Markdown.
- Entities should become notes.
- Evidence should become notes.
- Backlinks should connect knowledge.
- YAML frontmatter should support structured querying.

## 2026-07-10 - Evidence-first design

Decision: Every serious claim must link back to evidence.

Reason:

The product must be trustworthy. AI conclusions without evidence are not enough.

Implications:

- Evidence model is core.
- Reports must cite evidence IDs.
- Confidence and uncertainty must be explicit.

## 2026-07-10 - Kernel-first architecture

Decision: Build a small stable Kernel before advanced UI or marketplace features.

Reason:

The Kernel makes future Skills, extensions, dashboards, and agents possible.

Implications:

- Phase 0 focuses on Case, Evidence, Memory, Obsidian export, and reports.
- Browser extension comes after local core works.

## 2026-08-13 - PWA-first mobile surface

Decision: The first mobile surface is the responsive, manifest-based Efesto
dashboard. A native Android/iOS runtime and phone-to-PC Kernel transport remain
separate slices and are not implied by mobile-width rendering or installation
metadata.

Reason:

The repository currently contains the authenticated dashboard and browser
extension, but no native mobile application. The Kernel's default authority
boundary is loopback/local-first, so adding a remote bridge merely to make a
phone appear connected would weaken privacy and token safety.

Implications:

- Reuse the existing Goal, Mission, Finds, Evidence, Chat and Settings
  contracts in the mobile-width dashboard.
- Keep touch targets, keyboard/focus behavior, reduced motion and safe-area
  spacing as acceptance requirements.
- Do not expose the Kernel token in URLs or add a public proxy.
- A native companion requires a separate reviewed transport, pairing and
  authorization contract before implementation.

## 2026-08-29 - Goal-first Spanish product IA (Phase 1)

Decision: The authenticated Efesto dashboard primary navigation is Inicio, Objetivos, Hallazgos, Evidencia, Memoria, Actividad and Ajustes. Home defaults to Goal mode. Chat, Modelos, Agentes and Replay Lab remain secondary. Memory is Kernel-controlled only and renders honest unavailable when no dashboard memory list exists. Findings remain unverified leads.

Reason: The previous Home defaulted to Chat and mixed mission/system internals into the primary nav, which hid the Goal to confirmation to Evidence path.

Implications: Example chips only fill the composer. Goal create still does not authorize network. Green checks and confidence appear only from persisted Kernel fields. This is not UAT, public launch, or live Hermes L1 to L7 proof.

## 2026-10-05 — qualify the existing Forge candidate before extending scope

Start from the latest #252 reliability head, preserving the complete #251 search/telemetry/SUPPORT stack. Treat incomplete Kernel replies and redirects as transport failures, retain persisted reconciliation and avoid UI completion inferred from HTTP success. Improve recovery/accessibility through existing Goal revision contracts. No new authority, dependency, user data migration or public-release claim is justified. Rollback is a revert of this additive candidate commit.

## 2026-10-05 — Reviewed full live model identity

The mutable qwen3.5:2b alias changed and correctly failed provisioning in run 37297333680. Select the explicit Q8_0 variant, review its public registry manifest and verify its full SHA-256 locally and in the disposable workflow. Never automatically accept a new digest. Inference compatibility requires a fresh live run; no SUPPORT threshold, worker budget or founder data changes. Rollback reverts only this provisioning correction.

## 2026-10-05 — Curated local brand assets

Prefer downloaded original marks with source/hash provenance over runtime favicon services, which would disclose researched domains. Unknown hosts use initials rather than invented logos. Limit this slice to existing Forge source cards and the actual Hermes connector; no new providers or claims of integration. Rollback reverts this presentation slice without deleting Evidence or changing #256.

## 2026-10-05 — Exclusive vault diagnostic files

The prior write check could overwrite and remove an existing .efesto-write-test entry. Use a unique name and exclusive open; cleanup occurs only after acquiring ownership and closing the handle. Existing validation behavior and configured-vault semantics remain compatible. Tests retain original contents and run eight concurrent checks. Rollback is a scoped code revert; no migration.

## 2026-10-05 — Read-only installation identity

Add `node scripts/efesto-install-identity.mjs` / `pnpm efesto:identity` to report internal version, exact checkout/archive commit and clean/modified checkout state without exposing paths, filenames, credentials or performing runtime/vault/network probes. `BUILD_COMMIT.txt` is expanded by Git archive through export-subst. Reject parent-repository identity for nested packages and keep legacy/malformed identity unknown. Identity is not authenticity or readiness; verify the package SHA256 separately. Candidate `.83` replaces frozen `.82` for this new behavior; public launch remains blocked. #259 merged as f635676 after all five workflows passed. Founder-PC UAT remains outstanding. Rollback this slice only.

## 2026-10-05 — Launcher readiness rejects redirects

Launcher health and runtime bootstrap requests use redirect:error so readiness is accepted only from a direct response at the requested endpoint. Existing timeouts, port-conflict detection and direct runtime certification remain intact. No crawler, Kernel domain, SUPPORT, credential or store changes. Real HTTP regressions cover 301/302/307/308 for both probes (8 failures before the fix) plus direct health and blocked Hermes compatibility. Candidate `.84` advances frozen `.83`. Rollback only this transport slice. #260 merged to main 7e077439 after all five workflows passed; founder Windows UAT remains unverified and public launch blocked.

## 2026-10-05 — Observable launcher stop failures

Default stopOwnedProcess now returns its stop result and removes the launcher PID record only for an accepted stop request. Failure/timeout retains the original record, returns stop_failed from shutdown/pairing repair and gives CLI exit 1. Pairing restart returns stop_not_confirmed instead of spawning a replacement when the bounded wait still reports Kernel ready. Successful stop-request and legacy injected operations remain compatible; no completed POSIX termination claim is added. No crawler, Kernel authority, SUPPORT, credential or user-store changes. Candidate `.85` advances frozen `.84`; public launch remains blocked. #261 merged as e6d407a after all five workflows passed; Windows founder-PC UAT remains outstanding. Rollback only this stop-result slice.

## 2026-10-05 — Agent connector waiting count and SUPPORT truth

Candidate `.86` integrates #257 with main `34c1eea`. The read-only agent-presence projection counts queued/waiting_for_agent missions, excluding terminal missions. It emits forged only for a completed forged mission with a persisted supported verification result and nonempty Evidence identifier; other completions are completed_without_forge. Dashboard copy maps both this phase and legacy completed to terminada sin Evidence. No executor, crawler, SUPPORT admission, authentication or persistence changes. Rollback only this projection/copy slice. Public launch remains blocked; exact-candidate automated qualification and founder-PC UAT are distinct gates.

## 2026-10-10 — Count the full retained wait to useful feedback

Use earliest trusted authorization per Goal revision for time-to-first-useful, rather than the producing retry alone. Preserve validation against the producing mission to reject impossible feedback. No migration or SUPPORT change. Human review time remains part of the metric. Proposed 30-Goal evaluation is unexecuted; commercial constraint proof and founder-PC UAT are independent gates.

## 2026-10-10 — Separate topic SUPPORT from condition certification

Publish current implementation limits before adding actual assessments. SUPPORT and verified fetches are not exact price/stock/freshness proof. Agent or stored claimed scope cannot override read-model limits. Current UI disclosure preserves existing Find actions and design. Actual assessments require a separate Evidence/hash/Goal-revision bound versioned contract; public launch and founder UAT stay blocked.

## 2026-10-10 — Hermes rejected-output diagnostics (.95)

The adapter still rejects structured output without an array of at most twenty findings. Its failure now includes only fixed root/findings type labels and none/over_20 count categories. No payload, keys, values, URLs, private reasoning, candidates or authority are retained from a rejected result. Frozen .94 live run 38051253204 failed 8/14 before ingestion; .95 is a diagnostic improvement, not a proven malformed-output repair. Existing queued-with-lastFailure recovery is preserved. See docs/changes/hermes-output-shape-diagnostics.md; rollback this error-metadata slice only. PR #266 stays draft/unmerged and public launch remains blocked.
