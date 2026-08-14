import { validateGoalDraft } from './goals.mjs';

export const GOAL_INTELLIGENCE_SCHEMA_VERSION = 'efesto.goal-intelligence.v1';

const SOURCE_DEFINITIONS = Object.freeze([
  {
    id: 'hermes',
    adapter: 'native',
    reason: 'public_research',
    pattern: null,
    scopes: ['public.read'],
    requiredCapabilities: ['mission.execute', 'public.read'],
    action: 'agents',
  },
  {
    id: 'github',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(github|git hub|repository|repositories|repo|repos|pull request|pull requests|issue|issues|commit|commits|ci|open source|codigo|código|software)\b/u,
    scopes: ['github.read'],
    requiredCapabilities: ['github.repository.read', 'github.issue.read', 'github.pull_request.read', 'github.checks.read'],
    action: 'settings',
  },
  {
    id: 'gmail',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(gmail|email|emails|e-mail|correo|correos|inbox|bandeja|mensaje|mensajes)\b/u,
    scopes: ['gmail.read'],
    requiredCapabilities: ['gmail.message.read', 'gmail.thread.read'],
    action: 'settings',
  },
  {
    id: 'google-drive',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(google drive|drive|documento|documentos|document|documents|hoja|hojas|sheet|sheets)\b/u,
    scopes: ['drive.read'],
    requiredCapabilities: ['drive.file.read', 'drive.search'],
    action: 'settings',
  },
  {
    id: 'notion',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(notion|pagina de notion|página de notion|notas|note|notes|wiki|base de conocimiento|knowledge base)\b/u,
    scopes: ['notion.read'],
    requiredCapabilities: ['notion.page.read', 'notion.search'],
    action: 'settings',
  },
  {
    id: 'google-calendar',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(google calendar|calendar|calendario|evento|eventos|event|events|reunion|reunión|reuniones|meeting|meetings|agenda|disponibilidad|availability)\b/u,
    scopes: ['calendar.read'],
    requiredCapabilities: ['calendar.event.read', 'calendar.search'],
    action: 'settings',
  },
]);

/**
 * Builds a non-mutating, Kernel-owned plan preview. It selects sources from
 * explicit goal signals, but only advertises capabilities that the catalog
 * proves are active. The plan is guidance; it does not authorize a mission.
 */
export function buildGoalIntelligencePlan({ title, categories, keywords, integrations = [], now = () => new Date().toISOString() } = {}) {
  const draft = validateGoalDraft({ title, categories, keywords: Array.isArray(keywords) && keywords.length ? keywords : keywordsFromTitle(title), priority: 2 });
  const searchable = normalize(`${draft.title} ${draft.keywords.join(' ')}`);
  const selectedDefinitions = SOURCE_DEFINITIONS.filter((definition) => definition.pattern === null || definition.pattern.test(searchable));
  const sources = selectedDefinitions.map((definition) => sourceFromCatalog(definition, integrations));
  const nonReady = sources.filter((source) => source.status !== 'ready');
  const readiness = nonReady.some((source) => source.status === 'unavailable')
    ? 'unavailable'
    : nonReady.length ? 'needs_setup' : 'ready';
  const limitations = ['read_only_sources'];
  if (nonReady.some((source) => source.id !== 'hermes')) limitations.push('source_not_configured');
  if (sources.some((source) => source.id === 'hermes' && source.status !== 'ready')) limitations.push('mission_waiting_for_agent');

  return {
    schemaVersion: GOAL_INTELLIGENCE_SCHEMA_VERSION,
    authority: 'kernel',
    generatedAt: now(),
    goal: { title: draft.title, categories: draft.categories, keywords: draft.keywords },
    intent: {
      primaryCategory: draft.categories[0] ?? null,
      mode: sources.some((source) => source.id !== 'hermes') ? 'connector_research' : 'public_research',
    },
    sources,
    readiness,
    nextAction: readiness === 'ready' ? 'confirm_goal' : 'configure_source',
    limitations,
  };
}

function sourceFromCatalog(definition, integrations) {
  const catalogEntry = Array.isArray(integrations)
    ? integrations.find((integration) => integration?.id === definition.id)
    : undefined;
  const status = statusValue(catalogEntry?.status);
  return {
    id: definition.id,
    adapter: catalogEntry?.adapter ?? definition.adapter,
    selected: true,
    required: true,
    reason: definition.reason,
    status,
    scopes: Array.isArray(catalogEntry?.scopes) && catalogEntry.scopes.length ? catalogEntry.scopes : definition.scopes,
    requiredCapabilities: definition.requiredCapabilities,
    activeCapabilities: status === 'ready' && Array.isArray(catalogEntry?.capabilities) ? catalogEntry.capabilities : [],
    action: catalogEntry?.action ?? definition.action,
  };
}

function statusValue(value) {
  return ['ready', 'not_configured', 'degraded', 'unavailable'].includes(value) ? value : 'unavailable';
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en');
}

function keywordsFromTitle(value) {
  return Array.from(new Set(String(value ?? '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/u)
    .filter((word) => word.length > 2))).slice(0, 12);
}
