import { resolve } from 'node:path';

/**
 * Creates the optional storage-backed Hermes ingestion route for the local Kernel.
 *
 * The route is disabled unless a boundary secret is provided. When enabled, it
 * composes the already-tested Kernel services and runs startup reconciliation
 * before the server accepts Hermes traffic.
 */
export async function createHermesLocalIngestionRoute(options = {}) {
  const secret = options.secret;
  if (!secret) return undefined;

  let kernel;
  try {
    kernel = await import('../../packages/kernel/dist/index.js');
  } catch (error) {
    throw new Error(
      `Hermes ingestion requires the Kernel package to be built first: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const dataRoot = resolve(options.dataDir ?? '.hephaestus', 'kernel');
  const now = options.now ?? (() => new Date());
  const maxPayloadBytes = Number(options.maxPayloadBytes ?? process.env.IBOS_HERMES_MAX_PAYLOAD_BYTES ?? 256 * 1024);
  const freshnessWindowMs = Number(options.freshnessWindowMs ?? process.env.IBOS_HERMES_FRESHNESS_WINDOW_MS ?? 5 * 60 * 1000);
  const leaseMs = Number(options.leaseMs ?? process.env.IBOS_HERMES_LEASE_MS ?? 2 * 60 * 1000);

  const records = new kernel.JsonCognitivePipelineRepository(dataRoot);
  const receipts = new kernel.JsonHermesIngestionReceiptRepository(dataRoot);
  const replayLabQuery = new kernel.ReplayLabQueryService({ records, receipts });
  const recovery = new kernel.HermesIngestionRecoveryCoordinator(
    receipts,
    records,
    (error) => error instanceof kernel.NotFoundError || error?.name === 'NotFoundError',
  );
  const startup = new kernel.HermesIngestionStartupReconciler(recovery, receipts);
  const reconciled = await startup.reconcileStartup(now().toISOString());

  const pipeline = new kernel.CognitivePipelineOrchestrator(records);
  const adapter = new kernel.HermesCognitiveAdapter(pipeline);
  const ingestion = new kernel.HermesExecutionIngestionService(adapter);
  const idempotent = new kernel.IdempotentHermesExecutionIngestionService(ingestion, receipts);
  const route = new kernel.HermesLocalIngestionHttpRoute(
    {
      async ingest(input, context) {
        const receivedAt = input.receivedAt ?? now().toISOString();
        return idempotent.ingest(
          {
            ...input,
            receivedAt,
            leaseExpiresAt: new Date(new Date(receivedAt).getTime() + leaseMs).toISOString(),
          },
          context,
        );
      },
    },
    {
      secret,
      maxPayloadBytes,
      freshnessWindowMs,
      now,
      loadExistingClaims: options.loadExistingClaims ?? (async () => []),
    },
  );

  return { route, replayLabQuery, reconciled };
}
