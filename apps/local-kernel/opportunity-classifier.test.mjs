import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { classifyOpportunity, OPPORTUNITY_CATEGORIES, OpportunityProjector } from './opportunity-classifier.mjs';
import { PreferenceLearner } from './preference-learner.mjs';

const base = {
  schemaVersion: 'hephaestus.page-context.v1',
  url: 'https://jobs.example.com/ai-engineer?utm_source=x',
  canonicalUrl: 'https://jobs.example.com/ai-engineer',
  title: 'We are hiring an AI Applications Engineer',
  visibleText: 'Open role. Remote full-time position. Salary listed. Apply now. Deadline: August 14, 2026.',
  capturedAt: '2026-07-22T18:00:00.000Z',
};

describe('opportunity classifier', () => {
  it('classifies a strong job signal with explainable fields and raw deadline text', () => {
    expect(classifyOpportunity(base, { caseId: 'case:1', evidenceId: 'evidence:1' })).toEqual({
      status: 'opportunity',
      opportunity: expect.objectContaining({
        id: expect.stringMatching(/^opportunity:[a-f0-9]{64}$/),
        category: 'job', benefitType: 'income', relevance: expect.any(Number), sourceHost: 'jobs.example.com',
        deadlineText: 'August 14, 2026', nextAction: 'Review fit and application requirements',
        evidenceId: 'evidence:1', caseId: 'case:1', status: 'new',
      }),
    });
  });

  it('uses an extensible taxonomy for everyday and economic opportunities', () => {
    expect(OPPORTUNITY_CATEGORIES.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'job', 'grant', 'client', 'offer', 'tool', 'food', 'aid', 'learning',
      'event', 'housing', 'travel', 'collaboration', 'money',
    ]));
  });

  it.each([
    ['food', 'savings', 'Cena gratis para riders', 'Oferta restaurante: cena gratis. Reserva ahora en el restaurante.'],
    ['aid', 'support', 'Nueva ayuda pública', 'Bono social disponible. Consulta requisitos y solicitud en la sede electrónica oficial.'],
    ['learning', 'capability', 'Formación gratuita', 'Curso gratis con certificación. Inscripción abierta y temario disponible.'],
    ['event', 'connection', 'Evento gratis de IA', 'Evento gratis y networking. Inscríbete para asistir; aforo limitado.'],
    ['housing', 'access', 'Alquiler asequible', 'Habitación disponible con alquiler mensual barato. Consulta fianza y solicitud.'],
    ['travel', 'savings', 'Oferta de vuelo', 'Vuelo barato con plazas limitadas. Ida y vuelta y fechas de viaje publicadas.'],
    ['collaboration', 'connection', 'Buscamos colaboradores', 'Oportunidad de colaboración para creadores. Comunidad con participación.'],
    ['money', 'income', 'Estudio remunerado', 'Estudio remunerado con pago. Consulta condiciones e importe de la recompensa.'],
  ])('classifies %s opportunities with their concrete benefit', (category, benefitType, title, visibleText) => {
    const result = classifyOpportunity({ ...base, title, visibleText });
    expect(result).toEqual({
      status: 'opportunity',
      opportunity: expect.objectContaining({ category, benefitType }),
    });
  });

  it('keeps ordinary pages as Evidence without promoting them', () => {
    const result = classifyOpportunity({ ...base, title: 'Weather report', visibleText: 'Sunny today with light wind.' });
    expect(result).toEqual({ status: 'ordinary_evidence', score: 0 });
  });

  it('persists each opportunity once and lists highest relevance first', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-opportunities-'));
    const projector = new OpportunityProjector(new LocalKnowledgeStore(join(dir, 'store.json')));
    const first = await projector.project(base, { caseId: 'case:1', evidenceId: 'evidence:1' });
    const retry = await projector.project(base, { caseId: 'case:1', evidenceId: 'evidence:1' });
    expect(first.status).toBe('opportunity');
    expect(retry.duplicate).toBe(true);
    expect(await projector.list()).toHaveLength(1);
  });

  it('personalizes ranking without changing the evidence relevance score', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-personalized-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    const projector = new OpportunityProjector(store);
    await projector.project(base, { caseId: 'case:1', evidenceId: 'evidence:1' });
    await store.project(async (data) => ({ changed: true, data: { ...data, goals: [{ id: 'goal:1', title: 'Remote AI work', categories: ['job'], keywords: ['remote'], priority: 3, status: 'active', createdAt: base.capturedAt }] } }));
    const [result] = await projector.list();
    expect(result.personalizedRelevance).toBeGreaterThan(result.relevance);
    expect(result.goalMatches[0]).toEqual(expect.objectContaining({ goalId: 'goal:1', title: 'Remote AI work' }));
  });

  it('applies learned feedback separately from objective evidence relevance', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-learned-ranking-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    const projector = new OpportunityProjector(store);
    const created = await projector.project(base, { caseId: 'case:1', evidenceId: 'evidence:1' });
    await new PreferenceLearner(store).record(created.opportunity.id, { signal: 'saved' });
    const [result] = await projector.list();
    expect(result.learnedAdjustment).toBeGreaterThan(0);
    expect(result.personalizedRelevance).toBeGreaterThan(result.relevance);
    expect(result.relevance).toBe(created.opportunity.relevance);
  });
});
