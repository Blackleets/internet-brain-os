import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import {
  MAX_EVIDENCE_EXCERPT_CHARS,
  MAX_MISSION_EVIDENCE_RECORDS,
  MISSION_EVIDENCE_SCHEMA_VERSION,
  MissionEvidenceReader,
  excerptFrom,
} from './mission-evidence-reader.mjs';
import { createLocalKernelServer } from './server.mjs';

const apiToken = 'mission-evidence-token-that-is-long-enough-1234567890';
const MISSION_ID = 'mission:abc';
const servers = new Set();
const dirs = new Set();

afterEach(async () => {
  await Promise.all([...servers].map((server) => new Promise((resolve) => server.close(resolve))));
  servers.clear();
  await Promise.all([...dirs].map((dir) => rm(dir, { recursive: true, force: true })));
  dirs.clear();
});

function memoryStore(data) {
  return { read: async () => structuredClone(data), project: async () => { throw new Error('read-only reader must never write'); } };
}

function fixture(overrides = {}) {
  return {
    goals: [{ id: 'goal:1', title: 'Taladro percutor inalámbrico 18 V', keywords: ['taladro', 'percutor', 'inalámbrico'], status: 'active' }],
    agentMissions: [{
      id: MISSION_ID,
      goalId: 'goal:1',
      goalTitle: 'Taladro percutor inalámbrico 18 V',
      status: 'completed',
      executionPhase: 'forged',
      searchCandidates: [
        { id: 'cand:1', url: 'https://tools.example/drill', title: 'Hermes title', snippet: 'HERMES SNIPPET MUST NEVER BE QUOTED' },
        { id: 'cand:2', url: 'https://blog.example/post', title: 'Hermes title 2', snippet: 'snippet 2' },
        { id: 'cand:3', url: 'https://down.example/', title: 'Down', snippet: 'snippet 3' },
      ],
      verificationResults: [
        { candidateId: 'cand:1', status: 'verified', evidenceId: 'evidence:verified:1', sourceUrl: 'https://tools.example/drill', supported: true, supportReason: 'supported' },
        { candidateId: 'cand:2', status: 'verified', evidenceId: 'evidence:verified:2', sourceUrl: 'https://blog.example/post', supported: false, supportReason: 'insufficient_term_coverage' },
        { candidateId: 'cand:3', status: 'verification_failed', reason: 'web.read returned HTTP 404' },
      ],
    }],
    evidence: [
      {
        id: 'evidence:verified:1', caseId: 'case:verified:1', missionId: MISSION_ID, candidateId: 'cand:1',
        sourceUrl: 'https://tools.example/drill', summary: 'Taladro 18 V', capturedAt: '2026-10-03T10:00:00.000Z',
        contentHash: 'a'.repeat(64), extractionMethod: 'kernel-web-read-v1',
        rawText: `Menú Inicio Ofertas ${'navegación '.repeat(20)}El taladro percutor inalámbrico de 18 V cuesta 109,90 € con entrega en 24 h.`,
      },
      {
        id: 'evidence:verified:2', caseId: 'case:verified:2', missionId: MISSION_ID, candidateId: 'cand:2',
        sourceUrl: 'https://blog.example/post', summary: 'Comparativa', capturedAt: '2026-10-03T10:00:01.000Z',
        rawText: 'Comparativa de herramientas de jardín.',
      },
      // Evidence from another Mission / capture must never leak into this Mission's projection.
      { id: 'evidence:other', missionId: 'mission:other', sourceUrl: 'https://x.example', summary: 'Other', rawText: 'taladro' },
    ],
    ...overrides,
  };
}

async function startServer(reader) {
  const server = createLocalKernelServer({}, undefined, undefined, undefined, { apiToken, missionEvidenceReader: reader });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.add(server);
  return `http://127.0.0.1:${server.address().port}`;
}

