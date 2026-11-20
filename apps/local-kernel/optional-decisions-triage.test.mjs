import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GEMINI_DECISIONS_MODEL,
  OptionalDecisionsTriage,
} from './optional-decisions-triage.mjs';

const QUESTIONS = {
  states_price: {
    type: 'noul',
    instructions: 'Does the document state that the product costs 20 euros?',
  },
  doc_status: {
    type: 'choice',
    instructions: 'What is the status of this document?',
    criteria: { draft: 'draft', published: 'published' },
  },
  risk_clarity: {
    type: 'score',
    instructions: 'How explicitly does the document state its risks?',
    criteria: ['No risks are stated.', 'Specific risks are listed explicitly.'],
  },
};

function validResponse() {
  return {
    ok: true,
    json: async () => ({
      answers: {
        states_price: { type: 'noul', noul: 0.99, confidence: 0.99 },
        doc_status: {
          type: 'choice',
          choice: 'published',
          probabilities: { draft: 0.01, published: 0.99 },
          confidence: 0.99,
        },
        risk_clarity: {
          type: 'score',
          score: 0.98,
          probabilities: { 0: 0.02, 1: 0.98 },
          confidence: 0.98,
        },
      },
      usage: { total_tokens: 42 },
    }),
  };
}

describe('optional Gemini Decisions advisory triage', () => {
  it('skips cleanly when no API key is configured and never calls the provider', async () => {
    const fetchImpl = vi.fn(async () => validResponse());
    const triage = new OptionalDecisionsTriage({ fetchImpl });
    expect(triage.isConfigured()).toBe(false);
    await expect(triage.triage({ input: 'A public source states a price.', questions: QUESTIONS }))
      .resolves.toEqual({ status: 'skipped', reason: 'GEMINI_API_KEY_NOT_CONFIGURED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns advisory probabilities with model provenance on a valid response', async () => {
    const fetchImpl = vi.fn(async () => validResponse());
    const triage = new OptionalDecisionsTriage({
      apiKey: 'test-key',
      fetchImpl,
      now: () => '2026-11-20T12:00:00.000Z',
    });
    expect(triage.isConfigured()).toBe(true);
    const result = await triage.triage({ input: 'A public source states a price.', questions: QUESTIONS });
    expect(result.status).toBe('ok');
    expect(result.attempts).toBe(1);
    expect(result.provenance).toEqual({
      provider: 'google-gemini-decisions',
      model: DEFAULT_GEMINI_DECISIONS_MODEL,
      advisory: true,
      triageVersion: '1.0.0',
      generatedAt: '2026-11-20T12:00:00.000Z',
    });
    expect(result.answers.states_price).toEqual({ type: 'noul', probability: 0.99, confidence: 0.99 });
    expect(result.answers.doc_status).toMatchObject({ type: 'choice', choice: 'published' });
    expect(result.answers.doc_status.probabilities.published).toBeCloseTo(0.99);
    expect(result.answers.risk_clarity).toMatchObject({ type: 'score', score: 0.98 });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/decisions');
    expect(init.method).toBe('POST');
    expect(init.headers['x-goog-api-key']).toBe('test-key');
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe(DEFAULT_GEMINI_DECISIONS_MODEL);
    expect(sent.questions.states_price).toEqual({
      type: 'noul',
      instructions: QUESTIONS.states_price.instructions,
    });
    expect(sent.questions.doc_status.criteria).toEqual(QUESTIONS.doc_status.criteria);
  });

  it('reports unavailable after one bounded retry on HTTP 500', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const triage = new OptionalDecisionsTriage({ apiKey: 'test-key', fetchImpl });
    await expect(triage.triage({ input: 'Evidence text.', questions: QUESTIONS }))
      .resolves.toEqual({ status: 'unavailable', reason: 'GEMINI_HTTP_500', attempts: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry HTTP 4xx and reports unavailable on transport failure', async () => {
    const forbidden = new OptionalDecisionsTriage({
      apiKey: 'test-key',
      fetchImpl: vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })),
    });
    await expect(forbidden.triage({ input: 'Evidence text.', questions: QUESTIONS }))
      .resolves.toEqual({ status: 'unavailable', reason: 'GEMINI_HTTP_403', attempts: 1 });

    const offline = new OptionalDecisionsTriage({
      apiKey: 'test-key',
      fetchImpl: async () => { throw new Error('offline'); },
    });
    await expect(offline.triage({ input: 'Evidence text.', questions: QUESTIONS }))
      .resolves.toEqual({ status: 'unavailable', reason: 'GEMINI_TRANSPORT', attempts: 2 });
  });

  it('reports invalid on malformed provider responses without retrying', async () => {
    const missingAnswers = new OptionalDecisionsTriage({
      apiKey: 'test-key',
      fetchImpl: vi.fn(async () => ({ ok: true, json: async () => ({ usage: {} }) })),
    });
    await expect(missingAnswers.triage({ input: 'Evidence text.', questions: QUESTIONS }))
      .resolves.toEqual({ status: 'invalid', reason: 'INVALID_GEMINI_RESPONSE', attempts: 1 });

    const unknownChoice = new OptionalDecisionsTriage({
      apiKey: 'test-key',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          answers: {
            states_price: { type: 'noul', noul: 0.5 },
            doc_status: { type: 'choice', choice: 'archived', probabilities: { archived: 1 } },
            risk_clarity: { type: 'score', score: 1, probabilities: { 0: 0.1, 1: 0.9 } },
          },
        }),
      }),
    });
    await expect(unknownChoice.triage({ input: 'Evidence text.', questions: QUESTIONS }))
      .resolves.toEqual({ status: 'invalid', reason: 'INVALID_GEMINI_RESPONSE', attempts: 1 });

    const notJson = new OptionalDecisionsTriage({
      apiKey: 'test-key',
      fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('not json'); } }),
    });
    await expect(notJson.triage({ input: 'Evidence text.', questions: QUESTIONS }))
      .resolves.toEqual({ status: 'invalid', reason: 'INVALID_GEMINI_RESPONSE', attempts: 1 });
  });

  it('validates the question set before any provider call', async () => {
    const fetchImpl = vi.fn(async () => validResponse());
    const triage = new OptionalDecisionsTriage({ apiKey: 'test-key', fetchImpl });

    await expect(triage.triage({ input: '', questions: QUESTIONS }))
      .resolves.toEqual({ status: 'invalid', reason: 'INVALID_TRIAGE_INPUT' });
    await expect(triage.triage({ input: 'Evidence text.', questions: {} }))
      .resolves.toEqual({ status: 'invalid', reason: 'INVALID_TRIAGE_QUESTIONS' });
    await expect(triage.triage({
      input: 'Evidence text.',
      questions: { bad: { type: 'ranking', instructions: 'Rank these.' } },
    })).resolves.toEqual({ status: 'invalid', reason: 'INVALID_TRIAGE_QUESTIONS' });
    await expect(triage.triage({
      input: 'Evidence text.',
      questions: { bad: { type: 'noul', instructions: 'Yes or no?', criteria: { yes: 'yes' } } },
    })).resolves.toEqual({ status: 'invalid', reason: 'INVALID_TRIAGE_QUESTIONS' });
    await expect(triage.triage({
      input: 'Evidence text.',
      questions: { bad: { type: 'choice', instructions: 'Pick one.' } },
    })).resolves.toEqual({ status: 'invalid', reason: 'INVALID_TRIAGE_QUESTIONS' });
    await expect(triage.triage({
      input: 'Evidence text.',
      questions: { bad: { type: 'score', instructions: 'Score it.', criteria: ['only one level'] } },
    })).resolves.toEqual({ status: 'invalid', reason: 'INVALID_TRIAGE_QUESTIONS' });

    const tooMany = Object.fromEntries(
      Array.from({ length: 1001 }, (_, index) => [`q${index}`, { type: 'noul', instructions: 'Question?' }]),
    );
    await expect(triage.triage({ input: 'Evidence text.', questions: tooMany }))
      .resolves.toEqual({ status: 'invalid', reason: 'INVALID_TRIAGE_QUESTIONS' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects endpoints outside the Gemini API host', async () => {
    expect(() => new OptionalDecisionsTriage({
      apiKey: 'test-key', endpoint: 'https://example.com/v1beta/decisions',
    })).toThrow(/generativelanguage\.googleapis\.com/);
    expect(() => new OptionalDecisionsTriage({
      apiKey: 'test-key', endpoint: 'http://generativelanguage.googleapis.com/v1beta/decisions',
    })).toThrow(/generativelanguage\.googleapis\.com/);
  });
});
