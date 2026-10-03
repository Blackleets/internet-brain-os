import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildKernelPacket, verifyKernelPacket } from "./packet.ts";
import type { Evidence, Finding, Goal } from "./types.ts";

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

describe("kernel packet", () => {
  it("builds a verifiable packet and refuses chat, keys, and invented evidence", async () => {
    const packet = await buildKernelPacket({ goal, evidence: [evidence], findings: [finding] });
    assert.equal(packet.product, "Efesto");
    assert.equal(packet.contract.modelAdmits, false);
    const ok = await verifyKernelPacket(packet);
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.attested, true);
    assert.equal(packet.attestation?.alg, "Ed25519");

    const tampered = { ...packet, packetHash: packet.packetHash.replace(/a/g, "b") };
    const badHash = await verifyKernelPacket(tampered);
    assert.equal(badHash.ok, false);

    const withKey = await verifyKernelPacket({ ...packet, apiKey: "sk-secret" });
    assert.equal(withKey.ok, false);

    const http = await verifyKernelPacket({
      ...packet,
      evidence: [{ ...packet.evidence[0], url: "http://example.com/x" }],
    });
    assert.equal(http.ok, false);
  });

  it("rejects a finding that does not cite admitted evidence", async () => {
    const packet = await buildKernelPacket({ goal, evidence: [evidence], findings: [finding] });
    const orphan = await verifyKernelPacket({
      ...packet,
      findings: [{ ...packet.findings[0], evidenceIds: ["missing"] }],
    });
    assert.equal(orphan.ok, false);
  });
});
