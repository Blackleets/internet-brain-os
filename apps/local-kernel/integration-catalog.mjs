import { GITHUB_READ_CAPABILITIES, GITHUB_READ_SCOPE } from './github-readonly-contract.mjs';

const SCHEMA_VERSION = 'efesto.integration-catalog.v1';

const STATUS_VALUES = new Set(['ready', 'not_configured', 'degraded', 'unavailable']);

// External tools stay behind MCP and begin with read-only scopes. A connector
// can become ready only when the future gateway reports that exact connector
// as configured; a ready gateway alone must not imply ready access to every
// provider.
export const EXTERNAL_MCP_INTEGRATIONS = Object.freeze([
  { id: 'github', scopes: [GITHUB_READ_SCOPE], capabilities: [...GITHUB_READ_CAPABILITIES] },
  { id: 'gmail', scopes: ['gmail.read'], capabilities: ['gmail.message.read', 'gmail.thread.read'] },
  { id: 'google-drive', scopes: ['drive.read'], capabilities: ['drive.file.read', 'drive.search'] },
  { id: 'notion', scopes: ['notion.read'], capabilities: ['notion.page.read', 'notion.search'] },
  { id: 'google-calendar', scopes: ['calendar.read'], capabilities: ['calendar.event.read', 'calendar.search'] },
]);

/**
 * The catalog is deliberately a read model. It describes adapters that the
 * Kernel can prove are present; it never grants an adapter authority by
 * itself. External providers must enter through a typed adapter or MCP
 * transport before they can be advertised here as ready.
 */
export function buildIntegrationCatalog({
  bootstrap,
  hermesAvailable = false,
  obsidianAvailable = false,
  providerCount,
  mcpGateway,
  githubStatus,
  now = () => new Date().toISOString(),
} = {}) {
  const kernelStatus = statusFromBootstrap(bootstrap?.kernel, 'ready');
  const hermesStatus = statusFromBootstrap(bootstrap?.hermes, hermesAvailable ? 'ready' : 'not_configured');
  const obsidianStatus = statusFromBootstrap(bootstrap?.obsidian, obsidianAvailable ? 'ready' : 'not_configured');
  const extensionStatus = statusFromBootstrap(bootstrap?.pairing, 'not_configured', {
    paired: 'ready',
    required: 'not_configured',
    invalid: 'degraded',
  });
  const modelsStatus = providerCount === undefined
    ? 'unavailable'
    : providerCount > 0 ? 'ready' : 'not_configured';
  const mcpStatus = normalizeStatus(mcpGateway?.status ?? 'not_configured');

  return {
    schemaVersion: SCHEMA_VERSION,
    authority: 'kernel',
    generatedAt: now(),
    integrations: [
      integration('kernel', 'core', 'native', kernelStatus, ['goal.prepare', 'mission.confirm', 'evidence.read'], ['local'], 'settings'),
      integration('hermes', 'agent', 'native', hermesStatus, ['mission.execute'], ['public.read'], 'agents'),
      integration('obsidian', 'memory', 'native', obsidianStatus, ['memory.project'], ['local.memory'], 'settings'),
      integration('browser-extension', 'capture', 'native', extensionStatus, ['capture.public_page'], ['public.read'], 'settings'),
      integration('model-providers', 'model', 'native', modelsStatus, ['chat.generate'], ['model.input'], 'models', { count: providerCount ?? 0 }),
      integration('mcp-gateway', 'transport', 'mcp', mcpStatus, mcpStatus === 'ready' ? ['tools.discover', 'tools.invoke'] : [], ['scoped.tool'], 'settings'),
      ...buildExternalMcpIntegrations(mcpGateway, githubStatus),
    ],
  };
}

function buildExternalMcpIntegrations(mcpGateway, githubStatus) {
  const connectors = mcpGateway?.connectors && typeof mcpGateway.connectors === 'object' ? mcpGateway.connectors : {};
  return EXTERNAL_MCP_INTEGRATIONS.map((definition) => {
    if (definition.id === 'github' && githubStatus && typeof githubStatus === 'object') {
      return integration(
        definition.id,
        'transport',
        githubStatus.adapter === 'native' ? 'native' : 'mcp',
        githubStatus.status,
        Array.isArray(githubStatus.capabilities) ? githubStatus.capabilities : definition.capabilities,
        Array.isArray(githubStatus.scopes) && githubStatus.scopes.length ? githubStatus.scopes : definition.scopes,
        'settings',
        {
          requiresExplicitConsent: githubStatus.requiresExplicitConsent !== false,
          managedBy: githubStatus.managedBy ?? null,
        },
      );
    }
    const connector = connectors[definition.id];
    const status = normalizeStatus(connector?.status ?? 'not_configured');
    const capabilities = Array.isArray(connector?.capabilities) ? connector.capabilities : definition.capabilities;
    return integration(definition.id, 'transport', 'mcp', status, capabilities, definition.scopes, 'settings');
  });
}

function integration(id, kind, adapter, status, capabilities, scopes, action, extra = {}) {
  const normalizedStatus = normalizeStatus(status);
  return {
    id,
    kind,
    adapter,
    status: normalizedStatus,
    capabilities: normalizedStatus === 'ready' ? capabilities : [],
    scopes,
    action,
    ...extra,
  };
}

function statusFromBootstrap(value, fallback, aliases = {}) {
  if (typeof value !== 'string') return fallback;
  if (aliases[value]) return aliases[value];
  if (value === 'ready') return 'ready';
  if (['missing', 'not_configured', 'required', 'offline'].includes(value)) return 'not_configured';
  if (['invalid', 'unwritable', 'stale'].includes(value)) return 'degraded';
  if (value === 'failed' || value === 'port_conflict') return 'unavailable';
  return fallback;
}

function normalizeStatus(value) {
  return STATUS_VALUES.has(value) ? value : 'unavailable';
}
