import { createFileRoute } from "@tanstack/react-router";
import { listPresence, liveAgent } from "@/lib/agent/presence";
import { agentJson, agentOptions } from "@/lib/agent/http";

export const Route = createFileRoute("/api/agent/presence")({
  server: {
    handlers: {
      OPTIONS: async () => agentOptions(),
      GET: async () =>
        agentJson({
          live: liveAgent(),
          seen: listPresence(),
          note: "El Kernel nombra al agente que consultó. El bot no admite evidencia.",
        }),
    },
  },
});
