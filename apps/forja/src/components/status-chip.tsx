import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  statusPulses,
  statusTone,
  type StatusKind,
} from "@/lib/ui/status-tone";

const toneClass: Record<ReturnType<typeof statusTone>, string> = {
  ok: "text-verified",
  warn: "text-ember",
  err: "text-danger",
  info: "text-muted",
};

const dotClass: Record<ReturnType<typeof statusTone>, string> = {
  ok: "bg-verified",
  warn: "bg-ember",
  err: "bg-danger",
  info: "bg-subtle",
};

export function StatusChip({
  kind,
  className,
}: {
  kind: StatusKind;
  className?: string;
}) {
  const tone = statusTone(kind);
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium shadow-border",
        toneClass[tone],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          dotClass[tone],
          statusPulses(kind) && "status-pulse",
        )}
        aria-hidden
      />
      {STATUS_LABELS[kind]}
    </span>
  );
}
