# HEPHAESTUS / Efesto

**The Intelligence Forge — evidence, autonomous research and memory safety for AI agents.**

Hephaestus is a local-first intelligence Kernel. Efesto is the product experience around that Kernel: users define Goals, approved capabilities research the public web, findings become Evidence-backed opportunities, and the Kernel controls what may be trusted, remembered or acted on.

```text
Goal
→ Proposed Plan
→ Capability / Risk Gate
→ controlled execution
→ Evidence
→ Opportunity / Knowledge
→ Trigger / Notification
→ controlled memory
```

For agent ingestion the core invariant remains:

```text
Agent run → signed ingestion → evidence-backed Case → Kernel gates → controlled memory
                  ↘ exact replay: safe
                  ↘ altered replay: blocked
```

**An agent is never the Kernel.** Hermes and other agents may discover, research and propose. The Kernel owns Evidence, validation, contradiction handling, admission, capability policy, replay and durable-memory authority.

## Install Efesto on Windows

The normal user path does not require knowing Node, pnpm or terminal commands.

1. Download/clone this repository.
2. Double-click **`Install Efesto.cmd`**.
3. The installer checks and repairs Node.js 22+, pinned pnpm 11.11.0 and frozen-lockfile dependencies.
4. It builds the browser extension and repairs/starts the trusted local Efesto launcher.
5. It creates an owner-local **Efesto** desktop shortcut.
6. Load the built extension in Chrome/Chromium if it is not already installed, pair it when requested, and use the central Efesto orb.

`Efesto Launcher.cmd` is self-healing: if Node, pnpm or workspace dependencies are missing, it routes through the installer instead of leaving the user with a raw shell failure.

The installer does **not** embed or print Kernel tokens, provider credentials or Hermes boundary secrets.

### Browser extension

After installation/build:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `apps/extension/dist`.

The extension is a local sensor/copilot and operator surface. Heavy intelligence and authority stay in the local Kernel.

## What the current MVP proves

The canonical Golden journey is an economic Goal for a quality drill between €18 and €25:

```text
Goal
→ authorized web.search
→ authorized web.read
→ Case
→ Evidence
→ Opportunity ranking
→ new-match Trigger
→ deduplicated Notification
```

The journey retains source provenance and performs **no purchase, login, form submission or automatic memory admission**. Irreversible actions remain outside this Golden path and require explicit policy/approval.

Native `web.search` and `web.read` are read-only/public-web capabilities executed through the Capability Registry and Execution Engine. They are not a direct Hermes bypass.

## Memory and replay safety

The Kernel includes:

- explicit memory-authority lifecycle validation;
- append-only authority receipts;
- durable on-disk receipt persistence and restart reconstruction;
- deterministic authority projection;
- startup reconciliation;
- reasoning retrieval gating;
- exact replay idempotency;
- altered replay rejection;
- fail-closed handling for corrupt, tampered, gapped or missing-reference authority histories.

Only reconciled **admitted** memory may be reused by reasoning.

## Authentic Hermes boundary

Efesto includes a bounded, shell-free Hermes adapter and authentic runtime acceptance for Hermes v0.19.0. The live acceptance path proves the Agent Hub worker boundary with a real runtime rather than simulated agent output.

Hermes still does not receive Kernel memory authority. Unsafe URLs, malformed output, authority-field injection and sensitive data are rejected/sanitized at the boundary.

## Operator surfaces

### Efesto extension

The Chromium extension contains four bounded workspaces:

- **Forge** — Goals, system readiness and active work.
- **Missions** — persisted Agent Hub mission states and forge ledger.
- **Finds** — Evidence-backed opportunity leads and provenance.
- **Models** — local Model Forge inspection/recommendations.

The pixel blacksmith/forge reflects observable persisted states; it never invents agent progress.

### Hephaestus Control Center

The dashboard is an authenticated local client for Investigation, Knowledge, Agent Hub, Opportunity, Automation and System views plus owner-private multi-model chat.

When hosted, the dashboard remains presentation-only. Kernel authority, credentials, Evidence, Hermes worker state, Obsidian data and controlled memory remain local.

### Replay Lab

Replay Lab is the forensic surface for explaining what happened. It may inspect causality, replay and recorded decisions, but it never gains authority to rewrite durable memory.

### Efesto MCP Server

