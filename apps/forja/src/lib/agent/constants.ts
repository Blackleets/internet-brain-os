export const AGENT_PROTOCOL = "efesto-agent/v1";

export const AGENT_TOOLS = [
  {
    name: "efesto.contract",
    description:
      "Contrato del Kernel de Efesto. El modelo no admite. El chat no es evidencia. La memoria no es evidencia. Solo HTTPS público.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "efesto.verify_packet",
    description:
      "Verifica un Kernel Packet de Efesto. Rechaza huellas rotas, HTTP, chat, claves y hallazgos sin evidencia.",
    inputSchema: {
      type: "object",
      properties: { packet: { type: "object" } },
      required: ["packet"],
    },
  },
  {
    name: "efesto.inspect_packet",
    description: "Resume un Kernel Packet ya verificado: objetivo, sello, evidencia, hallazgos, incertidumbre.",
    inputSchema: {
      type: "object",
      properties: { packet: { type: "object" } },
      required: ["packet"],
    },
  },
  {
    name: "efesto.forge",
    description:
      "Forja un caso en Efesto a partir de un objetivo. Devuelve un Kernel Packet. No inventa fuentes. Si no hay evidencia, el paquete queda incompleto.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "Objetivo a investigar en la web pública." },
      },
      required: ["goal"],
    },
  },
] as const;

export const AGENT_RESOURCES = [
  {
    uri: "efesto://contract",
    name: "Kernel contract",
    mimeType: "application/json",
    description: "El modelo no admite. El Kernel sí.",
  },
  {
    uri: "efesto://packet",
    name: "Kernel Packet protocol",
    mimeType: "application/json",
    description: "Unidad de confianza que otros agentes verifican.",
  },
] as const;

export const AGENT_PROMPTS = [
  {
    name: "forge",
    description: "Forja un objetivo en el Kernel. No completes si el paquete queda incompleto.",
    arguments: [{ name: "goal", description: "Pregunta o afirmación a investigar", required: true }],
  },
  {
    name: "verify",
    description: "Verifica un Kernel Packet antes de citarlo.",
    arguments: [{ name: "packet", description: "Paquete JSON de Efesto", required: true }],
  },
] as const;
