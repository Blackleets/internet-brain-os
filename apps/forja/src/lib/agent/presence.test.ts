import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { identifyAgent, liveAgent, noteAgent, resetPresenceForTests } from "./presence.ts";

describe("agent presence", () => {
  it("names Hermes, Grok and OpenClaw, and ignores a browser user-agent", () => {
    resetPresenceForTests();
    assert.equal(identifyAgent({ userAgent: "Mozilla/5.0 Chrome/120" }), null);
    assert.equal(identifyAgent({ name: "hermes-agent" })?.label, "Hermes");
    assert.equal(identifyAgent({ header: "Grok" })?.label, "Grok");
    assert.equal(identifyAgent({ name: "OpenClaw MCP" })?.label, "OpenClaw");
    noteAgent({ name: "Hermes", source: "mcp", tool: "efesto.forge" });
    assert.equal(liveAgent()?.label, "Hermes");
    assert.equal(liveAgent()?.tool, "efesto.forge");
  });
});
