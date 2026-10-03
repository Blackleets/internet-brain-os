import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeDossier } from "./dossier.ts";
import { admittedMemory } from "./authority.ts";
import { latestConfidence } from "./confidence.ts";
import { eventsForCorrelation } from "./observability.ts";
import { useKernel } from "./store.ts";
import { withIsolatedKernel } from "./test-isolate.ts";
import type { Evidence, Finding } from "./types.ts";

describe("audit end-to-end", { concurrency: false }, () => {
  it("Replay(S1) reconstructs only historical state after later close, V2 and S2", async () => {
    await withIsolatedKernel(async () => {
      const kernel = useKernel.getState();

      const g0 = kernel.createGoal("Taladro Bosch de 20 euros, ficha ya contrastada");
      const e0: Evidence = {
        id: `e_${g0.id}`,
        goalId: g0.id,
        url: "https://example.com/bosch",
        title: "Taladro Bosch 20 EUR",
        sourceHost: "example.com",
        excerpt: "Ficha pública: taladro Bosch alrededor de 20 euros.",
        contentHash: "hashbosch20eur1234567",
        retrievedAt: "2026-08-29T00:00:00.000Z",
        httpStatus: 200,
        bytes: 48,
        validation: "retrieved",
      };
      const f0: Finding = {
        id: `f_${g0.id}`,
        goalId: g0.id,
        title: "Precio Bosch contrastado",
        answer: "Hay un taladro Bosch a 20 EUR.",
        whyItMatters: "Precio de referencia.",
        confidence: "medium",
        evidenceIds: [e0.id],
        uncertainties: [],
        nextAction: "",
        interpretationAvailable: true,
        createdAt: e0.retrievedAt,
      };
      assert.equal(kernel.tryAdmitEvidence(e0).ok, true);
      assert.equal(kernel.tryAdmitFinding(f0).ok, true);
      assert.equal(kernel.admitFindingToMemory(f0.id, "Precio verificado en una ficha pública.").ok, true);
      const m0 = useKernel.getState().memory.find((item) => item.findingId === f0.id);
      assert.ok(m0);
      assert.equal(m0.lifecycle, "admitted");

      const g1 = useKernel.getState().createGoal("Taladro 18-25 euros en otra ficha");
      const e1: Evidence = {
        id: `e_${g1.id}`,
        goalId: g1.id,
        url: "https://shop.example.org/drill",
        title: "Taladro 80 EUR",
        sourceHost: "shop.example.org",
        excerpt: "La ficha lista el mismo taladro a 80 EUR, no a 20.",
        contentHash: "hash80eur1234567890ab",
        retrievedAt: "2026-08-29T00:10:00.000Z",
        httpStatus: 200,
        bytes: 52,
        validation: "retrieved",
      };
      const f1: Finding = {
        id: `f_${g1.id}`,
        goalId: g1.id,
        title: "Precio distinto",
        answer: "La ficha lista 80 EUR.",
        whyItMatters: "Tensiona el precio admitido.",
        confidence: "medium",
        evidenceIds: [e1.id],
        uncertainties: [],
        nextAction: "Revisar la memoria.",
        interpretationAvailable: true,
        createdAt: e1.retrievedAt,
        delta: "tension",
        deltaMemoryId: m0.id,
        deltaNote: "El extracto lista 80 EUR, no 20.",
      };
      assert.equal(useKernel.getState().tryAdmitEvidence(e1).ok, true);
      assert.equal(useKernel.getState().tryAdmitFinding(f1).ok, true);

      const afterFinding = useKernel.getState();
      const contradiction = afterFinding.contradictions.find(
        (item) => item.kind === "evidence-memory" && item.findingId === f1.id,
      );
      assert.ok(contradiction);
      assert.equal(contradiction.open, true);
      const learning = afterFinding.learning.find((item) => item.findingIds.includes(f1.id));
      assert.ok(learning);

      const goal1 = afterFinding.goals.find((item) => item.id === g1.id);
      assert.ok(goal1);
      const s1 = await composeDossier({
        goal: goal1,
        findings: [f1],
        evidence: [e1],
        related: [{ memory: m0, score: 0.55, overlap: 3 }],
      });
      assert.ok(s1);
      assert.equal(useKernel.getState().sealDossier(s1).ok, true);
      const sealed = useKernel.getState().dossiers.find((item) => item.sealHash === s1.sealHash);
      assert.ok(sealed);

      const v1 = latestConfidence(useKernel.getState().confidence, f1.id);
      assert.ok(v1);
      assert.equal(v1.reasons.some((item) => item.kind === "live-memory-support"), true);

      useKernel.getState().forgetMemory(m0.id);
      const afterForget = useKernel.getState();
      const closed = afterForget.contradictions.find((item) => item.id === contradiction.id);
      assert.equal(closed?.open, false);
      assert.ok(closed?.closedAt);
      const v2 = latestConfidence(afterForget.confidence, f1.id);
      assert.ok(v2);
      assert.equal(v2.id === v1.id, false);
      assert.equal(v2.reasons.some((item) => item.kind === "live-memory-support"), false);
      assert.equal(admittedMemory(afterForget.memory).length, 0);

      const s2 = await composeDossier({
        goal: afterForget.goals.find((item) => item.id === g1.id)!,
        findings: afterForget.findings.filter((item) => item.goalId === g1.id),
        evidence: afterForget.evidence.filter((item) => item.goalId === g1.id),
        related: [],
      });
      assert.ok(s2);
      assert.equal(useKernel.getState().sealDossier(s2).ok, true);
      assert.equal(
        useKernel.getState().contradictions.some((item) => item.kind === "interpretation-interpretation"),
        true,
      );

      const replay = useKernel.getState().replaySeal(sealed.id);
      assert.equal(replay.status, "complete");
      const historic = replay.contradictions.find((item) => item.id === contradiction.id);
      assert.ok(historic);
      assert.equal(historic.open, true);
      assert.equal(historic.closedAt, undefined);
      assert.equal(
        replay.contradictions.some((item) => item.kind === "interpretation-interpretation"),
        false,
      );
      assert.equal(replay.confidence.length, 1);
      assert.equal(replay.confidence[0]?.id, v1.id);
      assert.equal(replay.confidence[0]?.score, v1.score);
      assert.equal(replay.memory[0]?.memoryId, m0.id);
      assert.equal(replay.memory[0]?.lifecycleAtConsult, "admitted");
      assert.equal(replay.activity.every((item) => item.at <= sealed.sealedAt), true);
      const chain = eventsForCorrelation(useKernel.getState().activity, g1.id);
      assert.equal(chain.some((item) => item.kind === "evidence.admitted"), true);
      assert.equal(chain.some((item) => item.kind === "finding.admitted"), true);
      assert.equal(chain.some((item) => item.kind === "dossier.sealed"), true);

      const rewrite = useKernel.getState().tryAdmitEvidence({
        ...e1,
        contentHash: "mutatedhash1234567890",
        excerpt: "Intento de reescritura.",
      });
      assert.equal(rewrite.ok, false);
    });
  });
});
