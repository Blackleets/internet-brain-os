import { KERNEL_CONTRACT, KERNEL_PACKET_PROTOCOL, verifyKernelPacket } from "../kernel/packet.ts";
import { verificationReport } from "../kernel/verification.ts";
import { forgeEphemeral } from "./forge-ephemeral.ts";
import { AGENT_PROMPTS, AGENT_PROTOCOL, AGENT_RESOURCES, AGENT_TOOLS } from "./constants.ts";
import { agentEndpoints, openClawSkill, openApiSpec } from "./connectors.ts";
import { noteAgent } from "./presence.ts";

export { AGENT_PROTOCOL, AGENT_TOOLS, AGENT_RESOURCES, AGENT_PROMPTS };

export function agentManifest(origin = "https://efesto-kernel.vercel.app") {
  return {
    protocol: AGENT_PROTOCOL,
    product: "Efesto",
    name: "Efesto Kernel",
    version: "1.0.0",
    packet: KERNEL_PACKET_PROTOCOL,
    contract: KERNEL_CONTRACT,
    tools: AGENT_TOOLS,
    resources: AGENT_RESOURCES,
    prompts: AGENT_PROMPTS,
    endpoints: agentEndpoints(origin),
    note: "Efesto no es un buscador. Es el Kernel que admite evidencia. Hermes, OpenClaw y Grok consultan; no sustituyen el sello.",
  };
}

type Rpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
  name?: string;
  arguments?: Record<string, unknown>;
  goal?: unknown;
  packet?: unknown;
  tool?: unknown;
};

function textResult(text: string, extra?: unknown) {
  return {
    content: [{ type: "text" as const, text }],
    structured: extra,
  };
}

function resourceText(uri: string, text: string, mimeType = "application/json") {
  return { contents: [{ uri, mimeType, text }] };
}

export async function restForge(
  goal: unknown,
  meta?: { agent?: string; userAgent?: string; header?: string },
) {
  noteAgent({
    name: meta?.agent,
    userAgent: meta?.userAgent,
    header: meta?.header,
    tool: "efesto.forge",
    source: "rest",
  });
  const text = typeof goal === "string" ? goal : "";
  const forged = await forgeEphemeral(text);
  if (!forged.ok) {
    return {
      ok: false as const,
      incomplete: true as const,
      reason: forged.reason,
      packet: forged.packet ?? null,
      contract: KERNEL_CONTRACT,
    };
  }
  return {
    ok: true as const,
    incomplete: forged.packet.incomplete,
    packet: forged.packet,
    contract: KERNEL_CONTRACT,
  };
}

export async function restVerify(packet: unknown) {
  const verified = await verifyKernelPacket(packet);
  if (!verified.ok) {
    return {
      ok: false as const,
      reason: verified.reason,
      contract: KERNEL_CONTRACT,
      attested: false as const,
      report: verificationReport({ ok: false, reason: verified.reason }),
    };
  }
  return {
    ok: true as const,
    packet: verified.packet,
    contract: KERNEL_CONTRACT,
    attested: verified.attested,
    incomplete: verified.packet.incomplete,
    report: verificationReport({
      ok: true,
      attested: verified.attested,
      incomplete: verified.packet.incomplete,
      packet: verified.packet,
    }),
  };
}

