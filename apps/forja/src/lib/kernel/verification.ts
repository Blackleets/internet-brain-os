import { KERNEL_PACKET_PROTOCOL, type KernelPacket } from "./packet.ts";

/** What this Kernel actually implements. It is not a qualified eIDAS seal. */
export const VERIFICATION_LEVEL = Object.freeze({
  id: "instance-attestation",
  hash: "SHA-256",
  signature: "Ed25519",
  fips: "FIPS 186-5 EdDSA",
  rfc: "RFC 8032",
  canonical: KERNEL_PACKET_PROTOCOL,
  eidas: "none" as const,
  note: "Atestación de instancia. Huella y firma comprueban el paquete. No es firma cualificada eIDAS.",
});

export type CheckState = "pass" | "fail" | "skip";

export type VerificationCheck = {
  id: "protocol" | "integrity" | "signature" | "admission" | "support";
  label: string;
  standard: string;
  state: CheckState;
  detail: string;
};

export type VerificationReport = {
  level: typeof VERIFICATION_LEVEL;
  checks: VerificationCheck[];
  failed: VerificationCheck["id"] | null;
};

function failedLayer(reason: string): VerificationCheck["id"] {
  if (/huella/i.test(reason)) return "integrity";
  if (/firma|atest/i.test(reason)) return "signature";
  if (/Evidencia|Hallazgo|clave|chat|modelo admite/i.test(reason)) return "admission";
  return "protocol";
}

function prior(id: VerificationCheck["id"], failed: VerificationCheck["id"] | null): CheckState {
  if (!failed) return "pass";
  const order: VerificationCheck["id"][] = ["protocol", "integrity", "signature", "admission", "support"];
  const i = order.indexOf(id);
  const f = order.indexOf(failed);
  if (i < f) return "pass";
  if (i === f) return "fail";
  return "skip";
}

export function verificationReport(input: {
  ok: boolean;
  reason?: string;
  attested?: boolean;
  incomplete?: boolean;
  packet?: Pick<KernelPacket, "incomplete" | "seal" | "attestation"> | null;
}): VerificationReport {
  const failed = input.ok ? null : failedLayer(input.reason ?? "");
  const attested = Boolean(input.attested && input.packet?.attestation);
  const incomplete = Boolean(input.incomplete || input.packet?.incomplete);
  const reason = input.reason ?? "Rechazado.";

  const signatureState = attested ? "pass" : prior("signature", failed) === "fail" ? "fail" : "skip";

  const checks: VerificationCheck[] = [
    {
      id: "protocol",
      label: "Protocolo",
      standard: KERNEL_PACKET_PROTOCOL,
      state: prior("protocol", failed),
      detail: prior("protocol", failed) === "fail" ? reason : "Paquete Efesto. No es un chat.",
    },
    {
      id: "integrity",
      label: "Integridad",
      standard: "SHA-256",
      state: prior("integrity", failed),
      detail:
        prior("integrity", failed) === "fail"
          ? reason
          : prior("integrity", failed) === "skip"
            ? "Sin cuerpo canónico."
            : "SHA-256 del cuerpo canónico. Un bit cambia, la huella cambia.",
    },
    {
      id: "signature",
      label: "Firma",
      standard: "Ed25519 · RFC 8032",
      state: signatureState,
      detail:
        signatureState === "fail"
          ? reason
          : signatureState === "pass"
            ? "Ed25519 sobre la huella. Clave de esta instancia, no de un prestador cualificado."
            : "Sin firma. La huella sigue siendo comprobable. Esto no es eIDAS.",
    },
    {
      id: "admission",
      label: "Admisión",
      standard: "Kernel · HTTPS",
      state: prior("admission", failed),
      detail:
        prior("admission", failed) === "fail"
          ? reason
          : prior("admission", failed) === "skip"
            ? "No se llegó a admitir."
            : "HTTPS, huella de página. El modelo no admite. El Kernel sí.",
    },
    {
      id: "support",
      label: "Soporte",
      standard: "Contraste del Kernel",
      state: input.ok ? "pass" : "skip",
      detail: input.ok
        ? incomplete
          ? "Investigación incompleta. El Kernel no sella. Completado no se declara."
          : "Hay sello. Completado es el punzón, no el modelo."
        : "Sin paquete válido no hay contraste.",
    },
  ];

  return { level: VERIFICATION_LEVEL, checks, failed };
}
