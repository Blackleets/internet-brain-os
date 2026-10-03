export const AGENT_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,mcp-protocol-version,x-efesto-tool,x-efesto-agent",
};

export function agentJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...AGENT_CORS },
  });
}

export function agentText(body: string, contentType: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": contentType, ...AGENT_CORS },
  });
}

export function agentOptions() {
  return new Response(null, { status: 204, headers: AGENT_CORS });
}
