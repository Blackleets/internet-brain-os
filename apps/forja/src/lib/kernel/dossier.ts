import { sha256Hex } from "./hash.ts";
import { shortId } from "../utils.ts";
import type {
  Dossier,
  Evidence,
  Finding,
  Goal,
  KnownMemorySnapshot,
  MemoryRecord,
  SealInstrument,
} from "./types.ts";
import type { RelatedMemoryHit } from "./related-memory.ts";
import { admittedMemory } from "./authority.ts";
import { goalSupport, maySealGoal } from "./support.ts";

function urlKey(url: string) {
  return url.replace(/\/$/, "");
}

export function composeExecutive(findings: Finding[]): string {
  const usable = findings
    .filter((item) => item.answer.trim())
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, 3);
  if (!usable.length) return "";
  if (usable.length === 1) return usable[0].answer.trim();
  return usable
    .map((item, index) => `${index + 1}. ${item.title.trim()} — ${item.answer.trim()}`)
    .join("\n\n");
}

export function memoryContextCanonical(known: KnownMemorySnapshot[]) {
  return JSON.stringify(
    known
      .map((item) => ({
        memoryId: item.memoryId,
        findingId: item.findingId,
        goalId: item.goalId,
        admittedAt: item.admittedAt,
        lifecycle: item.lifecycle,
        whyHash: item.whyHash,
      }))
      .sort((a, b) => a.memoryId.localeCompare(b.memoryId)),
  );
}

export async function hashMemoryContext(known: KnownMemorySnapshot[]) {
  return sha256Hex(memoryContextCanonical(known));
}

export async function snapshotRelatedMemory(
  related: RelatedMemoryHit[],
  consultedAt: string,
): Promise<KnownMemorySnapshot[]> {
  const rows: KnownMemorySnapshot[] = [];
  for (const hit of related) {
    rows.push({
      memoryId: hit.memory.id,
      title: hit.memory.title,
      findingId: hit.memory.findingId,
      goalId: hit.memory.goalId,
      admittedAt: hit.memory.admittedAt,
      lifecycle: hit.memory.lifecycle,
      whyHash: await sha256Hex(hit.memory.why),
      consultedAt,
    });
  }
  return rows;
}

export async function composeDossier(input: {
  goal: Goal;
  findings: Finding[];
  evidence: Evidence[];
  related: RelatedMemoryHit[];
}): Promise<Dossier | null> {
  const findings = input.findings
    .filter((item) => item.goalId === input.goal.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const evidence = input.evidence.filter((item) => item.goalId === input.goal.id);
  const support = goalSupport({
    goalText: input.goal.text,
    evidence,
    findings,
  });
  if (!maySealGoal(support)) return null;
  const active = support.supportedFindings
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, 3);
  const supported = support.supportedEvidence;
  const executive = composeExecutive(active);
  if (!active.length || !supported.length || !executive) return null;

  const sealedAt = new Date().toISOString();
  const known = await snapshotRelatedMemory(input.related, sealedAt);
  const memoryContextHash = await hashMemoryContext(known);
  const novel = active.filter((item) => item.delta === "novel").map((item) => item.title);
  const confirmed = active
    .filter((item) => item.delta === "confirmed")
    .map((item) => item.title);
  const tensions = active
    .filter((item) => item.delta === "tension")
    .map((item) => item.title);
  const uncertain = [
    ...new Set(active.flatMap((item) => item.uncertainties.map((row) => row.trim()).filter(Boolean))),
  ];
  const next =
    active.find((item) => item.nextAction.trim())?.nextAction.trim() ?? "";
  const sourceHosts = [...new Set(supported.map((item) => item.sourceHost))].sort();
  const evidenceHashes = supported.map((item) => item.contentHash);
  const findingIds = active.map((item) => item.id);
  const evidenceIds = supported.map((item) => item.id);

  const canonical = JSON.stringify({
    goalId: input.goal.id,
    goal: input.goal.text,
    evidence: supported
      .map((item) => ({ url: item.url, hash: item.contentHash }))
      .sort((a, b) => a.url.localeCompare(b.url)),
    findings: active.map((item) => ({
      title: item.title,
      answer: item.answer,
      delta: item.delta ?? null,
    })),
    known: memoryContextCanonical(known),
    memoryContextHash,
  });

  return {
    id: shortId("d"),
    goalId: input.goal.id,
    sealedAt,
    sealHash: await sha256Hex(canonical),
    executive,
    known,
    memoryContextHash,
    novel,
    confirmed,
    tensions,
    uncertain,
    next,
    findingIds,
    evidenceIds,
    evidenceHashes,
    sourceHosts,
    interpretationAvailable: active.some((item) => item.interpretationAvailable),
    memoryConsulted: known.length,
    reusedCount: supported.filter((item) => item.reused).length,
  };
}

