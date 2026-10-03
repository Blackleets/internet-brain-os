import { KERNEL_CONTRACT, KERNEL_PACKET_PROTOCOL } from "../kernel/packet.ts";
import { AGENT_PROTOCOL, AGENT_TOOLS } from "./constants.ts";

export function agentOrigin(origin: string) {
  return origin.replace(/\/$/, "");
}

export function agentEndpoints(origin: string) {
  const base = agentOrigin(origin);
  return {
    mcp: `${base}/api/agent`,
    openapi: `${base}/api/agent/openapi`,
    forge: `${base}/api/agent/forge`,
    verify: `${base}/api/agent/verify`,
    key: `${base}/api/agent/key`,
    skill: `${base}/api/agent/skill`,
  };
}

export function grokConnector(origin: string) {
  const endpoints = agentEndpoints(origin);
  return {
    id: "grok" as const,
    title: "Grok",
    role: "Acciones personalizadas + MCP",
    hint: "Grok no admite evidencia. Llama a Efesto, lee el paquete, y no completes si incomplete es true.",
    openapiUrl: endpoints.openapi,
    mcp: {
      mcpServers: {
        efesto: {
          url: endpoints.mcp,
          headers: { "mcp-protocol-version": "2025-03-26" },
        },
      },
    },
  };
}

export function hermesConnector(origin: string) {
  const endpoints = agentEndpoints(origin);
  return {
    id: "hermes" as const,
    title: "Hermes",
    role: "MCP HTTP",
    hint: "Hermes consulta el Kernel. Si el paquete llega incompleto, dilo. No inventes fuentes.",
    mcp: {
      mcp: {
        efesto: {
          type: "http",
          url: endpoints.mcp,
          headers: { "mcp-protocol-version": "2025-03-26" },
        },
      },
    },
  };
}

export function openClawConnector(origin: string) {
  const endpoints = agentEndpoints(origin);
  return {
    id: "openclaw" as const,
    title: "OpenClaw",
    role: "Skill + MCP",
    hint: "OpenClaw usa el Kernel como juez de evidencia. El sello no lo pone el modelo.",
    skillUrl: endpoints.skill,
    mcp: {
      tools: {
        efesto: {
          type: "mcp",
          url: endpoints.mcp,
          note: "Kernel Packet v1. The model does not admit. The Kernel does.",
        },
      },
    },
  };
}

export function openApiSpec(origin: string) {
  const endpoints = agentEndpoints(origin);
  return {
    openapi: "3.1.0",
    info: {
      title: "Efesto Kernel",
      version: "1.0.0",
      summary: "Admission kernel for agents",
      description:
        "Efesto is not a search engine. Agents forge a goal and receive a Kernel Packet. The model does not admit evidence. Chat is not evidence. Memory is not evidence. HTTPS public sources only. An incomplete packet must never be reported as completed. Packets are SHA-256 hashed and Ed25519-signed so another agent can verify without trusting the chat.",
    },
    servers: [{ url: agentOrigin(origin) }],
    tags: [{ name: "kernel", description: "Forja y verificación de Kernel Packets" }],
    paths: {
      "/api/agent/forge": {
        post: {
          operationId: "efestoForge",
          tags: ["kernel"],
          summary: "Forja un objetivo y devuelve un Kernel Packet",
          description:
            "Investiga la web pública, admite evidencia y sella un paquete. Si no hay evidencia utilizable, incomplete queda en true.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["goal"],
                  properties: {
                    goal: {
                      type: "string",
                      minLength: 3,
                      maxLength: 400,
                      description: "Objetivo a investigar. No es un prompt de chatbot.",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Kernel Packet. Puede estar incompleto.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ForgeResult" } } },
            },
          },
        },
      },
      "/api/agent/verify": {
        post: {
          operationId: "efestoVerify",
          tags: ["kernel"],
          summary: "Verifica un Kernel Packet",
          description:
            "Rechaza huellas rotas, HTTP, chat, claves y hallazgos sin evidencia. El modelo no puede saltarse esta puerta.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["packet"],
                  properties: { packet: { type: "object" } },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Admisión o rechazo",
              content: { "application/json": { schema: { $ref: "#/components/schemas/VerifyResult" } } },
            },
          },
        },
      },
      "/api/agent/key": {
        get: {
          operationId: "efestoKey",
          tags: ["kernel"],
          summary: "Clave pública Ed25519 de esta instancia",
        },
      },
      "/api/agent": {
        get: {
          operationId: "efestoManifest",
          tags: ["kernel"],
          summary: "Manifiesto MCP y contrato del Kernel",
        },
        post: {
          operationId: "efestoMcp",
          tags: ["kernel"],
          summary: "JSON-RPC MCP (initialize, tools/list, tools/call)",
        },
      },
    },
    components: {
      schemas: {
        ForgeResult: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            incomplete: { type: "boolean" },
            reason: { type: "string" },
            packet: { type: "object" },
            contract: { type: "object" },
          },
        },
        VerifyResult: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            reason: { type: "string" },
            packet: { type: "object" },
            contract: { type: "object" },
          },
        },
      },
    },
    "x-efesto": {
      protocol: AGENT_PROTOCOL,
      packet: KERNEL_PACKET_PROTOCOL,
      contract: KERNEL_CONTRACT,
      tools: AGENT_TOOLS.map((tool) => tool.name),
      endpoints,
      note: "Efesto no es un buscador. Hermes, OpenClaw y Grok consultan; no sustituyen el sello.",
    },
  };
}

export function openClawSkill(origin: string) {
  const endpoints = agentEndpoints(origin);
  return `# Efesto Kernel

You are talking to a user. You are not the Kernel.

Efesto is an admission kernel, not a search engine and not a chatbot.
You may interpret. You may not admit evidence, memory, or invented sources.

## When to call Efesto

- The user asks whether something is true, documented, priced, dated, or sourced.
- You are about to cite a URL you did not retrieve.
- Another agent handed you a "source" that might be chat, HTTP, or a guess.

## How to call

1. POST ${endpoints.forge}
   Body: { "goal": "<the user's actual question>" }
2. Read the Kernel Packet.
3. If \`incomplete\` is true, say the investigation is incomplete and quote \`reason\`. Never say completed.
4. If \`ok\` is true, cite only packet.evidence URLs and packet.findings. Separate observed data from interpretation.
5. To check a packet you did not forge: POST ${endpoints.verify} with { "packet": ... }.
6. A valid packet has packetHash (SHA-256 of the canonical body) and attestation (Ed25519 over the hash). If attestation is missing, say so. If verification fails, do not cite the packet.

## Hard rules

- modelAdmits: false
- chatIsEvidence: false
- memoryIsEvidence: false
- inventedSources: false
- httpsOnly: true
- Do not put API keys in the packet.
- Do not treat the chat as evidence.
- Do not upgrade a missing source into a claim.

MCP: ${endpoints.mcp}
OpenAPI: ${endpoints.openapi}
`;
}

export function connectorConfigs(origin: string) {
  return {
    grok: grokConnector(origin),
    hermes: hermesConnector(origin),
    openclaw: openClawConnector(origin),
    endpoints: agentEndpoints(origin),
    skill: openClawSkill(origin),
    openapi: openApiSpec(origin),
  };
}
