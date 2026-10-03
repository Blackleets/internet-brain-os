import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { grokConnector, hermesConnector, openClawConnector, openApiSpec } from "./connectors.ts";

describe("connector surface", () => {
  it("does not present Efesto as a search API", () => {
    const spec = openApiSpec("https://kernel.example");
    assert.doesNotMatch(JSON.stringify(spec), /web search api/i);
    assert.match(spec.info.description, /incomplete packet must never be reported as completed/i);
    assert.equal(spec["x-efesto"].note.includes("buscador"), true);
  });

  it("gives Grok OpenAPI, Hermes MCP HTTP, and OpenClaw a skill URL", () => {
    const grok = grokConnector("https://kernel.example");
    const hermes = hermesConnector("https://kernel.example");
    const claw = openClawConnector("https://kernel.example");
    assert.match(grok.openapiUrl, /\/api\/agent\/openapi$/);
    assert.equal(hermes.mcp.mcp.efesto.url, "https://kernel.example/api/agent");
    assert.match(claw.skillUrl ?? "", /\/api\/agent\/skill$/);
    const spec = openApiSpec("https://kernel.example");
    assert.ok(spec.paths["/api/agent/key"]);
    assert.ok(spec.paths["/api/agent/verify"]);
  });

  it("keeps the agents page from dumping JSON as the product", () => {
    const page = readFileSync(fileURLToPath(new URL("../../routes/agentes.tsx", import.meta.url)), "utf8");
    assert.match(page, /Si no tienes un agente/);
    assert.match(page, /Qué agente está conectado/);
    assert.match(page, /AGENT_STEPS/);
    assert.match(page, /\/api\/agent\/forge/);
    assert.match(page, /OpenAPI/);
    assert.match(page, /Skill/);
    assert.doesNotMatch(page, /mcpServers: \{ efesto: \{ url: mcpUrl \} \}/);
  });
});
