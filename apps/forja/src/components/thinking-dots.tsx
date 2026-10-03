import { cn } from "@/lib/utils";

export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn("think-dots", className)} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}
