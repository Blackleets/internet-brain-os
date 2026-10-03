import { createFileRoute } from "@tanstack/react-router";
import { restVerify } from "@/lib/agent/protocol";
import { agentJson, agentOptions } from "@/lib/agent/http";

export const Route = createFileRoute("/api/agent/verify")({
  server: {
    handlers: {
      OPTIONS: async () => agentOptions(),
      GET: async () =>
        agentJson({
          tool: "efesto.verify_packet",
          method: "POST",
          body: { packet: { protocol: "efesto-kernel-packet/v1" } },
          note: "Rechaza huellas rotas, HTTP, chat, claves y hallazgos sin evidencia.",
        }),
      POST: async ({ request }) => {
        let body: { packet?: unknown } = {};
        try {
          body = (await request.json()) as { packet?: unknown };
        } catch {
          body = {};
        }
        const result = await restVerify(body.packet);
        return agentJson(result);
      },
    },
  },
});
