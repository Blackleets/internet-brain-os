import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";
import { rememberPacket } from "@/lib/kernel/attestation";
import { downloadText } from "@/lib/kernel/export";
import {
  PACKET_EXPORT_KINDS,
  serializePacket,
  type PacketExportKind,
} from "@/lib/kernel/packet-export";
import type { KernelPacket } from "@/lib/kernel/packet";
import { cn } from "@/lib/utils";

export function PacketExportModal({
  packet,
  open,
  onOpenChange,
}: {
  packet: KernelPacket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [kind, setKind] = useState<PacketExportKind>("envelope");
  const file = useMemo(() => serializePacket(packet, kind), [packet, kind]);
  const spec = PACKET_EXPORT_KINDS.find((item) => item.id === kind)!;

  function copy() {
    rememberPacket(packet);
    void navigator.clipboard.writeText(file.text);
  }

  function download() {
    rememberPacket(packet);
    downloadText(file.filename, file.text, file.mime);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Exportar paquete"
        description="El JSON bonito no es la huella. El cuerpo canónico sí. Completado no se exporta si el Kernel no selló."
      >
        <div className="flex flex-wrap gap-2">
          {PACKET_EXPORT_KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "press min-h-11 rounded-full px-4 text-sm shadow-border",
                kind === item.id ? "bg-accent text-accent-fg" : "bg-surface text-muted hover:text-fg",
              )}
              aria-pressed={kind === item.id}
              onClick={() => setKind(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">{spec.note}</p>
        <p className="mt-2 font-mono text-xs text-subtle">{file.filename}</p>
        <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-surface p-4 font-mono text-xs leading-relaxed text-muted shadow-border">
          {file.text.slice(0, 1200)}
          {file.text.length > 1200 ? "…" : ""}
        </pre>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={copy}>Copiar</Button>
          <Button variant="secondary" onClick={download}>
            Descargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
