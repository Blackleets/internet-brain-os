import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demoIncompletePacket, demoSealedPacket } from "./demo-packets.ts";
import { verifyKernelPacket } from "./packet.ts";
import { VERIFICATION_LEVEL, verificationReport } from "./verification.ts";
import { restVerify } from "../agent/protocol.ts";

describe("verification standards", () => {
  it("does not claim a qualified eIDAS seal", () => {
    assert.equal(VERIFICATION_LEVEL.eidas, "none");
    assert.equal(VERIFICATION_LEVEL.signature, "Ed25519");
    assert.equal(VERIFICATION_LEVEL.hash, "SHA-256");
    assert.match(VERIFICATION_LEVEL.note, /no es firma cualificada eIDAS/i);
  });

  it("an incomplete demo packet passes integrity and support without Completado", async () => {
    const packet = await demoIncompletePacket();
    const verified = await verifyKernelPacket(packet);
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    const report = verificationReport({
      ok: true,
      attested: verified.attested,
      incomplete: verified.packet.incomplete,
      packet: verified.packet,
    });
    assert.equal(report.checks.find((item) => item.id === "integrity")?.state, "pass");
    assert.equal(report.checks.find((item) => item.id === "support")?.state, "pass");
    assert.match(report.checks.find((item) => item.id === "support")?.detail ?? "", /incompleta/i);
    const signature = report.checks.find((item) => item.id === "signature");
    assert.ok(signature?.state === "pass" || signature?.state === "skip");
    if (signature?.state === "pass") {
      assert.match(signature.detail, /no de un prestador cualificado/);
    }
  });

  it("a sealed demo packet still does not upgrade trust to eIDAS", async () => {
    const packet = await demoSealedPacket();
    const verified = await verifyKernelPacket(packet);
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    const report = verificationReport({
      ok: true,
      attested: verified.attested,
      incomplete: verified.packet.incomplete,
      packet: verified.packet,
    });
    assert.equal(report.level.eidas, "none");
    assert.equal(report.checks.find((item) => item.id === "support")?.state, "pass");
    assert.match(report.checks.find((item) => item.id === "support")?.detail ?? "", /sello/i);
  });

  it("rejects a chat blob at the protocol layer", async () => {
    const result = await restVerify({ product: "ChatGPT", chat: "hi" });
    assert.equal(result.ok, false);
    assert.equal(result.report.failed, "protocol");
    assert.equal(result.report.checks.find((item) => item.id === "integrity")?.state, "skip");
  });
});
