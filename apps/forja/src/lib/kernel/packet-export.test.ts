import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildKernelPacket, verifyKernelPacket } from "./packet.ts";
import { canonicalMatchesHash, serializePacket } from "./packet-export.ts";
import type { Evidence, Finding, Goal } from "./types.ts";

const goal: Goal = {
  id: "g1",
  text: "¿El Salvador sigue usando bitcoin como curso legal?",
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
  status: "blocked",
  stage: "blocked",
  evidenceIds: ["e1"],
  findingIds: [],
  leadCount: 0,
  leads: [],
  watched: false,
};

const evidence: Evidence = {
  id: "e1",
  goalId: "g1",
  url: "https://www.jwt.io/",
  title: "jwt.io",
  sourceHost: "jwt.io",
  excerpt: "JSON Web Tokens are an open industry standard.",
  contentHash: "deadbeefdeadbeefdead",
  retrievedAt: "2026-08-30T00:00:00.000Z",
  httpStatus: 200,
  bytes: 40,
  validation: "retrieved",
};

const finding: Finding = {
  id: "f1",
  goalId: "g1",
  title: "No cubre",
  answer: "jwt.io no cubre el Goal.",
  whyItMatters: "HTTP 200 no es soporte.",
  confidence: "low",
  evidenceIds: ["e1"],
  uncertainties: ["Fuente ajena"],
  nextAction: "",
  interpretationAvailable: true,
  createdAt: evidence.retrievedAt,
};

describe("packet export", () => {
  it("hashes the canonical body to packetHash and does not hash pretty JSON", async () => {
    const packet = await buildKernelPacket({ goal, evidence: [evidence], findings: [] });
    assert.equal(packet.incomplete, true);
    assert.equal(await canonicalMatchesHash(packet), true);
    const canonical = serializePacket(packet, "canonical");
    assert.equal(canonical.hashesToPacket, true);
    const pretty = serializePacket(packet, "pretty");
    assert.equal(pretty.hashesToPacket, false);
    assert.notEqual(pretty.text, canonical.text);
  });

  it("lets Verificar admit an envelope as the same packet", async () => {
    const packet = await buildKernelPacket({ goal, evidence: [evidence], findings: [] });
    const file = serializePacket(packet, "envelope");
    const parsed = JSON.parse(file.text);
    const verified = await verifyKernelPacket(parsed);
    assert.equal(verified.ok, true);
    if (verified.ok) assert.equal(verified.packet.packetHash, packet.packetHash);
  });

  it("does not treat a detached signature as a packet", async () => {
    const packet = await buildKernelPacket({ goal, evidence: [evidence], findings: [finding] });
    const file = serializePacket(packet, "detached");
    const verified = await verifyKernelPacket(JSON.parse(file.text));
    assert.equal(verified.ok, false);
  });
});
