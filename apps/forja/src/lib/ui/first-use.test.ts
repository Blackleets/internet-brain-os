import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { AGENT_STEPS, FIRST_USE_STEPS, HOW_YOU_KNOW, WHY_NOT_PERPLEXITY } from "./first-use.ts";

describe("first use for a person, not an operator", () => {
  it("never tells a beginner to complete a case without sources", () => {
    const blob = JSON.stringify({ FIRST_USE_STEPS, HOW_YOU_KNOW, WHY_NOT_PERPLEXITY, AGENT_STEPS });
    assert.match(blob, /Investigación incompleta/);
    assert.match(blob, /Nunca Completado/);
    assert.doesNotMatch(HOW_YOU_KNOW.join(" "), /si ves Completado/);
    assert.equal(FIRST_USE_STEPS.length, 3);
  });

  it("explains Efesto against Perplexity without becoming a search engine", () => {
    assert.match(WHY_NOT_PERPLEXITY.efesto, /sello/);
    assert.match(WHY_NOT_PERPLEXITY.choose, /demostrar/);
    assert.doesNotMatch(WHY_NOT_PERPLEXITY.efesto, /mejor buscador|más rápido/i);
  });

  it("tells a Hermes user how they know the agent is actually using Efesto", () => {
    const hermes = AGENT_STEPS.hermes.join(" ");
    assert.match(hermes, /MCP/);
    assert.match(hermes, /incompleto|huella/);
    assert.match(hermes, /no puede declarar Completado/i);
  });

  it("puts the same words on the uso and agentes pages", () => {
    const uso = readFileSync(fileURLToPath(new URL("../../routes/uso.tsx", import.meta.url)), "utf8");
    const agentes = readFileSync(fileURLToPath(new URL("../../routes/agentes.tsx", import.meta.url)), "utf8");
    assert.match(uso, /FIRST_USE_STEPS/);
    assert.match(uso, /WHY_NOT_PERPLEXITY/);
    assert.match(agentes, /AGENT_STEPS/);
    assert.match(agentes, /Si no tienes un agente/);
  });
});
