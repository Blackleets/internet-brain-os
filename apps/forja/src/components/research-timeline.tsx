import type { ResearchStage } from "@/lib/kernel/types";
import { cn } from "@/lib/utils";

const steps: Array<{ id: ResearchStage; label: string; note: string }> = [
  { id: "understood", label: "Entendido", note: "Caso abierto" },
  { id: "searching", label: "Buscando", note: "Fuentes públicas" },
  { id: "reading", label: "Leyendo", note: "Recuperando evidencia" },
  { id: "interpreting", label: "Interpretando", note: "Sobre evidencia admitida" },
  { id: "complete", label: "Completado", note: "Solo si el Kernel selló" },
];

function visualStage(stage: ResearchStage): ResearchStage {
  if (stage === "verifying") return "reading";
  if (stage === "failed" || stage === "blocked") return "searching";
  return stage;
}

export function ResearchTimeline({
  stage,
  blockedReason,
  interpretNote,
}: {
  stage: ResearchStage;
  blockedReason?: string;
  interpretNote?: string;
}) {
  const currentId = visualStage(stage);
  const current = steps.findIndex((step) => step.id === currentId);
  return (
    <ol className="relative space-y-0">
      <span
        className="absolute left-[7px] top-2 bottom-2 w-px bg-border"
        aria-hidden
      />
      {steps.map((step, index) => {
        const done = stage === "complete" || (current !== -1 && current > index);
        const active =
          stage !== "complete" &&
          stage !== "blocked" &&
          stage !== "failed" &&
          step.id === currentId;
        const note = step.id === "interpreting" && interpretNote ? interpretNote : step.note;
        return (
          <li key={step.id} className="relative flex gap-3 py-2.5 text-sm">
            <span
              className={cn(
                "relative z-10 mt-1.5 grid size-[15px] place-items-center rounded-full bg-bg",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  done ? "bg-verified" : active ? "bg-ember status-pulse" : "bg-subtle",
                )}
              />
            </span>
            <span>
              <span className={cn("block", done || active ? "text-fg" : "text-muted")}>
                {step.label}
                {active ? "…" : ""}
              </span>
              <span className="block text-xs text-subtle">{note}</span>
            </span>
          </li>
        );
      })}
      {stage === "blocked" || stage === "failed" ? (
        <li className="ml-6 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {blockedReason ?? "Investigación incompleta. El Kernel no inventó fuentes."}
        </li>
      ) : null}
    </ol>
  );
}
