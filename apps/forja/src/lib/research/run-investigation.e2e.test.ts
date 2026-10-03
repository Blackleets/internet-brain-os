import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { useKernel } from "../kernel/store.ts";
import { itIsolated as itSerial } from "../kernel/test-isolate.ts";
import { kernelFingerprint, replaySeal } from "../kernel/replay.ts";
import { latestConfidence } from "../kernel/confidence.ts";
import { isAdmittedMemory } from "../kernel/authority.ts";
import { responseAsMemory, chatAsMemory, AI_BOUNDARIES } from "../ai/boundaries.ts";
import { useAI } from "../ai/store.ts";
import { latestInterpretation, interpretationForFinding } from "../ai/observe.ts";
import { runInvestigation } from "./run-investigation.ts";
import type { AISelection } from "../ai/types.ts";
import type { PublicReadResult, ResearchIO } from "./io.ts";

const AT = "2026-08-29T12:00:00.000Z";
const SECRET = "sk-secret-test-key-1234567890";

function mockIO(opts?: {
  selectionProbe?: AISelection[];
  findingsAvailable?: boolean;
}): ResearchIO & { selections: AISelection[] } {
  const selections: AISelection[] = opts?.selectionProbe ?? [];
  return {
    selections,
    searchPublicWeb: async () => ({
      ok: true,
      provider: "test",
      hits: [
        {
          title: "Taladro 20 EUR",
          url: "https://example.com/drill",
          snippet: "Ficha pública del taladro.",
          sourceHost: "example.com",
        },
      ],
    }),
    readPublicWeb: async ({ data }): Promise<PublicReadResult> => ({
      ok: true,
      url: data.url,
      title: "Taladro 20 EUR",
      sourceHost: "example.com",
      excerpt:
        "El taladro percutor se ofrece a 20 EUR en la ficha pública de ferretería. Stock visible. No es un anuncio privado.",
      contentHash: "hash-drill-20-public-observation",
      httpStatus: 200,
      bytes: 140,
      retrievedAt: AT,
    }),
    interpretEvidence: async ({ data }) => {
      if (data.selection) selections.push(data.selection);
      const invocation = {
        provider: data.selection?.provider ?? "xai",
        model: data.selection?.model ?? "grok-4.5",
        operation: "interpret" as const,
        at: AT,
        latencyMs: 9,
      };
      if (opts?.findingsAvailable === false) {
        return {
          ok: true as const,
          available: false as const,
          reason: "Sin clave para este proveedor.",
          invocation,
        };
      }
      return {
        ok: true as const,
        available: true as const,
        invocation,
        findings: [
          {
            title: "Precio observado",
            answer: "La ficha pública ofrece el taladro a 20 EUR.",
            whyItMatters: "Es un hecho recuperado, no una invención del modelo.",
            confidence: "medium" as const,
            evidenceIndexes: [0],
            uncertainties: ["Puede cambiar en relectura."],
            nextAction: "Decidir si merece memoria.",
            memoryRelation: "novel" as const,
          },
        ],
      };
    },
  };
}

