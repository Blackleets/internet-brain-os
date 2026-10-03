import { cn } from "@/lib/utils";
import type { IdentityPhase, IdentityStep } from "@/lib/ui/identity";
import type { CSSProperties } from "react";
import { IconAnvil, IconCalda, IconPunch, IconTemple } from "./icons";

const STATIONS: {
  id: IdentityStep["id"];
  label: string;
  Glyph: typeof IconCalda;
}[] = [
  { id: "thinking", label: "Calda", Glyph: IconCalda },
  { id: "forging", label: "Yunque", Glyph: IconAnvil },
  { id: "checking", label: "Temple", Glyph: IconTemple },
  { id: "sealing", label: "Contraste", Glyph: IconPunch },
];

function slotOf(steps: IdentityStep[]): number {
  const sealing = steps.find((step) => step.id === "sealing");
  const completed = steps.find((step) => step.id === "completed");
  if (sealing?.state === "done" || completed?.state === "done") return 3;
  const active = STATIONS.findIndex((station) =>
    steps.some((step) => step.id === station.id && step.state === "active"),
  );
  if (active >= 0) return active;
  const lastDone = [...STATIONS].reverse().findIndex((station) =>
    steps.some((step) => step.id === station.id && step.state === "done"),
  );
  if (lastDone >= 0) return STATIONS.length - 1 - lastDone;
  return 0;
}

function stationState(
  stationId: IdentityStep["id"],
  steps: IdentityStep[],
  slot: number,
  index: number,
  failed: boolean,
): "active" | "done" | "pending" {
  if (failed && stationId === "sealing") return "pending";
  if (index === slot && !failed) return "active";
  const step = steps.find((item) => item.id === stationId);
  if (stationId === "sealing" && steps.some((item) => item.id === "completed" && item.state === "done")) {
    return "done";
  }
  return step?.state === "done" ? "done" : "pending";
}

export function ForgeBillet({
  steps,
  phase,
  live,
  caption,
  className,
}: {
  steps: IdentityStep[];
  phase: IdentityPhase;
  live: boolean;
  caption: string;
  className?: string;
}) {
  const failed = phase === "incomplete";
  const slot = failed ? Math.min(slotOf(steps), 2) : slotOf(steps);

  return (
    <div
      className={cn("forge-bed", className)}
      data-forge-bed="true"
      data-phase={phase}
      data-slot={slot}
      data-live={live ? "true" : "false"}
      style={{ "--slot": slot } as CSSProperties}
    >
      <ol className="forge-stations">
        {STATIONS.map((station, index) => {
          const state = stationState(station.id, steps, slot, index, failed);
          return (
            <li key={station.id} className="forge-station-item" data-state={state}>
              <station.Glyph className="forge-station-mark" />
              <span className="forge-station-label">{station.label}</span>
            </li>
          );
        })}
      </ol>
      <div className="forge-bed-track" aria-hidden>
        <span className={cn("forge-iron", failed && "is-cracked")} />
      </div>
      <p className={cn("forge-bed-caption", failed && "is-fail")}>{caption}</p>
    </div>
  );
}
