export const SUMMARY_PROMPT_VERSION = '1.0.0';

export class OptionalEvidenceSummarizer {
  constructor(store, options = {}) {
    this.store = store;
    this.model = options.model?.trim() || undefined;
    this.baseUrl = normalizeLoopbackUrl(options.baseUrl ?? 'http://127.0.0.1:11434');
    this.timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : 20_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  isConfigured() {
    return Boolean(this.model);
  }

  async summarize(evidenceId) {
    if (!this.model) return { status: 'skipped', reason: 'OLLAMA_MODEL_NOT_CONFIGURED' };
    const data = await this.store.read();
    const evidence = data.evidence.find((item) => item.id === evidenceId);
    if (!evidence?.rawText?.trim()) return { status: 'skipped', reason: 'NO_EVIDENCE_TEXT' };
    if (evidence.aiSummary?.model === this.model && evidence.aiSummary?.promptVersion === SUMMARY_PROMPT_VERSION) {
      return { status: 'completed', duplicate: true, model: this.model };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages: [
            {
              role: 'system',
              content: 'Summarize public Evidence conservatively. Return JSON only with summary, hypotheses, and limitations. Hypotheses must be explicitly uncertain and cannot introduce unsupported facts.',
            },
            { role: 'user', content: buildPrompt(evidence) },
          ],
          options: { temperature: 0.1, num_predict: 700 },
        }),
      });
      if (!response.ok) return { status: 'unavailable', reason: `OLLAMA_HTTP_${response.status}` };
      const payload = await response.json();
      if (typeof payload?.message?.content !== 'string') return { status: 'invalid', reason: 'INVALID_OLLAMA_RESPONSE' };
      const summary = parseSummary(payload.message.content);
      if (!summary) return { status: 'invalid', reason: 'INVALID_SUMMARY_OUTPUT' };
      const actualModel = typeof payload.model === 'string' ? payload.model : this.model;
      const generated = {
        ...summary,
        model: actualModel,
        provider: 'ollama',
        skillId: 'skill:evidence-summarization',
        skillVersion: '1.0.0',
        promptVersion: SUMMARY_PROMPT_VERSION,
        generatedAt: this.now(),
      };
      await this.store.project(async (current) => {
        const index = current.evidence.findIndex((item) => item.id === evidenceId);
        if (index < 0) return { changed: false, data: current, result: undefined };
        const evidenceRecords = [...current.evidence];
        evidenceRecords[index] = { ...evidenceRecords[index], aiSummary: generated };
        return { changed: true, data: { ...current, evidence: evidenceRecords }, result: undefined };
      });
      return { status: 'completed', duplicate: false, model: actualModel };
    } catch (error) {
      return {
        status: 'unavailable',
        reason: controller.signal.aborted ? 'OLLAMA_TIMEOUT' : 'OLLAMA_TRANSPORT',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function buildPrompt(evidence) {
  return [
    `Evidence ID: ${evidence.id}`,
    evidence.sourceUrl ? `Source URL: ${evidence.sourceUrl}` : 'Source URL: unavailable',
    `Captured at: ${evidence.capturedAt}`,
    `Confidence: ${evidence.confidence}`,
    '',
    'Evidence text:',
    evidence.rawText.slice(0, 20_000),
    '',
    'Return exactly: {"summary":"...","hypotheses":["..."],"limitations":["..."]}',
  ].join('\n');
}

function parseSummary(content) {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed.summary !== 'string' || !parsed.summary.trim() || parsed.summary.length > 2_000) return undefined;
    const hypotheses = cleanArray(parsed.hypotheses);
    const limitations = cleanArray(parsed.limitations);
    if (!hypotheses || !limitations) return undefined;
    return { summary: parsed.summary.trim(), hypotheses, limitations };
  } catch {
    return undefined;
  }
}

function cleanArray(value) {
  if (!Array.isArray(value) || value.length > 10 || !value.every((item) => typeof item === 'string' && item.length <= 500)) return undefined;
  return value.map((item) => item.trim()).filter(Boolean);
}

function normalizeLoopbackUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Ollama URL must use HTTP on a loopback host');
  }
  return url.href.replace(/\/$/, '');
}
