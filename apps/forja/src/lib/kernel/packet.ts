import { admitEvidence, admitFinding } from "./admission.ts";
import { attestPacketHash, verifyPacketAttestation, type PacketAttestation } from "./attestation.ts";
import { sha256Hex } from "./hash.ts";
import type {
  Contradiction,
  DiscoverySnapshot,
  Dossier,
  Evidence,
  Finding,
  Goal,
} from "./types.ts";

export type { PacketAttestation };

export const KERNEL_PACKET_PROTOCOL = "efesto-kernel-packet/v1";

export const KERNEL_CONTRACT = Object.freeze({
  modelAdmits: false,
  chatIsEvidence: false,
  memoryIsEvidence: false,
  inventedSources: false,
  httpsOnly: true,
  kernelAdmits: true,
  retrievedIsNotCompletion: true,
  supportRequiredToSeal: true,
});

export type KernelPacketEvidence = {
  id: string;
  url: string;
  sourceHost: string;
  contentHash: string;
  httpStatus: number;
  retrievedAt: string;
  excerpt: string;
  title: string;
};

export type KernelPacketFinding = {
  id: string;
  title: string;
  answer: string;
  confidence: Finding["confidence"];
  evidenceIds: string[];
  uncertainties: string[];
};

export type KernelPacket = {
  protocol: typeof KERNEL_PACKET_PROTOCOL;
  product: "Efesto";
  contract: typeof KERNEL_CONTRACT;
  goal: { id: string; text: string; status: Goal["status"]; stage: Goal["stage"] };
  seal: { hash: string; at: string; executive: string } | null;
  evidence: KernelPacketEvidence[];
  findings: KernelPacketFinding[];
  contradictions: Array<{ kind: string; note: string; open: boolean }>;
  discovery?: Pick<DiscoverySnapshot, "queries" | "found" | "usable" | "domains" | "providers">;
  incomplete: boolean;
  packetHash: string;
  attestation?: PacketAttestation;
};

export function canonicalPacketBody(packet: Omit<KernelPacket, "packetHash" | "attestation">) {
  return JSON.stringify({
    protocol: packet.protocol,
    product: packet.product,
    contract: packet.contract,
    goal: packet.goal,
    seal: packet.seal,
    evidence: packet.evidence.map((item) => ({
      id: item.id,
      url: item.url,
      contentHash: item.contentHash,
      httpStatus: item.httpStatus,
      retrievedAt: item.retrievedAt,
      excerpt: item.excerpt,
    })),
    findings: packet.findings.map((item) => ({
      id: item.id,
      title: item.title,
      answer: item.answer,
      evidenceIds: item.evidenceIds,
      uncertainties: item.uncertainties,
    })),
    contradictions: packet.contradictions,
    discovery: packet.discovery
      ? {
          queries: packet.discovery.queries,
          found: packet.discovery.found,
          usable: packet.discovery.usable,
          domains: packet.discovery.domains,
        }
      : null,
    incomplete: packet.incomplete,
  });
}

export async function buildKernelPacket(input: {
  goal: Goal;
  evidence: Evidence[];
  findings: Finding[];
  dossier?: Dossier | null;
  contradictions?: Contradiction[];
}): Promise<KernelPacket> {
  const evidence = input.evidence.filter((item) => item.goalId === input.goal.id);
  const findings = input.findings.filter((item) => item.goalId === input.goal.id);
  const contradictions = (input.contradictions ?? []).filter((item) => item.goalId === input.goal.id);
  const body: Omit<KernelPacket, "packetHash" | "attestation"> = {
    protocol: KERNEL_PACKET_PROTOCOL,
    product: "Efesto",
    contract: KERNEL_CONTRACT,
    goal: {
      id: input.goal.id,
      text: input.goal.text,
      status: input.goal.status,
      stage: input.goal.stage,
    },
    seal: input.dossier
      ? {
          hash: input.dossier.sealHash,
          at: input.dossier.sealedAt,
          executive: input.dossier.executive,
        }
      : null,
    evidence: evidence.map((item) => ({
      id: item.id,
      url: item.url,
      sourceHost: item.sourceHost,
      contentHash: item.contentHash,
      httpStatus: item.httpStatus,
      retrievedAt: item.retrievedAt,
      excerpt: item.excerpt,
      title: item.title,
    })),
    findings: findings.map((item) => ({
      id: item.id,
      title: item.title,
      answer: item.answer,
      confidence: item.confidence,
      evidenceIds: item.evidenceIds,
      uncertainties: item.uncertainties,
    })),
    contradictions: contradictions.map((item) => ({
      kind: item.kind,
      note: item.note,
      open: item.open,
    })),
    discovery: input.goal.discovery
      ? {
          queries: input.goal.discovery.queries,
          found: input.goal.discovery.found,
          usable: input.goal.discovery.usable,
          domains: input.goal.discovery.domains,
          providers: input.goal.discovery.providers,
        }
      : undefined,
    incomplete: !input.dossier || input.goal.status !== "complete" || evidence.length === 0,
  };
  const packetHash = await sha256Hex(canonicalPacketBody(body));
  return { ...body, packetHash, attestation: await attestPacketHash(packetHash) };
}

