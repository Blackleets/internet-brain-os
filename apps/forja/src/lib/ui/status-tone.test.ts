import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { statusPulses, statusTone, STATUS_LABELS, type StatusKind } from "./status-tone.ts";

describe("status tone", () => {
  it("treats admitted, complete and sealed as confirmed", () => {
    for (const kind of ["admitted", "complete", "sealed", "confirmed", "retrieved", "vigente", "high"] as StatusKind[]) {
      assert.equal(statusTone(kind), "ok", kind);
    }
  });

  it("treats process and pending decisions as caution, not error", () => {
    for (const kind of [
      "researching",
      "watched",
      "proposed",
      "quarantined",
      "tension",
      "changed",
      "ready",
      "missing",
      "low",
    ] as StatusKind[]) {
      assert.equal(statusTone(kind), "warn", kind);
    }
  });

  it("reserves red for real failure, block, reject and revoke", () => {
    for (const kind of ["blocked", "rejected", "failed", "revoked"] as StatusKind[]) {
      assert.equal(statusTone(kind), "err", kind);
    }
  });

  it("does not pulse settled warnings or errors", () => {
    assert.equal(statusPulses("researching"), true);
    assert.equal(statusPulses("tension"), false);
    assert.equal(statusPulses("failed"), false);
    assert.equal(statusPulses("missing"), false);
    assert.equal(statusPulses("blocked"), false);
  });

  it("covers every label", () => {
    for (const kind of Object.keys(STATUS_LABELS) as StatusKind[]) {
      assert.ok(statusTone(kind));
    }
  });
});
