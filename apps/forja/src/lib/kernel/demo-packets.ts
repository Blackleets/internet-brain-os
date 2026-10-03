import { composeDossier } from "./dossier.ts";
import { buildKernelPacket, type KernelPacket } from "./packet.ts";
import { INCOMPLETE_SUPPORT_REASON } from "./support.ts";
import type { Evidence, Finding, Goal } from "./types.ts";

const AT = "2026-01-15T12:00:00.000Z";

function baseGoal(over: Partial<Goal> & Pick<Goal, "id" | "text" | "status" | "stage">): Goal {
  return {
    createdAt: AT,
    updatedAt: AT,
    evidenceIds: [],
    findingIds: [],
    leadCount: 0,
    leads: [],
    watched: false,
    ...over,
  };
}

function page(over: Partial<Evidence> & Pick<Evidence, "id" | "goalId" | "url" | "title" | "excerpt" | "sourceHost">): Evidence {
  return {
    contentHash: `${over.id}-hash-demo-000000000000`,
    retrievedAt: AT,
    httpStatus: 200,
    bytes: over.excerpt.length,
    validation: "retrieved",
    ...over,
  };
}

export async function demoIncompletePacket(): Promise<KernelPacket> {
  const goal = baseGoal({
    id: "demo-incompleta",
    text: "xqzplmn-efesto-noindex-9f3k2j0d token único que no debe existir en la web pública",
    status: "blocked",
    stage: "blocked",
    blockedReason: INCOMPLETE_SUPPORT_REASON,
    evidenceIds: ["e-jwt"],
  });
  const evidence = page({
    id: "e-jwt",
    goalId: goal.id,
    url: "https://www.jwt.io/",
    title: "JSON Web Tokens",
    excerpt: "JWT is an open standard for signing tokens. HTTP 200. El token del Goal no aparece.",
    sourceHost: "jwt.io",
  });
  return buildKernelPacket({ goal, evidence: [evidence], findings: [] });
}

export async function demoSealedPacket(): Promise<KernelPacket> {
  const goal = baseGoal({
    id: "demo-sellado",
    text: "¿El Salvador sigue usando bitcoin como curso legal?",
    status: "complete",
    stage: "complete",
    evidenceIds: ["e-bbc"],
    findingIds: ["f-legal"],
  });
  const evidence = page({
    id: "e-bbc",
    goalId: goal.id,
    url: "https://www.bbc.com/mundo/articles/c4gpv776zd0o",
    title: "El bitcoin deja de ser moneda de curso legal en El Salvador",
    excerpt:
      "El Salvador adoptó el bitcoin como moneda de curso legal. La reforma posterior retiró esa condición obligatoria.",
    sourceHost: "bbc.com",
  });
  const finding: Finding = {
    id: "f-legal",
    goalId: goal.id,
    title: "Ya no es curso legal obligatorio",
    answer: "La reforma retiró el curso legal obligatorio del bitcoin en El Salvador.",
    whyItMatters: "Cambia el régimen monetario del país.",
    confidence: "medium",
    evidenceIds: [evidence.id],
    uncertainties: [],
    nextAction: "Nada",
    interpretationAvailable: true,
    createdAt: AT,
  };
  const dossier = await composeDossier({
    goal,
    findings: [finding],
    evidence: [evidence],
    related: [],
  });
  return buildKernelPacket({
    goal,
    evidence: [evidence],
    findings: [finding],
    dossier,
  });
}
