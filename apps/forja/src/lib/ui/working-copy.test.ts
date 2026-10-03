import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { intelligenceLabel, investigationSteps, workingDetail, workingGlyph, workingHeadline } from "./working-copy.ts";
import { identityPhase, identitySteps, identityLine } from "./identity.ts";

describe("working copy", () => {
  it("names investigation from the real Kernel stage", () => {
    assert.equal(workingHeadline("investigate"), "Pensando");
    assert.equal(workingHeadline("investigate", "searching"), "Forjando");
    assert.equal(workingHeadline("investigate", "reading"), "Forjando");
    assert.equal(workingHeadline("investigate", "interpreting"), "Comprobando");
    assert.equal(workingHeadline("investigate", "complete"), "Investigación incompleta");
    assert.equal(workingHeadline("investigate", "blocked"), "Investigación incompleta");
    assert.equal(workingHeadline("investigate", "failed"), "Investigación incompleta");
    assert.equal(workingHeadline("investigate", "searching", true), "Completado");
    assert.equal(workingHeadline("investigate", "complete", true), "Completado");
    assert.equal(workingDetail("investigate", "searching"), "Investigando fuentes públicas");
    assert.equal(workingDetail("investigate", "reading"), "Verificando evidencia");
    assert.equal(workingDetail("investigate", "verifying"), "Comprobando contradicciones");
    assert.equal(workingDetail("investigate", "interpreting"), "Contrastando hallazgos");
    assert.equal(workingDetail("investigate", "understood"), "Preparando el resultado");
  });

  it("does not claim a web search during private chat", () => {
    assert.equal(workingHeadline("chat"), "Pensando");
    assert.equal(workingHeadline("chat", "searching"), "Pensando");
    assert.equal(workingHeadline("chat", "complete", true), "Pensando");
    assert.match(workingDetail("chat", "searching", "Grok 4.5"), /Grok 4\.5 responde/);
    assert.doesNotMatch(workingDetail("chat", "searching"), /fuentes|evidencia recuper|Investigando/);
  });

  it("names a reread as a reread, not a new search", () => {
    assert.equal(workingHeadline("reread"), "Forjando");
    assert.equal(workingHeadline("reread", "complete"), "Investigación incompleta");
    assert.equal(workingHeadline("reread", "complete", true), "Completado");
    assert.equal(workingDetail("reread", "reading"), "Releyendo fuentes admitidas…");
    assert.equal(workingDetail("reread", "interpreting"), "Contrastando hallazgos");
  });

  it("only marks a pipeline step done when the Kernel has the artifact", () => {
    const searching = investigationSteps({
      stage: "searching",
      status: "researching",
      leadCount: 0,
      evidenceCount: 0,
      findingCount: 0,
      contradictionCount: 0,
      sealed: false,
    });
    assert.equal(searching.steps.find((s) => s.id === "search")?.state, "active");
    assert.equal(searching.steps.find((s) => s.id === "read")?.state, "pending");
    assert.equal(searching.steps.find((s) => s.id === "contradict")?.state, "pending");
    assert.equal(searching.steps.find((s) => s.id === "learn")?.state, "pending");
    assert.equal(searching.steps.find((s) => s.id === "support")?.state, "pending");
    assert.equal(searching.steps.find((s) => s.id === "complete")?.state, "pending");
    assert.equal(searching.summary, undefined);

    const reading = investigationSteps({
      stage: "reading",
      status: "researching",
      leadCount: 3,
      evidenceCount: 1,
      findingCount: 0,
      contradictionCount: 0,
      sealed: false,
    });
    assert.equal(reading.steps.find((s) => s.id === "search")?.state, "done");
    assert.equal(reading.steps.find((s) => s.id === "read")?.state, "done");
    assert.equal(reading.steps.find((s) => s.id === "interpret")?.state, "pending");
    assert.equal(reading.steps.find((s) => s.id === "contradict")?.state, "pending");
    assert.equal(reading.steps.find((s) => s.id === "support")?.state, "pending");

    const interpreted = investigationSteps({
      stage: "interpreting",
      status: "researching",
      leadCount: 8,
      evidenceCount: 4,
      findingCount: 1,
      contradictionCount: 0,
      confidenceCount: 0,
      sealed: false,
    });
    assert.equal(interpreted.steps.find((s) => s.id === "interpret")?.state, "done");
    assert.equal(interpreted.steps.find((s) => s.id === "contradict")?.state, "done");
    assert.equal(interpreted.steps.find((s) => s.id === "support")?.state, "active");

    const sealed = investigationSteps({
      stage: "complete",
      status: "complete",
      leadCount: 8,
      evidenceCount: 6,
      findingCount: 4,
      contradictionCount: 1,
      confidenceCount: 4,
      learningCount: 1,
      sealed: true,
    });
    assert.equal(sealed.steps.every((s) => s.state === "done"), true);
    assert.equal(sealed.steps.map((s) => s.id).join(","), "search,read,interpret,contradict,support,case,learn,complete");
    assert.equal(sealed.summary, "8 fuentes · 6 evidencias · 4 hallazgos · 1 contradicción");
  });

  it("shows contradiction and learning checks as Kernel operations, not invented artifacts", () => {
    const done = investigationSteps({
      stage: "complete",
      status: "complete",
      leadCount: 4,
      evidenceCount: 4,
      findingCount: 1,
      contradictionCount: 0,
      confidenceCount: 1,
      learningCount: 0,
      sealed: true,
    });
    assert.equal(done.steps.find((s) => s.id === "contradict")?.state, "done");
    assert.equal(done.steps.find((s) => s.id === "learn")?.state, "done");
    assert.equal(done.steps.find((s) => s.id === "support")?.state, "done");
    assert.equal(done.steps.find((s) => s.id === "complete")?.state, "done");
    assert.match(done.summary ?? "", /0 contradicciones/);
  });

  it("never treats chat thinking as an investigation pipeline", () => {
    const idle = investigationSteps({
      stage: "understood",
      status: "researching",
      leadCount: 0,
      evidenceCount: 0,
      findingCount: 0,
      contradictionCount: 0,
      sealed: false,
    });
    assert.equal(idle.steps.every((s) => s.id !== "search" || s.state === "active"), true);
    assert.equal(workingHeadline("chat", "searching"), "Pensando");
  });

  it("maps each pipeline stage to a distinct CSS glyph", () => {
    const searching = investigationSteps({
      stage: "searching",
      status: "researching",
      leadCount: 0,
      evidenceCount: 0,
      findingCount: 0,
      contradictionCount: 0,
      sealed: false,
    });
    const reading = investigationSteps({
      stage: "reading",
      status: "researching",
      leadCount: 3,
      evidenceCount: 0,
      findingCount: 0,
      contradictionCount: 0,
      sealed: false,
    });
    const interpreting = investigationSteps({
      stage: "interpreting",
      status: "researching",
      leadCount: 3,
      evidenceCount: 2,
      findingCount: 0,
      contradictionCount: 0,
      sealed: false,
    });
    const supporting = investigationSteps({
      stage: "interpreting",
      status: "researching",
      leadCount: 8,
      evidenceCount: 4,
      findingCount: 1,
      contradictionCount: 0,
      confidenceCount: 0,
      sealed: false,
    });
    assert.equal(workingGlyph("chat"), "thinking");
    assert.equal(workingGlyph("investigate", "searching", searching.steps), "searching");
    assert.equal(workingGlyph("investigate", "reading", reading.steps), "discovering");
    assert.equal(workingGlyph("investigate", "interpreting", interpreting.steps), "analyzing");
    assert.equal(workingGlyph("investigate", "interpreting", supporting.steps), "evidence");
    assert.equal(workingGlyph("investigate", "blocked"), "error");
    assert.equal(workingGlyph("investigate", "complete", undefined, true), "completed");
    assert.equal(intelligenceLabel("searching"), "Buscando");
    assert.equal(intelligenceLabel("analyzing"), "Analizando");
    assert.notEqual(
      workingGlyph("investigate", "searching", searching.steps),
      workingGlyph("investigate", "reading", reading.steps),
    );
    const names = [
      workingGlyph("chat"),
      workingGlyph("investigate", "searching", searching.steps),
      workingGlyph("investigate", "reading", reading.steps),
      workingGlyph("investigate", "interpreting", interpreting.steps),
      workingGlyph("investigate", "interpreting", supporting.steps),
      workingGlyph("investigate", "blocked"),
      workingGlyph("investigate", "complete", undefined, true),
    ];
    assert.equal(new Set(names).size, names.length);
  });

  it("groups Kernel stages into five identity states without inventing Completado", () => {
    const forging = identitySteps({
      stage: "searching",
      status: "researching",
      leadCount: 0,
      evidenceCount: 0,
      findingCount: 0,
      sealed: false,
    });
    assert.equal(forging.phase, "forging");
    assert.equal(forging.steps.map((s) => s.id).join(","), "thinking,forging,checking,sealing,completed");
    assert.equal(forging.steps.find((s) => s.id === "completed")?.state, "pending");
    assert.equal(identityPhase({ kind: "investigate", stage: "searching" }), "forging");
    assert.equal(identityLine({ kind: "investigate", stage: "searching" }), "Investigando fuentes públicas");
    const sealed = identitySteps({
      stage: "complete",
      status: "complete",
      leadCount: 4,
      evidenceCount: 3,
      findingCount: 2,
      sealed: true,
    });
    assert.equal(sealed.phase, "completed");
    assert.equal(sealed.steps.every((s) => s.state === "done"), true);
    const failed = identitySteps({
      stage: "blocked",
      status: "blocked",
      leadCount: 0,
      evidenceCount: 0,
      findingCount: 0,
      sealed: false,
    });
    assert.equal(failed.phase, "incomplete");
    assert.equal(failed.steps.find((s) => s.id === "completed")?.state, "pending");
  });
});
