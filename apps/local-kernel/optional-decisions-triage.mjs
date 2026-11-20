export const DECISIONS_TRIAGE_VERSION = '1.0.0';
export const DEFAULT_GEMINI_DECISIONS_MODEL = 'models/gemini-decision-1';
export const GEMINI_DECISIONS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/decisions';
export const MAX_DECISIONS_QUESTIONS = 1_000;

const QUESTION_TYPES = new Set(['noul', 'choice', 'score']);
const MAX_INPUT_CHARS = 200_000;
const MAX_INSTRUCTIONS_CHARS = 4_000;
const MAX_CRITERIA_LABEL_CHARS = 1_000;
const MAX_CHOICE_CRITERIA = 100;
const MAX_SCORE_CRITERIA = 101;

// Optional, env-gated advisory triage over the Google Gemini Decisions API.
//
// This adapter is a first-pass screening aid only. Its output is model
// advisory with recorded provenance: it is never Evidence, never a Claim,
// and never a Kernel verdict. When no API key is configured the adapter is
// inert and every call returns a bounded `skipped` result without any
// network traffic, so the deterministic Kernel paths behave exactly as
// they did before this adapter existed.
export class OptionalDecisionsTriage {
  constructor(options = {}) {
    this.apiKey = typeof options.apiKey === 'string' && options.apiKey.trim()
      ? options.apiKey.trim()
      : undefined;
    this.model = typeof options.model === 'string' && options.model.trim()
      ? options.model.trim()
      : DEFAULT_GEMINI_DECISIONS_MODEL;
    this.endpoint = normalizeDecisionsEndpoint(options.endpoint ?? GEMINI_DECISIONS_ENDPOINT);
    this.timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : 60_000;
    // Retries are bounded by design: at most one retry, only for transport
    // failures, timeouts, and HTTP 5xx responses.
    this.maxRetries = Number.isFinite(options.maxRetries)
      ? Math.min(1, Math.max(0, Math.trunc(options.maxRetries)))
      : 1;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async triage(request) {
    if (!this.apiKey) return { status: 'skipped', reason: 'GEMINI_API_KEY_NOT_CONFIGURED' };
    const input = validateInput(request?.input);
    if (!input) return { status: 'invalid', reason: 'INVALID_TRIAGE_INPUT' };
    const questions = validateQuestions(request?.questions);
    if (!questions) return { status: 'invalid', reason: 'INVALID_TRIAGE_QUESTIONS' };

    const payload = { input, model: this.model, questions: requestBody(questions) };
    const maxAttempts = 1 + this.maxRetries;
    let attempts = 0;
    let lastFailure;
    while (attempts < maxAttempts) {
      attempts += 1;
      const outcome = await this.attempt(payload);
      if (outcome.kind === 'invalid') {
        return { status: 'invalid', reason: outcome.reason, attempts };
      }
      if (outcome.kind === 'response') {
        const answers = parseAnswers(outcome.payload, questions);
        if (!answers) return { status: 'invalid', reason: 'INVALID_GEMINI_RESPONSE', attempts };
        return {
          status: 'ok',
          attempts,
          answers,
          provenance: {
            provider: 'google-gemini-decisions',
            model: this.model,
            advisory: true,
            triageVersion: DECISIONS_TRIAGE_VERSION,
            generatedAt: this.now(),
          },
        };
      }
      lastFailure = outcome;
      if (!outcome.retryable || attempts >= maxAttempts) break;
    }
    return { status: 'unavailable', reason: lastFailure.reason, attempts };
  }

  async attempt(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        return {
          kind: 'failure',
          reason: `GEMINI_HTTP_${response.status}`,
          retryable: response.status >= 500 && response.status <= 599,
        };
      }
      let parsed;
      try {
        parsed = await response.json();
      } catch {
        return { kind: 'invalid', reason: 'INVALID_GEMINI_RESPONSE' };
      }
      return { kind: 'response', payload: parsed };
    } catch {
      return {
        kind: 'failure',
        reason: controller.signal.aborted ? 'GEMINI_TIMEOUT' : 'GEMINI_TRANSPORT',
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function validateInput(input) {
  if (typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!trimmed || input.length > MAX_INPUT_CHARS) return undefined;
  return input;
}

function validateQuestions(questions) {
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) return undefined;
  const entries = Object.entries(questions);
  if (entries.length === 0 || entries.length > MAX_DECISIONS_QUESTIONS) return undefined;
  const validated = new Map();
  for (const [id, question] of entries) {
    if (!id || id.length > 200) return undefined;
    if (!question || typeof question !== 'object' || Array.isArray(question)) return undefined;
    if (!QUESTION_TYPES.has(question.type)) return undefined;
    if (typeof question.instructions !== 'string'
      || !question.instructions.trim()
      || question.instructions.length > MAX_INSTRUCTIONS_CHARS) return undefined;
    if (question.type === 'noul') {
      if (question.criteria !== undefined) return undefined;
      validated.set(id, { type: 'noul', instructions: question.instructions });
    } else if (question.type === 'choice') {
      const criteria = validateChoiceCriteria(question.criteria);
      if (!criteria) return undefined;
      validated.set(id, { type: 'choice', instructions: question.instructions, criteria });
    } else {
      const criteria = validateScoreCriteria(question.criteria);
      if (!criteria) return undefined;
      validated.set(id, { type: 'score', instructions: question.instructions, criteria });
    }
  }
  return validated;
}

function validateChoiceCriteria(criteria) {
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) return undefined;
  const entries = Object.entries(criteria);
  if (entries.length < 2 || entries.length > MAX_CHOICE_CRITERIA) return undefined;
  for (const [key, label] of entries) {
    if (!key || key.length > 200) return undefined;
    if (typeof label !== 'string' || !label.trim() || label.length > MAX_CRITERIA_LABEL_CHARS) return undefined;
  }
  return criteria;
}

function validateScoreCriteria(criteria) {
  if (!Array.isArray(criteria)) return undefined;
  if (criteria.length < 2 || criteria.length > MAX_SCORE_CRITERIA) return undefined;
  for (const label of criteria) {
    if (typeof label !== 'string' || !label.trim() || label.length > MAX_CRITERIA_LABEL_CHARS) return undefined;
  }
  return criteria;
}

function requestBody(questions) {
  const body = {};
  for (const [id, question] of questions) {
    const entry = { type: question.type, instructions: question.instructions };
    if (question.type !== 'noul') entry.criteria = question.criteria;
    body[id] = entry;
  }
  return body;
}

function parseAnswers(payload, questions) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  const rawAnswers = payload.answers;
  if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) return undefined;
  const answers = {};
  for (const [id, question] of questions) {
    const raw = rawAnswers[id];
    const parsed = parseAnswer(raw, question);
    if (!parsed) return undefined;
    answers[id] = parsed;
  }
  return answers;
}

