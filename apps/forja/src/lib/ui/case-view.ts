import { interpretationVoice } from "./finding-voice.ts";
import { identityPhase, identityLabel, type IdentityPhase } from "./identity.ts";
import { confidenceBandLabel, latestConfidence } from "../kernel/confidence.ts";
import type {
  ConfidenceRecord,
  Contradiction,
  Dossier,
  Evidence,
  Finding,
  Goal,
} from "../kernel/types.ts";

export type CaseView = {
  question: string;
  conclusion: string | null;
  statusLabel: string;
  identity: IdentityPhase;
  identityLabel: string;
  confidence: string | null;
  evidenceCount: number;
  sourceHosts: string[];
  contradictionCount: number;
  sealedAt: string | null;
  sealHash: string | null;
  why: string | null;
  incomplete: boolean;
};

function uniqueHosts(evidence: Evidence[], dossier?: Dossier): string[] {
  if (dossier?.sourceHosts.length) return dossier.sourceHosts;
  return [...new Set(evidence.map((item) => item.sourceHost).filter(Boolean))];
}

export function buildCaseView(input: {
  goal: Pick<Goal, "text" | "stage" | "status" | "blockedReason">;
  findings: Finding[];
  evidence: Evidence[];
  contradictions: Contradiction[];
  confidence: ConfidenceRecord[];
  dossier?: Dossier;
}): CaseView {
  const sealed = Boolean(input.dossier);
  const incomplete =
    input.goal.stage === "blocked" ||
    input.goal.stage === "failed" ||
    input.goal.status === "blocked" ||
    input.goal.status === "failed";
  const identity = identityPhase({
    kind: "investigate",
    stage: input.goal.stage,
    sealed,
    finished: sealed,
  });
  const primary = input.findings[0];
  const support = primary ? latestConfidence(input.confidence, primary.id) : undefined;
  const conclusion = input.dossier?.executive?.trim()
    ? input.dossier.executive.trim()
    : primary?.answer?.trim()
      ? interpretationVoice(primary.answer)
      : null;
  const why = incomplete
    ? input.goal.blockedReason ?? "Investigación incompleta. El Kernel no inventó fuentes."
    : sealed
      ? null
      : evidenceWhy(input.evidence.length, input.findings.length);

  return {
    question: input.goal.text,
    conclusion: conclusion || null,
    statusLabel: incomplete ? "Incompleto" : sealed ? "Sellado" : identityLabel(identity),
    identity,
    identityLabel: identityLabel(identity),
    confidence: support ? confidenceBandLabel(support.band) : null,
    evidenceCount: input.evidence.length,
    sourceHosts: uniqueHosts(input.evidence, input.dossier),
    contradictionCount: input.contradictions.length,
    sealedAt: input.dossier?.sealedAt ?? null,
    sealHash: input.dossier?.sealHash ?? null,
    why,
    incomplete,
  };
}

function evidenceWhy(evidenceCount: number, findingCount: number): string | null {
  if (evidenceCount === 0 && findingCount === 0) {
    return "Todavía no hay evidencia retenida. Efesto no concluye.";
  }
  if (findingCount === 0) {
    return "Hay evidencia retenida. El Kernel no selló un hallazgo.";
  }
  return null;
}

export function findingIsUnverifiedLead(finding: Pick<Finding, "evidenceIds" | "interpretationAvailable">): boolean {
  return finding.evidenceIds.length === 0 || !finding.interpretationAvailable;
}
