import { createHash } from 'node:crypto';
import { validatePageContext } from './page-context-inbox.mjs';
import { matchOpportunityToGoals } from './goals.mjs';
import { buildPreferenceProfile, preferenceAdjustment } from './preference-learner.mjs';

export const OPPORTUNITY_CATEGORIES = [
  {
    id: 'job', label: 'Job', benefitType: 'income', nextAction: 'Review fit and application requirements',
    signals: [
      [/\b(hiring|we(?:'re| are) hiring|vacanc(?:y|ies)|job opening|open role|apply now|career(?:s)?)\b/gi, 28],
      [/\b(empleo|contratando|vacante|oferta de trabajo|puesto abierto|postula(?:r|te))\b/gi, 28],
      [/\b(remote|salary|compensation|full[- ]time|part[- ]time|curriculum|resume|cv)\b/gi, 12],
    ],
  },
  {
    id: 'grant', label: 'Grant', benefitType: 'funding', nextAction: 'Verify eligibility and deadline',
    signals: [
      [/\b(grant|accelerator|fellowship|funding call|applications? open|prize pool|hackathon)\b/gi, 28],
      [/\b(subvenci[oó]n|aceleradora|beca|convocatoria|financiaci[oó]n|premio|hackat[oó]n)\b/gi, 28],
      [/\b(eligibility|deadline|apply by|fecha l[ií]mite|requisitos|cierra el)\b/gi, 14],
    ],
  },
  {
    id: 'client', label: 'Potential client', benefitType: 'income', nextAction: 'Qualify the need before contacting',
    signals: [
      [/\b(looking for|seeking|need help with|request for proposal|rfp|freelancer|consultant)\b/gi, 26],
      [/\b(busco|buscamos|necesitamos|solicitud de propuesta|aut[oó]nomo|consultor|proveedor)\b/gi, 26],
      [/\b(budget|paid|contract|project|presupuesto|pagado|contrato|proyecto)\b/gi, 12],
    ],
  },
  {
    id: 'offer', label: 'Offer', benefitType: 'savings', nextAction: 'Verify terms, price and source',
    signals: [
      [/\b(discount|limited offer|free trial|coupon|save \d+%|deal)\b/gi, 24],
      [/\b(descuento|oferta limitada|prueba gratis|cup[oó]n|ahorra \d+%|promoci[oó]n)\b/gi, 24],
      [/\b(expires?|ends? (?:on|in)|hasta el|caduca|termina)\b/gi, 12],
    ],
  },
  {
    id: 'tool', label: 'Useful tool', benefitType: 'capability', nextAction: 'Review license, trust and use case',
    signals: [
      [/\b(open source|github|developer tool|api|sdk|cli|self[- ]hosted)\b/gi, 22],
      [/\b(c[oó]digo abierto|herramienta|repositorio|api|sdk|autoalojado)\b/gi, 22],
      [/\b(release|documentation|install|integration|licen[cs]e|documentaci[oó]n|instalar|integraci[oó]n|licencia)\b/gi, 10],
    ],
  },
  {
    id: 'food', label: 'Food & dining', benefitType: 'savings', nextAction: 'Verify venue, availability and booking terms',
    signals: [
      [/\b(free (?:meal|dinner|lunch|food)|restaurant deal|complimentary dinner|meal voucher|food voucher|tasting event)\b/gi, 30],
      [/\b(cena gratis|comida gratis|men[uú] del d[ií]a|oferta restaurante|vale de comida|degustaci[oó]n)\b/gi, 30],
      [/\b(reservation|book now|per person|restaurant|reserva|por persona|restaurante)\b/gi, 14],
    ],
  },
  {
    id: 'aid', label: 'Aid & benefits', benefitType: 'support', nextAction: 'Verify eligibility with the official source',
    signals: [
      [/\b(financial aid|public benefit|relief payment|support scheme|government assistance|tax credit)\b/gi, 30],
      [/\b(ayuda p[uú]blica|prestaci[oó]n|bono social|cheque ayuda|deducci[oó]n fiscal|ingreso m[ií]nimo)\b/gi, 30],
      [/\b(eligib(?:le|ility)|official|application|requisitos|sede electr[oó]nica|solicitud)\b/gi, 14],
    ],
  },
  {
    id: 'learning', label: 'Learning', benefitType: 'capability', nextAction: 'Review curriculum, cost and recognition',
    signals: [
      [/\b(free course|scholarship|certification|training program|bootcamp|workshop)\b/gi, 30],
      [/\b(curso gratis|beca de estudio|certificaci[oó]n|formaci[oó]n gratuita|taller|curso subvencionado)\b/gi, 30],
      [/\b(enroll|registration|curriculum|plazas|inscripci[oó]n|temario)\b/gi, 16],
    ],
  },
  {
    id: 'event', label: 'Event', benefitType: 'connection', nextAction: 'Verify date, location and registration',
    signals: [
      [/\b(free event|meetup|networking event|conference ticket|community event)\b/gi, 30],
      [/\b(evento gratis|encuentro|networking|entrada gratuita|evento comunitario)\b/gi, 30],
      [/\b(register|venue|attend|aforo|ubicaci[oó]n|inscr[ií]bete)\b/gi, 16],
    ],
  },
  {
    id: 'housing', label: 'Housing', benefitType: 'access', nextAction: 'Verify price, conditions, identity and listing source',
    signals: [
      [/\b(affordable housing|room available|rental assistance|housing lottery|below market rent)\b/gi, 30],
      [/\b(alquiler asequible|habitaci[oó]n disponible|ayuda al alquiler|vivienda protegida|alquiler barato)\b/gi, 30],
      [/\b(monthly rent|deposit|application|alquiler mensual|fianza|solicitud)\b/gi, 14],
    ],
  },
  {
    id: 'travel', label: 'Travel', benefitType: 'savings', nextAction: 'Verify dates, restrictions and total price',
    signals: [
      [/\b(flight deal|fare sale|free accommodation|travel grant|hotel deal)\b/gi, 30],
      [/\b(oferta de vuelo|vuelo barato|alojamiento gratis|beca de viaje|oferta de hotel)\b/gi, 30],
      [/\b(round trip|travel dates|limited seats|ida y vuelta|fechas de viaje|plazas limitadas)\b/gi, 16],
    ],
  },
  {
    id: 'collaboration', label: 'Collaboration', benefitType: 'connection', nextAction: 'Review the people, scope and expected commitment',
    signals: [
      [/\b(cofounder wanted|seeking collaborators?|open call for creators?|partnership opportunity)\b/gi, 30],
      [/\b(busco socio|buscamos colaboradores|convocatoria para creadores|oportunidad de colaboraci[oó]n)\b/gi, 30],
      [/\b(equity|revenue share|portfolio|community|participaci[oó]n|comisi[oó]n|comunidad)\b/gi, 17],
    ],
  },
  {
    id: 'money', label: 'Money opportunity', benefitType: 'income', nextAction: 'Investigate independently; never send money or connect a wallet based on this lead',
    signals: [
      [/\b(cashback|referral reward|paid research|paid survey|bounty program|bug bounty)\b/gi, 30],
      [/\b(reembolso|recompensa por referido|estudio remunerado|encuesta pagada|programa de recompensas)\b/gi, 30],
      [/\b(terms apply|payout|reward amount|condiciones|pago|importe de la recompensa)\b/gi, 16],
    ],
  },
];

const DEADLINE_PATTERNS = [
  /\b(?:deadline|apply by|closes?|ends?|expires?)\s*[:\-]?\s*([^\n.!?]{3,50})/i,
  /\b(?:fecha l[ií]mite|cierra|termina|caduca|hasta el)\s*[:\-]?\s*([^\n.!?]{3,50})/i,
];

export function classifyOpportunity(input, references = {}) {
  const context = validatePageContext(input);
  const searchable = `${context.title}\n${context.description ?? ''}\n${context.visibleText}`;
  const ranked = OPPORTUNITY_CATEGORIES.map((category) => scoreCategory(category, searchable))
    .sort((left, right) => right.score - left.score || left.category.localeCompare(right.category));
  const best = ranked[0];
  if (!best || best.score < 55) return { status: 'ordinary_evidence', score: best?.score ?? 0 };

  const sourceUrl = context.canonicalUrl ?? context.url;
  const fingerprint = createHash('sha256').update(`${references.evidenceId ?? ''}\n${sourceUrl}`).digest('hex');
  return {
    status: 'opportunity',
    opportunity: {
      id: `opportunity:${fingerprint}`,
      evidenceId: references.evidenceId,
      caseId: references.caseId,
      category: best.category,
      categoryLabel: best.label,
      benefitType: best.benefitType,
      title: context.title,
      sourceUrl,
      sourceHost: new URL(sourceUrl).hostname,
      relevance: best.score,
      reasons: best.reasons,
      deadlineText: extractDeadline(searchable),
      nextAction: best.nextAction,
      status: 'new',
      detectedAt: context.capturedAt,
    },
  };
}

export class OpportunityProjector {
  constructor(store) { this.store = store; }

  async project(input, references = {}) {
    const classified = classifyOpportunity(input, references);
    if (classified.status !== 'opportunity') return classified;
    return this.store.project(async (data) => {
      const opportunities = Array.isArray(data.opportunities) ? data.opportunities : [];
      const existing = opportunities.find((item) => item.id === classified.opportunity.id || item.evidenceId === references.evidenceId);
      if (existing) return { changed: false, data, result: { status: 'opportunity', opportunity: existing, duplicate: true } };
      return {
        changed: true,
        data: { ...data, opportunities: [...opportunities, classified.opportunity] },
        result: { ...classified, duplicate: false },
      };
    });
  }

  async list({ limit = 20 } = {}) {
    const data = await this.store.read();
    const preferenceProfile = buildPreferenceProfile(data.preferenceFeedback ?? []);
    return (data.opportunities ?? [])
      .filter((item) => item?.status !== 'dismissed')
      .map((item) => {
        const goalMatches = matchOpportunityToGoals(item, data.goals ?? []);
        const learnedAdjustment = preferenceAdjustment(item, preferenceProfile);
        return { ...item, goalMatches, learnedAdjustment, personalizedRelevance: Math.max(0, Math.min(99, item.relevance + Math.round((goalMatches[0]?.score ?? 0) * 0.25) + learnedAdjustment)) };
      })
      .sort((left, right) => right.personalizedRelevance - left.personalizedRelevance || right.detectedAt.localeCompare(left.detectedAt))
      .slice(0, Math.max(1, Math.min(Number(limit) || 20, 100)));
  }
}

function scoreCategory(category, text) {
  let score = 0;
  const reasons = [];
  for (const [pattern, weight] of category.signals) {
    pattern.lastIndex = 0;
    const matches = [...text.matchAll(pattern)];
    if (!matches.length) continue;
    score += weight + Math.min(matches.length - 1, 2) * 4;
    reasons.push(matches[0][0].slice(0, 60));
  }
  return { category: category.id, label: category.label, benefitType: category.benefitType, nextAction: category.nextAction, score: Math.min(score, 99), reasons: reasons.slice(0, 3) };
}

function extractDeadline(text) {
  for (const pattern of DEADLINE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/\s+/g, ' ').slice(0, 80);
  }
  return undefined;
}