export function latestDossierByGoal(dossiers: Dossier[]): Dossier[] {
  const goalIds = [...new Set(dossiers.map((item) => item.goalId))];
  return goalIds
    .map((goalId) => currentSeal(dossiers, goalId))
    .filter((item): item is Dossier => Boolean(item))
    .sort((a, b) => b.sealedAt.localeCompare(a.sealedAt) || b.id.localeCompare(a.id));
}

export function sealsForGoal(dossiers: Dossier[], goalId: string): Dossier[] {
  const mine = dossiers.filter((item) => item.goalId === goalId);
  const newest = currentSeal(mine, goalId);
  if (!newest) return [];
  const chain = sealLineage(mine, newest);
  const seen = new Set(chain.map((item) => item.id));
  const orphans = mine
    .filter((item) => !seen.has(item.id))
    .sort((a, b) => b.sealedAt.localeCompare(a.sealedAt) || b.id.localeCompare(a.id));
  return [...chain, ...orphans];
}

function knownFingerprint(dossier: Dossier) {
  if (dossier.memoryContextHash) return dossier.memoryContextHash;
  return dossier.known.map((item) => item.memoryId).sort().join("\n");
}

export function compareSeals(newer: Dossier, older: Dossier) {
  const next = [...newer.evidenceHashes].sort();
  const prev = [...older.evidenceHashes].sort();
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  const added = next.filter((hash) => !prevSet.has(hash)).length;
  const removed = prev.filter((hash) => !nextSet.has(hash)).length;
  return {
    hashesChanged: next.join("\n") !== prev.join("\n"),
    executiveChanged: newer.executive.trim() !== older.executive.trim(),
    knownChanged: knownFingerprint(newer) !== knownFingerprint(older),
    added,
    removed,
  };
}

export function sealChangeNote(newer: Dossier, older: Dossier) {
  const diff = compareSeals(newer, older);
  if (diff.added && !diff.removed && diff.executiveChanged) {
    return "Se incorporaron fuentes y cambió la síntesis.";
  }
  if (diff.added && !diff.removed) {
    return "Se incorporaron fuentes que el sello anterior no cubría.";
  }
  if (diff.hashesChanged && diff.executiveChanged) {
    return "Cambiaron las fuentes y la síntesis.";
  }
  if (diff.hashesChanged) return "Las fuentes ya no tenían la misma huella.";
  if (diff.knownChanged && diff.executiveChanged) {
    return "Cambió la memoria consultada y la síntesis.";
  }
  if (diff.knownChanged) return "Cambió la memoria consultada.";
  if (diff.executiveChanged) return "La lectura cambió.";
  return "Sello distinto.";
}

export type SealCause = "evidence" | "memory" | "both" | "synthesis";

/** Why two seals differ. Memory change is never classified as evidence change. */
export function sealCause(newer: Dossier, older: Dossier): SealCause {
  const diff = compareSeals(newer, older);
  if (diff.hashesChanged && diff.knownChanged) return "both";
  if (diff.hashesChanged) return "evidence";
  if (diff.knownChanged) return "memory";
  return "synthesis";
}

export function spawnedFromDossier(goals: Goal[], dossierId: string) {
  return goals.find((goal) => goal.spawnedFromDossierId === dossierId);
}

export function childrenOf(goals: Goal[], goalId: string) {
  return goals.filter((goal) => goal.spawnedFromGoalId === goalId);
}

export function uncoveredEvidence(dossier: Dossier, evidence: Evidence[]) {
  const covered = new Set(dossier.evidenceIds);
  return evidence.filter(
    (item) =>
      item.goalId === dossier.goalId &&
      item.validation === "retrieved" &&
      !covered.has(item.id),
  );
}

export function newSourcesNotInSeal(dossier: Dossier, evidence: Evidence[]) {
  const coveredIds = new Set(dossier.evidenceIds);
  const coveredUrls = new Set(
    evidence.filter((item) => coveredIds.has(item.id)).map((item) => urlKey(item.url)),
  );
  return evidence.filter(
    (item) =>
      item.goalId === dossier.goalId &&
      item.validation === "retrieved" &&
      !coveredIds.has(item.id) &&
      !coveredUrls.has(urlKey(item.url)),
  );
}

