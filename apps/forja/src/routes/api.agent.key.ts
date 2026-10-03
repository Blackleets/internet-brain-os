import { createFileRoute } from "@tanstack/react-router";
import { instanceAttestationInfo } from "@/lib/kernel/attestation";
import { agentJson, agentOptions } from "@/lib/agent/http";

export const Route = createFileRoute("/api/agent/key")({
  server: {
    handlers: {
      OPTIONS: async () => agentOptions(),
      GET: async () => agentJson(await instanceAttestationInfo()),
    },
  },
});
