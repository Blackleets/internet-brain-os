import { sha256Hex } from "./hash.ts";
import { canonicalPacketBody, KERNEL_PACKET_PROTOCOL, PACKET_ENVELOPE, type KernelPacket } from "./packet.ts";
import { slugFile } from "./export.ts";

export { PACKET_ENVELOPE };

export type PacketExportKind = "pretty" | "canonical" | "envelope" | "detached";

export type PacketExportSpec = {
  id: PacketExportKind;
  label: string;
  ext: string;
  mime: string;
  note: string;
};

export const PACKET_EXPORT_KINDS: PacketExportSpec[] = [
  {
    id: "pretty",
    label: "JSON legible",
    ext: "json",
    mime: "application/json;charset=utf-8",
    note: "Paquete completo, indentado. Incluye firma. No es el texto de la huella.",
  },
  {
    id: "canonical",
    label: "Cuerpo canónico",
    ext: "json",
    mime: "application/json;charset=utf-8",
    note: "SHA-256 de este texto es packetHash. Sin firma ni espacios.",
  },
  {
    id: "envelope",
    label: "Sobre",
    ext: "json",
    mime: "application/json;charset=utf-8",
    note: "Cuerpo + huella + firma. Hermes y Verificar pegan esto.",
  },
  {
    id: "detached",
    label: "Firma suelta",
    ext: "sig.json",
    mime: "application/json;charset=utf-8",
    note: "Solo hash y Ed25519. El cuerpo viaja aparte.",
  },
];

export type PacketEnvelope = {
  kind: typeof PACKET_ENVELOPE;
  protocol: typeof KERNEL_PACKET_PROTOCOL;
  packetHash: string;
  incomplete: boolean;
  body: ReturnType<typeof JSON.parse>;
  attestation: KernelPacket["attestation"];
};

export function serializePacket(packet: KernelPacket, kind: PacketExportKind): {
  kind: PacketExportKind;
  filename: string;
  mime: string;
  text: string;
  hashesToPacket: boolean;
} {
  const spec = PACKET_EXPORT_KINDS.find((item) => item.id === kind) ?? PACKET_EXPORT_KINDS[0];
  const base = slugFile(packet.goal.text);
  const { packetHash, attestation, ...rest } = packet;
  const canonical = canonicalPacketBody(rest);
  if (kind === "canonical") {
    return {
      kind,
      filename: `${base}-cuerpo.json`,
      mime: spec.mime,
      text: canonical,
      hashesToPacket: true,
    };
  }
  if (kind === "envelope") {
    const envelope: PacketEnvelope = {
      kind: PACKET_ENVELOPE,
      protocol: KERNEL_PACKET_PROTOCOL,
      packetHash,
      incomplete: packet.incomplete,
      body: JSON.parse(canonical),
      attestation,
    };
    return {
      kind,
      filename: `${base}-sobre.json`,
      mime: spec.mime,
      text: JSON.stringify(envelope, null, 2),
      hashesToPacket: false,
    };
  }
  if (kind === "detached") {
    return {
      kind,
      filename: `${base}.sig.json`,
      mime: spec.mime,
      text: JSON.stringify(
        {
          kind: "efesto.packet-detached.v1",
          packetHash,
          incomplete: packet.incomplete,
          attestation: attestation ?? null,
        },
        null,
        2,
      ),
      hashesToPacket: false,
    };
  }
  return {
    kind: "pretty",
    filename: `${base}-packet.json`,
    mime: spec.mime,
    text: JSON.stringify(packet, null, 2),
    hashesToPacket: false,
  };
}

export async function canonicalMatchesHash(packet: KernelPacket): Promise<boolean> {
  const { packetHash, attestation: _attestation, ...rest } = packet;
  const digest = await sha256Hex(canonicalPacketBody(rest));
  return digest === packetHash;
}
