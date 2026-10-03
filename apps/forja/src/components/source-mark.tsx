import { useState } from "react";
import { cn } from "@/lib/utils";

export function SourceMark({
  host,
  className,
}: {
  host: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const letter = (host.replace(/^www\./, "")[0] ?? "?").toUpperCase();

  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center overflow-hidden rounded-sm bg-surface-2 text-xs font-medium text-accent shadow-border",
        className,
      )}
      title={host}
    >
      {failed ? (
        letter
      ) : (
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`}
          alt=""
          width={16}
          height={16}
          className="size-4"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
