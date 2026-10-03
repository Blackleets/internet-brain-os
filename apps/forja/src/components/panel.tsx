import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  hover = false,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-surface shadow-border",
        hover && "transition-colors duration-150 hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
