import { cn } from "@/lib/utils";
import type { IntelligenceState } from "@/lib/ui/working-copy";

function layerOn(state: IntelligenceState, group: IntelligenceState[]) {
  return group.includes(state);
}

function ForgeNucleus({ state, live }: { state: IntelligenceState; live: boolean }) {
  const forging = live && state !== "completed" && state !== "error";
  const incoming = layerOn(state, ["searching", "discovering"]);
  const field = layerOn(state, ["investigating", "thinking"]);
  const align = layerOn(state, ["analyzing"]);
  const clash = layerOn(state, ["verifying"]);
  const build = layerOn(state, ["evidence"]);
  const heat = layerOn(state, ["generating", "thinking"]);
  return (
    <svg viewBox="0 0 32 32" className="size-full overflow-visible" fill="none" aria-hidden>
      <path
        d="M16 3.8 26.2 9.6v11.8L16 28.2 5.8 21.4V9.6Z"
        className="stroke-border-strong"
        strokeWidth="1"
      />
      <path
        d="M16 3.8 26.2 9.6v11.8L16 28.2 5.8 21.4V9.6Z"
        className={cn("stroke-current", forging && "think-orbit")}
        strokeWidth="1.35"
        strokeLinejoin="round"
        strokeDasharray="12 52"
      />

      <g className={cn("forge-layer", incoming && "forge-layer-on")}>
        {[0, 60, 120, 180, 240, 300].map((deg, i) => (
          <g key={deg} transform={`rotate(${deg} 16 16)`}>
            <line
              x1="16"
              y1="12.4"
              x2="16"
              y2="5.2"
              className={cn("stroke-current", forging && `forge-ray forge-d${i}`)}
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>

      <g className={cn("forge-layer", (incoming || field) && "forge-layer-on")}>
        <circle cx="16" cy="6.2" r="1.15" className={cn("fill-current", forging && "forge-node")} />
        <circle cx="24.6" cy="11.2" r="1.05" className={cn("fill-current", forging && "forge-node forge-d1")} />
        <circle cx="24.6" cy="20.8" r="1.05" className={cn("fill-current", forging && "forge-node forge-d2")} />
        <circle cx="16" cy="25.8" r="1.15" className={cn("fill-current", forging && "forge-node forge-d3")} />
        <circle cx="7.4" cy="20.8" r="1.05" className={cn("fill-current", forging && "forge-node forge-d4")} />
        <circle cx="7.4" cy="11.2" r="1.05" className={cn("fill-current", forging && "forge-node forge-d5")} />
      </g>

      <g className={cn("forge-layer", align && "forge-layer-on")}>
        <circle
          cx="16"
          cy="16"
          r="9.2"
          className={cn("stroke-current", forging && "forge-align-a")}
          strokeWidth="1.15"
          strokeDasharray="14 44"
          strokeLinecap="round"
        />
        <circle
          cx="16"
          cy="16"
          r="6.4"
          className={cn("stroke-current", forging && "forge-align-b")}
          strokeWidth="1.15"
          strokeDasharray="10 30"
          strokeLinecap="round"
        />
      </g>

      <g className={cn("forge-layer", clash && "forge-layer-on")}>
        <path
          d="M16 6.8v4.6M16 25.2v-4.6M6.8 16h4.6M25.2 16h-4.6"
          className={cn("stroke-current", forging && "forge-converge")}
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      </g>

      <g className={cn("forge-layer", build && "forge-layer-on")}>
        <path d="M11 20.6h10" className={cn("stroke-current", forging && "forge-stack")} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M12 18h8" className={cn("stroke-current", forging && "forge-stack forge-d1")} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M13 15.4h6" className={cn("stroke-current", forging && "forge-stack forge-d2")} strokeWidth="1.4" strokeLinecap="round" />
      </g>

      <circle
        cx="16"
        cy="16"
        r="11.4"
        className={cn("stroke-current forge-layer", (heat || forging) && "forge-layer-on", forging && "forge-halo")}
        strokeWidth="0.9"
      />

      <g className={forging ? "forge-orbit think-orbit" : undefined}>
        <circle cx="16" cy="5.6" r="1.15" className="fill-current" />
        <circle cx="25.4" cy="20.8" r="0.95" className="fill-current opacity-70" />
      </g>
      <g className={forging ? "forge-orbit-rev" : undefined}>
        <circle cx="7.2" cy="19.6" r="1" className="fill-current opacity-80" />
      </g>

      <circle
        cx="16"
        cy="16"
        r="2.7"
        className={cn(
          "fill-current",
          forging && (heat ? "forge-gen-core think-core" : "forge-core think-core"),
          state === "completed" && "forge-settle",
        )}
      />

      <g className={cn("forge-layer", state === "error" && "forge-layer-on", state === "error" && live && "forge-fault")}>
        <path d="M12.2 12.2l7.6 7.6M19.8 12.2l-7.6 7.6" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function EfestoIntelligenceState({
  state,
  live = true,
  className,
}: {
  state: IntelligenceState;
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-visible rounded-full bg-surface-2 shadow-border",
        state === "error" ? "text-danger" : "text-accent",
        className,
      )}
      aria-hidden
      data-intelligence-state={state}
      data-working-glyph={state}
    >
      <ForgeNucleus state={state} live={live} />
    </span>
  );
}
