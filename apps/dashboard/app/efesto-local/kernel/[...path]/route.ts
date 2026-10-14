import { proxyToLocalKernel } from '../../../../lib/server/local-kernel-proxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) { return proxyToLocalKernel(request, (await context.params).path ?? []); }

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