function parseAnswer(raw, question) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  if (raw.type !== undefined && raw.type !== question.type) return undefined;
  const confidence = parseProbability(raw.confidence);
  if (raw.confidence !== undefined && confidence === undefined) return undefined;
  const suffix = confidence === undefined ? {} : { confidence };
  if (question.type === 'noul') {
    const probability = parseProbability(raw.noul);
    if (probability === undefined) return undefined;
    return { type: 'noul', probability, ...suffix };
  }
  if (question.type === 'choice') {
    if (typeof raw.choice !== 'string'
      || !Object.prototype.hasOwnProperty.call(question.criteria, raw.choice)) return undefined;
    const probabilities = parseProbabilities(raw.probabilities, Object.keys(question.criteria));
    if (!probabilities) return undefined;
    return { type: 'choice', choice: raw.choice, probabilities, ...suffix };
  }
  if (typeof raw.score !== 'number' || !Number.isFinite(raw.score)) return undefined;
  if (raw.score < 0 || raw.score > question.criteria.length - 1) return undefined;
  const probabilities = parseProbabilities(
    raw.probabilities,
    question.criteria.map((_, index) => String(index)),
  );
  if (!probabilities) return undefined;
  return { type: 'score', score: raw.score, probabilities, ...suffix };
}

function parseProbabilities(probabilities, allowedKeys) {
  if (!probabilities || typeof probabilities !== 'object' || Array.isArray(probabilities)) return undefined;
  const allowed = new Set(allowedKeys);
  const parsed = {};
  for (const [key, value] of Object.entries(probabilities)) {
    if (!allowed.has(key)) return undefined;
    const probability = parseProbability(value);
    if (probability === undefined) return undefined;
    parsed[key] = probability;
  }
  return parsed;
}

function parseProbability(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 0 || value > 1) return undefined;
  return value;
}

function normalizeDecisionsEndpoint(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'generativelanguage.googleapis.com') {
    throw new Error('Gemini Decisions endpoint must use HTTPS on generativelanguage.googleapis.com');
  }
  return url.href.replace(/\/$/, '');
}
