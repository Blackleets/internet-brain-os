import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { probeKernel } from './efesto-bootstrap.mjs';
import { readRunningKernelBootstrap } from './efesto-launcher-core.mjs';

const servers = [];
const health = { service: 'hephaestus-local-kernel', kernel: 'ready' };
const bootstrap = {
  schemaVersion: 'efesto.bootstrap-status.v1', kernel: 'ready', hermes: 'ready',
  obsidian: 'ready', pairing: 'paired', overall: 'ready', actions: [], diagnostics: {},
};
async function serve(handler) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  return { port, url: `http://127.0.0.1:${port}` };
}
function json(response, payload) { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(payload)); }
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  })));
});

describe('launcher readiness stays at the requested local endpoint', () => {
  for (const code of [301, 302, 307, 308]) {
    it(`does not follow ${code} health redirects or accept redirected ready state`, async () => {
      let targetRequests = 0;
      const target = await serve((request, response) => { targetRequests++; json(response, health); });
      const origin = await serve((request, response) => { response.writeHead(code, { location: `${target.url}/status` }); response.end(); });
      const result = await probeKernel(origin.url, origin.port);
      expect(result).not.toMatchObject({ ok: true });
      expect(result.portOpen).toBe(true);
      expect(targetRequests).toBe(0);
    });
    it(`does not follow ${code} runtime bootstrap redirects or import their readiness`, async () => {
      let targetRequests = 0;
      const target = await serve((request, response) => { targetRequests++; json(response, bootstrap); });
      const origin = await serve((request, response) => { response.writeHead(code, { location: `${target.url}/bootstrap/status` }); response.end(); });
      const result = await readRunningKernelBootstrap({ diagnostics: { kernel: { port: origin.port } } });
      expect(result).toBeUndefined();
      expect(targetRequests).toBe(0);
    });
  }
  it('still accepts direct Kernel health responses', async () => {
    const origin = await serve((request, response) => json(response, health));
    expect(await probeKernel(origin.url, origin.port)).toMatchObject({ reachable: true, ok: true, service: health.service });
  });
  it('still uses direct runtime certification including a blocked Hermes state', async () => {
    const blocked = { ...bootstrap, hermes: 'invalid', overall: 'needs_setup' };
    const origin = await serve((request, response) => json(response, blocked));
    expect(await readRunningKernelBootstrap({ diagnostics: { kernel: { port: origin.port } } })).toEqual(blocked);
  });
});
