import type { AffineKind } from "@/lib/motion/mat4";
import { cn } from "@/lib/utils";

const OPS: Array<[AffineKind, string]> = [
  ["identity", "Identidad"],
  ["translate", "Traslación"],
  ["rotate", "Rotación"],
  ["scale", "Escala"],
  ["shear", "Cizalla"],
  ["compose", "T·R·S·H"],
];

export function AffineSwitch({
  value,
  onChange,
}: {
  value: AffineKind;
  onChange: (value: AffineKind) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="kicker">Afín</p>
      {OPS.map(([id, label]) => (
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
