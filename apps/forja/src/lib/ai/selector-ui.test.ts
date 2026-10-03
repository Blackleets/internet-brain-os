import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("model selector UI contract", () => {
  const selector = readFileSync(
    fileURLToPath(new URL("../../components/model-selector.tsx", import.meta.url)),
    "utf8",
  );
  const composer = readFileSync(
    fileURLToPath(new URL("../../components/goal-composer.tsx", import.meta.url)),
    "utf8",
  );
  const chat = readFileSync(
    fileURLToPath(new URL("../../routes/chat.tsx", import.meta.url)),
    "utf8",
  );
  const shell = readFileSync(
    fileURLToPath(new URL("../../components/app-shell.tsx", import.meta.url)),
    "utf8",
  );
  const working = readFileSync(
    fileURLToPath(new URL("../../components/working-status.tsx", import.meta.url)),
    "utf8",
  );
  const intelligence = readFileSync(
    fileURLToPath(new URL("../../components/intelligence-state.tsx", import.meta.url)),
    "utf8",
  );
  const findingCard = readFileSync(
    fileURLToPath(new URL("../../components/finding-card.tsx", import.meta.url)),
    "utf8",
  );
  const forgeTrace = readFileSync(
    fileURLToPath(new URL("../../components/forge-trace.tsx", import.meta.url)),
    "utf8",
  );
  const packetStamp = readFileSync(
    fileURLToPath(new URL("../../components/packet-stamp.tsx", import.meta.url)),
    "utf8",
  );
  const receipt = readFileSync(
    fileURLToPath(new URL("../../components/forge-receipt.tsx", import.meta.url)),
    "utf8",
  );

  it("never renders an API key and lives in the composer, not the header", () => {
    assert.equal(selector.includes("apiKey"), false);
    assert.equal(/\{keys\[/.test(selector), false);
    assert.equal(selector.includes("type=\"password\""), false);
    assert.match(selector, /ProviderMark/);
    assert.match(selector, /Si falla/);
    assert.match(composer, /<ModelSelector task="interpret"/);
    assert.match(chat, /<ModelSelector task="chat"/);
    assert.equal(shell.includes("ModelSelector"), false);
  });

  it("uses Efesto's forge nucleus, not a chatbot checklist", () => {
    assert.match(working, /function WorkingMark/);
    assert.match(working, /ForgeMark/);
    assert.match(working, /Forjando/);
    assert.doesNotMatch(working, /EfestoIntelligenceState/);
    assert.doesNotMatch(working, /Buscando fuentes/);
    assert.doesNotMatch(working, /Pensando/);
    assert.match(forgeTrace, /buildForgeTrace/);
    assert.match(forgeTrace, /thinkingVoice/);
    assert.match(forgeTrace, /data-forge-trace/);
    assert.match(forgeTrace, /data-actor/);
    assert.match(intelligence, /think-orbit/);
    assert.match(intelligence, /think-core/);
    assert.match(intelligence, /forge-layer/);
    assert.match(intelligence, /forge-ray/);
    assert.match(intelligence, /data-intelligence-state/);
    assert.doesNotMatch(working, /🧠|🔎|📄|🧩|⚖️|📊|🔒/);
    assert.doesNotMatch(intelligence, /🧠|🔎|📄|🧩|⚖️|📊|🔒/);
  });

  it("separates observed evidence from Kernel-admitted interpretation", () => {
    assert.match(findingCard, /Observado/);
    assert.match(findingCard, /Interpretado/);
    assert.match(findingCard, /splitLabeledAnswer/);
    assert.match(findingCard, /No es un dato observado ni una predicción/);
    assert.match(receipt, /Recibo de la forja/);
    assert.match(receipt, /Fuentes encontradas/);
    assert.match(receipt, /El Kernel no inventó fuentes/);
    assert.match(packetStamp, /Kernel Packet/);
    assert.match(packetStamp, /Verificar sello/);
    assert.doesNotMatch(packetStamp, /Completado/);
  });
});
