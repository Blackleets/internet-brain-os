export const PROVIDER_IDS = [
  "openrouter",
  "openai",
  "anthropic",
  "google",
  "xai",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type AITask = "interpret" | "chat";

export type AIRole = "system" | "user" | "assistant";

export type AIMessage = {
  role: AIRole;
  content: string;
};

export type AIModel = {
  id: string;
  label: string;
  provider: ProviderId;
  tasks?: AITask[];
  recommended?: AITask[];
};

export type AICredentials = {
  apiKey: string;
};

export type AIUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
};

export type AIInvocation = {
  provider: ProviderId;
  model: string;
  modelVersion?: string;
  operation: string;
  at: string;
  latencyMs: number;
  usage?: AIUsage;
  fallbackFrom?: { provider: ProviderId; model: string; error: string };
};

export type AISelectionStep = {
  provider: ProviderId;
  model: string;
  apiKey?: string;
};

export type AISelection = AISelectionStep & {
  fallbacks?: AISelectionStep[];
};

export type AISuccess = {
  ok: true;
  text: string;
  invocation: AIInvocation;
};

export type AIFailure = {
  ok: false;
  status: "BLOCKED" | "FAIL";
  error: string;
  invocation: Omit<AIInvocation, "modelVersion"> & { modelVersion?: string };
};

export type AIResult = AISuccess | AIFailure;

export type AICompleteRequest = {
  task: AITask;
  operation: string;
  messages: AIMessage[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  correlationId?: string;
  selection: AISelection;
  envKeys?: Partial<Record<ProviderId, string>>;
};
