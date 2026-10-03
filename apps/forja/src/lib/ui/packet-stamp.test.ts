import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { packetStamp, shortPacketHash } from "./packet-stamp.ts";
import { buildKernelPacket } from "../kernel/packet.ts";
import type { Evidence, Finding, Goal } from "../kernel/types.ts";

const goal: Goal = {
  id: "g1",
  text: "¿OpenAI es una empresa cotizada?",
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
  status: "complete",
  stage: "complete",
  evidenceIds: ["e1"],
  findingIds: ["f1"],
  leadCount: 1,
  leads: [],
  watched: false,
};

const evidence: Evidence = {
  id: "e1",
  goalId: "g1",
  url: "https://www.sec.gov/edgar",
  title: "SEC",
  sourceHost: "sec.gov",
  excerpt: "OpenAI is not listed as a public company on this filing excerpt.",
  contentHash: "abc123def4567890abcd",
  retrievedAt: "2026-08-30T00:00:00.000Z",
  httpStatus: 200,
  bytes: 80,
  validation: "retrieved",
};

const finding: Finding = {
  id: "f1",
  goalId: "g1",
  title: "No cotiza",
  answer: "Los extractos no muestran a OpenAI como empresa cotizada.",
  whyItMatters: "Distingue hecho de rumor.",
  confidence: "medium",
  evidenceIds: ["e1"],
  uncertainties: ["Una sola fuente"],
  nextAction: "Leer otra ficha oficial.",
  interpretationAvailable: true,
  createdAt: evidence.retrievedAt,
};

describe("packet stamp", () => {
  it("never presents an incomplete signed packet as Completado", async () => {
    const packet = await buildKernelPacket({ goal: { ...goal, status: "blocked", stage: "blocked" }, evidence: [evidence], findings: [] });
    const stamp = packetStamp(packet);
    assert.match(stamp.headline, /Incompleto/);
    assert.doesNotMatch(stamp.headline, /Completado|Sellado/);
    assert.equal(stamp.attested, true);
    assert.match(stamp.note, /no inventó/);
    assert.equal(shortPacketHash(packet.packetHash).includes("…"), true);
  });

  it("marks a sealed packet as firmado, not as a search result", async () => {
    const packet = await buildKernelPacket({
      goal,
      evidence: [evidence],
      findings: [finding],
      dossier: {
        id: "d1",
        goalId: "g1",
        sealedAt: evidence.retrievedAt,
        sealHash: "abc123def4567890abcd",
        executive: "No cotiza en el extracto.",
        known: [],
        memoryContextHash: "",
        novel: [],
        confirmed: [],
        tensions: [],
        uncertain: [],
        next: "",
        findingIds: ["f1"],
        evidenceIds: ["e1"],
        evidenceHashes: ["h1"],
        sourceHosts: ["sec.gov"],
        interpretationAvailable: true,
        memoryConsulted: 0,
        reusedCount: 0,
      },
    });
    const stamp = packetStamp(packet);
    assert.match(stamp.headline, /firmado/);
    assert.equal(stamp.alg, "Ed25519");
    assert.doesNotMatch(stamp.note, /buscador|search/i);
  });
});
