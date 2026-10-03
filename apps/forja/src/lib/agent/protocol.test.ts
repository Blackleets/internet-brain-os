import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_TOOLS, agentManifest, handleAgentRpc, restForge, restVerify } from "./protocol.ts";
import { resetAgentForgeGate } from "./forge-ephemeral.ts";
import { connectorConfigs, openApiSpec, openClawSkill } from "./connectors.ts";

describe("agent protocol", () => {
  it("exposes tools for Hermes, OpenClaw and Grok without letting the model admit", () => {
    const manifest = agentManifest("https://efesto.example");
    assert.equal(manifest.contract.modelAdmits, false);
    assert.equal(manifest.contract.chatIsEvidence, false);
    assert.ok(AGENT_TOOLS.some((tool) => tool.name === "efesto.forge"));
    assert.ok(AGENT_TOOLS.some((tool) => tool.name === "efesto.verify_packet"));
    assert.match(manifest.note, /Hermes|OpenClaw|Grok/);
    assert.equal(manifest.endpoints.forge, "https://efesto.example/api/agent/forge");
    assert.equal(manifest.endpoints.openapi, "https://efesto.example/api/agent/openapi");
    assert.equal(manifest.endpoints.key, "https://efesto.example/api/agent/key");
    assert.equal(manifest.endpoints.verify, "https://efesto.example/api/agent/verify");
  });

  it("lists tools over MCP initialize / tools/list", async () => {
    const listed = (await handleAgentRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" })) as {
      result: { tools: Array<{ name: string }> };
    };
    assert.ok(listed.result.tools.some((tool) => tool.name === "efesto.contract"));
  });

  it("exposes ping, resources and prompts for real MCP clients", async () => {
    const ping = (await handleAgentRpc({ jsonrpc: "2.0", id: 3, method: "ping" })) as { result: object };
    assert.ok(ping.result);
    const resources = (await handleAgentRpc({ jsonrpc: "2.0", id: 4, method: "resources/list" })) as {
      result: { resources: Array<{ uri: string }> };
    };
    assert.ok(resources.result.resources.some((row) => row.uri === "efesto://contract"));
    const contract = (await handleAgentRpc({
      jsonrpc: "2.0",
      id: 5,
      method: "resources/read",
      params: { uri: "efesto://contract" },
    })) as { result: { contents: Array<{ text: string }> } };
    assert.match(contract.result.contents[0]?.text ?? "", /"modelAdmits": false/);
    const prompts = (await handleAgentRpc({ jsonrpc: "2.0", id: 6, method: "prompts/list" })) as {
      result: { prompts: Array<{ name: string }> };
    };
    assert.ok(prompts.result.prompts.some((row) => row.name === "forge"));
  });

  it("rejects a broken packet through verify_packet", async () => {
    resetAgentForgeGate();
    const result = (await handleAgentRpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "efesto.verify_packet", arguments: { packet: { product: "ChatGPT" } } },
    })) as { result: { content: Array<{ text: string }> } };
    assert.match(result.result.content[0]?.text ?? "", /Rechazado/);
  });

  it("REST forge rejects a short goal without inventing a completed case", async () => {
    resetAgentForgeGate();
    const result = await restForge("no");
    assert.equal(result.ok, false);
    assert.equal(result.incomplete, true);
    assert.match(result.reason, /corto|incompleta|largo/i);
    assert.equal(result.contract.modelAdmits, false);
  });

  it("REST verify rejects packets that are not Kernel Packets", async () => {
    const result = await restVerify({ product: "ChatGPT", chat: "hi" });
    assert.equal(result.ok, false);
    assert.match(result.reason, /Rechazado|clave|chat|Protocolo|paquete/i);
  });
});

describe("agent connectors", () => {
  it("publishes OpenAPI and skills that keep the Kernel in front of the model", () => {
    const spec = openApiSpec("https://efesto.example");
    assert.equal(spec.openapi, "3.1.0");
    assert.ok(spec.paths["/api/agent/forge"]);
    assert.ok(spec.paths["/api/agent/verify"]);
    assert.equal(spec["x-efesto"].contract.modelAdmits, false);
    assert.match(spec.info.description, /not a search engine/i);
    const skill = openClawSkill("https://efesto.example");
    assert.match(skill, /modelAdmits: false/);
    assert.match(skill, /Never say completed/);
    assert.match(skill, /\/api\/agent\/forge/);
    const configs = connectorConfigs("https://efesto.example");
    assert.equal(configs.grok.mcp.mcpServers.efesto.url, "https://efesto.example/api/agent");
    assert.equal(configs.hermes.mcp.mcp.efesto.type, "http");
    assert.equal(configs.openclaw.mcp.tools.efesto.type, "mcp");
  });
});
