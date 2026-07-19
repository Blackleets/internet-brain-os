import { describe, expect, it } from 'vitest';
import type { Confidence, Evidence, EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import { MockLLMAdapter } from '@internet-brain-os/kernel';
import {
  EvidenceSummarizationInputError,
  EvidenceSummarizationOutputError,
  EvidenceSummarizationSkill,
} from '../src/evidence-summarization-skill';

const evidence: Evidence = {
  id: 'evidence:test' as EvidenceId,
  sourceUrl: 'https://example.com/source',
  contentType: 'webpage',
  rawText: 'Acme lists a wholesale price of 10 EUR and a minimum order quantity of 100 units.',
  capturedAt: '2026-07-19T10:00:00.000Z' as IsoDateTime,
  confidence: 0.8 as Confidence,
  tags: [],
  entityIds: [],
  relationshipIds: [],
};

describe('EvidenceSummarizationSkill', () => {
  it('preserves provenance and model metadata', async () => {
    const adapter = new MockLLMAdapter({
      model: 'mock-summary',
      now: () => '2026-07-19T11:00:00.000Z' as IsoDateTime,
      content: JSON.stringify({
        summary: 'Acme advertises a 10 EUR wholesale price with a 100-unit MOQ.',
        hypotheses: ['The offer may be relevant for bulk purchasing.'],
        limitations: ['The source has not been independently verified.'],
      }),
    });

    const result = await new EvidenceSummarizationSkill(adapter).run(evidence);

    expect(result.evidenceId).toBe(evidence.id);
    expect(result.model).toBe('mock-summary');
    expect(result.generatedAt).toBe('2026-07-19T11:00:00.000Z');
    expect(result.summary).toContain('100-unit MOQ');
    expect(result.hypotheses).toEqual(['The offer may be relevant for bulk purchasing.']);
    expect(result.limitations).toEqual(['The source has not been independently verified.']);
  });

  it('rejects evidence without usable text', async () => {
    const emptyEvidence: Evidence = { ...evidence, rawText: undefined, summary: undefined };
    await expect(new EvidenceSummarizationSkill(new MockLLMAdapter()).run(emptyEvidence)).rejects.toBeInstanceOf(
      EvidenceSummarizationInputError,
    );
  });

  it('rejects malformed model output', async () => {
    const adapter = new MockLLMAdapter({ content: 'not-json' });
    await expect(new EvidenceSummarizationSkill(adapter).run(evidence)).rejects.toBeInstanceOf(
      EvidenceSummarizationOutputError,
    );
  });
});
