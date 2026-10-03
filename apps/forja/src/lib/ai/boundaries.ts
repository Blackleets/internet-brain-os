import type { GateResult } from "../kernel/authority.ts";
import type { Evidence, MemoryRecord } from "../kernel/types.ts";

/** The model proposes. The Kernel admits. These stay false. */
export const AI_BOUNDARIES = Object.freeze({
  mayAdmitMemory: false,
  mayCreateEvidence: false,
  mayMutateEvidence: false,
  mayRevokeMemory: false,
  maySupersedeMemory: false,
  mayDecideConfidence: false,
  mayCloseContradiction: false,
  mayMutateSeal: false,
  mayMutatePolicies: false,
  mayMutateKernel: false,
  maySkipAuthority: false,
  mayTreatMemoryAsEvidence: false,
  mayTreatChatAsEvidence: false,
  mayTreatChatAsMemory: false,
});

export function responseAsEvidence(_text: string): GateResult<Evidence> {
  return { ok: false, reason: "Una respuesta del modelo no es evidencia. Solo una fuente HTTPS recuperada puede serlo." };
}

export function responseAsMemory(_text: string): GateResult<MemoryRecord> {
  return { ok: false, reason: "Una respuesta del modelo no es memoria. Solo Memory Authority admite." };
}

export function chatAsEvidence(_content: string): GateResult<Evidence> {
  return { ok: false, reason: "La conversación no es evidencia." };
}

export function chatAsMemory(_content: string): GateResult<MemoryRecord> {
  return { ok: false, reason: "La conversación no entra en memoria. Memory Authority es el único camino." };
}

export function aiAdmitMemory(): GateResult<never> {
  return { ok: false, reason: "La IA no admite memoria." };
}

export function aiSkipAuthority(): GateResult<never> {
  return { ok: false, reason: "La IA no puede saltarse Memory Authority." };
}

export function aiDecideConfidence(): GateResult<never> {
  return { ok: false, reason: "La IA no decide el soporte del Kernel." };
}

export function aiMutatePolicies(): GateResult<never> {
  return { ok: false, reason: "La IA no modifica políticas del Kernel." };
}
