import { completeWithProvider } from "./adapters.ts";
import { isProviderId, readEnvKey } from "./catalog.ts";
import { collectSecrets, redactSecrets } from "./redact.ts";
import type {
  AICompleteRequest,
  AIFailure,
  AIResult,
  AISelectionStep,
  ProviderId,
} from "./types.ts";

export function resolveKey(
  step: AISelectionStep,
  envKeys: Partial<Record<ProviderId, string>> = {},
): string {
  return (step.apiKey?.trim() || envKeys[step.provider] || "").trim();
}

export function envKeysFromProcess(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>) {
  const keys: Partial<Record<ProviderId, string>> = {};
  for (const provider of ["openrouter", "openai", "anthropic", "google", "xai"] as ProviderId[]) {
    const value = readEnvKey(provider, env);
    if (value) keys[provider] = value;
  }
  return keys;
}

function chainOf(request: AICompleteRequest): AISelectionStep[] {
  const primary: AISelectionStep = {
    provider: request.selection.provider,
    model: request.selection.model,
    apiKey: request.selection.apiKey,
  };
  const rest = (request.selection.fallbacks ?? []).filter(
    (item) => isProviderId(item.provider) && item.model.trim().length > 0,
  );
  return [primary, ...rest];
}

type Attempt = {
  provider: ProviderId;
  model: string;
  error: string;
  status: "BLOCKED" | "FAIL";
};

export async function completeAI(
  request: AICompleteRequest,
  opts?: { fetchImpl?: typeof fetch; now?: () => string },
): Promise<AIResult> {
  const secrets = collectSecrets([
    request.selection.apiKey,
    ...(request.selection.fallbacks ?? []).map((item) => item.apiKey),
    ...Object.values(request.envKeys ?? {}),
  ]);
  const steps = chainOf(request);
  const attempts: Attempt[] = [];

  for (const step of steps) {
    if (!isProviderId(step.provider)) {
      attempts.push({
        provider: "xai",
        model: step.model,
        error: "Proveedor desconocido.",
        status: "FAIL",
      });
      continue;
    }
    const apiKey = resolveKey(step, request.envKeys);
    if (!apiKey) {
      attempts.push({
        provider: step.provider,
        model: step.model,
        error: "Sin clave para este proveedor.",
        status: "BLOCKED",
      });
      continue;
    }
    const result = await completeWithProvider({
      provider: step.provider,
      model: step.model,
      apiKey,
      request,
      fetchImpl: opts?.fetchImpl,
      now: opts?.now,
    });
    if (result.ok) {
      if (attempts.length) {
        const last = attempts[attempts.length - 1];
        return {
          ...result,
          invocation: {
            ...result.invocation,
            fallbackFrom: last,
          },
        };
      }
      return result;
    }
    attempts.push({
      provider: step.provider,
      model: step.model,
      error: redactSecrets(result.error, secrets),
      status: result.status,
    });
  }

  const last = attempts[attempts.length - 1];
  const allBlocked = attempts.length > 0 && attempts.every((item) => item.status === "BLOCKED");
  const failure: AIFailure = {
    ok: false,
    status: !last || allBlocked ? "BLOCKED" : "FAIL",
    error: redactSecrets(
      last?.error || "Ningún proveedor de interpretación está configurado.",
      secrets,
    ),
    invocation: {
      provider: request.selection.provider,
      model: request.selection.model,
      operation: request.operation,
      at: (opts?.now ?? (() => new Date().toISOString()))(),
      latencyMs: 0,
      fallbackFrom: attempts.length > 1 ? attempts[attempts.length - 2] : undefined,
    },
  };
  return failure;
}

export function invocationHasSecret(result: AIResult, secrets: string[]): boolean {
  const blob = JSON.stringify(result);
  return secrets.some((secret) => secret && blob.includes(secret));
}
