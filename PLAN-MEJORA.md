# Plan de Mejora — Efesto Release Closeout

> Canonical truth: `PROJECT_STATE.md`, live GitHub `main`, and the exact current CI run. This file is a planning view, not an older branch checkpoint.

## Verified baseline — 2026-08-09

- Kernel authority, Evidence, contradiction/admission, exact replay and altered-replay rejection are implemented.
- Authentic Hermes ingestion and Agent Hub runtime validation are complete.
- Goal-first Control Center, living Efesto forge, extension workspaces and Replay Lab are wired to real Kernel state.
- Production dependency audit, typecheck, Vitest, build, first-run verification, Chromium acceptance and Windows launcher/first-run gates are green on the `main` baseline before packaged-candidate hardening.
- Windows distribution is generated from an exact Git commit as an immutable internal artifact. Public launch approval is intentionally separate from CI.

## Current release-closeout work

- [x] Close extension background-runtime gaps and regressions in `0.1.0-internal.6`.
- [x] Identify the missing release proof: source-tree installation tests did not install the exact generated ZIP artifact.
- [x] Add an exact-artifact Windows qualification harness with SHA-256 and BUILD_INFO binding.
- [x] Require extraction and installation from normal Windows paths containing spaces.
- [x] Require packaged first install on Windows 2022 and Windows 2025.
- [x] Require Shared, Kernel and extension runtimes to be built from the extracted candidate.
- [x] Require Kernel `alive`, `owned`, `verified` and Hermes readiness after installation.
- [x] Separate fresh unpaired installation from paired repair so first-run daemon handles are not misclassified as a batch-process failure.
- [x] Require first install to create the local private Kernel token and report pairing as required.
- [x] Require a second paired repair pass and prove the private Kernel token digest is unchanged.
- [x] Audit captured repair output for Kernel-token or Hermes-boundary credential leakage.
- [x] Persist only sanitized failure diagnostics for CI investigation.
- [x] Add Gherkin and machine-checked release-contract coverage for packaged installation.
- [x] Freeze `0.1.0-internal.7`, `0.1.0-internal.8`, and `0.1.0-internal.9` as non-promotable qualification attempts rather than reusing their identities.
- [x] Advance the corrected two-phase qualification state to `0.1.0-internal.10`.
- [ ] Make the exact packaged-candidate qualification green on both Windows generations for the final PR SHA.
- [ ] Merge only after the complete CI, Chromium, legacy Windows and packaged-candidate gates are green for the same SHA.
- [ ] Re-run the same required gates on the merged `main` commit.
- [ ] Only then begin manual UAT-1 through UAT-6 on that exact `internal.10` artifact.
- [ ] Set `publicLaunchApproved=true` only after UAT passes on the same immutable candidate.

## Engineering sequence after release qualification

After packaged installation qualification is merged and green, the next bounded engineering phase is Memory Safety completion:

1. deterministic Kernel-owned quarantine signal evaluation and recommendations;
2. explicit terminal-memory recovery review records without creating an agent mutation path;
3. repeated-failure aggregation into read-only prevention recommendations;
4. operator/read-model exposure with provenance and no Replay Lab write authority;
5. contract freeze and full regression/acceptance gates.

Only after those contracts are stable do we begin formal Product Design work against the real Goal-first product state.

## UAT promotion gate

The release is not publicly promotable until automated packaged qualification is green and `docs/internal-uat-v0.1.0.md` passes end to end on the same artifact:

1. clean Windows install;
2. browser pairing and real surfaces;
3. real public-web economic Goal;
4. persistence and replay;
5. second value Goal;
6. truthful failure handling/recovery.

## Engineering rules

1. **Kernel authority stays local-first and fail-closed.**
2. **Agents propose; the Kernel validates, admits and persists.**
3. **No fake UI state or synthetic release claims.**
4. **One bounded branch/PR at a time; never patch `main` directly.**
5. **Every shipped behavior or release-validation change advances the immutable internal candidate.**
6. **CI green is necessary, but public launch requires UAT evidence.**
7. **A generated package is not qualified until that exact package installs and repairs successfully.**
