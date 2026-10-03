import { it } from "node:test";
import { DEFAULT_SELECTION } from "../ai/catalog.ts";
import { useAI } from "../ai/store.ts";
import { useKernel } from "./store.ts";

/**
 * Process-wide lock around the Kernel/AI singletons.
 * Node isolates *files* by default, but tests inside a file run concurrent
 * and `--experimental-test-isolation=none` puts every file in one process.
 */
let locked = false;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (!locked) {
    locked = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiters.push(resolve);
  });
}

function release() {
  const next = waiters.shift();
  if (next) next();
  else locked = false;
}

export function resetKernelAndAI() {
  useKernel.getState().clearKernel();
  useAI.setState({
    provider: DEFAULT_SELECTION.provider,
    model: DEFAULT_SELECTION.model,
    keys: {},
    fallbacks: [{ provider: "openrouter", model: "anthropic/claude-sonnet-4" }],
    catalogs: {},
    connection: {},
    envAvail: {},
  });
}

export async function withIsolatedKernel<T>(fn: () => T | Promise<T>): Promise<T> {
  await acquire();
  try {
    resetKernelAndAI();
    return await fn();
  } finally {
    resetKernelAndAI();
    release();
  }
}

export function itIsolated(name: string, fn: () => Promise<void> | void) {
  it(name, async () => {
    await withIsolatedKernel(fn);
  });
}
