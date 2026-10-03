import { Link } from "@tanstack/react-router";
import { StatusChip } from "./status-chip";
import { Panel } from "./panel";
import { SourceMark } from "./source-mark";
import { IconWatch } from "./icons";
import type { WatchPass } from "@/lib/kernel/types";
import { watchSummary } from "@/lib/kernel/watch";
import { formatWhen } from "@/lib/utils";

export function WatchPanel({ pass }: { pass: WatchPass }) {
  return (
    <Panel className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <IconWatch className="size-4 text-ember" />
        <h2 className="text-sm font-medium">Última relectura</h2>
        <span className="text-xs text-subtle">{formatWhen(pass.at)}</span>
      </div>
      <p className="text-sm text-muted">{watchSummary(pass)}</p>
      <p className="mt-2 text-sm text-subtle">
        Se releen las fuentes ya admitidas. No es una búsqueda nueva. Una huella distinta
        es una observación nueva, no un recorte de la anterior.
      </p>
      <ul className="mt-4 space-y-3">
        {pass.observations.map((item) => (
          <li key={`${item.previousEvidenceId}-${item.status}`} className="flex min-w-0 items-start gap-3">
            <SourceMark host={item.sourceHost} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm">{item.sourceHost}</p>
                <StatusChip kind={item.status} />
              </div>
              <p className="mt-1 break-all font-mono text-[11px] text-subtle">
                {item.previousHash.slice(0, 12)}
                {item.currentHash && item.currentHash !== item.previousHash
                  ? ` → ${item.currentHash.slice(0, 12)}`
                  : ""}
              </p>
              <p className="mt-1 flex flex-wrap gap-3 text-xs">
                <Link
                  to="/evidence/$evidenceId"
                  params={{ evidenceId: item.previousEvidenceId }}
                  className="text-accent"
                >
                  Anterior
                </Link>
                {item.newEvidenceId ? (
                  <Link
                    to="/evidence/$evidenceId"
                    params={{ evidenceId: item.newEvidenceId }}
                    className="text-accent"
                  >
                    Nueva
                  </Link>
                ) : null}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