export async function handleAgentRpc(
  body: unknown,
  origin?: string,
  meta?: { userAgent?: string; header?: string },
): Promise<unknown> {
  const rpc = (body && typeof body === "object" ? body : {}) as Rpc;
  const id = rpc.id ?? null;
  const method = rpc.method ?? rpc.name ?? "";
  const manifest = agentManifest(origin);
  const clientInfo = (rpc.params as { clientInfo?: { name?: string; title?: string } } | undefined)?.clientInfo;
  noteAgent({
    name: clientInfo?.name || clientInfo?.title,
    userAgent: meta?.userAgent,
    header: meta?.header,
    tool: method || undefined,
    source: "mcp",
  });

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        serverInfo: { name: "efesto-kernel", version: "1.0.0" },
        capabilities: { tools: {}, resources: {}, prompts: {} },
      },
    };
  }

  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (method === "tools/list" || method === "list_tools") {
    return { jsonrpc: "2.0", id, result: { tools: AGENT_TOOLS } };
  }

  if (method === "resources/list") {
    return { jsonrpc: "2.0", id, result: { resources: AGENT_RESOURCES } };
  }

  if (method === "resources/read") {
    const uri = String((rpc.params as { uri?: string } | undefined)?.uri ?? "");
    if (uri === "efesto://contract") {
      return {
        jsonrpc: "2.0",
        id,
        result: resourceText(uri, JSON.stringify(KERNEL_CONTRACT, null, 2)),
      };
    }
    if (uri === "efesto://packet") {
      return {
        jsonrpc: "2.0",
        id,
        result: resourceText(
          uri,
          JSON.stringify(
            { protocol: KERNEL_PACKET_PROTOCOL, contract: KERNEL_CONTRACT, product: "Efesto" },
            null,
            2,
          ),
        ),
      };
    }
    return { jsonrpc: "2.0", id, error: { code: -32002, message: `Recurso desconocido: ${uri}` } };
  }

  if (method === "prompts/list") {
    return { jsonrpc: "2.0", id, result: { prompts: AGENT_PROMPTS } };
  }

  if (method === "prompts/get") {
    const name = String((rpc.params as { name?: string } | undefined)?.name ?? "");
    const args = ((rpc.params as { arguments?: Record<string, string> } | undefined)?.arguments ?? {}) as Record<
      string,
      string
    >;
    if (name === "forge") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          description: "Forja en el Kernel. No completes si incomplete es true.",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Call efesto.forge with goal ${JSON.stringify(args.goal ?? "")}. Do not admit evidence yourself.`,
              },
            },
          ],
        },
      };
    }
    if (name === "verify") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          description: "Verifica un Kernel Packet.",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Call efesto.verify_packet. If rejected, do not cite the packet.",
              },
            },
          ],
        },
      };
    }
    return { jsonrpc: "2.0", id, error: { code: -32602, message: `Prompt desconocido: ${name}` } };
  }

  if (method === "notifications/initialized") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  const callName =
    method === "tools/call"
      ? String((rpc.params as { name?: string } | undefined)?.name ?? "")
      : method === "efesto.forge" || method === "efesto.verify_packet" || method === "efesto.inspect_packet" || method === "efesto.contract"
        ? method
        : String(rpc.tool ?? "");
  const args =
    method === "tools/call"
      ? ((rpc.params as { arguments?: Record<string, unknown> } | undefined)?.arguments ?? {})
      : (rpc.arguments ?? (rpc.params as Record<string, unknown>) ?? {});

  if (!callName && typeof rpc.goal === "string") {
    const forged = await restForge(rpc.goal);
    return { jsonrpc: "2.0", id, result: textResult(JSON.stringify(forged, null, 2), forged) };
  }

  if (callName === "efesto.contract") {
    return {
      jsonrpc: "2.0",
      id,
      result: textResult(JSON.stringify(manifest, null, 2), manifest),
    };
  }

  if (callName === "efesto.verify_packet" || callName === "efesto.inspect_packet") {
    const verified = await verifyKernelPacket(args.packet ?? rpc.packet);
    if (!verified.ok) {
      return { jsonrpc: "2.0", id, result: textResult(`Rechazado: ${verified.reason}`) };
    }
    if (callName === "efesto.verify_packet") {
      return {
        jsonrpc: "2.0",
        id,
        result: textResult(
          `Paquete válido. Huella ${verified.packet.packetHash}. Firma ${verified.attested ? "Ed25519" : "ausente"}.`,
          { packet: verified.packet, attested: verified.attested },
        ),
      };
    }
    const packet = verified.packet;
    const summary = [
      `Objetivo: ${packet.goal.text}`,
      packet.seal ? `Sello: ${packet.seal.hash}` : "Sin sello",
      `Evidencia: ${packet.evidence.length}`,
      `Hallazgos: ${packet.findings.length}`,
      packet.incomplete ? "Estado: investigación incompleta" : "Estado: forjado",
      verified.attested ? "Firma: Ed25519" : "Firma: ausente",
      "El modelo no admite. El Kernel sí.",
    ].join("\n");
    return { jsonrpc: "2.0", id, result: textResult(summary, packet) };
  }

  if (callName === "efesto.forge") {
    const goal = typeof args.goal === "string" ? args.goal : typeof rpc.goal === "string" ? rpc.goal : "";
    const forged = await forgeEphemeral(goal);
    if (!forged.ok) {
      return {
        jsonrpc: "2.0",
        id,
        result: textResult(forged.reason, forged.packet ?? null),
      };
    }
    return {
      jsonrpc: "2.0",
      id,
      result: textResult(JSON.stringify(forged.packet, null, 2), forged.packet),
    };
  }

  if (!method) {
    return manifest;
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Herramienta desconocida: ${callName || method}` },
  };
}

export function agentDiscovery(origin: string) {
  return {
    manifest: agentManifest(origin),
    openapi: openApiSpec(origin),
    skill: openClawSkill(origin),
  };
}
