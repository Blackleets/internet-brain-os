import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeDossier } from "./dossier.ts";
import { admitDossier, admitFinding } from "./admission.ts";
import { buildKernelPacket } from "./packet.ts";
import { forgeEphemeral, resetAgentForgeGate } from "../agent/forge-ephemeral.ts";
import {
  evidenceSupportsGoal,
  goalSupport,
  INCOMPLETE_SUPPORT_REASON,
  KERNEL_SUPPORT_CONTRACT,
  maySealGoal,
} from "./support.ts";
import type { Evidence, Finding, Goal } from "./types.ts";
import type { PublicReadResult, ResearchIO } from "../research/io.ts";

const AT = "2026-08-30T12:00:00.000Z";

function evidence(over: Partial<Evidence> & Pick<Evidence, "id" | "excerpt" | "url" | "title">): Evidence {
  return {
    goalId: "g1",
    sourceHost: "example.com",
    contentHash: `${over.id}hash1234567890abcd`,
    retrievedAt: AT,
    httpStatus: 200,
    bytes: over.excerpt.length,
    validation: "retrieved",
    ...over,
  };
}

function finding(over: Partial<Finding> & Pick<Finding, "id" | "evidenceIds">): Finding {
  return {
    goalId: "g1",
    title: "Hallazgo",
    answer: "Respuesta observada.",
    whyItMatters: "Importa al Goal.",
    confidence: "medium",
    uncertainties: [],
    nextAction: "Nada",
    interpretationAvailable: true,
    createdAt: AT,
    ...over,
  };
}

const goal: Goal = {
  id: "g1",
  text: "¿El Salvador sigue usando bitcoin como curso legal?",
  createdAt: AT,
  updatedAt: AT,
  status: "researching",
  stage: "interpreting",
  evidenceIds: [],
  findingIds: [],
  leadCount: 0,
  leads: [],
  watched: false,
};

