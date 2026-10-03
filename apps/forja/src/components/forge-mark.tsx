import { cn } from "@/lib/utils";

const ANVIL =
  "M3 15.4 11.4 14.5 11.4 12.6 23.2 12.6 26.8 14.8 26.8 17.4 22.2 18.6 20.6 23.2 27.2 24 27.5 28.2 4.5 28.2 4.8 24 11 23.2 10.3 18.6 11.4 17 3 16.8Z";

export function ForgeMark({
  live = false,
  className,
}: {
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 items-center justify-center overflow-visible rounded-md bg-surface-2 shadow-border",
        live && "think-live",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-6 overflow-visible" fill="none">
        {live ? (
          <g className="forge-hammer">
            <path
              d="M9.2 3.4 18.6 13.2"
              className="stroke-ember"
              strokeWidth="1.85"
              strokeLinecap="round"
            />
            <path d="M5.4 1.8 13.6 0.6 15.1 4.6 6.8 6z" className="fill-ember" />
          </g>
        ) : null}
        <path className="forge-anvil fill-accent" d={ANVIL} />
        {live ? (
          <g className="forge-sparks">
            <path className="forge-spark spark-a" d="M20 13.1 22.6 9.2" />
            <path className="forge-spark spark-b" d="M20.4 13.4 24.2 11.4" />
            <path className="forge-spark spark-c" d="M19.6 12.8 19.1 8.4" />
            <path className="forge-spark spark-d" d="M20.8 13.6 23.8 14.8" />
          </g>
        ) : null}
      </svg>
    </span>
  );
}
