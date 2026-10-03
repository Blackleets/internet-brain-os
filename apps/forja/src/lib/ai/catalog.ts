import { PROVIDER_IDS, type AIModel, type AITask, type ProviderId } from "./types.ts";

export const PROVIDER_META: Record<
  ProviderId,
  { id: ProviderId; label: string; hint: string; envKeys: string[] }
> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    hint: "Un acceso a muchos modelos. Recomendado si quieres cambiar sin cambiar de clave.",
    envKeys: ["OPENROUTER_API_KEY"],
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    hint: "GPT y modelos de OpenAI.",
    envKeys: ["OPENAI_API_KEY"],
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    hint: "Claude.",
    envKeys: ["ANTHROPIC_API_KEY"],
  },
  google: {
    id: "google",
    label: "Google",
    hint: "Gemini.",
    envKeys: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
  },
  xai: {
    id: "xai",
    label: "xAI",
    hint: "Grok.",
    envKeys: ["XAI_API_KEY"],
  },
};

/** Built-in catalog. Not authority — a starting list that refresh can replace. */
export const DEFAULT_CATALOG: Record<ProviderId, AIModel[]> = {
  openrouter: [
    { id: "x-ai/grok-4.5", label: "Grok 4.5", provider: "openrouter", recommended: ["interpret", "chat"] },
    { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", provider: "openrouter", recommended: ["interpret"] },
    { id: "openai/gpt-4o", label: "GPT-4o", provider: "openrouter", recommended: ["chat"] },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "openrouter" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o", provider: "openai", recommended: ["interpret", "chat"] },
    { id: "gpt-4.1", label: "GPT-4.1", provider: "openai" },
    { id: "o4-mini", label: "o4-mini", provider: "openai" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "anthropic", recommended: ["interpret", "chat"] },
    { id: "claude-opus-4-20250514", label: "Claude Opus 4", provider: "anthropic", recommended: ["interpret"] },
  ],
  google: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google", recommended: ["interpret"] },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", recommended: ["chat"] },
  ],
  xai: [
    { id: "grok-4.5", label: "Grok 4.5", provider: "xai", recommended: ["interpret", "chat"] },
    { id: "grok-4", label: "Grok 4", provider: "xai" },
    { id: "grok-3", label: "Grok 3", provider: "xai" },
  ],
};

export const DEFAULT_SELECTION = {
  provider: "xai" as ProviderId,
  model: "grok-4.5",
};

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

export function modelsFor(provider: ProviderId, catalog?: Partial<Record<ProviderId, AIModel[]>>): AIModel[] {
  const live = catalog?.[provider];
  if (live?.length) return live;
  return DEFAULT_CATALOG[provider];
}

export function defaultModelFor(
  provider: ProviderId,
  selected: { provider: ProviderId; model: string },
  catalogs?: Partial<Record<ProviderId, AIModel[]>>,
  task: AITask = "interpret",
): string {
  if (provider === selected.provider && selected.model.trim()) return selected.model;
  const models = modelsFor(provider, catalogs);
  return models.find((item) => item.recommended?.includes(task))?.id ?? models[0]?.id ?? selected.model;
}

export function recommendedFor(task: AITask, catalog?: Partial<Record<ProviderId, AIModel[]>>): AIModel[] {
  return PROVIDER_IDS.flatMap((id) => modelsFor(id, catalog)).filter((item) =>
    item.recommended?.includes(task),
  );
}

export function envKeyPresent(provider: ProviderId, env: Record<string, string | undefined> = {}): boolean {
  return PROVIDER_META[provider].envKeys.some((key) => Boolean(env[key]?.trim()));
}

export function readEnvKey(provider: ProviderId, env: Record<string, string | undefined> = {}): string {
  for (const key of PROVIDER_META[provider].envKeys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return "";
}

/** Observability only. Unknown models stay undefined. */
export function estimateCostUsd(model: string, usage?: { promptTokens?: number; completionTokens?: number }): number | undefined {
  if (!usage) return undefined;
  const prompt = usage.promptTokens ?? 0;
  const completion = usage.completionTokens ?? 0;
  if (!prompt && !completion) return undefined;
  const row = COST_PER_MILLION.find((item) => model.includes(item.match));
  if (!row) return undefined;
  return Number((((prompt * row.in) + (completion * row.out)) / 1_000_000).toFixed(6));
}

const COST_PER_MILLION: Array<{ match: string; in: number; out: number }> = [
  { match: "grok-4.5", in: 3, out: 15 },
  { match: "grok-4", in: 3, out: 15 },
  { match: "gpt-4o", in: 2.5, out: 10 },
  { match: "claude-sonnet", in: 3, out: 15 },
  { match: "claude-opus", in: 15, out: 75 },
  { match: "gemini-2.5-pro", in: 1.25, out: 10 },
  { match: "gemini-2.5-flash", in: 0.15, out: 0.6 },
];
