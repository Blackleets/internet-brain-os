export const LOCAL_PRODUCT_COHORT_SCHEMA_VERSION = 'efesto.local-product-cohort.v1';

export class LocalProductCohortLedger {
  constructor(store, options = {}) {
    this.store = store;
    this.now = options.now ?? (() => new Date());
  }

  async ensure() {
    return this.store.project(async (data) => {
      const current = readLocalProductCohort(data.productCohort);
      if (current.status !== 'missing') {
        return { changed: false, data, result: current };
      }
      const startedAt = normalizeTimestamp(this.now());
      const cohort = {
        schemaVersion: LOCAL_PRODUCT_COHORT_SCHEMA_VERSION,
        unit: 'local_installation',
        startedAt,
      };
      return {
        changed: true,
        data: { ...data, productCohort: cohort },
        result: { status: 'valid', cohort },
      };
    });
  }
}

export function readLocalProductCohort(value) {
  if (value === undefined) return { status: 'missing' };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { status: 'invalid' };
  if (value.schemaVersion !== LOCAL_PRODUCT_COHORT_SCHEMA_VERSION || value.unit !== 'local_installation') return { status: 'invalid' };
  if (typeof value.startedAt !== 'string') return { status: 'invalid' };
  const startedAtMs = Date.parse(value.startedAt);
  if (!Number.isFinite(startedAtMs)) return { status: 'invalid' };
  return {
    status: 'valid',
    cohort: {
      schemaVersion: LOCAL_PRODUCT_COHORT_SCHEMA_VERSION,
      unit: 'local_installation',
      startedAt: new Date(startedAtMs).toISOString(),
    },
  };
}

function normalizeTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(timestamp.getTime())) throw new Error('Local product cohort start time is invalid');
  return timestamp.toISOString();
}
