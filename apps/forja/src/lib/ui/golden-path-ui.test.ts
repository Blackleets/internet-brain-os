import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { GOLDEN_PATH, MEMORY_UNAVAILABLE } from "./golden-path.ts";
import { IDENTITY_LABEL } from "./identity.ts";
import { STATUS_LABELS } from "./status-tone.ts";

function src(rel: string) {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

describe("golden path UI contract", () => {
  const shell = src("../../components/app-shell.tsx");
  const palette = src("../../components/command-palette.tsx");
  const composer = src("../../components/goal-composer.tsx");
  const home = src("../../routes/index.tsx");
  const goals = src("../../routes/goals.index.tsx");
  const goalPage = src("../../routes/goals.$goalId.tsx");
  const memory = src("../../routes/memory.tsx");
  const finding = src("../../components/finding-card.tsx");
  const forgeTrace = src("../../components/forge-trace.tsx");
  const firstUse = src("./first-use.ts");

  it("keeps the Goal-first Spanish nav", () => {
    for (const label of ["Inicio", "Objetivos", "Hallazgos", "Evidencia", "Memoria", "Actividad", "Ajustes"]) {
      assert.match(shell, new RegExp(`label: "${label}"`));
      assert.match(palette, new RegExp(`label: "${label}"`));
    }
    assert.match(home, /Pregunta lo que tendrías que poder demostrar/);
    assert.match(composer, /¿Qué estás buscando\?/);
    assert.match(goals, /title="Objetivos"/);
  });

  it("requires human prepare then confirm before the Kernel searches", () => {
    assert.match(composer, /prepareGoal/);
    assert.match(composer, /Preparar Goal/);
    assert.match(composer, /Confirmar y forjar/);
    assert.match(composer, /data-goal-prepared/);
    assert.match(composer, /createGoal\(prepared\)/);
    const prepareAt = composer.indexOf("function prepare(");
    const confirmAt = composer.indexOf("async function confirm(");
    assert.ok(prepareAt >= 0 && confirmAt > prepareAt);
    assert.equal(composer.slice(prepareAt, confirmAt).includes("createGoal"), false);
    assert.match(firstUse, /Prepara el Goal y confirma/);
    assert.match(firstUse, /Preparar no busca/);
    assert.deepEqual([...GOLDEN_PATH], [
      "Pregunta",
      "Goal",
      "Preparar",
      "Confirmar",
      "Forjar",
      "Evidencia",
      "Hallazgos",
      "Case",
    ]);
  });

  it("makes Case the result and keeps findings as unverified leads until evidence", () => {
    assert.match(goalPage, /CaseViewCard/);
    assert.match(goalPage, /buildCaseView/);
    assert.match(finding, /findingIsUnverifiedLead/);
    assert.match(finding, /Lead no verificado/);
    assert.equal(STATUS_LABELS.unverified, "Lead no verificado");
    assert.match(forgeTrace, /identitySteps/);
    assert.match(forgeTrace, /data-identity-rail/);
    assert.equal(IDENTITY_LABEL.forging, "Forjando");
    assert.equal(IDENTITY_LABEL.completed, "Completado");
  });

  it("never dresses chat as memory and does not approve a public launch", () => {
    assert.match(memory, /MEMORY_UNAVAILABLE/);
    assert.equal(MEMORY_UNAVAILABLE.title, "Memoria no disponible");
    const blob = [shell, composer, home, goalPage, memory, finding, firstUse].join("\n");
    assert.doesNotMatch(blob, /publicLaunchApproved\s*[:=]\s*true/);
  });
});
