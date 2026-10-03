import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretationVoice, splitLabeledAnswer } from "./finding-voice.ts";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("finding voice", () => {
  it("keeps a clean interpretation untouched", () => {
    const text = "Bitcoin es dinero electrónico entre pares, según el extracto.";
    assert.equal(interpretationVoice(text), text);
    assert.deepEqual(splitLabeledAnswer(text).extraUncertainties, []);
  });

  it("does not present observed dumps or forecasts as the interpretation", () => {
    const dumped = `DATOS OBSERVADOS: El extracto cita un precio de 0,08 USD en 2010.
ANÁLISIS: Los extractos describen un activo volátil; no determinan 2026.
ESCENARIOS: Podría subir o bajar.
INCERTIDUMBRE: No hay serie completa 2010-2026 en las fuentes retenidas.`;
    const split = splitLabeledAnswer(dumped);
    assert.equal(split.interpretation.includes("0,08"), false);
    assert.match(split.interpretation, /volátil/);
    assert.doesNotMatch(split.interpretation, /DATOS OBSERVADOS|ANÁLISIS/);
    assert.ok(split.extraUncertainties.some((item) => /2010-2026|serie/.test(item)));
  });

  it("forbids the interpret prompt from asking the model to dump DATOS OBSERVADOS into answer", () => {
    const src = readFileSync(fileURLToPath(new URL("../research/functions.ts", import.meta.url)), "utf8");
    assert.match(src, /NO escribas las etiquetas DATOS OBSERVADOS/);
    assert.match(src, /answer es SOLO la interpretación/);
    assert.doesNotMatch(
      src,
      /Separa con claridad DATOS OBSERVADOS, MÉTRICAS, ANÁLISIS, ESCENARIOS e INCERTIDUMBRE\. Nunca presentes una predicción como hecho\. Responde JSON/,
    );
  });
});
