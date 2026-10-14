import { localStatus } from '../../../lib/server/local-kernel-proxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(request: Request) { return localStatus(request); }
