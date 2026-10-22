import { describe, expect, it } from 'vitest';
import { resolveFitVerdict, TIGHT_FIT_RATIO } from './domain';

describe('resolveFitVerdict', () => {
  const hostBudget = 1000;

  it('returns nofit when the model does not fit', () => {
    expect(resolveFitVerdict({ fits: false, est_total_bytes: 100 }, hostBudget)).toBe('nofit');
  });

  it('returns tight when the model uses more than 90% of the budget', () => {
    expect(resolveFitVerdict({ fits: true, est_total_bytes: 950 }, hostBudget)).toBe('tight');
  });

  it('returns fits when the model uses 90% or less of the budget', () => {
    expect(
      resolveFitVerdict({ fits: true, est_total_bytes: hostBudget * TIGHT_FIT_RATIO }, hostBudget)
    ).toBe('fits');
    expect(resolveFitVerdict({ fits: true, est_total_bytes: 500 }, hostBudget)).toBe('fits');
  });
});
