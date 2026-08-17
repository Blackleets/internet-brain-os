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
    // Keep generic technology language on public web. Connector selection
    // requires an explicit GitHub or repository signal.
    pattern: /\b(github|git hub|repository|repositories|repo|repos|pull request|pull requests|issue|issues|commit|commits|ci)\b/u,
    scopes: ['github.read'],
    requiredCapabilities: ['github.repository.read', 'github.issue.read', 'github.pull_request.read', 'github.checks.read'],
    action: 'settings',
  },
  {
    id: 'gmail',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(gmail|e-?mail|correo|correos|inbox|bandeja de entrada)\b/u,
    scopes: ['gmail.read'],
    requiredCapabilities: ['gmail.message.read', 'gmail.thread.read'],
    action: 'settings',
  },
  {
    id: 'google-drive',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(google drive|drive de google)\b/u,
    scopes: ['drive.read'],
    requiredCapabilities: ['drive.file.read', 'drive.search'],
    action: 'settings',
  },
  {
    id: 'notion',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(notion|pagina de notion|notas de notion|notion notes)\b/u,
    scopes: ['notion.read'],
    requiredCapabilities: ['notion.page.read', 'notion.search'],
    action: 'settings',
  },
  {
    id: 'google-calendar',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(google calendar|calendario de google|mi calendario|my calendar)\b/u,
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
  const limitations = ['preview_only', 'kernel_required_for_execution', 'read_only_sources'];
  if (connectorSources.length > 0) limitations.push('source_not_configured');

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
    limitations,
  };
}

export type WebSearchClient = Pick<PublicWebSearchClient, 'search'>;

/**
 * Turns a conversational Goal into a compact topic query for the public
 * preview. The hosted shell must search for the user's subject, not the
 * imperative wrapper around it (for example, "explica" instead of
 * "bitcoin").
 */
export function buildPublicSearchQuery(title: string, keywords: readonly string[] = [], categories: readonly string[] = []): string {
  const tokens = buildPublicSearchTokens(title, keywords, categories);
  const categoryTokens = categories.flatMap((category) => CATEGORY_SEARCH_TERMS[category] ?? []);
  const uniqueTokens = [...new Set([...tokens, ...categoryTokens])].slice(0, 10);
  return uniqueTokens.length > 0 ? uniqueTokens.join(' ') : title.trim();
}

function buildBroadPublicSearchQuery(title: string, keywords: readonly string[], categories: readonly string[]): string {
  const tokens = buildPublicSearchTokens(title, keywords, categories).slice(0, 6);
  return tokens.length > 0 ? tokens.join(' ') : title.trim();
}

function buildRawPublicSearchQuery(title: string): string {
  return title
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .slice(0, 12)
    .join(' ');
}

function buildPublicSearchTokens(title: string, keywords: readonly string[], categories: readonly string[]): string[] {
  const isJobGoal = categories.includes('job');
  return [...new Set(tokenizeSearchText([title, ...keywords].join(' '))
    .filter((token) => !WEB_SEARCH_STOP_WORDS.has(token))
    .filter((token) => !(isJobGoal && isJobConstraintToken(token)))
    .filter((token) => token.length > 2 || /^\d{2,}$/u.test(token)))];
}

/**
 * Runs one bounded, read-only public search for an explicit hosted-web order.
 * The native connector may use its credential-free HTML fallback chain, but
 * only query-relevant links are exposed to the hosted preview.
 * The result is unverified preview data: it is not Evidence, is not persisted,
 * and does not grant the web shell authority to execute anything.
 */
const HOSTED_SEARCH_TIMEOUT_MS = 8_000;
const HOSTED_SEARCH_PROVIDER_TIMEOUT_MS = 2_200;

