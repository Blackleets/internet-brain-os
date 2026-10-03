import { cn } from "@/lib/utils";
import {
  workingGlyph,
  workingHeadline,
  type ProgressStep,
  type IntelligenceState,
  type WorkingKind,
} from "@/lib/ui/working-copy";
import { thinkingVoice } from "@/lib/ui/thinking-voice";
import type { ResearchStage } from "@/lib/kernel/types";
import { ForgeMark } from "@/components/forge-mark";
import { ThinkingBar } from "@/components/thinking-bar";

export function WorkingMark({
  live = true,
  className,
  glyph: _glyph = "thinking",
}: {
  live?: boolean;
  className?: string;
  glyph?: IntelligenceState;
}) {
  return <ForgeMark live={live} className={className} />;
}

export function WorkingStatus({
  kind,
  stage,
  model,
  agent,
  steps,
  className,
}: {
  kind: WorkingKind;
  stage?: ResearchStage;
  model?: string;
  agent?: { label: string } | null;
  steps?: ProgressStep[];
  summary?: string;
  className?: string;
}) {
  const finished = steps?.some((step) => step.id === "complete" && step.state === "done") ?? false;
  const headline = workingHeadline(kind, stage, finished);
  const state = workingGlyph(kind, stage, steps, finished);
  const live =
    kind === "chat" ||
    (!finished && stage !== "complete" && stage !== "blocked" && stage !== "failed");
  const forging = live && headline === "Forjando";
  const voice = thinkingVoice({
    state: kind === "chat" ? "thinking" : state,
    model,
    agent,
    live,
  });
  return (
    <ThinkingBar
      className={cn(className, forging && "think-bar-forging")}
      live={live}
      actor={voice.actor}
      mode={kind === "chat" ? voice.mode : headline}
      line={voice.line}
    />
  );
}