import type { CapabilityDefinition } from '../capability/capability-contract';
import type { CapabilityExecutionAdapter } from './execution-contract';
import { InvalidExecutionInputError } from './execution-errors';

export const PUBLIC_WEB_READ_CAPABILITY: CapabilityDefinition = {
  id: 'web.read',
  version: '1',
  provider: 'public-web-reader',
  riskLevel: 'r0_observe',
  consentPolicy: 'none',
  allowedDataScopes: ['public_web'],
  credentialScopes: [],
  health: 'available',
  description: 'Read one validated public HTTP(S) page without authentication or writes',
};

export interface PublicWebDocument {
  readonly url: string;
  readonly title: string;
  readonly text: string;
  readonly fetchedAt: string;
  readonly contentType: string;
  readonly status: number;
}

export interface PublicWebReader {
  fetch(url: string): Promise<PublicWebDocument>;
}

export class PublicWebReadExecutionAdapter implements CapabilityExecutionAdapter {
  readonly capabilityId = PUBLIC_WEB_READ_CAPABILITY.id;

  constructor(private readonly reader: PublicWebReader) {}

  async execute(input: {
    readonly executionId: string;
    readonly idempotencyKey: string;
    readonly payload: Readonly<Record<string, unknown>>;
  }): Promise<Readonly<Record<string, unknown>>> {
    const url = readUrl(input.payload);
    const document = await this.reader.fetch(url);
    return {
      executionId: input.executionId,
      sourceUrl: document.url,
      title: document.title,
      text: document.text,
      fetchedAt: document.fetchedAt,
      contentType: document.contentType,
      status: document.status,
    };
  }
}

function readUrl(payload: Readonly<Record<string, unknown>>): string {
  const value = payload.url;
  if (typeof value !== 'string') throw new InvalidExecutionInputError('payload.url', 'payload.url must be a string');
  const normalized = value.trim();
  if (!normalized || normalized.length > 2048 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new InvalidExecutionInputError('payload.url', 'payload.url is invalid');
  }
  let parsed: URL;
  try { parsed = new URL(normalized); } catch { throw new InvalidExecutionInputError('payload.url', 'payload.url must be a valid URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new InvalidExecutionInputError('payload.url', 'payload.url must be public HTTP(S) without embedded credentials');
  }
  return parsed.toString();
}
