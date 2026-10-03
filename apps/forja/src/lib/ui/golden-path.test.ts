import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GOLDEN_PATH, MEMORY_UNAVAILABLE, prepareGoal } from "./golden-path.ts";

describe("golden path", () => {
  it("prepares a Goal locally without authorizing the network", () => {
    const ready = prepareGoal("Investiga esta empresa");
    assert.equal(ready.ok, true);
    if (ready.ok) assert.equal(ready.text, "Investiga esta empresa");
    const empty = prepareGoal("  ");
    assert.equal(empty.ok, false);
  });

  it("keeps the human confirmation chain intact", () => {
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

  it("never dresses chat as memory", () => {
    assert.equal(MEMORY_UNAVAILABLE.title, "Memoria no disponible");
    assert.match(MEMORY_UNAVAILABLE.body, /chat nunca/);
  });
});
