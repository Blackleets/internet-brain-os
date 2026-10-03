import type { ProjectionKind } from "@/lib/motion/mat4";
import { cn } from "@/lib/utils";

export function ProjectionSwitch({
  value,
  onChange,
}: {
  value: ProjectionKind;
  onChange: (value: ProjectionKind) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="kicker">Proyección</p>
      {(
        [
          ["perspective", "Perspectiva"],
          ["ortho", "Ortográfica"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={cn(
            "press min-h-11 rounded-full px-4 text-sm shadow-border",
            value === id ? "bg-accent text-accent-fg" : "bg-surface text-muted hover:text-fg",
          )}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