describe("investigación end-to-end", { concurrency: false }, () => {
  itSerial("flujo: investigación → evidencia → IA → hallazgo → caso → memoria → confidence → activity → replay", async () => {
    useAI.getState().select("openai", "gpt-4o");
    useAI.getState().setKey("openai", SECRET);
    const io = mockIO();
    const goal = useKernel.getState().createGoal("Taladro 18-25 EUR");
    const result = await runInvestigation(goal.id, goal.text, io);
    assert.equal(result.status, "complete");

    const live = useKernel.getState();
    assert.equal(io.selections.length, 1);
    assert.equal(io.selections[0]?.provider, "openai");
    assert.equal(io.selections[0]?.model, "gpt-4o");
    assert.equal(io.selections[0]?.apiKey, SECRET);

    const evidence = live.evidence.filter((item) => item.goalId === goal.id);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0]?.url, "https://example.com/drill");
    assert.equal(evidence[0]?.validation, "retrieved");

    const findings = live.findings.filter((item) => item.goalId === goal.id);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.interpretationAvailable, true);
    assert.ok(findings[0]?.evidenceIds.includes(evidence[0]!.id));

    const seals = live.dossiers.filter((item) => item.goalId === goal.id);
    assert.equal(seals.length, 1);
    const seal = seals[0]!;
    assert.ok(seal.findingIds.includes(findings[0]!.id));
    assert.ok(seal.evidenceIds.includes(evidence[0]!.id));

    const support = latestConfidence(live.confidence, findings[0]!.id);
    assert.ok(support);
    assert.equal(support.findingId, findings[0]!.id);

    const ai = latestInterpretation(live.activity, goal.id);
    assert.ok(ai);
    assert.equal(ai.ok, true);
    assert.equal(ai.ai.provider, "openai");
    assert.equal(ai.ai.model, "gpt-4o");
    const bound = interpretationForFinding(live.activity, findings[0]!);
    assert.ok(bound);
    assert.equal(bound.ai.provider, "openai");
    assert.equal(bound.ai.model, "gpt-4o");
    assert.equal(JSON.stringify(live.activity).includes(SECRET), false);

    assert.equal(live.memory.length, 0);
    assert.equal(responseAsMemory(findings[0]!.answer).ok, false);
    assert.equal(AI_BOUNDARIES.mayAdmitMemory, false);

    const admitted = useKernel.getState().admitFindingToMemory(findings[0]!.id, "Lo retenemos porque la ficha es pública.");
    assert.equal(admitted.ok, true);
    const afterMemory = useKernel.getState();
    const memory = afterMemory.memory.filter((item) => isAdmittedMemory(item));
    assert.equal(memory.length, 1);
    assert.ok(afterMemory.activity.some((item) => item.kind === "memory.admitted"));
    assert.ok(afterMemory.activity.some((item) => item.kind === "confidence.evaluated"));
    assert.ok(afterMemory.activity.some((item) => item.kind === "dossier.sealed"));

    const replay = replaySeal(useKernel.getState(), seal.id);
    assert.equal(replay.status, "complete");
    assert.ok(replay.findings.some((item) => item.id === findings[0]!.id));
    assert.ok(replay.evidence.some((item) => item.id === evidence[0]!.id));
    assert.equal(
      replay.memory.some((item) => item.memoryId === memory[0]!.id),
      false,
      "Replay del sello no debe incluir memoria admitida después",
    );
  });

  itSerial("cambiar de modelo no altera evidencia, hallazgos ni memoria", async () => {
    useAI.getState().select("openai", "gpt-4o");
    const io = mockIO();
    const goal = useKernel.getState().createGoal("Taladro 18-25 EUR");
    await runInvestigation(goal.id, goal.text, io);
    const before = kernelFingerprint(useKernel.getState());
    const evidenceN = useKernel.getState().evidence.length;
    useAI.getState().select("openrouter", "anthropic/claude-sonnet-4");
    useAI.getState().select("anthropic", "claude-sonnet-4-20250514");
    assert.equal(kernelFingerprint(useKernel.getState()), before);
    assert.equal(useKernel.getState().evidence.length, evidenceN);
  });

  itSerial("OpenRouter y otro proveedor llegan por la misma abstracción de interpretación", async () => {
    const io = mockIO();
    useAI.getState().select("openrouter", "anthropic/claude-sonnet-4");
    const first = useKernel.getState().createGoal("Taladro OpenRouter");
    await runInvestigation(first.id, first.text, io);

    useAI.getState().select("xai", "grok-4.5");
    const second = useKernel.getState().createGoal("Taladro xAI");
    await runInvestigation(second.id, second.text, io);

    assert.equal(io.selections[0]?.provider, "openrouter");
    assert.equal(io.selections[1]?.provider, "xai");
    const events = useKernel.getState().activity.filter((item) => item.kind === "ai.completed");
    assert.ok(events.some((item) => item.ai?.provider === "openrouter"));
    assert.ok(events.some((item) => item.ai?.provider === "xai"));
  });

  itSerial("sin modelo la evidencia se retiene y no entra memoria", async () => {
    useAI.getState().select("openai", "gpt-4o");
    const io = mockIO({ findingsAvailable: false });
    const goal = useKernel.getState().createGoal("Taladro sin clave");
    const result = await runInvestigation(goal.id, goal.text, io);
    assert.equal(result.status, "complete");
    const live = useKernel.getState();
    assert.equal(live.evidence.length, 1);
    const finding = live.findings[0];
    assert.ok(finding);
    assert.equal(finding.interpretationAvailable, false);
    assert.match(finding.answer, /no estuvo disponible/i);
    assert.match(finding.uncertainties.join(" "), /clave|proveedor/i);
    assert.equal(live.memory.length, 0);
    const ai = latestInterpretation(live.activity, goal.id);
    assert.ok(ai);
    assert.equal(ai.ok, false);
    assert.equal(chatAsMemory("recuerda el precio").ok, false);
  });

  itSerial("páginas HTTP 200 irrelevantes no sellan ni marcan Completado", async () => {
    const io: ResearchIO = {
      searchPublicWeb: async () => ({
        ok: true,
        provider: "test",
        hits: [
          {
            title: "JSON Web Token",
            url: "https://www.jwt.io/",
            snippet: "JWT standard.",
            sourceHost: "jwt.io",
          },
        ],
      }),
      readPublicWeb: async ({ data }): Promise<PublicReadResult> => ({
        ok: true,
        url: data.url,
        title: "JWT",
        sourceHost: "jwt.io",
        excerpt: "JSON Web Tokens are an open industry standard used to sign tokens. HTTP 200.",
        contentHash: "hashjwtirrelevantpage12",
        httpStatus: 200,
        bytes: 90,
        retrievedAt: AT,
      }),
      interpretEvidence: async () => ({
        ok: true as const,
        available: true as const,
        findings: [
          {
            title: "El token no aparece",
            answer: "Ningún extracto incluye el identificador buscado. Completado.",
            whyItMatters: "El modelo no admite.",
            confidence: "high" as const,
            evidenceIndexes: [0],
            uncertainties: [],
            nextAction: "Nada",
          },
        ],
      }),
    };
    const goal = useKernel.getState().createGoal(
      "xqzplmn-efesto-noindex-9f3k2j0d token único que no debe existir en la web pública",
    );
    const result = await runInvestigation(goal.id, goal.text, io);
    assert.equal(result.status, "blocked");
    const live = useKernel.getState();
    const stored = live.goals.find((item) => item.id === goal.id);
    assert.equal(stored?.stage, "blocked");
    assert.equal(stored?.status, "blocked");
    assert.equal(live.dossiers.filter((item) => item.goalId === goal.id).length, 0);
    assert.equal(live.evidence.filter((item) => item.goalId === goal.id).length, 1);
    assert.match(stored?.blockedReason ?? "", /Investigación incompleta/);
    assert.doesNotMatch(stored?.blockedReason ?? "", /^Completado$/);
  });

  it("un hallazgo conserva el modelo que lo interpretó, no uno posterior", () => {
    const goalId = "g_attr";
    const activity = [
      {
        id: "a3",
        at: "2026-08-29T12:00:03.000Z",
        kind: "finding.admitted" as const,
        actor: "kernel" as const,
        source: "admission" as const,
        summary: "Hallazgo 2",
        correlationId: goalId,
        goalId,
        findingId: "f2",
      },
      {
        id: "a2",
        at: "2026-08-29T12:00:02.000Z",
        kind: "ai.completed" as const,
        actor: "kernel" as const,
        source: "ai" as const,
        summary: "Modelo xai/grok-4.5 · interpret",
        correlationId: goalId,
        goalId,
        ai: { provider: "xai", model: "grok-4.5", operation: "interpret" },
      },
      {
        id: "a1",
        at: "2026-08-29T12:00:01.000Z",
        kind: "finding.admitted" as const,
        actor: "kernel" as const,
        source: "admission" as const,
        summary: "Hallazgo 1",
        correlationId: goalId,
        goalId,
        findingId: "f1",
      },
      {
        id: "a0",
        at: "2026-08-29T12:00:00.000Z",
        kind: "ai.completed" as const,
        actor: "kernel" as const,
        source: "ai" as const,
        summary: "Modelo openai/gpt-4o · interpret",
        correlationId: goalId,
        goalId,
        ai: { provider: "openai", model: "gpt-4o", operation: "interpret" },
      },
    ];
    const first = interpretationForFinding(activity, {
      id: "f1",
      goalId,
      createdAt: "2026-08-29T12:00:01.000Z",
    });
    const later = interpretationForFinding(activity, {
      id: "f2",
      goalId,
      createdAt: "2026-08-29T12:00:03.000Z",
    });
    assert.equal(first?.ai.provider, "openai");
    assert.equal(first?.ai.model, "gpt-4o");
    assert.equal(later?.ai.provider, "xai");
    assert.equal(later?.ai.model, "grok-4.5");
    assert.equal(latestInterpretation(activity, goalId)?.ai.provider, "xai");
  });

  it("binds an interpretation that shares the millisecond with admission", () => {
    const goalId = "g_same_ms";
    const at = "2026-08-29T12:00:00.000Z";
    const activity = [
      {
        id: "a1",
        at,
        kind: "finding.admitted" as const,
        actor: "kernel" as const,
        source: "admission" as const,
        summary: "Hallazgo",
        correlationId: goalId,
        goalId,
        findingId: "f1",
      },
      {
        id: "z9",
        at,
        kind: "ai.completed" as const,
        actor: "kernel" as const,
        source: "ai" as const,
        summary: "Modelo openai/gpt-4o · interpret",
        correlationId: goalId,
        goalId,
        ai: { provider: "openai" as const, model: "gpt-4o", operation: "interpret" as const },
      },
    ];
    const bound = interpretationForFinding(activity, { id: "f1", goalId, createdAt: at });
    assert.equal(bound?.ai.provider, "openai");
    assert.equal(bound?.ai.model, "gpt-4o");
  });
});
