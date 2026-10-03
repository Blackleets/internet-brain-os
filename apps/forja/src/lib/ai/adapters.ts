import { estimateCostUsd } from "./catalog.ts";
import { redactSecrets } from "./redact.ts";
import type { AICompleteRequest, AIFailure, AIMessage, AIResult, AISuccess, ProviderId } from "./types.ts";

export const PROVIDER_ENDPOINTS: Record<
  ProviderId,
  { host: string; url: string; kind: "openai" | "anthropic" }
> = {
  openai: { host: "api.openai.com", url: "https://api.openai.com/v1/chat/completions", kind: "openai" },
  xai: { host: "api.x.ai", url: "https://api.x.ai/v1/chat/completions", kind: "openai" },
  openrouter: {
    host: "openrouter.ai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    kind: "openai",
  },
  google: {
    host: "generativelanguage.googleapis.com",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    kind: "openai",
  },
  anthropic: { host: "api.anthropic.com", url: "https://api.anthropic.com/v1/messages", kind: "anthropic" },
};

export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

const ALLOWED_HOSTS = new Set(Object.values(PROVIDER_ENDPOINTS).map((item) => item.host));

export function assertProviderUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Solo HTTPS hacia el proveedor.");
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error("Host de proveedor no autorizado.");
  return url;
}

export function providerHttpError(status: number, raw: string, secrets: string[] = []): string {
  const body = redactSecrets(raw, secrets);
  let detail = "";
  try {
    const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown; code?: unknown };
    const err = parsed.error;
    if (typeof err === "string") detail = err;
    else if (err && typeof err === "object") {
      const rec = err as { message?: unknown; code?: unknown };
      detail = [rec.code, rec.message].filter((item) => typeof item === "string").join(": ");
    }
    if (!detail && typeof parsed.message === "string") detail = parsed.message;
    if (!detail && typeof parsed.code === "string") detail = parsed.code;
  } catch {
    detail = body.replace(/\s+/g, " ").trim().slice(0, 180);
  }
  detail = redactSecrets(detail, secrets).replace(/\s+/g, " ").trim().slice(0, 180);
  const spending = /credit|spending|quota|billing|subscription|saldo|crédito/i.test(`${detail} ${body}`);
  if ((status === 401 || status === 403) && spending) {
    return `El proveedor rechazó la clave (HTTP ${status}): sin crédito o suscripción.${detail ? ` ${detail}` : ""}`;
  }
  if (status === 401 || status === 403) {
    return `El proveedor rechazó la clave (HTTP ${status}).${detail ? ` ${detail}` : ""}`;
  }
  return `El proveedor devolvió HTTP ${status}.${detail ? ` ${detail}` : ""}`;
}

function openaiHeaders(provider: ProviderId, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://efesto.local";
    headers["X-Title"] = "Efesto";
  }
  return headers;
}

function asOpenAIMessages(messages: AIMessage[]) {
  return messages.map((item) => ({ role: item.role, content: item.content }));
}

export async function completeWithProvider(input: {
  provider: ProviderId;
  model: string;
  apiKey: string;
  request: AICompleteRequest;
  fetchImpl?: typeof fetch;
  now?: () => string;
}): Promise<AIResult> {
  const started = Date.now();
  const now = input.now ?? (() => new Date().toISOString());
  const fetchImpl = input.fetchImpl ?? fetch;
  const endpoint = PROVIDER_ENDPOINTS[input.provider];
  const secrets = [input.apiKey];
  const invocationBase = {
    provider: input.provider,
    model: input.model,
    operation: input.request.operation,
    at: now(),
    latencyMs: 0,
  };

  const fail = (status: AIFailure["status"], error: string, extra?: Partial<AIFailure["invocation"]>): AIFailure => ({
    ok: false,
    status,
    error: redactSecrets(error, secrets),
    invocation: {
      ...invocationBase,
      ...extra,
      latencyMs: Date.now() - started,
    },
  });

  try {
    assertProviderUrl(endpoint.url);
    if (endpoint.kind === "anthropic") {
      return await completeAnthropic({ ...input, started, now, fetchImpl, secrets, fail });
    }
    return await completeOpenAI({ ...input, started, now, fetchImpl, secrets, fail, endpoint: endpoint.url });
  } catch (error) {
    return fail("FAIL", error instanceof Error ? error.message : "El proveedor falló.");
  }
}

