import { EXTERNAL_INTEGRATION_DEFINITIONS } from './integration-definitions.mjs';

const SCHEMA_VERSION = 'efesto.integration-catalog.v1';

const STATUS_VALUES = new Set(['ready', 'not_configured', 'degraded', 'unavailable']);

// External tools stay behind MCP and begin with read-only scopes. A connector
// can become ready only when the future gateway reports that exact connector
// as configured; a ready gateway alone must not imply ready access to every
// provider.
export const EXTERNAL_MCP_INTEGRATIONS = Object.freeze(EXTERNAL_INTEGRATION_DEFINITIONS.map((definition) => Object.freeze({
  id: definition.id,
  scopes: Object.freeze([...definition.scopes]),
  capabilities: Object.freeze([...definition.capabilities]),
  readOnly: definition.readOnly,
  requiresExplicitConsent: definition.requiresExplicitConsent,
})));

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
      integration('kernel', 'core', 'native', kernelStatus, ['goal.prepare', 'mission.confirm', 'evidence.read'], ['local'], 'settings', { readOnly: true, statusReason: 'kernel_boundary' }),
      integration('hermes', 'agent', 'native', hermesStatus, ['mission.execute'], ['public.read'], 'agents', { readOnly: true, requiresExplicitConsent: true, statusReason: hermesStatus === 'ready' ? 'runtime_verified' : 'runtime_not_configured' }),
      integration('obsidian', 'memory', 'native', obsidianStatus, ['memory.project'], ['local.memory'], 'settings', { readOnly: true, statusReason: 'local_projection' }),
      integration('browser-extension', 'capture', 'native', extensionStatus, ['capture.public_page'], ['public.read'], 'settings', { readOnly: true, requiresExplicitConsent: true, statusReason: extensionStatus === 'ready' ? 'paired_extension' : 'pairing_required' }),
      integration('model-providers', 'model', 'native', modelsStatus, ['chat.generate'], ['model.input'], 'models', { count: providerCount ?? 0, readOnly: true, statusReason: modelsStatus === 'ready' ? 'provider_configured' : 'model_not_configured' }),
      integration('mcp-gateway', 'transport', 'mcp', mcpStatus, mcpStatus === 'ready' ? ['tools.discover', 'tools.invoke'] : [], ['scoped.tool'], 'settings', { readOnly: true, requiresExplicitConsent: true, statusReason: mcpStatus === 'ready' ? 'gateway_verified' : 'gateway_not_configured' }),
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
          readOnly: githubStatus.readOnly !== false,
          statusReason: safeStatusReason(githubStatus.statusReason, githubStatusReason(githubStatus.status)),
        },
      );
    }
    const connector = connectors[definition.id];
    const status = normalizeStatus(connector?.status ?? 'not_configured');
    const capabilities = Array.isArray(connector?.capabilities) ? connector.capabilities : definition.capabilities;
    return integration(definition.id, 'transport', 'mcp', status, capabilities, definition.scopes, 'settings', {
      readOnly: definition.readOnly,
      requiresExplicitConsent: definition.requiresExplicitConsent,
      statusReason: safeStatusReason(connector?.statusReason, mcpConnectorReason(status, mcpGateway?.status)),
    });
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
    readOnly: extra.readOnly === true,
    requiresExplicitConsent: extra.requiresExplicitConsent === true,
    statusReason: safeStatusReason(extra.statusReason, normalizedStatus),
  };
}

function githubStatusReason(status) {
  if (status === 'ready') return 'kernel_verified';
  if (status === 'not_configured') return 'credential_required';
  if (status === 'degraded') return 'credential_degraded';
  return 'provider_unavailable';
}

function mcpConnectorReason(status, gatewayStatus) {
  if (status === 'ready') return 'connector_verified';
  if (status === 'degraded') return 'provider_degraded';
  if (status === 'unavailable') return 'provider_unavailable';
  return gatewayStatus === 'ready' ? 'provider_not_configured' : 'gateway_not_configured';
}

function safeStatusReason(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized && normalized.length <= 64 && /^[A-Za-z0-9._-]+$/u.test(normalized) ? normalized : fallback;
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
