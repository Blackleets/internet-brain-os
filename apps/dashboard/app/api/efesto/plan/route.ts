import { prepareWebGoalPlan, WebPlanInputError, type WebSearchClient } from '../../../../lib/web-runtime/goal-plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: Request) {
  return postGoalPlan(request);
}

export async function postGoalPlan(request: Request, searcher?: WebSearchClient) {
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ ok: false, error: 'request_too_large' }, 413);
    const body = JSON.parse(rawBody) as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'invalid_request' }, 400);
    const plan = await prepareWebGoalPlan(body as { title?: unknown; keywords?: unknown }, searcher);
    return json({ ok: true, ...plan });
  } catch (error) {
    if (error instanceof WebPlanInputError || error instanceof SyntaxError) return json({ ok: false, error: 'invalid_request' }, 400);
    return json({ ok: false, error: 'planning_unavailable' }, 500);
  }
}

export async function GET() {
  return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
}

function json(body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}
