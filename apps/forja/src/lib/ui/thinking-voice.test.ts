import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { thinkingVoice } from "./thinking-voice.ts";

describe("thinking voice", () => {
  it("names the connected agent instead of a generic spinner", () => {
    const voice = thinkingVoice({
      state: "searching",
      model: "Grok 4.5",
      agent: { label: "Hermes" },
      live: true,
    });
    assert.equal(voice.mode, "Forjando");
    assert.match(voice.line, /conectado/);
  });

  it("uses the interpreter name when no agent is connected", () => {
    const voice = thinkingVoice({ state: "analyzing", model: "Grok 4.5", agent: null });
    assert.equal(voice.actor, "Grok 4.5");
    assert.equal(voice.mode, "Comprobando");
    assert.match(voice.line, /interpreta extractos/);
  });

  it("never lets a bot claim Completado", () => {
    const done = thinkingVoice({
      state: "completed",
      agent: { label: "OpenClaw" },
      live: true,
    });
    assert.doesNotMatch(done.mode, /Completado/);
    assert.match(done.line, /sello|Kernel/i);
  });
});
