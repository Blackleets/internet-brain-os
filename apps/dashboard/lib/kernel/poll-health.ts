import type { OverviewSnapshot } from './overview';

/** Consecutive failed polls before the dashboard stops claiming the Kernel is online. */
export const KERNEL_UNREACHABLE_AFTER_FAILURES = 2;

/**
 * Keeps the last verified Kernel records visible but marks the Kernel itself offline, so
 * readiness chrome cannot keep saying "online" while the Kernel is stopped or restarting.
 */
export function markKernelUnreachable(snapshot: OverviewSnapshot | undefined): OverviewSnapshot | undefined {
  if (!snapshot || snapshot.readiness.kernel === 'offline') return snapshot;
  return { ...snapshot, readiness: { ...snapshot.readiness, kernel: 'offline' } };
}
