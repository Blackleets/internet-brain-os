import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { identityLabel, identityLine, identityPhase, identitySteps } from "./identity.ts";

describe("identity phases", () => {
  it("never shows Completado while the Kernel is still searching", () => {
    assert.equal(identityPhase({ kind: "investigate", stage: "searching" }), "forging");
    assert.equal(identityLabel("forging"), "Forjando");
    assert.equal(identityLine({ kind: "investigate", stage: "searching" }), "Investigando fuentes públicas");
    assert.equal(identityLine({ kind: "investigate", stage: "reading" }), "Verificando evidencia");
    assert.equal(identityLine({ kind: "investigate", stage: "interpreting" }), "Contrastando hallazgos");
    assert.equal(identityLine({ kind: "investigate", stage: "verifying" }), "Comprobando contradicciones");
    assert.equal(identityLine({ kind: "investigate", stage: "understood" }), "Preparando el resultado");
  });

  it("keeps Completado behind a real seal", () => {
    const open = identitySteps({
      stage: "interpreting",
      status: "researching",
      leadCount: 4,
      evidenceCount: 2,
      findingCount: 1,
      sealed: false,
    });
    assert.equal(open.phase, "checking");
    assert.equal(open.steps.find((s) => s.id === "completed")?.state, "pending");
    const sealed = identitySteps({
      stage: "complete",
      status: "complete",
      leadCount: 4,
      evidenceCount: 2,
      findingCount: 1,
      sealed: true,
    });
    assert.equal(sealed.phase, "completed");
    const unsealed = identitySteps({
      stage: "complete",
      status: "complete",
      leadCount: 4,
      evidenceCount: 2,
      findingCount: 1,
      sealed: false,
    });
    assert.equal(unsealed.phase, "incomplete");
    assert.equal(unsealed.steps.find((s) => s.id === "completed")?.state, "pending");
  });
});
