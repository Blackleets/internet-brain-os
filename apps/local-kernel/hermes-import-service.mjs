import { createHmac } from 'node:crypto';
import { scanHermesSensitiveData } from '../../scripts/hermes-sensitive-data-scan.mjs';

export class HermesImportError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = 'HermesImportError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class HermesReplayLabImportService {
  constructor({ kernel, route, secret, now = () => new Date() }) {
    this.kernel = kernel;
    this.route = route;
    this.secret = secret;
    this.now = now;
  }

  validate(input) {
    const format = input?.format;
    const content = input?.content;
    if (!['json', 'jsonl'].includes(format) || typeof content !== 'string' || content.length === 0) {
      throw new HermesImportError('INVALID_IMPORT_REQUEST', 'A non-empty JSON or JSONL capture is required.');
    }
    const findings = scanHermesSensitiveData(content);
    if (findings.length > 0) {
      throw new HermesImportError('SENSITIVE_DATA_DETECTED', 'Sanitize the capture before importing it.', 422,
        findings.map(({ code, line }) => ({ code, line })));
    }
    try {
      const runOutput = format === 'jsonl'
        ? new this.kernel.HermesNativeLogExtractor().fromJsonl(content)
        : JSON.parse(content);
      const events = new this.kernel.HermesAgentOutputAdapter().toExecutionEvents(runOutput);
      const idempotencyKey = input.idempotencyKey ?? runOutput.idempotencyKey ?? `hermes-agent-${runOutput.runId}`;
      if (!runOutput.runId || typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
        throw new Error('The capture must include a stable runId.');
      }
      return {
        runOutput,
        events,
        idempotencyKey,
        recordId: `pipeline-${idempotencyKey}`,
        resultId: `result-${idempotencyKey}`,
      };
    } catch (error) {
      if (error instanceof HermesImportError) throw error;
      throw new HermesImportError('INVALID_HERMES_CAPTURE', error instanceof Error ? error.message : 'Invalid Hermes capture.');
    }
  }

  async ingest(input) {
    const validated = this.validate(input);
    const body = JSON.stringify({
      idempotencyKey: validated.idempotencyKey,
      recordId: validated.recordId,
      resultId: validated.resultId,
      events: validated.events,
      comparisons: Array.isArray(validated.runOutput.comparisons) ? validated.runOutput.comparisons : [],
    });
    const timestamp = this.now().toISOString();
    const signature = createHmac('sha256', this.secret)
      .update(`${timestamp}.${validated.idempotencyKey}.${body}`)
      .digest('hex');
    const result = await this.route.handle({
      method: 'POST', url: '/hermes/ingestions', remoteAddress: '127.0.0.1', rawBody: body,
      headers: {
        'content-type': 'application/json',
        'x-ibos-idempotency-key': validated.idempotencyKey,
        'x-ibos-timestamp': timestamp,
        'x-ibos-signature': signature,
      },
    });
    if (result.status < 200 || result.status >= 300) {
      throw new HermesImportError(result.body?.code ?? 'HERMES_INGESTION_FAILED', 'Hermes ingestion was rejected.', result.status);
    }
    return result.body;
  }
}