async function completeOpenAI(input: {
  provider: ProviderId;
  model: string;
  apiKey: string;
  request: AICompleteRequest;
  started: number;
  now: () => string;
  fetchImpl: typeof fetch;
  secrets: string[];
  fail: (status: AIFailure["status"], error: string) => AIFailure;
  endpoint: string;
}): Promise<AIResult> {
  const body: Record<string, unknown> = {
    model: input.model,
    temperature: input.request.temperature ?? (input.request.json ? 0.2 : 0.5),
    max_tokens: input.request.maxTokens ?? (input.request.json ? 1200 : 700),
    messages: asOpenAIMessages(input.request.messages),
  };
  if (input.request.json) body.response_format = { type: "json_object" };
  const res = await input.fetchImpl(input.endpoint, {
    method: "POST",
    headers: openaiHeaders(input.provider, input.apiKey),
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    const status = res.status === 401 || res.status === 403 ? "BLOCKED" : "FAIL";
    return input.fail(status, providerHttpError(res.status, raw, input.secrets));
  }
  const parsed = JSON.parse(raw) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const text = parsed.choices?.[0]?.message?.content ?? "";
  const usage = {
    promptTokens: parsed.usage?.prompt_tokens,
    completionTokens: parsed.usage?.completion_tokens,
    totalTokens: parsed.usage?.total_tokens,
  };
  const success: AISuccess = {
    ok: true,
    text,
    invocation: {
      provider: input.provider,
      model: input.model,
      modelVersion: parsed.model,
      operation: input.request.operation,
      at: input.now(),
      latencyMs: Date.now() - input.started,
      usage: {
        ...usage,
        estimatedCostUsd: estimateCostUsd(input.model, usage),
      },
    },
  };
  return success;
}

async function completeAnthropic(input: {
  provider: ProviderId;
  model: string;
  apiKey: string;
  request: AICompleteRequest;
  started: number;
  now: () => string;
  fetchImpl: typeof fetch;
  secrets: string[];
  fail: (status: AIFailure["status"], error: string) => AIFailure;
}): Promise<AIResult> {
  const system = input.request.messages.filter((item) => item.role === "system").map((item) => item.content).join("\n");
  const messages = input.request.messages
    .filter((item) => item.role !== "system")
    .map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.content }));
  const res = await input.fetchImpl(PROVIDER_ENDPOINTS.anthropic.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.request.maxTokens ?? (input.request.json ? 1200 : 700),
      temperature: input.request.temperature ?? (input.request.json ? 0.2 : 0.5),
      system: system || undefined,
      messages,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    const status = res.status === 401 || res.status === 403 ? "BLOCKED" : "FAIL";
    return input.fail(status, providerHttpError(res.status, raw, input.secrets));
  }
  const parsed = JSON.parse(raw) as {
    model?: string;
    content?: Array<{ text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = parsed.content?.map((item) => item.text ?? "").join("\n") ?? "";
  const usage = {
    promptTokens: parsed.usage?.input_tokens,
    completionTokens: parsed.usage?.output_tokens,
    totalTokens: (parsed.usage?.input_tokens ?? 0) + (parsed.usage?.output_tokens ?? 0),
  };
  const success: AISuccess = {
    ok: true,
    text,
    invocation: {
      provider: input.provider,
      model: input.model,
      modelVersion: parsed.model,
      operation: input.request.operation,
      at: input.now(),
      latencyMs: Date.now() - input.started,
      usage: {
        ...usage,
        estimatedCostUsd: estimateCostUsd(input.model, usage),
      },
    },
  };
  return success;
}

export async function listOpenRouterModels(input: {
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; models: Array<{ id: string; name: string }> } | { ok: false; error: string }> {
  try {
    assertProviderUrl(OPENROUTER_MODELS_URL);
    const res = await (input.fetchImpl ?? fetch)(OPENROUTER_MODELS_URL, {
      headers: { Authorization: `Bearer ${input.apiKey}` },
    });
    if (!res.ok) return { ok: false, error: `OpenRouter devolvió HTTP ${res.status}.` };
    return {
      ok: true,
      models: (((await res.json()) as { data?: Array<{ id?: string; name?: string }> }).data ?? [])
        .map((item) => ({
          id: String(item.id ?? ""),
          name: String(item.name ?? item.id ?? ""),
        }))
        .filter((item) => item.id),
    };
  } catch (error) {
    return {
      ok: false,
      error: redactSecrets(error instanceof Error ? error.message : "No se pudo listar modelos.", [input.apiKey]),
    };
  }
}
