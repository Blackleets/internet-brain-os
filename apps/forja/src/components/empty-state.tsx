import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg bg-surface px-5 py-8 shadow-border",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-md bg-surface-2 text-accent shadow-border">
        {icon}
      </span>
      <h3 className="font-display text-2xl tracking-tight">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  );
}
