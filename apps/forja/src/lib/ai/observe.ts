import { useKernel } from "../kernel/store.ts";
import type { ActivityAI, ActivityEvent } from "../kernel/types.ts";
import type { AIResult } from "./types.ts";
import { redactSecrets } from "./redact.ts";
import { isProviderId, modelsFor, PROVIDER_META } from "./catalog.ts";

export function recordAIInvocation(input: {
  result: AIResult;
  correlationId?: string;
  goalId?: string;
}) {
  const inv = input.result.invocation;
  const summaryBase = `${inv.provider}/${inv.model}`;
  if (inv.fallbackFrom) {
    useKernel.getState().logActivity({
      kind: "ai.fallback",
      source: "ai",
      summary: `Fallback: ${inv.fallbackFrom.provider}/${inv.fallbackFrom.model} → ${summaryBase}`,
      correlationId: input.correlationId,
      goalId: input.goalId,
      ai: {
        provider: inv.provider,
        model: inv.model,
        modelVersion: inv.modelVersion,
        operation: inv.operation,
        latencyMs: inv.latencyMs,
        fallbackFrom: { provider: inv.fallbackFrom.provider, model: inv.fallbackFrom.model },
      },
    });
  }
  useKernel.getState().logActivity({
    kind: input.result.ok ? "ai.completed" : "ai.failed",
    source: "ai",
    summary: redactSecrets(
      input.result.ok
        ? `Modelo ${summaryBase} · ${inv.operation}`
        : `Modelo ${summaryBase} falló · ${inv.operation}: ${"error" in input.result ? input.result.error : ""}`,
    ),
    correlationId: input.correlationId,
    goalId: input.goalId,
    ai: {
      provider: inv.provider,
      model: inv.model,
      modelVersion: inv.modelVersion,
      operation: inv.operation,
      latencyMs: inv.latencyMs,
      promptTokens: inv.usage?.promptTokens,
      completionTokens: inv.usage?.completionTokens,
      estimatedCostUsd: inv.usage?.estimatedCostUsd,
      fallbackFrom: inv.fallbackFrom
        ? { provider: inv.fallbackFrom.provider, model: inv.fallbackFrom.model }
        : undefined,
    },
  });
}

function asInterpretation(row: ActivityEvent | undefined) {
  if (!row?.ai) return undefined;
  return { ok: row.kind === "ai.completed", ai: row.ai, summary: row.summary };
}

export function latestInterpretation(
  activity: ActivityEvent[],
  goalId: string,
): { ok: boolean; ai: ActivityAI; summary: string } | undefined {
  const row = activity.find(
    (item) =>
      item.goalId === goalId &&
      (item.kind === "ai.completed" || item.kind === "ai.failed") &&
      item.ai?.operation === "interpret" &&
      item.ai,
  );
  return asInterpretation(row);
}

/** The model that interpreted this finding — not a later model on the same case. */
export function interpretationForFinding(
  activity: ActivityEvent[],
  finding: { id: string; goalId: string; createdAt: string },
): { ok: boolean; ai: ActivityAI; summary: string } | undefined {
  const chrono = [...activity].sort((a, b) => {
    const delta = Date.parse(a.at) - Date.parse(b.at);
    if (delta !== 0) return delta;
    const rank = (item: ActivityEvent) =>
      item.kind === "ai.completed" || item.kind === "ai.failed" ? 0 : item.kind === "finding.admitted" ? 2 : 1;
    const ranked = rank(a) - rank(b);
    return ranked !== 0 ? ranked : a.id.localeCompare(b.id);
  });
  const admittedAt = chrono.findIndex(
    (item) => item.kind === "finding.admitted" && item.findingId === finding.id,
  );
  const window =
    admittedAt >= 0
      ? chrono.slice(0, admittedAt)
      : chrono.filter((item) => Date.parse(item.at) <= Date.parse(finding.createdAt));
  for (let index = window.length - 1; index >= 0; index -= 1) {
    const item = window[index];
    if (
      item &&
      item.goalId === finding.goalId &&
      (item.kind === "ai.completed" || item.kind === "ai.failed") &&
      item.ai?.operation === "interpret" &&
      item.ai
    ) {
      return asInterpretation(item);
    }
  }
  return undefined;
}

export function interpretationLabel(ai: Pick<ActivityAI, "provider" | "model">): string {
  const provider = isProviderId(ai.provider) ? PROVIDER_META[ai.provider].label : ai.provider;
  const model = isProviderId(ai.provider)
    ? (modelsFor(ai.provider).find((item) => item.id === ai.model)?.label ?? ai.model)
    : ai.model;
  return `${model} · ${provider}`;
}