describe('MissionEvidenceReader', () => {
  it('reports term-coverage scope without certifying price, stock or freshness from agent or stored text', async () => {
    const data = fixture();
    const fakeScope = { topic: 'all_conditions_verified', price: 'met', availability: 'met', freshness: 'met' };
    data.agentMissions[0].verificationScope = fakeScope;
    data.agentMissions[0].verificationResults[0].verificationScope = fakeScope;
    data.evidence[0].verificationScope = fakeScope;
    const before = JSON.stringify(data);
    const result = await new MissionEvidenceReader(memoryStore(data)).list(MISSION_ID);
    expect(result.verificationScope).toEqual({
      topic: 'term_coverage_only', price: 'not_assessed', availability: 'not_assessed', freshness: 'not_assessed',
    });
    expect(result.evidence[0].supported).toBe(true);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('projects only Kernel-verified Evidence of the Mission with the Kernel SUPPORT decision and a bounded verbatim excerpt', async () => {
    const result = await new MissionEvidenceReader(memoryStore(fixture())).list(MISSION_ID);
    expect(result.schemaVersion).toBe(MISSION_EVIDENCE_SCHEMA_VERSION);
    expect(result.sourceOfTruth).toBe('kernel');
    expect(result.missionId).toBe(MISSION_ID);
    expect(result.evidence.map((item) => item.id)).toEqual(['evidence:verified:1', 'evidence:verified:2']);
    const [supported, unsupported] = result.evidence;
    expect(supported).toMatchObject({ candidateId: 'cand:1', caseId: 'case:verified:1', supported: true, supportReason: 'supported', title: 'Taladro 18 V', extractionMethod: 'kernel-web-read-v1' });
    expect(supported.excerpt.anchor).toBe('goal_term');
    expect(supported.excerpt.truncatedStart).toBe(true);
    expect(supported.excerpt.text).toContain('taladro percutor inalámbrico de 18 V cuesta 109,90 €');
    // Verbatim: every excerpt is a literal substring of the stored Evidence text.
    expect(fixture().evidence[0].rawText.replace(/\s+/g, ' ')).toContain(supported.excerpt.text);
    expect(unsupported).toMatchObject({ supported: false, supportReason: 'insufficient_term_coverage' });
    expect(unsupported.excerpt).toEqual({ text: 'Comparativa de herramientas de jardín.', anchor: 'start', truncatedStart: false, truncatedEnd: false });
    // Full page text, Hermes snippets and other Missions' Evidence are never returned.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('rawText');
    expect(serialized).not.toContain('HERMES SNIPPET');
    expect(serialized).not.toContain('evidence:other');
  });

  it('fails closed on Evidence that is not linked to the Mission even when a verification row names it', async () => {
    const data = fixture();
    data.evidence[0] = { ...data.evidence[0], missionId: 'mission:forged-elsewhere' };
    const result = await new MissionEvidenceReader(memoryStore(data)).list(MISSION_ID);
    expect(result.evidence.map((item) => item.id)).toEqual(['evidence:verified:2']);
  });

  it('returns an empty list (not invented records) while the Mission is still searching or verifying', async () => {
    const data = fixture();
    data.agentMissions[0] = { ...data.agentMissions[0], status: 'running', executionPhase: 'verifying', verificationResults: undefined };
    const result = await new MissionEvidenceReader(memoryStore(data)).list(MISSION_ID);
    expect(result.evidence).toEqual([]);
  });

  it('returns a null excerpt when the stored Evidence has no text', async () => {
    const data = fixture();
    data.evidence[1] = { ...data.evidence[1], rawText: '   ' };
    const result = await new MissionEvidenceReader(memoryStore(data)).list(MISSION_ID);
    expect(result.evidence[1].excerpt).toBeNull();
  });

  it('rejects unknown Missions with 404 and invalid ids with 400', async () => {
    const reader = new MissionEvidenceReader(memoryStore(fixture()));
    await expect(reader.list('mission:missing')).rejects.toMatchObject({ code: 'AGENT_MISSION_NOT_FOUND', status: 404 });
    await expect(reader.list('')).rejects.toMatchObject({ code: 'INVALID_MISSION_ID', status: 400 });
    await expect(reader.list('x'.repeat(201))).rejects.toMatchObject({ code: 'INVALID_MISSION_ID', status: 400 });
  });

  it('bounds the number of records', async () => {
    const data = fixture();
    const results = [];
    const evidence = [];
    for (let index = 0; index < MAX_MISSION_EVIDENCE_RECORDS + 5; index += 1) {
      results.push({ candidateId: `c${index}`, status: 'verified', evidenceId: `e${index}`, supported: false, supportReason: 'insufficient_term_coverage' });
      evidence.push({ id: `e${index}`, missionId: MISSION_ID, sourceUrl: `https://s${index}.example`, summary: `S${index}`, rawText: 'texto' });
    }
    data.agentMissions[0].verificationResults = results;
    data.evidence = evidence;
    const result = await new MissionEvidenceReader(memoryStore(data)).list(MISSION_ID);
    expect(result.evidence).toHaveLength(MAX_MISSION_EVIDENCE_RECORDS);
  });

  it('reads a real LocalKnowledgeStore file without writing to it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mission-evidence-'));
    dirs.add(dir);
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    await store.write(fixture());
    let writes = 0;
    const write = store.write.bind(store);
    store.write = async (value) => { writes += 1; return write(value); };
    const result = await new MissionEvidenceReader(store).list(MISSION_ID);
    expect(result.evidence).toHaveLength(2);
    expect(writes).toBe(0);
  });
});

