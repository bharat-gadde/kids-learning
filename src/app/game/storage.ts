// src/app/game/storage.ts
/** Spec §13: a failed storage write keeps the game going in memory; the parent corner (Plan 1C) shows a quiet warning. */
export interface StorageHealth {
  failures: number;
  lastError: unknown;
}

export const createStorageHealth = (): StorageHealth => ({ failures: 0, lastError: null });

/** Runs one write; a failure is counted and logged instead of thrown. */
export async function guarded<T>(health: StorageHealth, write: () => Promise<T>): Promise<T | undefined> {
  try {
    return await write();
  } catch (e) {
    health.failures += 1;
    health.lastError = e;
    console.error('storage write failed', e);
    return undefined;
  }
}

/**
 * Writes run one after another, without holding the child up. Anything that reads history — the next set, Buddy's
 * suggestion — waits for idle() first, so it sees every round already played.
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
