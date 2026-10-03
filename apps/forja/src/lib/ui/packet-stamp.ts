import type { KernelPacket } from "../kernel/packet.ts";

export function shortPacketHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

export function packetStamp(packet: KernelPacket): {
  protocol: string;
  hash: string;
  short: string;
  alg: string | null;
  attested: boolean;
  incomplete: boolean;
  evidence: number;
  findings: number;
  headline: string;
  note: string;
} {
  const attested = Boolean(packet.attestation?.signature);
  const incomplete = packet.incomplete;
  return {
    protocol: packet.protocol,
    hash: packet.packetHash,
    short: shortPacketHash(packet.packetHash),
    alg: packet.attestation?.alg ?? null,
    attested,
    incomplete,
    evidence: packet.evidence.length,
    findings: packet.findings.length,
    headline: incomplete
      ? attested
        ? "Incompleto · firmado"
        : "Incompleto"
      : attested
        ? "Sellado · firmado"
        : "Sellado",
    note: incomplete
      ? "El Kernel no inventó fuentes. Otro agente puede verificar este paquete."
      : "El modelo no admite. Otro agente verifica huella y firma, no el chat.",
  };
}