export async function prepareWebGoalPlan(input: WebGoalPlanInput, searcher: WebSearchClient = new PublicWebSearchClient({ timeoutMs: HOSTED_SEARCH_PROVIDER_TIMEOUT_MS })): Promise<GoalIntelligencePlan> {
  const basePlan = buildWebGoalPlan(input);
  const publicSearchQuery = buildPublicSearchQuery(basePlan.goal.title, basePlan.goal.keywords, basePlan.goal.categories);
  const fallbackSearchQuery = buildBroadPublicSearchQuery(basePlan.goal.title, basePlan.goal.keywords, basePlan.goal.categories);
  // Keep a natural-language fallback for providers that return nothing for a
  // short keyword query. It is attempted only after the focused variants and
  // remains bounded by the same hosted deadline.
  const titleSearchQuery = buildRawPublicSearchQuery(basePlan.goal.title);
  const searchQueries = [...new Set([publicSearchQuery, fallbackSearchQuery, titleSearchQuery])].slice(0, 3);
  const deadline = Date.now() + HOSTED_SEARCH_TIMEOUT_MS;
  try {
    let lastSearch: PublicWebSearchResponse | undefined;
    for (const query of searchQueries) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) throw new Error('Public search deadline exceeded');
      lastSearch = await withTimeout(searcher.search(query, 6), remainingMs);
      if (lastSearch.results.length > 0) break;
    }
    return withSearchSnapshot(basePlan, lastSearch!, 'ready');
  } catch {
    return withSearchSnapshot(basePlan, {
      query: publicSearchQuery,
      searchedAt: new Date().toISOString(),
      provider: 'unavailable',
      results: [],
    }, 'unavailable');
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Public search timed out')), timeoutMs);
    promise.then((value) => {
      clearTimeout(timeout);
      resolve(value);
    }, (error: unknown) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function withSearchSnapshot(plan: GoalIntelligencePlan, response: PublicWebSearchResponse | Omit<PublicSearchSnapshot, 'status'>, status: PublicSearchSnapshot['status']): GoalIntelligencePlan {
  const publicSearch: PublicSearchSnapshot = { ...response, status };
  const publicSourceStatus = status === 'ready' ? 'ready' : 'unavailable';
  const sources: GoalIntelligencePlan['sources'] = plan.sources.map((source) => source.id === 'public-web'
    ? { ...source, status: publicSourceStatus, activeCapabilities: status === 'ready' ? ['web.search', 'public.read'] : [] }
    : source);
  const nonReady = sources.filter((source) => source.status !== 'ready');
  const readiness: GoalIntelligencePlan['readiness'] = nonReady.some((source) => source.status === 'unavailable')
    ? 'unavailable'
    : nonReady.length > 0 ? 'needs_setup' : 'ready';
  const limitations = [...plan.limitations];
  if (nonReady.some((source) => source.id !== 'public-web') && !limitations.includes('source_not_configured')) limitations.push('source_not_configured');
  if (status === 'unavailable' && !limitations.includes('public_search_unavailable')) limitations.push('public_search_unavailable');
  return {
    ...plan,
    sources,
    readiness,
    nextAction: readiness === 'ready' ? 'confirm_goal' : 'configure_source',
    limitations,
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

const WEB_SEARCH_STOP_WORDS = new Set([
  'a', 'al', 'an', 'and', 'are', 'about', 'by', 'con', 'de', 'del', 'dame',
  'el', 'en', 'es', 'explica', 'explicar', 'explain', 'find', 'for', 'from',
  'fuente', 'fuentes', 'give', 'is', 'la', 'las', 'los', 'me', 'muéstrame',
  'muestrame', 'my', 'of', 'para', 'por', 'public', 'publica', 'publicas',
  'pública', 'públicas', 'que', 'qué', 'search', 'source', 'the', 'to', 'un',
  'una', 'verificable', 'verificables', 'what', 'with', 'y', 'you', 'encuentra',
  'encuentrame', 'encuéntrame', 'encontrar', 'busca', 'buscar', 'quiero',
  'necesito', 'sobre', 'menos', 'oportunidad', 'oportunidades',
]);

const CATEGORY_SEARCH_TERMS: Record<string, readonly string[]> = {
  job: ['empleo', 'vacantes'],
  grant: ['subvenciones', 'becas'],
  client: ['clientes', 'proyectos'],
  offer: ['ofertas'],
  tool: ['herramientas'],
  food: ['restaurantes'],
  learning: ['cursos'],
  event: ['eventos'],
  housing: ['alquiler'],
  travel: ['viajes'],
};

function isJobConstraintToken(token: string): boolean {
  return /^\d+$/u.test(token) || ['hora', 'horas', 'semanal', 'semanales', 'mes', 'meses', 'euro', 'euros'].includes(token);
}

function tokenizeSearchText(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
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