Your kernel knowledge as **read-only tools for any MCP client** (Claude Desktop, Cursor, Windsurf, Hermes…). Five tools — `kernel_status`, `list_goals`, `list_missions`, `list_cases`, `get_case` — expose Goals, research missions, Cases and their Evidence receipts with full provenance. Stdio transport only: no ports open, token never echoed, read-only by construction. Setup in 2 minutes: [`apps/local-kernel/MCP_SERVER.md`](apps/local-kernel/MCP_SERVER.md).

> Most agent memory is embeddings without provenance. Efesto's is different: every claim a model makes from `get_case` traces back to what was actually observed.

## Opportunity intelligence and privacy

Efesto can capture authorized public-page context, classify opportunities, match them against private Goals, rank them and project useful records to an Obsidian-compatible vault.

Privacy boundaries include:

- loopback-only authenticated Kernel APIs for owner data;
- no password/cookie/localStorage capture by Opportunity Radar;
- sensitive path/query/selection blocks;
- explicit per-site authorization;
- preference learning only from explicit feedback;
- bounded and erasable private preference state;
- credentials never returned from the Kernel to the dashboard;
- local runtime state excluded from Git.

Finds are **unverified leads**, not guarantees or professional advice. Personalized ordering never rewrites objective Evidence relevance.

## Developer verification

Install the pinned workspace and run the complete gates:

```bash
pnpm install --frozen-lockfile
pnpm release:verify
pnpm typecheck
pnpm test
pnpm build
pnpm verify:first-run
pnpm --filter @internet-brain-os/dashboard e2e
```

`pnpm release:verify` is a machine-checkable MVP readiness contract. CI also enforces:

- frozen-lockfile install;
- unfiltered `pnpm audit --prod`;
- TypeScript typecheck;
- full Vitest suite;
- production build;
- first-run Hermes/replay/Replay Lab verification;
- dedicated Chromium/Playwright dashboard acceptance.

The supply-chain gate locks patched `nanoid@3.3.18`; no GHSA audit ignore is permitted.

## Hermes forensics demo

For development/forensic verification:

```bash
pnpm hermes:validate-agent examples/hermes-agent-run-output.sample.json
pnpm hermes:validate-agent --native-jsonl examples/hermes-native-log.sample.jsonl
pnpm hermes:smoke
pnpm hermes:attack-smoke
pnpm replay-lab:api-smoke
```

These checks exercise validation, signed local ingestion, exact replay, altered-replay blocking and Replay Lab visibility without granting fixtures durable-memory authority.

## Architecture

```text
USER GOALS
    │
    ▼
Proposed Plan
    │
    ▼
Capability + Risk + Approval Gates
    │
    ▼
Execution Engine ─────→ Hermes / Browser / Connectors
    │                         │
    └──────────── Evidence ←──┘
                  │
                  ▼
        Claims / Opportunities / Knowledge
                  │
                  ▼
        Controlled Memory Authority
                  │
          ┌───────┴────────┐
          ▼                ▼
   Goal Evaluation    Scheduler / Trigger
                           │
                           ▼
                      Notification
```

See `ARCHITECTURE.md` for the authoritative system boundary and `PROJECT_STATE.md` for the current verified checkpoint.

## Non-negotiable direction

Hephaestus / Efesto remains:

- local-first;
- evidence-first;
- modular and LLM-flexible;
- deny-by-default for capabilities;
- Obsidian-compatible;
- free or near-zero-cost by default;
- safe and focused on public/authorized information;
- explicit about consent for external side effects;
- incapable of allowing an agent to rewrite its own authority history.

## Deliberately outside this MVP completion claim

The current green MVP does **not** claim that every long-term idea is shipped. These remain later product choices:

- automatic purchases or irreversible financial actions;
- a broad email/calendar/commerce connector catalog;
- public Skill/agent marketplace;
- multi-tenant cloud brain or central telemetry;
- native mobile application;
- token/blockchain/social layers;
- decorative graph experiences unsupported by real Kernel data.

## Contributor recovery

Before changing the repository:

Read `CONSTITUTION.md` completely, then run:

```bash
pnpm resume
```

Then read, in order:

1. `CONSTITUTION.md` — the canonical project and authority contract
2. `PROJECT_STATE.md`
3. `AGENTS.md`
4. `ARCHITECTURE.md`
5. `ROADMAP.md`
6. the one active GitHub task/PR, if any.

`AI_CONSTITUTION.md` is retained as a historical compatibility pointer. It must not be treated as a second or conflicting constitution.

Use one bounded branch at a time. Never weaken Evidence provenance, local-first secrecy, replay protection, capability gates or Kernel authority merely to make a test pass.

## Golden rule

**Every search must make the system smarter without making the agent more authoritative than the Kernel.**
