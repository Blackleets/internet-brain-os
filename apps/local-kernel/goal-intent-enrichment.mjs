export const GOAL_CATEGORIES = Object.freeze([
  'job', 'grant', 'client', 'offer', 'tool', 'food', 'aid', 'learning',
  'event', 'housing', 'travel', 'collaboration', 'money',
]);

const CATEGORY_RULES = Object.freeze([
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
]);

const CURRENCY_AMOUNT_PATTERN = /(?:[$€£]\s*\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s*(?:eur|usd|gbp|euros?|dollars?|dolares?|libras?)\b)/iu;
const PURCHASE_PRICE_CONTEXT = /\b(price|prices|budget|under|between|cost|costs|buy|buying|seller|sellers|precio|precios|presupuesto|entre|coste|costes|comprar|compra|vendedor|vendedores)\b/u;
const CONSUMER_CATEGORIES = new Set(['tool', 'food', 'travel', 'housing']);
const MAX_INFERRED_CATEGORIES = 4;

export function enrichGoalIntent({ title, categories = [], keywords = [], keywordLimit = 12 } = {}) {
  const explicitCategories = Array.isArray(categories) ? categories : [];
  const explicitKeywords = Array.isArray(keywords) ? keywords : [];
  const categoriesResult = explicitCategories.length
    ? [...explicitCategories]
    : inferGoalCategories(`${title ?? ''} ${explicitKeywords.join(' ')}`);
  const numericKeywords = extractNumericGoalKeywords(title);
  const keywordsResult = unique([...explicitKeywords, ...numericKeywords]).slice(0, keywordLimit);
  return { categories: categoriesResult, keywords: keywordsResult };
}

export function inferGoalCategories(value) {
  const searchable = normalize(value);
  const matches = [];
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(searchable)) matches.push(category);
  }
  const currencyPriceIntent = CURRENCY_AMOUNT_PATTERN.test(String(value ?? ''))
    && (PURCHASE_PRICE_CONTEXT.test(searchable) || matches.some((category) => CONSUMER_CATEGORIES.has(category)));
  if (currencyPriceIntent && !matches.includes('offer')) matches.push('offer');
  return matches.slice(0, MAX_INFERRED_CATEGORIES);
}

export function extractNumericGoalKeywords(value) {
  const text = String(value ?? '');
  const results = [];
  const currencyAmounts = text.match(/[$€£]\s*\d+(?:[.,]\d+)?/gu) ?? [];
  for (const match of currencyAmounts) results.push(match.replace(/[$€£\s]/gu, '').replace(',', '.'));
  const standalone = text.match(/\b\d{2,}(?:[.,]\d+)?\b/gu) ?? [];
  for (const match of standalone) results.push(match.replace(',', '.'));
  return unique(results).filter((item) => item.length <= 40);
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en');
}

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
}
