import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentMissionExecutor, isWellFormedAbsoluteHttpUrl } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

// TEST FIXTURES: Kernel-shaped agent results (not product data).
// The mangled URL is the exact shape a live Hermes run returned (markdown link debris).
const MANGLED = 'https://www.opcionempleo.com/](https://www.opcionempleo.com/compania/McDonald%27s';
const interactive = { confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' } };
const now = new Date('2026-10-04T01:40:00.000Z');

async function claimed() {
  const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-candidate-url-')), 'store.json'));
  const goal = await new GoalManager(store).create({ title: 'Find a drill offer', categories: ['offer'], keywords: ['drill'] });
  const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
  const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false, now: () => now });
  const claim = await executor.claim('hermes', mission.id);
  return { store, mission, executor, claim };
}
const finding = (url) => ({ url, title: 'Search result', text: 'UNTRUSTED SEARCH SNIPPET' });

describe('candidate URLs must be well-formed absolute http(s) URLs as written', () => {
  it('accepts ordinary public URLs, IRIs and bracketed query keys', () => {
    for (const url of [
      'https://shop.example/drill',
      'http://shop.example:8080/a/b?x=1&y=2#frag',
      'https://www.glassdoor.es/Empleo/espa%C3%B1a-delivery-courier-empleos-SRCH_IL.0,6_IN219_KO7,23.htm',
      'https://es.wikipedia.org/wiki/España',
      'https://en.wikipedia.org/wiki/Rust_(programming_language)',
      'https://jobs.example/search?f[0]=type:rider&page=2',
      'https://web.archive.org/web/2020/https://shop.example/drill',
      'https://shop.example',
    ]) expect(isWellFormedAbsoluteHttpUrl(url), url).toBe(true);
  });

  it('rejects markdown debris, whitespace, excluded characters, bad escapes and relative or non-web URLs', () => {
    for (const url of [
      MANGLED,
      'https://a.example/[link](https://a.example/b)',
      'https://a.example/path]',
      'https://a.example/pa th',
      'https://a.example/a"b',
      'https://a.example/a<b>',
      'https://a.example/a{b}',
      'https://a.example/a|b',
      'https://a.example/a\\b',
      'https://a.example/100%',
      'https://a.example/%zz',
      'https://[not-an-ip]/x',
      '//a.example/x',
      '/relative/path',
      'ftp://a.example/x',
      'javascript:alert(1)',
      '',
    ]) expect(isWellFormedAbsoluteHttpUrl(url), url).toBe(false);
  });

  it('the results route rejects a batch carrying a mangled URL and stores nothing from it', async () => {
    const { store, mission, executor, claim } = await claimed();
    await expect(executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [finding('https://shop.example/drill'), finding(MANGLED)] }))
      .rejects.toThrow(/well-formed absolute HTTP\(S\)/);
    const stored = (await store.read()).agentMissions[0];
    expect(stored.searchCandidates ?? []).toEqual([]);
    expect(stored.status).toBe('running');
  });

  it('still accepts the same batch once the adapter has recovered the link target', async () => {
    const { store, mission, executor, claim } = await claimed();
    await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [finding('https://shop.example/drill'), finding('https://www.opcionempleo.com/compania/McDonald%27s')] });
    const stored = (await store.read()).agentMissions[0];
    expect(stored.searchCandidates.map((item) => item.url)).toEqual(['https://shop.example/drill', 'https://www.opcionempleo.com/compania/McDonald%27s']);
  });
});