export function changedSealedSources(dossier: Dossier, evidence: Evidence[]) {
  const sealed = evidence.filter(
    (item) => item.goalId === dossier.goalId && dossier.evidenceIds.includes(item.id),
  );
  const latestByUrl = new Map<string, Evidence>();
  for (const item of evidence) {
    if (item.goalId !== dossier.goalId || item.validation !== "retrieved") continue;
    const key = urlKey(item.url);
    const prev = latestByUrl.get(key);
    if (!prev || prev.retrievedAt < item.retrievedAt) latestByUrl.set(key, item);
  }
  const changed: Evidence[] = [];
  for (const previous of sealed) {
    const latest = latestByUrl.get(urlKey(previous.url));
    if (latest && latest.contentHash !== previous.contentHash) changed.push(latest);
  }
  return changed;
}

export function sealedEvidence(dossier: Dossier, evidence: Evidence[]) {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  return dossier.evidenceIds
    .map((id) => byId.get(id))
    .filter((item): item is Evidence => {
      if (!item) return false;
      return item.goalId === dossier.goalId && item.validation === "retrieved";
    });

}

/** Sealed observations plus new URLs. Never substitutes a later hash of a sealed URL. */
export function sealedPlusNewEvidence(dossier: Dossier, evidence: Evidence[]) {
  const sealed = sealedEvidence(dossier, evidence);
  const seen = new Set(sealed.map((item) => item.id));
  return [...sealed, ...newSourcesNotInSeal(dossier, evidence).filter((item) => !seen.has(item.id))];
}

export function sealIsStale(dossier: Dossier, evidence: Evidence[]) {
  return uncoveredEvidence(dossier, evidence).length > 0;
}

export function memoryConsultNote(
  dossier: Dossier,
  related: RelatedMemoryHit[],
  memory: MemoryRecord[],
) {
  const alive = new Map(admittedMemory(memory).map((item) => [item.id, item]));
  const knownIds = new Set(dossier.known.map((item) => item.memoryId));
  const gone = dossier.known.some((item) => !alive.has(item.memoryId));
  const evolved = dossier.known.some((item) => {
    const live = alive.get(item.memoryId);
    if (!live) return false;
    if (item.whyHash && live.why && item.findingId && live.findingId !== item.findingId) {
      return true;
    }
    if (item.admittedAt && live.admittedAt && live.admittedAt !== item.admittedAt) {
      return true;
    }
    if (item.lifecycle && live.lifecycle && live.lifecycle !== item.lifecycle) {
      return true;
    }
    return false;
  });
  const missing = related.some((hit) => !knownIds.has(hit.memory.id));
  if ((gone || evolved) && missing) return "La memoria consultada ya no coincide con el Kernel.";
  if (gone) return "Este sello consultó memoria histórica que ya no está vigente.";
  if (evolved) return "Este sello consultó memoria histórica que ya no está vigente.";
  if (missing) return "Hay memoria admitida que este sello no consultó.";
  return null;
}

export function memoryConsultIsStale(
  dossier: Dossier,
  related: RelatedMemoryHit[],
  memory: MemoryRecord[],
) {
  return memoryConsultNote(dossier, related, memory) !== null;
}

export function chooseInstrument(
  dossier: Dossier,
  evidence: Evidence[],
  related: RelatedMemoryHit[],
  memory: MemoryRecord[],
): SealInstrument {
  if (changedSealedSources(dossier, evidence).length) return "RELEER";
  if (newSourcesNotInSeal(dossier, evidence).length) return "INCORPORAR";
  if (memoryConsultIsStale(dossier, related, memory)) return "REINTERPRETAR";
  return "NADA";
}

/**
 * Append a new seal. Never mutates historical seals. Never truncates lineage.
 * Identical sealHash is a no-op. Previous head is the seal no sibling supersedes.
 */
export function commitSeal(existing: Dossier[], incoming: Dossier): Dossier[] {
  const previous = currentSeal(existing, incoming.goalId);
  if (previous && previous.sealHash === incoming.sealHash) {
    return existing;
  }
  const sealed: Dossier = previous
    ? { ...incoming, supersedesId: previous.id }
    : incoming;
  return [sealed, ...existing.filter((item) => item.id !== sealed.id)];
}

