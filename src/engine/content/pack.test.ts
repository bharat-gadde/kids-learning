// src/engine/content/pack.test.ts
import { describe, it, expect } from 'vitest';
import { readPack } from './readPackFromDisk';
import { validatePack } from './validate';

describe('the M1 content pack', () => {
  it('loads, validates with no errors, and covers the M1 topics', () => {
    const pack = readPack();
    const issues = validatePack(pack);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect([...pack.topics.keys()].sort()).toEqual([
      'big-small', 'capital-small', 'counting', 'cvc', 'feelings', 'good-habits', 'healthy-food', 'kind-fair', 'letters', 'rhyming',
    ]);
    expect(pack.templates.size).toBe(15);
  });
});
