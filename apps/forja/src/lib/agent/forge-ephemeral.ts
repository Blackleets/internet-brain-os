import { admitEvidence, admitFinding } from "../kernel/admission.ts";
import { composeDossier } from "../kernel/dossier.ts";
import { buildKernelPacket, type KernelPacket } from "../kernel/packet.ts";
import type { DiscoverySnapshot, Evidence, Finding, Goal } from "../kernel/types.ts";
import { resolveResearchIO, type DiscoveryReport, type ResearchIO } from "../research/io.ts";
import { selectDiverseHits } from "../research/search-parse.ts";
import { normalizeUrl } from "../kernel/watch.ts";
import { shortId } from "../utils.ts";
import { INCOMPLETE_SUPPORT_REASON, goalSupport } from "../kernel/support.ts";

let lastForge = 0;
const FORGE_GAP_MS = 4000;

export function resetAgentForgeGate() {
  lastForge = 0;
}

function snapshotOf(report?: DiscoveryReport): DiscoverySnapshot | undefined {
  if (!report) return undefined;
  return {
    queries: report.queries,
    providers: report.providers.map((probe) => ({
      name: probe.name,
      status: probe.status,
      hitCount: probe.hitCount,
      error: probe.error,
    })),
    found: report.found,
    usable: report.usable,
    domains: report.domains,
    kinds: report.kinds as Record<string, number> | undefined,
    extracted: report.extracted,
    readFailures: report.readFailures,
  };
}

function stubGoal(text: string, discovery?: DiscoverySnapshot): Goal {
  const now = new Date().toISOString();
  return {
    id: shortId("g"),
    text,
    createdAt: now,
    updatedAt: now,
    status: "researching",
    stage: "searching",
    evidenceIds: [],
    findingIds: [],
    leadCount: 0,
    leads: [],
    discovery,
    watched: false,
  };
}

export async function forgeEphemeral(
  goalText: string,
  io?: ResearchIO,
): Promise<{ ok: true; packet: KernelPacket } | { ok: false; reason: string; packet?: KernelPacket }> {
  const text = goalText.trim();
  if (text.length < 3) return { ok: false, reason: "El objetivo es demasiado corto." };
  if (text.length > 400) return { ok: false, reason: "El objetivo es demasiado largo." };
  const now = Date.now();
  if (now - lastForge < FORGE_GAP_MS) {
    return { ok: false, reason: "El Kernel limita la forja para agentes. Espera un momento." };
  }
  lastForge = now;

  const resolved = await resolveResearchIO(io);
  const search = await resolved.searchPublicWeb({ data: { query: text } });
  const discovery = snapshotOf(search.discovery);
  const goal = stubGoal(text, discovery);
  if (!search.ok) {
    goal.status = "blocked";
    goal.stage = "blocked";
    goal.blockedReason = search.error;
    const packet = await buildKernelPacket({ goal, evidence: [], findings: [] });
    return { ok: false, reason: search.error, packet };
  }
  goal.leads = search.hits;
  goal.leadCount = search.hits.length;
  goal.stage = "reading";

  const chosen = selectDiverseHits(search.hits, text, { limit: 4, maxPerHost: 2 });
  const admitted: Evidence[] = [];
  const already = new Set<string>();
  for (let offset = 0; offset < chosen.length && admitted.length < 3; offset += 3) {
    const batch = chosen.slice(offset, offset + 3);
    const reads = await Promise.all(
      batch.map((hit) => resolved.readPublicWeb({ data: { url: hit.url } }).then((read) => ({ hit, read }))),
    );
    for (const { hit, read } of reads) {
      if (admitted.length >= 3) break;
      if (!read.ok) continue;
      const key = normalizeUrl(read.url);
      if (already.has(key)) continue;
      const evidence: Evidence = {
        id: shortId("e"),
        goalId: goal.id,
        url: read.url,
        title: read.title || hit.title,
        sourceHost: read.sourceHost,
        excerpt: read.excerpt,
        contentHash: read.contentHash,
        retrievedAt: read.retrievedAt,
        httpStatus: read.httpStatus,
        bytes: read.bytes,
        validation: "retrieved",
      };
      const gate = admitEvidence(evidence);
      if (!gate.ok) continue;
      admitted.push(evidence);
      already.add(key);
    }
  }

  if (!admitted.length) {
    goal.status = "blocked";
    goal.stage = "blocked";
    const packet = await buildKernelPacket({ goal, evidence: [], findings: [] });
    return {
      ok: false,
      reason: "Investigación incompleta. Se encontraron pistas, pero ninguna fuente pública se admitió como evidencia.",
      packet,
    };
  }

  goal.evidenceIds = admitted.map((item) => item.id);
  goal.stage = "interpreting";
  const interpretation = await resolved.interpretEvidence({
    data: {
      goal: text,
      evidence: admitted.map((item) => ({
        title: item.title,
        url: item.url,
        excerpt: item.excerpt,
      })),
    },
  });

  const findings: Finding[] = [];
  if (interpretation.ok && interpretation.available) {
    for (const item of interpretation.findings) {
      const evidenceIds = item.evidenceIndexes
        .map((index) => admitted[index]?.id)
        .filter((id): id is string => Boolean(id));
      if (!evidenceIds.length) continue;
      const finding: Finding = {
        id: shortId("f"),
        goalId: goal.id,
        title: item.title || "Hallazgo",
        answer: item.answer,
        whyItMatters: item.whyItMatters,
        confidence: item.confidence,
        evidenceIds,
        uncertainties: item.uncertainties,
        nextAction: item.nextAction,
        interpretationAvailable: true,
        createdAt: new Date().toISOString(),
      };
      const gate = admitFinding(finding, admitted, [], text);
      if (gate.ok) findings.push(finding);
    }
  }

  goal.findingIds = findings.map((item) => item.id);
  const dossier =
    findings.length > 0
      ? await composeDossier({
          goal,
          findings,
          evidence: admitted,
          related: [],
        })
      : null;
  if (dossier) {
    goal.status = "complete";
    goal.stage = "complete";
  } else {
    const support = goalSupport({ goalText: text, evidence: admitted, findings });
    goal.status = "blocked";
    goal.stage = "blocked";
    goal.blockedReason = !support.ok
      ? INCOMPLETE_SUPPORT_REASON
      : interpretation.ok && !interpretation.available
        ? `Evidencia retenida. ${interpretation.reason} El Kernel no inventó un hallazgo.`
        : "Evidencia retenida, pero el Kernel no selló un hallazgo.";
  }
  const packet = await buildKernelPacket({
    goal,
    evidence: admitted,
    findings,
    dossier,
  });
  if (!dossier) {
    return {
      ok: false,
      reason: goal.blockedReason ?? INCOMPLETE_SUPPORT_REASON,
      packet,
    };
  }
  return { ok: true, packet };
}
