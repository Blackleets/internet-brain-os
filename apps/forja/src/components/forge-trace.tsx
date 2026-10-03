import { ThinkingBar } from "@/components/thinking-bar";
import { ForgeBillet } from "@/components/forge-billet";
import {
  workingGlyph,
  type ProgressStep,
  type WorkingKind,
} from "@/lib/ui/working-copy";
import { identitySteps } from "@/lib/ui/identity";
import { buildForgeTrace } from "@/lib/ui/forge-trace";
import { thinkingVoice } from "@/lib/ui/thinking-voice";
import type { DiscoverySnapshot, ResearchStage } from "@/lib/kernel/types";

export function ForgeTrace({
  kind,
  stage,
  model,
  agent,
  steps,
  planQueries,
  discovery,
  leads,
  evidence,
  findingCount,
  contradictionCount,
  sealed,
  blockedReason,
  className,
}: {
  kind: WorkingKind;
  stage?: ResearchStage;
  model?: string;
  agent?: { label: string } | null;
  steps?: ProgressStep[];
  planQueries?: string[];
  discovery?: DiscoverySnapshot;
  leads?: Array<{ sourceHost: string }>;
  evidence?: Array<{ sourceHost: string; title: string }>;
  findingCount?: number;
  contradictionCount?: number;
  sealed?: boolean;
  blockedReason?: string;
  className?: string;
}) {
  const finished = steps?.some((step) => step.id === "complete" && step.state === "done") ?? false;
  const state = workingGlyph(kind, stage, steps, finished);
  const live =
    !finished && stage !== "complete" && stage !== "blocked" && stage !== "failed";
  const entries = buildForgeTrace({
    stage,
    planQueries,
    discovery,
    leads,
    evidence,
    findingCount,
    contradictionCount,
    sealed,
    model,
    blockedReason,
  });
  const voice = thinkingVoice({ state, model, agent, live });
  const failed = stage === "blocked" || stage === "failed";
  const identity = identitySteps({
    stage: stage ?? "understood",
    status: sealed ? "complete" : failed ? "blocked" : "researching",
    leadCount: leads?.length ?? 0,
    evidenceCount: evidence?.length ?? 0,
    findingCount: findingCount ?? 0,
    sealed: Boolean(sealed),
  });
  const liveEntry = entries.find((entry) => entry.tone === "live") ?? entries.find((entry) => entry.tone === "fail");
  const caption = liveEntry?.title ?? voice.line;

  return (
    <section
      className={className}
      role="status"
      aria-live="polite"
      aria-label={`${voice.actor}. ${voice.mode}. ${voice.line}`}
      data-intelligence-state={state}
      data-forge-trace="true"
      data-actor={voice.actor}
      data-identity-phase={identity.phase}
      data-identity-rail="true"
    >
      <ThinkingBar
        live={live}
        actor={voice.actor}
        mode={voice.mode}
        line={voice.line}
        defaultOpen
      >
        <ForgeBillet
          steps={identity.steps}
          phase={identity.phase}
          live={live}
          caption={caption}
        />
      </ThinkingBar>
    </section>
  );
}
