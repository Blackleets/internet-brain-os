import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { forgeEphemeral, resetAgentForgeGate } from "./forge-ephemeral.ts";
import type { PublicReadResult, ResearchIO } from "../research/io.ts";

const AT = "2026-08-30T10:00:00.000Z";

function mockIO(over?: { searchEmpty?: boolean; noInterpret?: boolean }): ResearchIO {
  return {
    searchPublicWeb: async () =>
      over?.searchEmpty
        ? {
            ok: false as const,
            status: "FAIL" as const,
            error: "Investigación incompleta. Ningún proveedor devolvió URLs utilizables.",
            discovery: {
              queries: ["openai cotizada"],
              providers: [{ name: "wikipedia", status: "empty" as const, hitCount: 0, recoverable: true }],
              found: 0,
              usable: 0,
              domains: [],
              kinds: {},
            },
          }
        : {
            ok: true as const,
            provider: "test",
            hits: [
              {
                title: "SEC filing",
                url: "https://www.sec.gov/edgar/openai",
                snippet: "Public filings.",
                sourceHost: "sec.gov",
              },
            ],
            discovery: {
              queries: ["openai cotizada"],
              providers: [{ name: "google-news", status: "ok" as const, hitCount: 1, recoverable: true }],
              found: 1,
              usable: 1,
              domains: ["sec.gov"],
              kinds: {},
            },
          },
    readPublicWeb: async ({ data }): Promise<PublicReadResult> => ({
      ok: true,
      url: data.url,
      title: "SEC",
      sourceHost: "sec.gov",
      excerpt: "OpenAI does not appear as a listed issuer in this public filing excerpt. The page is a real retrieved document.",
      contentHash: "hashopenaiisnotlisted12",
      httpStatus: 200,
      bytes: 120,
      retrievedAt: AT,
    }),
    interpretEvidence: async () =>
      over?.noInterpret
        ? { ok: true as const, available: false as const, reason: "Sin clave para este proveedor." }
        : {
            ok: true as const,
            available: true as const,
            findings: [
              {
                title: "No cotiza en este extracto",
                answer: "El extracto de la SEC no lista a OpenAI como emisora pública.",
                whyItMatters: "Evita tratar un rumor como hecho.",
                confidence: "medium" as const,
                evidenceIndexes: [0],
                uncertainties: ["Una sola fuente"],
                nextAction: "Contrastar otra ficha oficial.",
              },
            ],
          },
  };
}

describe("ephemeral agent forge", () => {
  it("returns a sealed packet that other agents can verify, without touching chat", async () => {
    resetAgentForgeGate();
    const result = await forgeEphemeral("¿OpenAI es una empresa cotizada?", mockIO());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.packet.contract.modelAdmits, false);
    assert.equal(result.packet.evidence.length, 1);
    assert.equal(result.packet.findings.length, 1);
    assert.equal(result.packet.incomplete, false);
    assert.match(result.packet.evidence[0]?.url ?? "", /^https:/);
  });

  it("does not mark Completado when search yields nothing", async () => {
    resetAgentForgeGate();
    const result = await forgeEphemeral("pregunta imposible xyzzy", mockIO({ searchEmpty: true }));
    assert.equal(result.ok, false);
    assert.match(result.reason, /incompleta/i);
    assert.equal(result.packet?.incomplete, true);
    assert.equal(result.packet?.evidence.length, 0);
    assert.doesNotMatch(result.reason, /Completado/);
  });
});
