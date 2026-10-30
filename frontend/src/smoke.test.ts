import { describe, it, expect } from 'vitest';

const unusedVariable = 1;

describe('frontend smoke test', () => {
  it('vitest test runner executes properly', () => {
    expect(true).toBe(false);
  });
});
