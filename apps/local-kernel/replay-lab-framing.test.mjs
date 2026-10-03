import { afterEach, describe, expect, it } from 'vitest';
import { createLocalKernelServer } from './server.mjs';

// Replay Lab (GET /replay-lab) hosts a Kernel-token field and a capture import; any site could
// frame it and redress clicks. It must refuse framing.
const apiToken = 'test-token-that-is-at-least-32-characters';
let server;
afterEach(async () => { if (server?.listening) await new Promise((resolve) => server.close(resolve)); });

describe('local Kernel HTML surfaces refuse framing', () => {
  it('serves /replay-lab with frame-ancestors none, X-Frame-Options DENY and no-referrer', async () => {
    server = createLocalKernelServer({}, undefined, undefined, undefined, { apiToken });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/replay-lab`);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
});
