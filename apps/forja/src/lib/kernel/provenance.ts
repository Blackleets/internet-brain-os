import { compareSeals, sealCause, sealChangeNote, sealsForGoal } from "./dossier.ts";
import { admittedMemory } from "./authority.ts";
import type { RelatedMemoryHit } from "./related-memory.ts";
import type { Dossier, Evidence, Finding, MemoryRecord } from "./types.ts";

export function evidenceForFinding(finding: Finding, evidence: Evidence[]): Evidence[] {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  return finding.evidenceIds
    .map((id) => byId.get(id))
    .filter((item): item is Evidence => Boolean(item));
}

export function sourcesForFinding(finding: Finding, evidence: Evidence[]) {
  return evidenceForFinding(finding, evidence).map((item) => ({
    evidenceId: item.id,
    url: item.url,
    title: item.title,
    sourceHost: item.sourceHost,
    contentHash: item.contentHash,
    retrievedAt: item.retrievedAt,
  }));
}

export function closingSeal(finding: Finding, dossiers: Dossier[]): Dossier | undefined {
  const bound = dossiers.filter(
    (item) => item.goalId === finding.goalId && item.findingIds.includes(finding.id),
  );
  if (!bound.length) return undefined;
  const newest = sealsForGoal(bound, finding.goalId)[0];
  return newest;
}

export function memoryInfluence(
  dossier: Dossier,
  related: RelatedMemoryHit[],
  memory: MemoryRecord[],
) {
  const alive = new Set(admittedMemory(memory).map((item) => item.id));
  const consultedIds = new Set(dossier.known.map((item) => item.memoryId));
  return {
    consulted: dossier.known,
    historic: dossier.known.filter((item) => !alive.has(item.memoryId)),
    notConsulted: related
      .filter((hit) => !consultedIds.has(hit.memory.id))
      .map((hit) => hit.memory),
  };
}

export function traceFinding(
  finding: Finding,
  evidence: Evidence[],
  dossiers: Dossier[],
) {
  const sources = sourcesForFinding(finding, evidence);
  const seal = closingSeal(finding, dossiers);
  return {
    findingId: finding.id,
    goalId: finding.goalId,
    evidenceIds: finding.evidenceIds,
    sources,
    sourceHosts: [...new Set(sources.map((item) => item.sourceHost))].sort(),
    influencedByMemoryId: finding.deltaMemoryId,
    closedBySealId: seal?.id,
    closedBySealHash: seal?.sealHash,
  };
}

export function traceSeal(
  dossier: Dossier,
  evidence: Evidence[],
  findings: Finding[],
  memory: MemoryRecord[],
  related: RelatedMemoryHit[],
  previous?: Dossier,
) {
  const boundEvidence = evidence.filter((item) => dossier.evidenceIds.includes(item.id));
  const boundFindings = findings.filter((item) => dossier.findingIds.includes(item.id));
  const influence = memoryInfluence(dossier, related, memory);
  return {
    sealId: dossier.id,
    goalId: dossier.goalId,
    sealedAt: dossier.sealedAt,
    sealHash: dossier.sealHash,
    memoryContextHash: dossier.memoryContextHash,
    evidence: boundEvidence,
    findings: boundFindings,
    memory: influence,
    supersedesId: dossier.supersedesId,
    causeFromPrevious: previous ? sealCause(dossier, previous) : undefined,
    changeNote: previous ? sealChangeNote(dossier, previous) : undefined,
    hashesChanged: previous ? compareSeals(dossier, previous).hashesChanged : false,
    knownChanged: previous ? compareSeals(dossier, previous).knownChanged : false,
  };
}
