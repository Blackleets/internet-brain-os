# G5.3 — Authentic public-web journey acceptance

G5.3 strengthens the existing `pnpm hermes:acceptance:live` path. It does **not** create another executor, another agent protocol, another Evidence writer or a production telemetry channel.

## Purpose

The previous live acceptance could prove that an authentic Hermes runtime reached a terminal Mission. Terminal execution is necessary but insufficient for product value. G5.3 additionally requires evidence that the same isolated run completed:

```text
trusted Goal confirmation
→ authentic Hermes isolated search-only discovery
→ persisted searchCandidates
→ Kernel web.read verification
→ Case + Evidence
→ Goal-linked Find
→ Shared Goal Truth forged state
```

## Live-only probe

The live mode uses one bounded public-learning Goal:

> Find a free public AI course with certification, enrollment and curriculum details

The category is `learning`. The Goal is intentionally read-only and public-web only. A result must be independently fetched and verified by the Kernel before it can satisfy acceptance.

## Checks

Existing live checks remain:

- **L1** — authentic Hermes reaches terminal `completed` state;
- **L2** — attempts remain bounded at three or fewer.

G5.3 adds:

- **L3** — at least one bounded `searchCandidate` is persisted;
- **L4** — Kernel `web.read` creates verified Evidence;
- **L5** — at least one promoted Find matches the exact tested Goal;
- **L6** — that Find resolves through Case/Evidence provenance to the same Mission and candidate, with `kernel-web-read-v1`, a `web-read:` source receipt, non-empty fetched text and a content hash;
- **L7** — Shared Goal Truth reports `sourceOfTruth: kernel`, the same Mission id and `workState: forged`.

The epistemic check is based on **provenance**, not on comparing whether two text strings happen to differ. Identical text does not make agent output Evidence; only the Kernel verification path does.

## Isolation and privacy

Live acceptance continues to:

- use loopback-only Kernel endpoints;
- generate a fresh local API token;
- create an isolated temporary Efesto data directory;
- remove that data directory after the run;
- redact report details;
- run Hermes from an ephemeral home/cwd with user config, rules and project plugins disabled and only the official `search` toolset available;
- add no purchase, login, form, message, payment or durable-memory authority.

The report stays local at the existing acceptance report path unless the operator explicitly handles it elsewhere.

## CI boundary

Default CI remains deterministic and does **not** require Internet access or a live Hermes account/runtime. The new live provenance checks run only when the existing acceptance command is explicitly invoked with `--live` / `pnpm hermes:acceptance:live`.

Unit and structural tests for the G5.3 assessment logic remain part of normal CI so regressions in the acceptance contract are still caught offline.

The separate `Hermes live public-web acceptance` GitHub workflow provides a remote execution environment without changing default deterministic CI. It supports manual reruns and automatically qualifies same-repository pull requests plus `main` only when the live-acceptance boundary itself changes; fork pull requests are skipped. It pins the reviewed Hermes runtime and checksum-verifies a disposable local Ollama runtime, verifies the reviewed Qwen3 model identity before use, binds inference to loopback, and uploads only the sanitized report. It requires no founder-owned provider credential and does not become evidence until the exact run completes L1→L7 successfully.

## What this does not replace

A green live acceptance run is not the same as founder/manual UAT of the packaged Windows candidate. Public launch remains separately blocked until the exact immutable package passes the documented internal UAT journey and side-effect review.
