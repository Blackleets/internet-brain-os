export type AgentId = "hermes" | "grok" | "openclaw" | "agent";

export type AgentPresence = {
  id: AgentId;
  label: string;
  at: string;
  tool?: string;
  source: "mcp" | "rest" | "header" | "local";
};

const LIVE_MS = 90_000;
const seen: AgentPresence[] = [];

export function identifyAgent(input: {
  name?: string | null;
  userAgent?: string | null;
  header?: string | null;
}): Omit<AgentPresence, "at" | "source" | "tool"> | null {
  const raw = [input.name, input.header, input.userAgent].find((value) => typeof value === "string" && value.trim()) ?? "";
  const text = raw.trim();
  if (!text) return null;
  const key = text.toLowerCase();
  if (!input.name && !input.header && /mozilla|chrome\/|safari\/|firefox\/|edg\//.test(key)) {
    return null;
  }
  if (key.includes("hermes") || key.includes("nous")) return { id: "hermes", label: "Hermes" };
  if (key.includes("grok") || key.includes("xai")) return { id: "grok", label: "Grok" };
  if (key.includes("openclaw") || key.includes("claw")) return { id: "openclaw", label: "OpenClaw" };
  if (key.includes("efesto")) return null;
  const label = text.split(/[/(\s]/)[0]?.slice(0, 24) || "Agente";
  if (label.length < 2) return null;
  return { id: "agent", label };
}

export function noteAgent(
  input: {
    name?: string | null;
    userAgent?: string | null;
    header?: string | null;
    tool?: string;
    source?: AgentPresence["source"];
  },
): AgentPresence | null {
  const identified = identifyAgent(input);
  if (!identified) return null;
  const row: AgentPresence = {
    ...identified,
    at: new Date().toISOString(),
    tool: input.tool,
    source: input.source ?? "mcp",
  };
  const index = seen.findIndex((item) => item.id === row.id && item.label === row.label);
  if (index >= 0) seen.splice(index, 1);
  seen.unshift(row);
  if (seen.length > 8) seen.pop();
  return row;
}

export function listPresence(now = Date.now()): AgentPresence[] {
  return seen.filter((item) => now - Date.parse(item.at) < LIVE_MS * 4);
}

export function liveAgent(now = Date.now()): AgentPresence | null {
  const [first] = seen;
  if (!first) return null;
  if (now - Date.parse(first.at) > LIVE_MS) return null;
  return first;
}

export function resetPresenceForTests() {
  seen.length = 0;
}

export const AGENT_CHOICES: Array<{ id: AgentId; label: string }> = [
  { id: "hermes", label: "Hermes" },
  { id: "grok", label: "Grok" },
  { id: "openclaw", label: "OpenClaw" },
];
