// src/app/game/storage.ts
/** Spec §13: a failed storage write keeps the game going in memory; the parent corner (Plan 1C) shows a quiet warning. */
export interface StorageHealth {
  failures: number;
  lastError: unknown;
}

export const createStorageHealth = (): StorageHealth => ({ failures: 0, lastError: null });

/**
 * How long the game waits on one storage call (spec §4.4: never blocking). Like speech, IndexedDB may settle late or
 * never: Safari has been seen to stall an open or a transaction, for example after the app resumes.
 */
export const STORAGE_WAIT_MS = 3000;

/** `p`, or a rejection once `ms` have passed without it settling; `p` goes on, and what it writes may still land. */
export function within<T>(p: Promise<T>, ms = STORAGE_WAIT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`storage gave no answer in ${ms} ms`)), ms);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

/** Runs one write; a failure, or no answer within STORAGE_WAIT_MS, is counted and logged instead of thrown. */
export async function guarded<T>(health: StorageHealth, write: () => Promise<T>): Promise<T | undefined> {
  try {
    return await within(write());
  } catch (e) {
    health.failures += 1;
    health.lastError = e;
    console.error('storage write failed', e);
    return undefined;
  }
}

/**
 * Writes run one after another, without holding the child up. Anything that reads history — the next set, Buddy's
 * suggestion — waits for idle() first, so it sees every round already played. A write that never answers holds the
 * next for STORAGE_WAIT_MS at most: records order by `at`, not by when they landed.
 */
export class WriteQueue {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly health: StorageHealth) {}

  add(write: () => Promise<unknown>): void {
    this.tail = this.tail.then(async () => {
      await guarded(this.health, write);
    });
  }

  idle(): Promise<void> {
    return this.tail;
  }
}
