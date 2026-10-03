import type { DiscoverySnapshot, ResearchStage } from "../kernel/types.ts";
import type { IntelligenceState } from "./working-copy.ts";

export type ForgeTraceTone = "pending" | "live" | "done" | "fail";

export type ForgeTraceEntry = {
  id: string;
  phase: IntelligenceState;
  tone: ForgeTraceTone;
  title: string;
  detail?: string;
  items?: string[];
};

function providerLabel(name: string): string {
  const key = name.toLowerCase();
  if (key.includes("wiki")) return "Wikipedia";
  if (key.includes("hacker") || key === "hn") return "Hacker News";
  if (key.includes("google")) return "Google News";
  if (key.includes("duck")) return "DuckDuckGo";
  if (key.includes("url")) return "URL del objetivo";
  return name;
}

function providerLine(probe: DiscoverySnapshot["providers"][number]): string {
  const name = providerLabel(probe.name);
  if (probe.status === "ok") return `${name} · ${probe.hitCount} URL`;
  if (probe.status === "empty") return `${name} · sin URLs utilizables`;
  if (probe.status === "blocked") return `${name} · bloqueado`;
  return `${name} · ${probe.error?.replace(/\.$/, "") || "falló"}`;
}

export function buildForgeTrace(input: {
  stage?: ResearchStage;
  planQueries?: string[];
  discovery?: DiscoverySnapshot;
  leads?: Array<{ sourceHost: string }>;
  evidence?: Array<{ sourceHost: string; title: string }>;
  findingCount?: number;
  contradictionCount?: number;
  sealed?: boolean;
  model?: string;
  blockedReason?: string;
}): ForgeTraceEntry[] {
  const stage = input.stage;
  const queries = (input.discovery?.queries?.length ? input.discovery.queries : input.planQueries) ?? [];
  const evidence = input.evidence ?? [];
  const leads = input.leads ?? [];
  const findingCount = input.findingCount ?? 0;
  const contradictionCount = input.contradictionCount ?? 0;
  const sealed = Boolean(input.sealed);
  const failed = stage === "blocked" || stage === "failed";
  const entries: ForgeTraceEntry[] = [];

  const planning = stage === "understood" || stage === "searching" || !stage;
  entries.push({
    id: "plan",
    phase: "thinking",
    tone: planning && !input.discovery?.providers.length && !failed ? "live" : failed && !queries.length ? "fail" : "done",
    title: queries.length ? `${queries.length} consultas derivadas` : "Preparando el caso",
    items: queries.slice(0, 4),
  });

  const providers = input.discovery?.providers ?? [];
  const searchLive = stage === "searching" || stage === "understood" || !stage;
  if (providers.length) {
    entries.push({
      id: "search",
      phase: "searching",
      tone: failed && (input.discovery?.usable ?? 0) === 0 ? "fail" : searchLive ? "live" : "done",
      title:
        (input.discovery?.found ?? 0) > 0
          ? `Encontradas ${input.discovery?.found} · utilizables ${input.discovery?.usable}`
          : "Buscando en la web pública",
      items: providers.map(providerLine),
    });
  } else if (searchLive || failed) {
    entries.push({
      id: "search",
      phase: "searching",
      tone: failed ? "fail" : "live",
      title: "Buscando en la web pública",
      detail: "Varios proveedores en paralelo. Wikipedia no es el motor.",
    });
  }

  const reading = stage === "reading" || stage === "verifying";
  if (reading || evidence.length || leads.length) {
    const items = [
      ...evidence.slice(0, 6).map((item) => `${item.sourceHost} · retenida`),
      ...(input.discovery?.readFailures ?? []).slice(0, 3),
    ];
    entries.push({
      id: "read",
      phase: "investigating",
      tone: failed && !evidence.length ? "fail" : reading && evidence.length < 3 ? "live" : evidence.length ? "done" : "live",
      title: evidence.length
        ? `${evidence.length} evidencia retenida`
        : leads.length
          ? `Recuperando ${leads.length} pista(s)`
          : "Recuperando páginas",
      items: items.length ? items : undefined,
    });
  }

  if (stage === "interpreting" || findingCount > 0) {
    entries.push({
      id: "interpret",
      phase: "analyzing",
      tone: stage === "interpreting" && !findingCount ? "live" : findingCount ? "done" : "live",
      title: findingCount
        ? `${findingCount} hallazgo admitido`
        : `${input.model ?? "El modelo"} interpreta extractos`,
      detail: "El modelo no admite. El Kernel sí.",
    });
  }

  if (findingCount > 0 || stage === "interpreting") {
    entries.push({
      id: "verify",
      phase: "verifying",
      tone: findingCount ? "done" : "pending",
      title:
        contradictionCount > 0
          ? `${contradictionCount} contradicción detectada`
          : "Comprobando contradicciones",
    });
  }

  if (sealed) {
    entries.push({
      id: "seal",
      phase: "completed",
      tone: "done",
      title: "Caso sellado",
    });
  }

  if (failed) {
    entries.push({
      id: "fail",
      phase: "error",
      tone: "fail",
      title: "Investigación incompleta",
      detail: input.blockedReason || "El Kernel no inventó fuentes.",
    });
  }

  return entries;
}