describe('excerptFrom', () => {
  it('keeps excerpts within the bound and marks truncation', () => {
    const long = `${'palabra '.repeat(200)}`;
    const excerpt = excerptFrom(long, []);
    expect(excerpt.text.length).toBeLessThanOrEqual(MAX_EVIDENCE_EXCERPT_CHARS);
    expect(excerpt).toMatchObject({ anchor: 'start', truncatedStart: false, truncatedEnd: true });
  });

  it('removes control characters and matches goal terms accent-insensitively', () => {
    const excerpt = excerptFrom('Hola\u0000 mundo. Envio a MADRID hoy', ['madrid']);
    expect(excerpt.text).toBe('Hola mundo. Envio a MADRID hoy');
    expect(excerpt.anchor).toBe('goal_term');
  });
});

describe('excerptFrom sentence choice', () => {
  it('prefers the prose sentence covering the goal terms over page chrome that repeats them', () => {
    const raw = 'What is Ownership? - The Rust Book Keyboard shortcuts Press S or / to search Auto Light Rust Coal Navy Ayu The Rust Programming Language Home Docs Blog Community Install Learn Playground Tools Governance What Is Ownership? '
      + 'Ownership is a set of rules that govern how a Rust program manages memory. All programs have to manage memory. '.repeat(3);
    const excerpt = excerptFrom(raw, ['rust', 'ownership']);
    expect(excerpt?.text.startsWith('Ownership is a set of rules that govern how a Rust program manages memory.')).toBe(true);
    expect(raw.replace(/\s+/g, ' ')).toContain(excerpt?.text);
    expect(excerpt?.truncatedStart).toBe(true);
  });

  it('treats the block that repeats the page title as page chrome', () => {
    const raw = `Lifetimes - The Rustonomicon Keyboard shortcuts Press ? to show this help ${'Navigation entry. '.repeat(12)}Rust enforces these rules through lifetimes. Lifetimes are named regions of code.`;
    const excerpt = excerptFrom(raw, ['rust', 'lifetimes'], { title: 'Lifetimes - The Rustonomicon' });
    expect(excerpt?.text.startsWith('Rust enforces these rules through lifetimes.')).toBe(true);
  });

  it('never quotes undecoded binary stored as text', () => {
    expect(excerptFrom('\ufffd}\ufffdr\ufffdF\ufffd\ufffd G\ufffd;`\ufffd\ufffd \u03f1@\ufffd\ufffd\u058b\ufffd \ufffd\ufffd\ufffd', ['rust'])).toBeNull();
  });
});

describe('GET /api/agent-missions/:id/evidence', () => {
  it('requires the Kernel API token', async () => {
    const base = await startServer(new MissionEvidenceReader(memoryStore(fixture())));
    const response = await fetch(`${base}/api/agent-missions/${encodeURIComponent(MISSION_ID)}/evidence`);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, code: 'AUTH_REQUIRED' });
  });

  it('returns the read-only projection for an authenticated client', async () => {
    const base = await startServer(new MissionEvidenceReader(memoryStore(fixture())));
    const response = await fetch(`${base}/api/agent-missions/${encodeURIComponent(MISSION_ID)}/evidence`, { headers: { 'x-hephaestus-token': apiToken } });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.schemaVersion).toBe(MISSION_EVIDENCE_SCHEMA_VERSION);
    expect(body.verificationScope).toMatchObject({ topic: 'term_coverage_only', price: 'not_assessed', availability: 'not_assessed', freshness: 'not_assessed' });
    expect(body.evidence).toHaveLength(2);
  });

  it('answers 404 for an unknown Mission, 400 for malformed ids and 404 when the reader is not configured', async () => {
    const base = await startServer(new MissionEvidenceReader(memoryStore(fixture())));
    const headers = { 'x-hephaestus-token': apiToken };
    const missing = await fetch(`${base}/api/agent-missions/mission%3Amissing/evidence`, { headers });
    expect(missing.status).toBe(404);
    expect((await missing.json()).code).toBe('AGENT_MISSION_NOT_FOUND');
    const malformed = await fetch(`${base}/api/agent-missions/%E0%A4%A/evidence`, { headers, signal: AbortSignal.timeout(3000) });
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).code).toBe('INVALID_PATH');
    const unconfigured = await startServer(undefined);
    const unavailable = await fetch(`${unconfigured}/api/agent-missions/${encodeURIComponent(MISSION_ID)}/evidence`, { headers });
    expect(unavailable.status).toBe(404);
    expect((await unavailable.json()).code).toBe('MISSION_EVIDENCE_UNAVAILABLE');
  });

  it('is GET-only: other methods do not reach the reader', async () => {
    let calls = 0;
    const base = await startServer({ list: async () => { calls += 1; return {}; } });
    const response = await fetch(`${base}/api/agent-missions/${encodeURIComponent(MISSION_ID)}/evidence`, { method: 'POST', headers: { 'x-hephaestus-token': apiToken, 'content-type': 'application/json' }, body: '{}' });
    expect(response.status).toBe(404);
    expect(calls).toBe(0);
  });
});
