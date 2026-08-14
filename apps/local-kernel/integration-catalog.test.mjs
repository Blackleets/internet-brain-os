import { describe, expect, it } from 'vitest';
import { buildIntegrationCatalog } from './integration-catalog.mjs';

describe('Efesto integration catalog', () => {
  it('publishes only Kernel-verifiable adapter state', () => {
    const catalog = buildIntegrationCatalog({
      bootstrap: {
        kernel: 'ready', hermes: 'ready', obsidian: 'unwritable', pairing: 'required',
      },
      hermesAvailable: true,
      obsidianAvailable: true,
      providerCount: 2,
      now: () => '2026-08-14T12:00:00.000Z',
    });

    expect(catalog).toMatchObject({
      schemaVersion: 'efesto.integration-catalog.v1',
      authority: 'kernel',
      generatedAt: '2026-08-14T12:00:00.000Z',
    });
    expect(catalog.integrations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'kernel', status: 'ready', action: 'settings' }),
      expect.objectContaining({ id: 'hermes', status: 'ready', action: 'agents' }),
      expect.objectContaining({ id: 'obsidian', status: 'degraded', action: 'settings' }),
      expect.objectContaining({ id: 'browser-extension', status: 'not_configured', action: 'settings' }),
      expect.objectContaining({ id: 'model-providers', status: 'ready', count: 2, action: 'models' }),
      expect.objectContaining({ id: 'mcp-gateway', status: 'not_configured', capabilities: [], action: 'settings' }),
      expect.objectContaining({ id: 'github', status: 'not_configured', capabilities: [], scopes: ['github.read'], action: 'settings', readOnly: true, requiresExplicitConsent: true, statusReason: 'gateway_not_configured' }),
      expect.objectContaining({ id: 'gmail', status: 'not_configured', capabilities: [], scopes: ['gmail.read'], action: 'settings', readOnly: true, requiresExplicitConsent: true, statusReason: 'gateway_not_configured' }),
      expect.objectContaining({ id: 'google-drive', status: 'not_configured', capabilities: [], scopes: ['drive.read'], action: 'settings', readOnly: true, requiresExplicitConsent: true, statusReason: 'gateway_not_configured' }),
      expect.objectContaining({ id: 'notion', status: 'not_configured', capabilities: [], scopes: ['notion.read'], action: 'settings', readOnly: true, requiresExplicitConsent: true, statusReason: 'gateway_not_configured' }),
      expect.objectContaining({ id: 'google-calendar', status: 'not_configured', capabilities: [], scopes: ['calendar.read'], action: 'settings', readOnly: true, requiresExplicitConsent: true, statusReason: 'gateway_not_configured' }),
    ]));
  });

  it('keeps an absent MCP gateway explicitly unconfigured', () => {
    const catalog = buildIntegrationCatalog({ providerCount: 0 });
    const mcp = catalog.integrations.find((item) => item.id === 'mcp-gateway');
    expect(mcp).toMatchObject({ adapter: 'mcp', status: 'not_configured', capabilities: [], action: 'settings' });
  });

  it('keeps external connector readiness independent from the MCP gateway', () => {
    const catalog = buildIntegrationCatalog({
      mcpGateway: {
        status: 'ready',
        connectors: { github: { status: 'ready', capabilities: ['github.repository.read'] } },
      },
    });

    expect(catalog.integrations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'mcp-gateway', status: 'ready', capabilities: ['tools.discover', 'tools.invoke'] }),
      expect.objectContaining({ id: 'github', status: 'ready', capabilities: ['github.repository.read'], statusReason: 'connector_verified' }),
      expect.objectContaining({ id: 'gmail', status: 'not_configured', capabilities: [] }),
      expect.objectContaining({ id: 'google-drive', status: 'not_configured', capabilities: [] }),
      expect.objectContaining({ id: 'notion', status: 'not_configured', capabilities: [] }),
      expect.objectContaining({ id: 'google-calendar', status: 'not_configured', capabilities: [] }),
    ]));
  });

  it('publishes the native GitHub adapter without changing the other external integrations', () => {
    const catalog = buildIntegrationCatalog({
      githubStatus: {
        adapter: 'native',
        status: 'ready',
        scopes: ['github.read'],
        capabilities: ['github.repository.read'],
        requiresExplicitConsent: true,
        managedBy: 'local',
      },
    });

    expect(catalog.integrations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'github', adapter: 'native', status: 'ready', capabilities: ['github.repository.read'], requiresExplicitConsent: true, readOnly: true, statusReason: 'kernel_verified', managedBy: 'local' }),
      expect.objectContaining({ id: 'gmail', adapter: 'mcp', status: 'not_configured', capabilities: [] }),
      expect.objectContaining({ id: 'google-drive', adapter: 'mcp', status: 'not_configured', capabilities: [] }),
      expect.objectContaining({ id: 'notion', adapter: 'mcp', status: 'not_configured', capabilities: [] }),
      expect.objectContaining({ id: 'google-calendar', adapter: 'mcp', status: 'not_configured', capabilities: [] }),
    ]));
  });

  it('sanitizes provider-supplied status reasons before publishing the read model', () => {
    const catalog = buildIntegrationCatalog({
      mcpGateway: {
        status: 'ready',
        connectors: { gmail: { status: 'degraded', statusReason: '<script>alert(1)</script>' } },
      },
      githubStatus: {
        adapter: 'native',
        status: 'ready',
        statusReason: 'not safe to render',
      },
    });

    expect(catalog.integrations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'gmail', status: 'degraded', statusReason: 'provider_degraded' }),
      expect.objectContaining({ id: 'github', status: 'ready', statusReason: 'kernel_verified' }),
    ]));
  });
});
