import { PublicWebSearchClient, type PublicWebSearchResponse } from '../../../../packages/connectors/src/public-web-search';
import type { GoalIntelligencePlan, IntegrationAdapter, IntegrationAction, PublicSearchSnapshot } from '../kernel/contracts';

type WebGoalPlanInput = {
  title?: unknown;
  keywords?: unknown;
  now?: () => string;
};

type WebSourceDefinition = {
  id: string;
  adapter: IntegrationAdapter;
  reason: 'public_research' | 'goal_signal';
  pattern: RegExp | null;
  scopes: string[];
  requiredCapabilities: string[];
  action: IntegrationAction;
};

const WEB_SOURCE_DEFINITIONS: WebSourceDefinition[] = [
  {
    id: 'public-web',
    adapter: 'native',
    reason: 'public_research',
    pattern: null,
    scopes: ['public.read'],
    requiredCapabilities: ['web.search', 'public.read'],
    action: null,
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
];

const CATEGORY_RULES: Array<[string, RegExp]> = [
  ['job', /\b(job|jobs|employment|vacancy|vacancies|hiring|work|freelance|empleo|empleos|trabajo|trabajos|vacante|vacantes|puesto|puestos|contratando)\b/u],
  ['grant', /\b(grant|grants|funding|scholarship|scholarships|subvencion|subvenciones|beca|becas|financiacion)\b/u],
  ['client', /\b(client|clients|customer|customers|project|projects|contract|contracts|freelance|cliente|clientes|proyecto|proyectos|contrato|contratos)\b/u],
  ['offer', /\b(offer|offers|deal|deals|discount|discounts|sale|sales|price|prices|cheap|cheaper|budget|oferta|ofertas|descuento|descuentos|rebaja|rebajas|precio|precios|barato|barata|baratos|baratas|presupuesto)\b/u],
  ['tool', /\b(tool|tools|drill|drills|equipment|hardware|software|laptop|laptops|app|apps|herramienta|herramientas|taladro|taladros|equipo|equipos|portatil|portatiles|aplicacion|aplicaciones)\b/u],
  ['food', /\b(food|meal|meals|restaurant|restaurants|dinner|lunch|breakfast|comida|comidas|restaurante|restaurantes|cena|cenas|almuerzo|desayuno)\b/u],
  ['aid', /\b(aid|assistance|support|relief|ayuda|ayudas|asistencia|apoyo)\b/u],
  ['learning', /\b(course|courses|training|certification|certificate|learn|learning|class|classes|curso|cursos|formacion|certificacion|certificado|aprender|clase|clases)\b/u],
  ['event', /\b(event|events|conference|conferences|meetup|meetups|expo|fair|evento|eventos|conferencia|conferencias|feria|ferias)\b/u],
  ['housing', /\b(rent|rental|apartment|apartments|housing|room|rooms|alquiler|alquilar|piso|pisos|vivienda|viviendas|habitacion|habitaciones)\b/u],
  ['travel', /\b(flight|flights|hotel|hotels|trip|trips|travel|vuelo|vuelos|viaje|viajes|viajar)\b/u],
  ['collaboration', /\b(partner|partners|partnership|collaboration|collaborate|socio|socios|alianza|alianzas|colaboracion|colaborar)\b/u],
  ['money', /\b(earn|earning|income|money|profit|revenue|salary|wage|ganar|ganancia|ganancias|ingreso|ingresos|dinero|beneficio|beneficios|salario|sueldo)\b/u],
];

/**
 * Builds a bounded, preview-only plan for the hosted web shell. It shares the
 * public contract shape with the Kernel but deliberately uses a different
 * authority value and can never confirm a Goal or access a connector.
 */
export function buildWebGoalPlan({ title, keywords, now = () => new Date().toISOString() }: WebGoalPlanInput): GoalIntelligencePlan {
  const cleanTitle = cleanText(title, 120, 'Goal title must contain at least 3 characters');
  const suppliedKeywords = cleanList(keywords, 12, 40);
  const searchable = normalize(`${cleanTitle} ${suppliedKeywords.join(' ')}`);
  const inferredKeywords = keywordsFromTitle(cleanTitle);
  const goalKeywords = unique([...suppliedKeywords, ...inferredKeywords]).slice(0, 12);
  const categories = CATEGORY_RULES.filter(([, pattern]) => pattern.test(searchable)).map(([category]) => category).slice(0, 4);
  const connectorSources = WEB_SOURCE_DEFINITIONS.filter((definition) => definition.pattern?.test(searchable));
  const sources = [WEB_SOURCE_DEFINITIONS[0], ...connectorSources].map(sourceFromDefinition);

  return {
    schemaVersion: 'efesto.goal-intelligence.v1',
    authority: 'web-runtime',
    generatedAt: now(),
    goal: { title: cleanTitle, categories, keywords: goalKeywords },
    intent: {
      primaryCategory: categories[0] ?? null,
      mode: connectorSources.length ? 'connector_research' : 'public_research',
    },
    sources,
    readiness: 'needs_setup',
    nextAction: 'configure_source',
    limitations: ['preview_only', 'kernel_required_for_execution', 'read_only_sources'],
  };
}

export type WebSearchClient = Pick<PublicWebSearchClient, 'search'>;

/**
 * Runs one bounded, read-only public search for an explicit hosted-web order.
 * The result is unverified preview data: it is not Evidence, is not persisted,
 * and does not grant the web shell authority to execute anything.
 */
export async function prepareWebGoalPlan(input: WebGoalPlanInput, searcher: WebSearchClient = new PublicWebSearchClient()): Promise<GoalIntelligencePlan> {
  const basePlan = buildWebGoalPlan(input);
  try {
    const search = await searcher.search(basePlan.goal.title, 6);
    return withSearchSnapshot(basePlan, search, 'ready');
  } catch {
    return withSearchSnapshot(basePlan, {
      query: basePlan.goal.title,
      searchedAt: new Date().toISOString(),
      provider: 'unavailable',
      results: [],
    }, 'unavailable');
  }
}

function withSearchSnapshot(plan: GoalIntelligencePlan, response: PublicWebSearchResponse | Omit<PublicSearchSnapshot, 'status'>, status: PublicSearchSnapshot['status']): GoalIntelligencePlan {
  const publicSearch: PublicSearchSnapshot = { ...response, status };
  const publicSourceStatus = status === 'ready' ? 'ready' : 'unavailable';
  return {
    ...plan,
    sources: plan.sources.map((source) => source.id === 'public-web'
      ? { ...source, status: publicSourceStatus, activeCapabilities: status === 'ready' ? ['web.search', 'public.read'] : [] }
      : source),
    readiness: status === 'ready' ? 'ready' : 'unavailable',
    nextAction: 'confirm_goal',
    limitations: status === 'ready' ? plan.limitations : [...plan.limitations, 'public_search_unavailable'],
    publicSearch,
  };
}

function sourceFromDefinition(definition: WebSourceDefinition) {
  return {
    id: definition.id,
    adapter: definition.adapter,
    selected: true as const,
    required: true as const,
    reason: definition.reason,
    status: 'not_configured' as const,
    scopes: [...definition.scopes],
    requiredCapabilities: [...definition.requiredCapabilities],
    activeCapabilities: [],
    action: definition.action,
  };
}

function cleanList(value: unknown, limit: number, maxLength: number) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > limit) throw new WebPlanInputError('Goal keywords are invalid or too long');
  return unique(value.map((item) => cleanText(item, maxLength, 'Goal keywords are invalid')).filter(Boolean));
}

function cleanText(value: unknown, maxLength: number, emptyMessage: string) {
  if (typeof value !== 'string') throw new WebPlanInputError(emptyMessage);
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length < 3 || text.length > maxLength || /[\u0000-\u001f\u007f]/u.test(text)) throw new WebPlanInputError(emptyMessage);
  return text;
}

function keywordsFromTitle(value: string) {
  return value
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/u)
    .filter((word) => word.length > 2)
    .slice(0, 12);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalize(value: string) {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('en');
}

export class WebPlanInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebPlanInputError';
  }
}
