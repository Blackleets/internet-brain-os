import type { OpportunitySummary } from './contracts';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isKernelSupportedFind(item: OpportunitySummary): boolean {
  const title = text(item.title);
  const evidenceId = text(item.evidenceId);
  const sourceUrl = text(item.sourceUrl);
  if (!title || !evidenceId || !sourceUrl || item.status === 'dismissed') return false;
  try {
    const parsed = new URL(sourceUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function kernelSupportedFinds(items: readonly OpportunitySummary[] | undefined): OpportunitySummary[] {
  return (items ?? []).filter(isKernelSupportedFind);
}