export const PACKET_ENVELOPE = "efesto.packet-envelope.v1";

export function unwrapPacketExport(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const row = raw as { kind?: unknown; body?: unknown; packetHash?: unknown; attestation?: unknown };
  if (row.kind !== PACKET_ENVELOPE) return raw;
  if (!row.body || typeof row.body !== "object" || Array.isArray(row.body)) return raw;
  return {
    ...(row.body as object),
    packetHash: row.packetHash,
    attestation: row.attestation,
  };
}

export async function verifyKernelPacket(
  raw: unknown,
  options?: { requireAttestation?: boolean },
): Promise<{ ok: true; packet: KernelPacket; attested: boolean } | { ok: false; reason: string }> {
  raw = unwrapPacketExport(raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "El paquete no es un objeto." };
  }
  const row = raw as Partial<KernelPacket> & { apiKey?: unknown; chat?: unknown };
  if (row.protocol !== KERNEL_PACKET_PROTOCOL || row.product !== "Efesto") {
    return { ok: false, reason: "Protocolo desconocido. Efesto no admite ese paquete." };
  }
  if (row.apiKey || row.chat) {
    return { ok: false, reason: "El paquete no puede llevar claves ni chat." };
  }
  if (row.contract && row.contract.modelAdmits) {
    return { ok: false, reason: "Un paquete no puede afirmar que el modelo admite." };
  }
  if (!Array.isArray(row.evidence) || !Array.isArray(row.findings)) {
    return { ok: false, reason: "El paquete no tiene evidencia o hallazgos como listas." };
  }
  const evidenceAsKernel: Evidence[] = row.evidence.map((item) => ({
    id: item.id,
    goalId: row.goal?.id || "packet",
    url: item.url,
    title: item.title,
    sourceHost: item.sourceHost,
    excerpt: item.excerpt,
    contentHash: item.contentHash,
    retrievedAt: item.retrievedAt,
    httpStatus: item.httpStatus,
    bytes: item.excerpt?.length ?? 0,
    validation: "retrieved",
  }));
  for (const item of evidenceAsKernel) {
    const gate = admitEvidence(item);
    if (!gate.ok) return { ok: false, reason: `Evidencia rechazada: ${gate.reason}` };
  }
  for (const finding of row.findings) {
    const candidate: Finding = {
      id: finding.id,
      goalId: row.goal?.id || "packet",
      title: finding.title,
      answer: finding.answer,
      whyItMatters: "",
      confidence: finding.confidence,
      evidenceIds: finding.evidenceIds,
      uncertainties: finding.uncertainties,
      nextAction: "",
      interpretationAvailable: true,
      createdAt: row.seal?.at || new Date().toISOString(),
    };
    const gate = admitFinding(candidate, evidenceAsKernel, [], row.goal?.text);
    if (!gate.ok) return { ok: false, reason: `Hallazgo rechazado: ${gate.reason}` };
  }
  const { packetHash, attestation, ...rest } = row as KernelPacket;
  if (!packetHash || packetHash.length < 16) {
    return { ok: false, reason: "El paquete no tiene huella." };
  }
  const expected = await sha256Hex(canonicalPacketBody(rest));
  if (expected !== packetHash) {
    return { ok: false, reason: "La huella del paquete no coincide. El Kernel no lo admite." };
  }
  if (attestation) {
    const signed = await verifyPacketAttestation(packetHash, attestation);
    if (!signed.ok) return signed;
    return { ok: true, packet: row as KernelPacket, attested: true };
  }
  if (options?.requireAttestation) {
    return { ok: false, reason: "El paquete no tiene firma. El Kernel no lo admite como atestación." };
  }
  return { ok: true, packet: row as KernelPacket, attested: false };
}
