import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { IconChevron } from "./icons";
import { ForgeMark } from "./forge-mark";
import { cn } from "@/lib/utils";

function elapsedLabel(ms: number, live: boolean) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (live) return `${sec} s`;
  return sec ? `Pensó ${sec} s` : null;
}

export function ThinkingBar({
  live,
  actor,
  mode,
  line,
  defaultOpen = false,
  goalId,
  children,
  className,
}: {
  live: boolean;
  actor: string;
  mode: string;
  line: string;
  defaultOpen?: boolean;
  goalId?: string;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [ms, setMs] = useState(0);

  useEffect(() => {
    if (!live) return;
    const t0 = Date.now();
    const id = window.setInterval(() => setMs(Date.now() - t0), 250);
    return () => window.clearInterval(id);
  }, [live]);

  const clock = elapsedLabel(ms, live);
  const expandable = Boolean(children);

  return (
    <div
      className={cn("think-bar", className)}
      data-thinking-bar="true"
      data-open={open ? "true" : "false"}
      data-live={live ? "true" : "false"}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => expandable && setOpen((value) => !value)}
          aria-expanded={expandable ? open : undefined}
          disabled={!expandable}
        >
          <ForgeMark live={live} className="size-8 shrink-0" />
          <span className="min-w-0">
            <span className="kicker block">{actor}</span>
            <span className="mt-0.5 flex items-baseline gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <span className={live ? "think-shimmer" : undefined}>{mode}</span>
              </span>
              {clock ? (
                <span className="font-sans text-xs font-normal tabular-nums text-subtle">{clock}</span>
              ) : null}
            </span>
          </span>
          {expandable ? (
            <IconChevron
              className={cn("ml-auto size-4 shrink-0 text-subtle transition-transform duration-150", open && "rotate-90")}
            />
          ) : null}
        </button>
        {goalId ? (
          <Link
            to="/goals/$goalId"
            params={{ goalId }}
            className="shrink-0 text-sm text-accent"
          >
            Abrir caso
          </Link>
        ) : null}
      </div>
      <p className="mt-1 pl-11 text-xs leading-relaxed text-subtle">{line}</p>
      {expandable ? (
        <div className="think-bar-body">
          <div className="think-bar-clip">
            <div className="pt-3">{children}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
