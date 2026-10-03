import { useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AgentId, AgentPresence } from "./presence.ts";
import { AGENT_CHOICES } from "./presence.ts";

type PresenceState = {
  expected: AgentId | null;
  live: AgentPresence | null;
  setExpected: (id: AgentId | null) => void;
  setLive: (row: AgentPresence | null) => void;
};

type PersistedPresence = { expected: AgentId | null };

const memoryStorage = createJSONStorage<PersistedPresence>(() => {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
  return localStorage;
});

export const useAgentPresence = create<PresenceState>()(
  persist(
    (set) => ({
      expected: null,
      live: null,
      setExpected: (expected) => set({ expected }),
      setLive: (live) => set({ live }),
    }),
    {
      name: "efesto-agent-presence",
      storage: memoryStorage,
      partialize: (state) => ({ expected: state.expected }),
    },
  ),
);

export function expectedActor(id: AgentId | null): { id: AgentId; label: string } | null {
  if (!id) return null;
  return AGENT_CHOICES.find((item) => item.id === id) ?? { id, label: "Agente" };
}

export function connectedActor(state: { expected: AgentId | null; live: AgentPresence | null }): {
  label: string;
  live: boolean;
} | null {
  if (state.live) {
    const age = Date.now() - Date.parse(state.live.at);
    if (Number.isFinite(age) && age < 90_000) {
      return { label: state.live.label, live: true };
    }
  }
  const expected = expectedActor(state.expected);
  if (expected) return { label: expected.label, live: false };
  return null;
}

export function useHydratePresence() {
  const setLive = useAgentPresence((state) => state.setLive);
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const response = await fetch("/api/agent/presence");
        const data = (await response.json()) as { live?: AgentPresence | null };
        if (!cancelled && data.live) setLive(data.live);
      } catch {
        /* presence is best-effort */
      }
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setLive]);
}