describe("kernel goal support", () => {
  it("treats retrieved HTTP 200 as retrieval, never as Completion", () => {
    assert.equal(KERNEL_SUPPORT_CONTRACT.retrievedIsNotCompletion, true);
    assert.equal(KERNEL_SUPPORT_CONTRACT.httpOkIsNotSupport, true);
    assert.equal(KERNEL_SUPPORT_CONTRACT.supportRequiredToSeal, true);
    const page = evidence({
      id: "e-http",
      url: "https://www.jwt.io/",
      title: "JSON Web Tokens",
      excerpt: "JWT is an open standard for signing tokens. HTTP 200. Hash is real.",
    });
    assert.equal(
      evidenceSupportsGoal("xqzplmn-efesto-noindex-9f3k2j0d token único que no debe existir en la web pública", page),
      false,
    );
  });

  it("1. refuses irrelevant retrieved evidence", async () => {
    const off = evidence({
      id: "e-off",
      url: "https://docs.aws.amazon.com/jwt",
      title: "AWS Kendra JWT",
      excerpt: "Use a JWT with a public key to control access to an Amazon Kendra index.",
    });
    const row = finding({ id: "f-off", evidenceIds: ["e-off"], title: "Token no aparece", answer: "No está en los extractos." });
    const support = goalSupport({
      goalText: "xqzplmn-efesto-noindex-9f3k2j0d token único que no debe existir en la web pública",
      evidence: [off],
      findings: [row],
    });
    assert.equal(support.ok, false);
    assert.equal(maySealGoal(support), false);
    const dossier = await composeDossier({
      goal: { ...goal, text: "xqzplmn-efesto-noindex-9f3k2j0d token único que no debe existir" },
      findings: [row],
      evidence: [off],
      related: [],
    });
    assert.equal(dossier, null);
  });

  it("2. a matching keyword with irrelevant content is not support", () => {
    const page = evidence({
      id: "e-kw",
      url: "https://jwt.io/openai-note",
      title: "JWT y OpenAPI",
      excerpt: "Guía de tokens JWT y especificaciones OpenAPI. Noindex en cabecera. Nada sobre cotización.",
    });
    assert.equal(evidenceSupportsGoal("¿OpenAI es una empresa cotizada en bolsa?", page), false);
    const marketHome = evidence({
      id: "e-mkt",
      url: "https://es-us.finanzas.yahoo.com/",
      title: "Yahoo Finanzas: Mercado de acciones en vivo, cotizaciones, negocios y noticias financieras",
      excerpt:
        "S&P 500. Dow Jones. Nasdaq. Empresas y cotizaciones. Petróleo. Oro. Nada nombra a la compañía del Goal.",
    });
    assert.equal(evidenceSupportsGoal("¿OpenAI es una empresa cotizada en bolsa?", marketHome), false);
  });

  it("3. HTTP 200 on an unrelated homepage is not support", () => {
    const home = evidence({
      id: "e-home",
      url: "https://www.bbc.com/",
      title: "BBC Home - Breaking News",
      excerpt: "LIVE Girl rescued from Nepal-Tibet flash floods. Iceland volcano watch.",
    });
    assert.equal(evidenceSupportsGoal("¿El Salvador sigue usando bitcoin como curso legal?", home), false);
  });

  it("4. relevant evidence can complete", async () => {
    const page = evidence({
      id: "e-rel",
      url: "https://www.bbc.com/mundo/articles/c4gpv776zd0o",
      title: "El bitcoin deja de ser moneda de curso legal en El Salvador",
      excerpt:
        "El Salvador adoptó el bitcoin como moneda de curso legal. La reforma posterior retiró esa condición obligatoria.",
    });
    const row = finding({
      id: "f-rel",
      evidenceIds: ["e-rel"],
      title: "Ya no es curso legal obligatorio",
      answer: "La reforma retiró el curso legal obligatorio del bitcoin en El Salvador.",
    });
    assert.equal(evidenceSupportsGoal(goal.text, page), true);
    const support = goalSupport({ goalText: goal.text, evidence: [page], findings: [row] });
    assert.equal(maySealGoal(support), true);
    const dossier = await composeDossier({
      goal,
      findings: [row],
      evidence: [page],
      related: [],
    });
    assert.ok(dossier);
    assert.equal(dossier.evidenceIds.includes("e-rel"), true);
    const gate = admitDossier(dossier, [row], [page], [], goal.text);
    assert.equal(gate.ok, true);
  });

  it("5. a negative conclusion completes only when evidence is about the Goal", async () => {
    const page = evidence({
      id: "e-neg",
      url: "https://www.sec.gov/edgar/openai",
      title: "SEC filings",
      excerpt:
        "OpenAI does not appear as a listed issuer in this public filing excerpt. The company is preparing a possible IPO, not a ticker today.",
    });
    const row = finding({
      id: "f-neg",
      evidenceIds: ["e-neg"],
      title: "No cotiza en este extracto",
      answer: "Los extractos no muestran a OpenAI como empresa cotizada hoy.",
    });
    const text = "¿OpenAI es una empresa cotizada en bolsa?";
    assert.equal(evidenceSupportsGoal(text, page), true);
    const dossier = await composeDossier({
      goal: { ...goal, text },
      findings: [row],
      evidence: [page],
      related: [],
    });
    assert.ok(dossier);
    assert.match(dossier.executive, /no muestran a OpenAI como empresa cotizada/i);
  });

  it("6. an agent cannot declare Completion when support is insufficient", async () => {
    resetAgentForgeGate();
    const io: ResearchIO = {
      searchPublicWeb: async () => ({
        ok: true,
        provider: "test",
        hits: [
          {
            title: "JSON Web Token",
            url: "https://www.jwt.io/",
            snippet: "JWT standard.",
            sourceHost: "jwt.io",
          },
        ],
      }),
      readPublicWeb: async ({ data }): Promise<PublicReadResult> => ({
        ok: true,
        url: data.url,
        title: "JWT",
        sourceHost: "jwt.io",
        excerpt: "JSON Web Tokens are an open industry standard. HTTP 200. Real hash.",
        contentHash: "hashjwtirrelevantpage12",
        httpStatus: 200,
        bytes: 80,
        retrievedAt: AT,
      }),
      interpretEvidence: async () => ({
        ok: true as const,
        available: true as const,
        findings: [
          {
            title: "Completado por el agente",
            answer: "El agente declara Completado aunque la página no demuestra el Goal.",
            whyItMatters: "No debe bastar.",
            confidence: "high" as const,
            evidenceIndexes: [0],
            uncertainties: [],
            nextAction: "Nada",
          },
        ],
      }),
    };
    const result = await forgeEphemeral("xqzplmn-efesto-agent-noindex-7k1 token único que no debe existir", io);
    assert.equal(result.ok, false);
    assert.equal(result.packet?.incomplete, true);
    assert.equal(result.packet?.seal, null);
    assert.match(result.reason, /incompleta/i);
    assert.equal(result.packet?.goal.stage === "complete", false);
    assert.equal(result.packet?.goal.status === "complete", false);
  });

  it("7. support does not hide a contradiction between two on-topic sources", async () => {
    const a = evidence({
      id: "e-a",
      url: "https://www.bbc.com/mundo/bitcoin-legal",
      title: "Bitcoin deja de ser curso legal en El Salvador",
      excerpt: "El Salvador retiró al bitcoin la condición de moneda de curso legal obligatoria.",
    });
    const b = evidence({
      id: "e-b",
      url: "https://cincodias.elpais.com/criptoactivos/salvador",
      title: "El Salvador mantiene bitcoin como curso legal",
      excerpt: "Voces oficiales sostienen que bitcoin sigue siendo moneda de curso legal en El Salvador.",
      contentHash: "otherhash1234567890abzz",
    });
    const rows = [
      finding({ id: "f-a", evidenceIds: ["e-a"], title: "Reversión", answer: "Ya no es obligatorio." }),
      finding({ id: "f-b", evidenceIds: ["e-b"], title: "Continuidad", answer: "Sigue presentado como curso legal." }),
    ];
    const support = goalSupport({ goalText: goal.text, evidence: [a, b], findings: rows });
    assert.equal(support.ok, true);
    const dossier = await composeDossier({
      goal,
      findings: rows,
      evidence: [a, b],
      related: [],
    });
    assert.ok(dossier);
  });

  it("8. retry is idempotent: unsupported evidence never seals on the second pass", async () => {
    const off = evidence({
      id: "e-retry",
      url: "https://seranking.com/es/blog/noindex/",
      title: "Qué es noindex",
      excerpt: "La etiqueta noindex evita que el buscador indexe una página. No menciona el identificador buscado.",
    });
    const row = finding({ id: "f-retry", evidenceIds: ["e-retry"] });
    const text = "xqzplmn-efesto-noindex-9f3k2j0d token único que no debe existir en la web pública";
    const first = await composeDossier({
      goal: { ...goal, text },
      findings: [row],
      evidence: [off],
      related: [],
    });
    const second = await composeDossier({
      goal: { ...goal, text },
      findings: [row],
      evidence: [off],
      related: [],
    });
    assert.equal(first, null);
    assert.equal(second, null);
  });

  it("9. admits no seal without sufficient Goal support", async () => {
    const off = evidence({
      id: "e-noseal",
      url: "https://www.jwt.io/",
      title: "JWT",
      excerpt: "JSON Web Token documentation. HTTP 200.",
    });
    const row = finding({ id: "f-noseal", evidenceIds: ["e-noseal"] });
    const text = "xqzplmn-efesto-noindex-9f3k2j0d token único";
    const admitted = admitFinding(row, [off], [], text);
    assert.equal(admitted.ok, false);
    const dossier = await composeDossier({
      goal: { ...goal, text },
      findings: [row],
      evidence: [off],
      related: [],
    });
    assert.equal(dossier, null);
    const packet = await buildKernelPacket({
      goal: { ...goal, text, status: "blocked", stage: "blocked" },
      evidence: [off],
      findings: [],
    });
    assert.equal(packet.incomplete, true);
    assert.equal(packet.seal, null);
    assert.match(INCOMPLETE_SUPPORT_REASON, /Investigación incompleta/);
  });

  it("does not let a homepage ride along into the seal when other pages support the Goal", async () => {
    const home = evidence({
      id: "e-home2",
      url: "https://www.bbc.com/",
      title: "BBC Home",
      excerpt: "Live floods in Nepal. Sports. Weather.",
    });
    const article = evidence({
      id: "e-art",
      url: "https://www.bbc.com/mundo/articles/c4gpv776zd0o",
      title: "El bitcoin deja de ser moneda de curso legal en El Salvador",
      excerpt: "Reforma: El Salvador retiró el curso legal obligatorio del bitcoin.",
    });
    const row = finding({ id: "f-mix", evidenceIds: ["e-home2", "e-art"] });
    const dossier = await composeDossier({
      goal,
      findings: [row],
      evidence: [home, article],
      related: [],
    });
    assert.ok(dossier);
    assert.deepEqual(dossier.evidenceIds, ["e-art"]);
    assert.equal(dossier.evidenceIds.includes("e-home2"), false);
  });

  it("a vague empresa prompt never supports, even if the page says empresa", () => {
    const page = evidence({
      id: "e-emp",
      url: "https://www.example.com/about",
      title: "Nuestra empresa",
      excerpt: "Somos una empresa de software. HTTP 200. Hash real.",
    });
    assert.equal(evidenceSupportsGoal("Investiga esta empresa", page), false);
    const row = finding({
      id: "f-emp",
      evidenceIds: ["e-emp"],
      interpretationAvailable: false,
      title: "Fuentes recuperadas",
    });
    const support = goalSupport({
      goalText: "Investiga esta empresa",
      evidence: [page],
      findings: [row],
    });
    assert.equal(maySealGoal(support), false);
  });

  it("a retrieved-only finding without interpretation cannot Completado", () => {
    const page = evidence({
      id: "e-src",
      url: "https://www.bbc.com/mundo/articles/c4gpv776zd0o",
      title: "El bitcoin deja de ser moneda de curso legal en El Salvador",
      excerpt:
        "El Salvador adoptó el bitcoin como moneda de curso legal. La reforma posterior retiró esa condición obligatoria.",
    });
    const row = finding({
      id: "f-src",
      evidenceIds: ["e-src"],
      title: "Fuentes recuperadas",
      interpretationAvailable: false,
    });
    const support = goalSupport({ goalText: goal.text, evidence: [page], findings: [row] });
    assert.equal(support.ok, true);
    assert.equal(maySealGoal(support), false);
  });
});
