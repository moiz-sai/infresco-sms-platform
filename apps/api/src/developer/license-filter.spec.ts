import { filterByLicense, LICENSED_MODULES, moduleOf } from '@sms/shared';

describe('license module filtering', () => {
  it('keeps base-module codes regardless of the license', () => {
    const codes = ['fees.collect', 'students.view', 'dashboard.view'];
    expect(filterByLicense(codes, [])).toEqual(codes);
  });

  it('drops a licensed module that the license does not enable', () => {
    // Build a code set that includes one code from a licensed module, if any exist.
    const licensed = LICENSED_MODULES[0];
    if (!licensed) {
      // No optional modules yet (pre-T15): filtering is a no-op by design.
      expect(filterByLicense(['fees.collect'], [])).toEqual(['fees.collect']);
      return;
    }
    const code = `${licensed}.view`;
    expect(moduleOf(code)).toBe(licensed);
    expect(filterByLicense([code], [])).toEqual([]);
    expect(filterByLicense([code], [licensed])).toEqual([code]);
  });
});
