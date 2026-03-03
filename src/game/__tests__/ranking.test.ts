import { describe, expect, it } from 'vitest';
import { gradeForScore } from '../ranking';

describe('gradeForScore', () => {
  it('returns S for high scores', () => {
    expect(gradeForScore(4200)).toBe('S');
    expect(gradeForScore(9999)).toBe('S');
  });

  it('returns A/B/C for lower scores', () => {
    expect(gradeForScore(3000)).toBe('A');
    expect(gradeForScore(2500)).toBe('B');
    expect(gradeForScore(0)).toBe('C');
  });
});
