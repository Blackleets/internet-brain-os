import type { DiscoverySnapshot, Evidence, Finding, Goal, ResearchStage } from "../kernel/types.ts";

export type ReceiptTone = "forging" | "forged" | "incomplete";

export function receiptTone(
  stage: ResearchStage,
  status: Goal["status"],
  sealed = false,
): ReceiptTone {
  if (status === "researching") return "forging";
  if (stage === "blocked" || stage === "failed" || status === "blocked" || status === "failed") {
    return "incomplete";
  }
  if (sealed) return "forged";
  return "incomplete";
}

export function receiptHeadline(tone: ReceiptTone): string {
  if (tone === "forging") return "Forjando…";
  if (tone === "incomplete") return "Investigación incompleta";
  return "Forjado";
}

export function providerLine(provider: DiscoverySnapshot["providers"][number]): string {
  const name = provider.name;
  if (provider.status === "ok") return `${name}: ${provider.hitCount}`;
  if (provider.status === "empty") return `${name}: vacío`;
  if (provider.status === "blocked") return `${name}: bloqueado${provider.error ? ` · ${provider.error}` : ""}`;
  return `${name}: falló${provider.error ? ` · ${provider.error}` : ""}`;
}

export function forgeReceipt(input: {
  goal: Pick<Goal, "stage" | "status" | "blockedReason" | "discovery" | "leads">;
  evidenceCount: number;
  findingCount: number;
  contradictionCount: number;
  sealed: boolean;
}): {
  tone: ReceiptTone;
  headline: string;
  reason?: string;
  found: number;
  usable: number;
  domains: string[];
  extracted: number;
  findings: number;
  contradictions: number;
  providers: string[];
  queries: string[];
  sealed: boolean;
} {
  const tone = receiptTone(input.goal.stage, input.goal.status, input.sealed);
  const discovery = input.goal.discovery;
  return {
    tone,
    headline: receiptHeadline(tone),
    reason: tone === "incomplete" ? input.goal.blockedReason : undefined,
    found: discovery?.found ?? input.goal.leads.length,
    usable: discovery?.usable ?? input.goal.leads.length,
    domains: discovery?.domains ?? [...new Set(input.goal.leads.map((lead) => lead.sourceHost))],
    extracted: discovery?.extracted ?? input.evidenceCount,
    findings: input.findingCount,
    contradictions: input.contradictionCount,
    providers: (discovery?.providers ?? []).map(providerLine),
    queries: discovery?.queries ?? [],
    sealed: input.sealed,
  };
}

export function citedObservations(finding: Pick<Finding, "evidenceIds">, evidence: Evidence[]): Evidence[] {
  return finding.evidenceIds
    .map((id) => evidence.find((item) => item.id === id))
    .filter((item): item is Evidence => Boolean(item && item.excerpt.trim()));
}
