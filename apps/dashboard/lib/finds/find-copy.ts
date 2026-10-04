/**
 * Spanish display copy for the Kernel opportunity classifier's fixed strings
 * (apps/local-kernel/opportunity-classifier.mjs: category labels and nextAction). The Kernel stores
 * them in English; the dashboard UI is Spanish, so known strings are shown translated and anything
 * unknown is shown exactly as the Kernel stored it. Display only: the stored record is unchanged.
 */
const NEXT_ACTION_ES: Record<string, string> = {
  'Review fit and application requirements': 'Revisa si encaja y los requisitos para postularte',
  'Verify eligibility and deadline': 'Comprueba si cumples los requisitos y el plazo',
  'Qualify the need before contacting': 'Confirma la necesidad antes de contactar',
  'Verify terms, price and source': 'Comprueba condiciones, precio y fuente',
  'Review license, trust and use case': 'Revisa licencia, fiabilidad y caso de uso',
  'Verify venue, availability and booking terms': 'Comprueba lugar, disponibilidad y condiciones de reserva',
  'Verify eligibility with the official source': 'Comprueba los requisitos en la fuente oficial',
  'Review curriculum, cost and recognition': 'Revisa temario, coste y reconocimiento',
  'Verify date, location and registration': 'Comprueba fecha, lugar e inscripción',
  'Verify price, conditions, identity and listing source': 'Comprueba precio, condiciones, identidad y fuente del anuncio',
  'Verify dates, restrictions and total price': 'Comprueba fechas, restricciones y precio total',
  'Review the people, scope and expected commitment': 'Revisa las personas, el alcance y el compromiso esperado',
  'Investigate independently; never send money or connect a wallet based on this lead': 'Investiga por tu cuenta; nunca envíes dinero ni conectes una wallet por este hallazgo',
  'Open the source and confirm it answers your Goal': 'Abre la fuente y confirma que responde a tu Goal',
};
const CATEGORY_ES: Record<string, string> = {
  Job: 'Empleo',
  Grant: 'Ayuda o beca',
  'Potential client': 'Cliente potencial',
  Offer: 'Oferta',
  'Useful tool': 'Herramienta útil',
  'Food & dining': 'Comida y restaurantes',
  'Aid & benefits': 'Ayudas y prestaciones',
  Learning: 'Formación',
  Event: 'Evento',
  Housing: 'Vivienda',
  Travel: 'Viajes',
  Collaboration: 'Colaboración',
  'Money opportunity': 'Oportunidad de dinero',
  'Goal match': 'Coincide con el Goal',
};

export function findNextActionEs(text: string): string {
  return NEXT_ACTION_ES[text.trim()] ?? text;
}
export function findCategoryEs(label: string): string {
  return CATEGORY_ES[label.trim()] ?? label;
}

/**
 * Compact form of a Kernel id for display: "case:verified:<64-hex>" → { kind: "case", short: "b08de4bb" }.
 * The full id is always kept (title, copy button, screen readers); nothing is hidden, only shortened.
 */
export function shortKernelId(id: string): { kind: string; short: string; full: string } {
  const full = id.trim();
  const parts = full.split(':');
  const last = parts[parts.length - 1] ?? full;
  const kind = parts.length > 1 ? parts[0] : '';
  if (/^[0-9a-f]{16,}$/i.test(last)) return { kind, short: last.slice(0, 8), full };
  const body = parts.length > 1 ? parts.slice(1).join(':') : full;
  return { kind, short: body.length > 14 ? `${body.slice(0, 12)}…` : body, full };
}
