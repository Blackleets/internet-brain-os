import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_CATALOG, DEFAULT_SELECTION, modelsFor } from "./catalog.ts";
import { listAIAvailability } from "./server.ts";
import type { AIModel, AISelection, ProviderId } from "./types.ts";

export type AIConnection = {
  ok: boolean;
  at: string;
  error?: string;
  source: "env" | "key" | "none";
};

type AIState = {
  provider: ProviderId;
  model: string;
  keys: Partial<Record<ProviderId, string>>;
  fallbacks: Array<{ provider: ProviderId; model: string }>;
  catalogs: Partial<Record<ProviderId, AIModel[]>>;
  connection: Partial<Record<ProviderId, AIConnection>>;
  envAvail?: Partial<Record<ProviderId, boolean>>;
};

type AIActions = {
  select: (provider: ProviderId, model: string) => void;
  setKey: (provider: ProviderId, key: string) => void;
  clearKey: (provider: ProviderId) => void;
  setFallbacks: (fallbacks: Array<{ provider: ProviderId; model: string }>) => void;
  setCatalog: (provider: ProviderId, models: AIModel[]) => void;
  setConnection: (provider: ProviderId, connection: AIConnection) => void;
  setEnvAvail: (envAvail: Partial<Record<ProviderId, boolean>>) => void;
  selection: () => AISelection;
};

const empty: AIState = {
  provider: DEFAULT_SELECTION.provider,
  model: DEFAULT_SELECTION.model,
  keys: {},
  fallbacks: [{ provider: "openrouter", model: "anthropic/claude-sonnet-4" }],
  catalogs: {},
  connection: {},
  envAvail: {},
};

const memoryStorage = createJSONStorage<AIState>(() => {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
  return localStorage;
});

export const useAI = create<AIState & AIActions>()(
  persist(
    (set, get) => ({
      ...empty,
      select: (provider, model) => set({ provider, model }),
      setKey: (provider, key) =>
        set((state) => ({ keys: { ...state.keys, [provider]: key } })),
      clearKey: (provider) =>
        set((state) => {
          const keys = { ...state.keys };
          delete keys[provider];
          return { keys };
        }),
      setFallbacks: (fallbacks) => set({ fallbacks }),
      setCatalog: (provider, models) =>
        set((state) => ({ catalogs: { ...state.catalogs, [provider]: models } })),
      setConnection: (provider, connection) =>
        set((state) => ({ connection: { ...state.connection, [provider]: connection } })),
      setEnvAvail: (envAvail) => set({ envAvail }),
      selection: () => {
        const state = get();
        return {
          provider: state.provider,
          model: state.model,
          apiKey: state.keys[state.provider],
          fallbacks: state.fallbacks.map((item) => ({
            ...item,
            apiKey: state.keys[item.provider],
          })),
        };
      },
    }),
    {
      name: "efesto-ai-v1",
      storage: memoryStorage,
      skipHydration: true,
      partialize: (state) => ({
        provider: state.provider,
        model: state.model,
        keys: state.keys,
        fallbacks: state.fallbacks,
        catalogs: state.catalogs,
        connection: state.connection,
      }),
    },
  ),
);

export function useHydrateAI() {
  const [hydrated, setHydrated] = useState(() => useAI.persist.hasHydrated());
  useEffect(() => {
    if (useAI.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAI.persist.onFinishHydration(() => setHydrated(true));
    void useAI.persist.rehydrate();
    return unsub;
  }, []);
  useEffect(() => {
    void listAIAvailability()
      .then((avail) => useAI.getState().setEnvAvail(avail))
      .catch(() => undefined);
  }, []);
  return hydrated;
}

export function currentModels(provider: ProviderId): AIModel[] {
  return modelsFor(provider, useAI.getState().catalogs);
}

export function currentLabel(): string {
  const state = useAI.getState();
  const model = currentModels(state.provider).find((item) => item.id === state.model);
  return model?.label ?? state.model;
}

export { DEFAULT_CATALOG };
