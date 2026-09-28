type VisibilityDocument = {
  visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
};

/**
 * Poll the local Kernel only while the dashboard is visible, one request wave at a time.
 * A bare setInterval kept ~10 Kernel requests (incl. /bootstrap/status probes) firing every
 * interval in hidden tabs and stacked overlapping waves whenever the Kernel was slow.
 * Returning to the tab refreshes immediately. Returns a stop function.
 */
export function startVisiblePoller(run: () => Promise<void>, intervalMs: number, doc: VisibilityDocument): () => void {
  let inFlight = false;
  let stopped = false;
  const tick = () => {
    if (stopped || inFlight || doc.visibilityState !== 'visible') return;
    inFlight = true;
    void Promise.resolve()
      .then(run)
      .catch(() => undefined)
      .finally(() => { inFlight = false; });
  };
  const onVisibility = () => { if (doc.visibilityState === 'visible') tick(); };
  const timer = setInterval(tick, intervalMs);
  doc.addEventListener('visibilitychange', onVisibility);
  return () => {
    stopped = true;
    clearInterval(timer);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}
