import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demoIncompletePacket, demoSealedPacket } from "./demo-packets.ts";

describe("demo packets", () => {
  it("ships an incomplete packet that is not Completado", async () => {
    const packet = await demoIncompletePacket();
    assert.equal(packet.incomplete, true);
    assert.equal(packet.seal, null);
    assert.notEqual(packet.goal.status, "complete");
  });

  it("ships a sealed packet only when the Kernel composed a dossier", async () => {
    const packet = await demoSealedPacket();
    assert.equal(packet.incomplete, false);
    assert.ok(packet.seal);
    assert.match(packet.seal?.executive ?? "", /curso legal/i);
  });
});