export function currentSeal(dossiers: Dossier[], goalId: string): Dossier | undefined {
  const mine = dossiers.filter((item) => item.goalId === goalId);
  if (!mine.length) return undefined;
  const pointed = new Set(
    mine.map((item) => item.supersedesId).filter((id): id is string => Boolean(id)),
  );
  const heads = mine.filter((item) => !pointed.has(item.id));
  if (heads.length === 1) return heads[0];
  return heads.sort(
    (a, b) => b.sealedAt.localeCompare(a.sealedAt) || b.id.localeCompare(a.id),
  )[0];
}

export function sealLineage(dossiers: Dossier[], newest: Dossier): Dossier[] {
  const byId = new Map(dossiers.map((item) => [item.id, item]));
  const chain: Dossier[] = [];
  const seen = new Set<string>();
  let cursor: Dossier | undefined = newest;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.push(cursor);
    cursor = cursor.supersedesId ? byId.get(cursor.supersedesId) : undefined;
  }
  return chain;
}

export function parentSealContext(
  goal: Goal,
  dossiers: Dossier[],
  findings: Finding[],
  goals: Goal[],
) {
  if (!goal.spawnedFromDossierId) return undefined;
  const dossier = dossiers.find((item) => item.id === goal.spawnedFromDossierId);
  if (!dossier) return undefined;
  const parent = goals.find((item) => item.id === dossier.goalId);
  return {
    goal: parent?.text ?? "",
    executive: dossier.executive,
    findings: findings
      .filter((item) => dossier.findingIds.includes(item.id))
      .map((item) => ({ title: item.title, answer: item.answer })),
  };
}

export function dossierToMarkdown(
  dossier: Dossier,
  goal: Goal,
  findings: Finding[],
  evidence: Evidence[],
  memory: MemoryRecord[] = [],
): string {
  const boundFindings = findings.filter((item) => dossier.findingIds.includes(item.id));
  const boundEvidence = evidence.filter((item) => dossier.evidenceIds.includes(item.id));
  const alive = new Set(memory.map((item) => item.id));
  const knownLines = dossier.known.length
    ? dossier.known
        .map((item) => {
          const historic = alive.has(item.memoryId)
            ? ""
            : " — memoria histórica, ya no vigente";
          return `- ${item.title}${historic}`;
        })
        .join("\n")
    : "- Nada. Este es el primer caso relacionado en el núcleo.";

  const sources = boundEvidence
    .map(
      (item) =>
        `- ${item.title} — ${item.url}\n  huella: \`${item.contentHash}\` · HTTP ${item.httpStatus} · ${item.retrievedAt}${item.reused ? " · reutilizada" : ""}`,
    )
    .join("\n");

  const findingBlock = boundFindings
    .map((item) => {
      const delta = item.delta ? ` · delta: ${item.delta}` : "";
      return `### ${item.title}\nConfianza: ${item.confidence}${delta}\n\n${item.answer}`;
    })
    .join("\n\n");

  return [
    `# Dosier · ${goal.text}`,
    "",
    `Sello: \`${dossier.sealHash}\``,
    `Sellado: ${dossier.sealedAt}`,
    `Caso: ${dossier.goalId}`,
    dossier.memoryContextHash
      ? `Contexto de memoria: \`${dossier.memoryContextHash}\``
      : null,
    "",
    "## Síntesis",
    dossier.executive,
    "",
    "## Lo que ya se sabía",
    knownLines,
    "",
    dossier.novel.length ? `## Nuevo en este caso\n${dossier.novel.map((t) => `- ${t}`).join("\n")}\n` : null,
    dossier.confirmed.length
      ? `## Confirmado por evidencia nueva\n${dossier.confirmed.map((t) => `- ${t}`).join("\n")}\n`
      : null,
    dossier.tensions.length
      ? `## Tensión con memoria admitida\n${dossier.tensions.map((t) => `- ${t}`).join("\n")}\n`
      : null,
    "## Hallazgos",
    findingBlock || "_Sin hallazgos vinculados._",
    "",
    dossier.uncertain.length
      ? `## Incierto\n${dossier.uncertain.map((item) => `- ${item}`).join("\n")}\n`
      : null,
    dossier.next ? `## Siguiente\n${dossier.next}\n` : null,
    "## Procedencia",
    sources || "- (sin fuentes vinculadas)",
    "",
    "_Dosier sellado por Efesto. El modelo interpreta; el Kernel admite. La memoria no es evidencia._",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
