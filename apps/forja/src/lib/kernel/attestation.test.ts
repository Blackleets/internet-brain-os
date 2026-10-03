import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attestPacketHash, instancePublicKey, verifyPacketAttestation } from "./attestation.ts";
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

describe("packet attestation", () => {
  it("signs a new packet with Ed25519 over the hash, not the chat", async () => {
    const packet = await buildKernelPacket({ goal, evidence: [evidence], findings: [finding] });
    assert.ok(packet.attestation);
    assert.equal(packet.attestation?.alg, "Ed25519");
    assert.equal(packet.attestation?.publicKey, await instancePublicKey());
    const verified = await verifyKernelPacket(packet);
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    assert.equal(verified.attested, true);
  });

  it("rejects a broken signature even if the hash still matches", async () => {
    const packet = await buildKernelPacket({ goal, evidence: [evidence], findings: [finding] });
    const broken = {
      ...packet,
      attestation: {
        ...packet.attestation!,
        signature: Buffer.alloc(64).toString("base64"),
      },
    };
    const verified = await verifyKernelPacket(broken);
    assert.equal(verified.ok, false);
  });

  it("still admits an unsigned v1 packet whose hash is intact", async () => {
    const packet = await buildKernelPacket({ goal, evidence: [evidence], findings: [finding] });
    const { attestation: _drop, ...unsigned } = packet;
    const verified = await verifyKernelPacket(unsigned);
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    assert.equal(verified.attested, false);
    const required = await verifyKernelPacket(unsigned, { requireAttestation: true });
    assert.equal(required.ok, false);
  });

  it("does not let attestation change the canonical hash", async () => {
    const packet = await buildKernelPacket({ goal, evidence: [evidence], findings: [finding] });
    const again = await attestPacketHash(packet.packetHash);
    assert.equal(again.publicKey, packet.attestation?.publicKey);
    const check = await verifyPacketAttestation(packet.packetHash, packet.attestation);
    assert.equal(check.ok, true);
  });
});
