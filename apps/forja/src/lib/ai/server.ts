import { createServerFn } from "@tanstack/react-start";
import { completeAI, envKeysFromProcess } from "./complete.ts";
import { listOpenRouterModels } from "./adapters.ts";
import { DEFAULT_CATALOG, envKeyPresent, isProviderId } from "./catalog.ts";
import { PROVIDER_IDS, type AICompleteRequest, type AIModel, type ProviderId } from "./types.ts";
import { collectSecrets, redactSecrets } from "./redact.ts";

export type EnvAvailability = Record<ProviderId, boolean>;

export const listAIAvailability = createServerFn({ method: "GET" }).handler(
  async (): Promise<EnvAvailability> => {
    const env = process.env as Record<string, string | undefined>;
    const out = {} as EnvAvailability;
    for (const id of PROVIDER_IDS) out[id] = envKeyPresent(id, env);
    return out;
  },
);

export const completeAIRequest = createServerFn({ method: "POST" })
  .validator((input: AICompleteRequest) => input)
  .handler(async ({ data }) => {
    const secrets = collectSecrets([
      data.selection.apiKey,
      ...(data.selection.fallbacks ?? []).map((item) => item.apiKey),
    ]);
    try {
      return await completeAI({
        ...data,
        envKeys: envKeysFromProcess(),
      });
    } catch (error) {
      return {
        ok: false as const,
        status: "FAIL" as const,
        error: redactSecrets(error instanceof Error ? error.message : "El proveedor falló.", secrets),
        invocation: {
          provider: data.selection.provider,
          model: data.selection.model,
          operation: data.operation,
          at: new Date().toISOString(),
          latencyMs: 0,
        },
      };
    }
  });

export const refreshOpenRouterCatalog = createServerFn({ method: "POST" })
  .validator((input: { apiKey?: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; models: AIModel[] } | { ok: false; error: string }> => {
    const apiKey = data.apiKey?.trim() || envKeysFromProcess().openrouter || "";
    if (!apiKey) return { ok: false, error: "OpenRouter no tiene clave." };
    const listed = await listOpenRouterModels({ apiKey });
    if (!listed.ok) return listed;
    return {
      ok: true,
      models: listed.models.slice(0, 80).map((item) => ({
        id: item.id,
        label: item.name || item.id,
        provider: "openrouter" as const,
      })),
    };
  });

export const probeProvider = createServerFn({ method: "POST" })
  .validator((input: { provider: string; model: string; apiKey?: string }) => input)
  .handler(async ({ data }) => {
    if (!isProviderId(data.provider)) {
      return { ok: false as const, error: "Proveedor desconocido." };
    }
    const result = await completeAI({
      task: "chat",
      operation: "probe",
      messages: [{ role: "user", content: "Responde con la palabra ok." }],
      maxTokens: 8,
      temperature: 0,
      selection: { provider: data.provider, model: data.model, apiKey: data.apiKey },
      envKeys: envKeysFromProcess(),
    });
    if (!result.ok) return { ok: false as const, error: result.error, provider: data.provider, model: data.model };
    return {
      ok: true as const,
      provider: result.invocation.provider,
      model: result.invocation.model,
      latencyMs: result.invocation.latencyMs,
    };
  });

export { DEFAULT_CATALOG };
