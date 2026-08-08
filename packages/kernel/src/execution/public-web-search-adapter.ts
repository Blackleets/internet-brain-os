import type { CapabilityDefinition } from '../capability/capability-contract';
import type { CapabilityExecutionAdapter } from './execution-contract';
import { InvalidExecutionInputError } from './execution-errors';

export const PUBLIC_WEB_SEARCH_CAPABILITY: CapabilityDefinition = {
  id: 'web.search',
  version: '1',
  provider: 'public-web-search',
  riskLevel: 'r0_observe',
  consentPolicy: 'none',
  allowedDataScopes: ['public_web'],
  credentialScopes: [],
  health: 'available',
  description: 'Search the public web without authentication or writes and return bounded discovery results',
};

export interface PublicWebSearchResult {
  readonly rank: number;
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly sourceHost: string;
}

export interface PublicWebSearchResponse {
  readonly query: string;
  readonly searchedAt: string;
  readonly provider: string;
  readonly results: readonly PublicWebSearchResult[];
}

export interface PublicWebSearcher {
  search(query: string, limit?: number): Promise<PublicWebSearchResponse>;
}

export class PublicWebSearchExecutionAdapter implements CapabilityExecutionAdapter {
  readonly capabilityId = PUBLIC_WEB_SEARCH_CAPABILITY.id;

  constructor(private readonly searcher: PublicWebSearcher) {}

  async execute(input: {
    readonly executionId: string;
    readonly idempotencyKey: string;
    readonly payload: Readonly<Record<string, unknown>>;
  }): Promise<Readonly<Record<string, unknown>>> {
    const query = readQuery(input.payload);
    const limit = readLimit(input.payload);
    const response = await this.searcher.search(query, limit);
    return {
      executionId: input.executionId,
      query: response.query,
      searchedAt: response.searchedAt,
      provider: response.provider,
      results: response.results.map((result) => ({ ...result })),
    };
  }
}

function readQuery(payload: Readonly<Record<string, unknown>>): string {
  const value = payload.query;
  if (typeof value !== 'string') throw new InvalidExecutionInputError('payload.query', 'payload.query must be a string');
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 300 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new InvalidExecutionInputError('payload.query', 'payload.query is invalid');
  }
  return normalized;
}

function readLimit(payload: Readonly<Record<string, unknown>>): number | undefined {
  if (payload.limit === undefined) return undefined;
  const value = Number(payload.limit);
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new InvalidExecutionInputError('payload.limit', 'payload.limit must be an integer between 1 and 20');
  }
  return value;
}
