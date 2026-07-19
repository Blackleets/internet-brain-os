import type { Evidence, EvidenceId, IsoDateTime, RequestId, SkillDefinition, SkillId } from '@internet-brain-os/shared';
import type { LLMAdapter } from '@internet-brain-os/kernel';

export const EVIDENCE_SUMMARIZATION_PROMPT_VERSION = '1.0.0';

export const evidenceSummarizationSkillDefinition: SkillDefinition = {
  id: 'skill:evidence-summarization' as SkillId,
  name: 'Evidence Summarization',
  description: 'Produces a conservative summary and clearly labeled hypotheses from one Evidence item.',
  version: '1.0.0',
  tags: ['evidence', 'summarization', 'local-first'],
  inputSchemaVersion: '1.0.0',
  outputSchemaVersion: '1.0.0',
};

export interface EvidenceSummarizationResult {
  readonly skillId: SkillId;
  readonly skillVersion: string;
  readonly promptVersion: string;
  readonly evidenceId: EvidenceId;
  readonly summary: string;
  readonly hypotheses: readonly string[];
  readonly limitations: readonly string[];
  readonly model: string;
  readonly generatedAt: IsoDateTime;
}

export class EvidenceSummarizationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvidenceSummarizationInputError';
  }
}

export class EvidenceSummarizationOutputError extends Error {
  constructor() {
    super('Evidence summarization model returned invalid structured output');
    this.name = 'EvidenceSummarizationOutputError';
  }
}

export class EvidenceSummarizationSkill {
  readonly definition = evidenceSummarizationSkillDefinition;

  constructor(private readonly adapter: LLMAdapter) {}

  async run(evidence: Evidence): Promise<EvidenceSummarizationResult> {
    const source = evidence.rawText?.trim() || evidence.summary?.trim();
    if (!source) {
      throw new EvidenceSummarizationInputError(`Evidence ${evidence.id} has no usable text`);
    }

    const response = await this.adapter.complete({
      requestId: `request:evidence-summary:${evidence.id}` as RequestId,
      messages: [
        {
          role: 'system',
          content: 'You summarize public evidence conservatively. Return JSON only with summary, hypotheses, and limitations. Hypotheses must remain explicitly uncertain and must not introduce unsupported facts.',
        },
        {
          role: 'user',
          content: buildPrompt(evidence, source),
        },
      ],
      temperature: 0.1,
      maxOutputTokens: 700,
      metadata: {
        skillId: this.definition.id,
        skillVersion: this.definition.version,
        promptVersion: EVIDENCE_SUMMARIZATION_PROMPT_VERSION,
        evidenceId: evidence.id,
      },
    });

    const parsed = parseOutput(response.content);
    return {
      skillId: this.definition.id,
      skillVersion: this.definition.version,
      promptVersion: EVIDENCE_SUMMARIZATION_PROMPT_VERSION,
      evidenceId: evidence.id,
      summary: parsed.summary,
      hypotheses: parsed.hypotheses,
      limitations: parsed.limitations,
      model: response.model,
      generatedAt: response.timestamp,
    };
  }
}

function buildPrompt(evidence: Evidence, source: string): string {
  return [
    `Evidence ID: ${evidence.id}`,
    evidence.sourceUrl ? `Source URL: ${evidence.sourceUrl}` : 'Source URL: unavailable',
    `Captured at: ${evidence.capturedAt}`,
    `Confidence: ${evidence.confidence}`,
    '',
    'Evidence text:',
    source.slice(0, 20_000),
    '',
    'Return exactly this JSON shape:',
    '{"summary":"...","hypotheses":["..."],"limitations":["..."]}',
  ].join('\n');
}

function parseOutput(content: string): { summary: string; hypotheses: readonly string[]; limitations: readonly string[] } {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) throw new Error('invalid summary');
    if (!isStringArray(parsed.hypotheses) || !isStringArray(parsed.limitations)) throw new Error('invalid arrays');
    return {
      summary: parsed.summary.trim(),
      hypotheses: parsed.hypotheses.map((item) => item.trim()).filter(Boolean),
      limitations: parsed.limitations.map((item) => item.trim()).filter(Boolean),
    };
  } catch {
    throw new EvidenceSummarizationOutputError();
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
