import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PacketExportModal } from "./packet-export-modal";
import { Panel } from "./panel";
import { Button } from "./ui/button";
import { IconExport, IconSeal } from "./icons";
import { packetStamp } from "@/lib/ui/packet-stamp";
import { rememberPacket } from "@/lib/kernel/attestation";
import { serializePacket } from "@/lib/kernel/packet-export";
import type { KernelPacket } from "@/lib/kernel/packet";

export function PacketStamp({ packet }: { packet: KernelPacket }) {
  const stamp = packetStamp(packet);
  const [exportOpen, setExportOpen] = useState(false);

  function copy() {
    rememberPacket(packet);
    void navigator.clipboard.writeText(serializePacket(packet, "envelope").text);
  }

  return (
    <Panel className="p-5" data-packet-stamp={stamp.headline}>
      <div className="mb-4 flex items-center gap-3">
        <IconSeal className="size-5 shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="kicker">Kernel Packet</p>
          <p className="mt-1 font-display text-lg tracking-tight">{stamp.headline}</p>
        </div>
      </div>
      <p className="break-all font-mono text-xs leading-relaxed text-subtle">{stamp.short}</p>
      <dl className="mt-4 space-y-1.5 text-sm text-muted">
        <div className="flex justify-between gap-4">
          <dt>Firma</dt>
          <dd>{stamp.attested ? stamp.alg : "ausente"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Evidencia</dt>
          <dd className="tabular-nums text-fg">{stamp.evidence}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Hallazgos</dt>
          <dd className="tabular-nums text-fg">{stamp.findings}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-subtle">{stamp.note}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={copy}>
          Copiar sobre
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)}>
          <IconExport className="size-3.5" />
          Exportar
        </Button>
        <Link
          to="/verificar"
          className="inline-flex min-h-9 items-center rounded-sm px-3 text-sm text-accent"
          onClick={() => rememberPacket(packet)}
        >
          Verificar sello
        </Link>
      </div>
      <PacketExportModal packet={packet} open={exportOpen} onOpenChange={setExportOpen} />
    </Panel>
  );
}
