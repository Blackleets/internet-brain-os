import { KernelClient } from './client';
import type { IntegrationCatalog } from './contracts';
import { parseIntegrationCatalog } from './parse';

export function loadIntegrationCatalog(client: KernelClient, signal?: AbortSignal): Promise<IntegrationCatalog> {
  return client.get('/api/integrations', parseIntegrationCatalog, signal);
}
