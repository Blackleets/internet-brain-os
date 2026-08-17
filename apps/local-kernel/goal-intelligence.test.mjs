import { describe, expect, it } from 'vitest';
import { buildGoalIntelligencePlan } from './goal-intelligence.mjs';

const readyCatalog = [
  { id: 'hermes', adapter: 'native', status: 'ready', capabilities: ['mission.execute', 'public.read'], scopes: ['public.read'], action: 'agents' },
  { id: 'github', adapter: 'mcp', status: 'ready', capabilities: ['github.repository.read', 'github.issue.read', 'github.pull_request.read', 'github.checks.read'], scopes: ['github.read'], action: 'settings' },
  { id: 'gmail', adapter: 'mcp', status: 'not_configured', capabilities: [], scopes: ['gmail.read'], action: 'settings' },
  { id: 'google-drive', adapter: 'mcp', status: 'not_configured', capabilities: [], scopes: ['drive.read'], action: 'settings' },
  { id: 'notion', adapter: 'mcp', status: 'not_configured', capabilities: [], scopes: ['notion.read'], action: 'settings' },
  { id: 'google-calendar', adapter: 'mcp', status: 'not_configured', capabilities: [], scopes: ['calendar.read'], action: 'settings' },
];

describe('Kernel Goal intelligence plan', () => {
  it('selects only public research for a generic Goal and keeps the plan ready when Hermes is ready', () => {
    const plan = buildGoalIntelligencePlan({
      title: 'Encuéntrame trabajos freelance remotos',
      integrations: readyCatalog,
      now: () => '2026-08-14T14:00:00.000Z',
    });

    expect(plan).toMatchObject({
      schemaVersion: 'efesto.goal-intelligence.v1',
      authority: 'kernel',
      generatedAt: '2026-08-14T14:00:00.000Z',
      intent: { primaryCategory: 'job', mode: 'public_research' },
      readiness: 'ready',
      nextAction: 'confirm_goal',
    });
    expect(plan.sources.map((source) => source.id)).toEqual(['hermes']);
    expect(plan.limitations).toContain('read_only_sources');
  });

  it.each([
    ['software', 'Encuentra software de automatización'],
    ['open source', 'Encuentra proyectos open source de automatización'],
    ['documentos', 'Investiga documentos públicos sobre contratos'],
    ['notas', 'Busca notas públicas sobre trading'],
    ['eventos', 'Encuentra eventos de tecnología en Madrid'],
  ])('does not route generic %s language to a private connector', (_label, title) => {
    const plan = buildGoalIntelligencePlan({ title, integrations: readyCatalog });

    expect(plan.sources.map((source) => source.id)).toEqual(['hermes']);
    expect(plan.intent.mode).toBe('public_research');
  });

  it('routes explicit GitHub intent to the connector without claiming inactive capabilities', () => {
    const plan = buildGoalIntelligencePlan({
      title: 'Audita este repositorio de GitHub y sus pull requests',
      integrations: readyCatalog.map((integration) => integration.id === 'github'
        ? { ...integration, status: 'not_configured', capabilities: [] }
        : integration),
    });
    const github = plan.sources.find((source) => source.id === 'github');

    expect(plan.intent.mode).toBe('connector_research');
    expect(github).toMatchObject({
      status: 'not_configured',
      required: true,
      scopes: ['github.read'],
      activeCapabilities: [],
      requiredCapabilities: expect.arrayContaining(['github.repository.read', 'github.pull_request.read']),
    });
    expect(plan.readiness).toBe('needs_setup');
    expect(plan.nextAction).toBe('configure_source');
    expect(plan.limitations).toContain('source_not_configured');
  });

  it.each([
    ['Gmail', 'Revisa mis correos de Gmail sobre clientes', 'gmail'],
    ['Google Drive', 'Busca en Google Drive el documento de estrategia', 'google-drive'],
    ['Notion', 'Contrasta estas notas de Notion', 'notion'],
    ['Google Calendar', 'Encuentra una reunión libre en Google Calendar', 'google-calendar'],
  ])('routes explicit %s intent to its read-only connector', (_label, title, sourceId) => {
    const plan = buildGoalIntelligencePlan({ title, integrations: readyCatalog });
    expect(plan.sources.map((source) => source.id)).toContain(sourceId);
    expect(plan.sources.find((source) => source.id === sourceId)).toMatchObject({ required: true, reason: 'goal_signal' });
  });

  it('fails closed for an invalid preview without mutating a Goal or integration state', () => {
    expect(() => buildGoalIntelligencePlan({ title: '  ' })).toThrow('Goal title must contain at least 3 characters');
  });
});
