import { Panel } from "./panel";
import { SealMark } from "./seal-mark";
import { WorkingMark } from "./working-status";
import { forgeReceipt } from "@/lib/ui/forge-receipt";
import type { Goal } from "@/lib/kernel/types";

export function ForgeReceipt({
  goal,
  evidenceCount,
  findingCount,
  contradictionCount,
  sealed,
  sealHash,
}: {
  goal: Goal;
  evidenceCount: number;
  findingCount: number;
  contradictionCount: number;
  sealed: boolean;
  sealHash?: string;
}) {
  const receipt = forgeReceipt({
    goal,
    evidenceCount,
    findingCount,
    contradictionCount,
    sealed,
  });
  return (
    <Panel className="p-5" data-forge-receipt={receipt.tone}>
      <div className="mb-4 flex items-center gap-3">
        {receipt.tone === "forged" && sealHash ? (
          <SealMark hash={sealHash} className="size-10 shrink-0" />
        ) : (
          <WorkingMark live={receipt.tone === "forging"} glyph={receipt.tone === "incomplete" ? "error" : "completed"} className="size-10" />
        )}
        <div className="min-w-0">
          <p className="kicker">Recibo de la forja</p>
          <p className="mt-1 font-display text-lg tracking-tight">{receipt.headline}</p>
        </div>
      </div>
      {receipt.reason ? (
        <p className={receipt.tone === "incomplete" ? "mb-3 text-sm text-ember" : "mb-3 text-sm text-danger"}>
          {receipt.reason}
        </p>
      ) : null}
      <dl className="space-y-1.5 text-sm text-muted">
        <div className="flex justify-between gap-4">
          <dt>Fuentes encontradas</dt>
          <dd className="tabular-nums text-fg">{receipt.found}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Utilizables</dt>
          <dd className="tabular-nums text-fg">{receipt.usable}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Dominios</dt>
          <dd className="tabular-nums text-fg">{receipt.domains.length}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Evidencias extraídas</dt>
          <dd className="tabular-nums text-fg">{receipt.extracted}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Hallazgos admitidos</dt>
          <dd className="tabular-nums text-fg">{receipt.findings}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Contradicciones</dt>
          <dd className="tabular-nums text-fg">{receipt.contradictions}</dd>
        </div>
      </dl>
      {receipt.providers.length ? (
        <ul className="mt-4 space-y-1 text-xs text-subtle">
          {receipt.providers.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {receipt.queries.length ? (
        <p className="mt-3 text-xs text-subtle">Buscó: {receipt.queries.slice(0, 4).join(" · ")}</p>
      ) : null}
      {receipt.domains.length ? (
        <p className="mt-2 text-xs text-subtle">{receipt.domains.slice(0, 6).join(" · ")}</p>
      ) : null}
      {receipt.sealed ? (
        <p className="mt-4 text-xs text-subtle">El Kernel selló lo observado. El modelo no admite.</p>
      ) : receipt.tone === "incomplete" ? (
        <p className="mt-4 text-xs text-subtle">El Kernel no inventó fuentes. Eso no es un fallo: es el sello.</p>
      ) : null}
    </Panel>
  );
}
