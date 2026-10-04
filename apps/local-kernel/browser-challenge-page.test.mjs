import { describe, expect, it } from 'vitest';
import { BROWSER_CHALLENGE_READ_REASON, isBrowserChallengePage } from './browser-challenge-page.mjs';

// TEST FIXTURES: shapes of bot-wall pages (run 6 InfoJobs text, Cloudflare) and of real pages.
const infojobsWall = 'InfoJobs No podemos identificar tu navegador ¿Cómo lo solucionamos? ¡Elemental, querido Watson! Comprueba que JavaScript esté habilitado en tu navegador y que no tengas ningún plugin que pueda impedir su carga o redirija tu tráfico a través de un proxy. To regain access, please make sure that cookies and JavaScript are enabled before reloading the page. Nosotros Ayuda Seguridad Condiciones legales';

describe('isBrowserChallengePage', () => {
  it('recognises short bot-protection pages', () => {
    expect(isBrowserChallengePage(infojobsWall)).toBe(true);
    expect(isBrowserChallengePage('Just a moment... Checking your browser before accessing example.com.')).toBe(true);
    expect(isBrowserChallengePage('Attention Required! | Cloudflare Please complete the security check')).toBe(true);
    expect(isBrowserChallengePage('Access to this page has been denied because we believe you are using automation tools.')).toBe(true);
    expect(BROWSER_CHALLENGE_READ_REASON).toMatch(/bot-protection/);
  });

  it('never rejects real or long pages that merely mention cookies, JavaScript or captcha', () => {
    expect(isBrowserChallengePage('Repartidor en bicicleta – ofertas de trabajo | Randstad. Trabaja como rider en Madrid, Barcelona y toda España con horario flexible.')).toBe(false);
    expect(isBrowserChallengePage('This site uses cookies. JavaScript tutorial: how to build forms.')).toBe(false);
    expect(isBrowserChallengePage(`${'Oferta de empleo de rider con contrato. '.repeat(120)} captcha`)).toBe(false);
    expect(isBrowserChallengePage('')).toBe(false);
    expect(isBrowserChallengePage(undefined)).toBe(false);
  });
});

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as kernel from '../../packages/kernel/src/index.ts';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { MissionSearchCandidateVerifier } from './mission-search-candidate-verifier.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

describe('Kernel verification of a bot-protection page', () => {
  it('records a failed read with a clear reason and stores no Evidence or Find', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-bot-wall-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'empleo de rider o delivery en España', keywords: ['empleo', 'rider', 'delivery', 'españa'] });
    const missions = new AgentMissionManager(store, { isAgentReady: () => true });
    const mission = await missions.create(goal.id, { agent: 'hermes', confirmed: true }, { confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' } });
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false });
    const url = 'https://infojobs.example/ofertas-trabajo/repartidor-delivery';
    const claim = await executor.claim('hermes', mission.id);
    await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [{ url, title: 'Search result', text: 'UNTRUSTED SNIPPET' }] });
    const reader = { fetch: async () => ({ url, title: 'InfoJobs', text: infojobsWall, fetchedAt: '2026-10-04T10:39:00.000Z', contentType: 'text/html', status: 200 }) };
    const result = await new MissionSearchCandidateVerifier(store, new OpportunityProjector(store), { kernel, reader, now: () => new Date('2026-10-04T10:39:30.000Z') }).verify(mission.id);
    expect(result.mission.verificationResults).toEqual([expect.objectContaining({ status: 'verification_failed', reason: BROWSER_CHALLENGE_READ_REASON })]);
    const data = await store.read();
    expect(data.evidence ?? []).toHaveLength(0);
    expect(data.opportunities ?? []).toHaveLength(0);
  });
});
