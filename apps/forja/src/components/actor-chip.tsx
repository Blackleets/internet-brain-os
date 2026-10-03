import { cn } from "@/lib/utils";
import { connectedActor, useAgentPresence, useHydratePresence } from "@/lib/agent/presence-store";

export function ActorChip({ className }: { className?: string }) {
  useHydratePresence();
  const presence = useAgentPresence();
  const actor = connectedActor(presence);
  if (!actor) return null;
  return (
    <p
      className={cn("truncate text-[11px] uppercase tracking-[0.16em] text-subtle", className)}
      data-actor={actor.label}
      data-actor-live={actor.live ? "true" : "false"}
    >
      {actor.live ? `${actor.label} conectado` : `${actor.label} · esperando`}
    </p>
  );
}
