/**
 * The growth suite (PRODUCT.md 4b, CLAUDE.md 6b). MANDATORY: no growth code
 * ships without this green.
 *
 * Two kinds of test here, and both are needed:
 *
 *  1. MATHS -- properties the LMS model must satisfy regardless of any table
 *     (z=0 is the median, the transform round-trips, the normal CDF hits its
 *     textbook values). These would catch an algebra slip.
 *
 *  2. PUBLISHED VALUES -- the -3SD..+3SD columns WHO prints in its own z-score
 *     tables, reproduced here and checked against what our pipeline computes
 *     from WHO's LMS parameters. These catch the far more likely failure: a
 *     correctly implemented formula fed a mis-parsed, mis-scaled or
 *     mis-sexed table. The maths being right is not the same as the ANSWER
 *     being right, and it is the answer that gets written on a child's chart.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadGrowthTables } from '@data/growth/index.ts';
import type { GrowthTables } from '@domain/growth/index.ts';
import { compute, curve, selectChart, ageDaysBetween } from '@domain/growth/index.ts';
import {
  adjustTails,
  bmi,
  lmsAt,
  normalCdf,
  percentileFromZ,
  rawZScore,
  sdBand,
  valueAtZ,
} from '@domain/growth/lms.ts';

let growthTables: GrowthTables;

beforeAll(async () => {
  growthTables = await loadGrowthTables();
});

describe('normal distribution', () => {
  it('matches textbook values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 12);
    expect(normalCdf(1)).toBeCloseTo(0.8413447460685429, 10);
    expect(normalCdf(-1)).toBeCloseTo(0.15865525393145707, 10);
    expect(normalCdf(1.959963985)).toBeCloseTo(0.975, 9);
    expect(normalCdf(2)).toBeCloseTo(0.9772498680518208, 10);
    expect(normalCdf(-3)).toBeCloseTo(0.0013498980316301, 10);
  });

  it('is symmetric', () => {
    for (const z of [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 12);
    }
  });

  it('percentileFromZ is on a 0-100 scale', () => {
    expect(percentileFromZ(0)).toBeCloseTo(50, 10);
    expect(percentileFromZ(-2)).toBeCloseTo(2.275, 3);
  });
});

describe('LMS maths', () => {
  const skewed = { l: 0.3487, m: 3.3464, s: 0.14602 };
  const logNormal = { l: 0, m: 10, s: 0.12 };

  it('z = 0 is exactly the median', () => {
    expect(valueAtZ(skewed, 0)).toBeCloseTo(skewed.m, 12);
    expect(rawZScore(skewed, skewed.m)).toBeCloseTo(0, 12);
    expect(valueAtZ(logNormal, 0)).toBeCloseTo(logNormal.m, 12);
  });

  it('round-trips value <-> z for skewed and log-normal distributions', () => {
    for (const lms of [skewed, logNormal, { l: -0.2942, m: 11.47, s: 0.1239 }]) {
      for (const z of [-2.5, -1, 0, 0.7, 2, 3]) {
        expect(rawZScore(lms, valueAtZ(lms, z))).toBeCloseTo(z, 9);
      }
    }
  });

  it('rejects impossible inputs instead of returning a number', () => {
    expect(Number.isNaN(rawZScore(skewed, 0))).toBe(true);
    expect(Number.isNaN(rawZScore(skewed, -1))).toBe(true);
    expect(Number.isNaN(bmi(0, 100))).toBe(true);
  });

  it('computes BMI', () => {
    expect(bmi(16, 100)).toBeCloseTo(16, 10);
    expect(bmi(70, 175)).toBeCloseTo(22.857, 3);
  });

  describe('WHO tail adjustment beyond +/-3 SD', () => {
    // Below -3 SD, WHO replaces the LMS tail with a linear extrapolation whose
    // step is the width of the (-3, -2) SD interval.
    it('is the published linear extrapolation, not the raw LMS tail', () => {
      const sd3 = valueAtZ(skewed, -3);
      const sd2 = valueAtZ(skewed, -2);
      const value = sd3 - (sd2 - sd3) / 2; // exactly half an interval below -3SD
      const raw = rawZScore(skewed, value);
      const adjusted = adjustTails(skewed, value, raw);
      expect(adjusted).toBeCloseTo(-3.5, 10);
      expect(adjusted).not.toBeCloseTo(raw, 3);
    });

    it('is the identity inside +/-3 SD', () => {
      for (const z of [-3, -1, 0, 2.9, 3]) {
        const value = valueAtZ(skewed, z);
        expect(adjustTails(skewed, value, z)).toBeCloseTo(z, 12);
      }
    });

    it('extrapolates the upper tail the same way', () => {
      const sd3 = valueAtZ(skewed, 3);
      const sd2 = valueAtZ(skewed, 2);
      const value = sd3 + (sd3 - sd2);
      expect(adjustTails(skewed, value, rawZScore(skewed, value))).toBeCloseTo(4, 10);
    });
  });

  it('never extrapolates off the end of a table', () => {
    const rows = [
      [0, 1, 10, 0.1],
      [10, 1, 12, 0.1],
    ] as const;
    expect(lmsAt(rows, -1)).toBeNull();
    expect(lmsAt(rows, 11)).toBeNull();
    expect(lmsAt(rows, 5)?.m).toBeCloseTo(11, 10);
    expect(lmsAt(rows, 5)?.interpolated).toBe(true);
    expect(lmsAt(rows, 10)?.interpolated).toBe(false);
  });

  it('bands are descriptive only and carry no clinical label', () => {
    expect(sdBand(-3.5)).toBe('below -3');
    expect(sdBand(-2.5)).toBe('-3 to -2');
    expect(sdBand(0)).toBe('-1 to +1');
    expect(sdBand(3.5)).toBe('above +3');
  });
});

describe('reference tables', () => {
  it('are installed and carry provenance for every range', () => {
    expect(growthTables.charts.length).toBeGreaterThan(0);
    expect(growthTables.provenance.length).toBeGreaterThan(0);
    for (const row of growthTables.provenance) {
      expect(row.url).toMatch(/^https:\/\//);
      expect(row.rows).toBeGreaterThan(0);
    }
  });

  it('are strictly ascending in age, for both sexes, in every chart', () => {
    for (const chart of growthTables.charts) {
      for (const sex of ['M', 'F'] as const) {
        const rows = chart.data[sex];
        expect(rows.length).toBeGreaterThan(0);
        for (let i = 1; i < rows.length; i += 1) {
          expect(rows[i]![0]).toBeGreaterThan(rows[i - 1]![0]);
        }
      }
    }
  });

  it('hold plausible L, M, S everywhere (no parse drift)', () => {
    for (const chart of growthTables.charts) {
      for (const sex of ['M', 'F'] as const) {
        for (const [, l, m, s] of chart.data[sex]) {
          expect(Number.isFinite(l)).toBe(true);
          expect(m).toBeGreaterThan(0);
          expect(s).toBeGreaterThan(0);
          expect(s).toBeLessThan(1);
          expect(Math.abs(l)).toBeLessThan(10);
        }
      }
    }
  });
});

/**
 * Spot-checks against the -3SD..+3SD columns WHO prints in its own z-score
 * tables. Tolerance is 0.05 kg / 0.1 cm, i.e. the rounding WHO itself publishes
 * at, not a fudge factor.
 */
describe('WHO published z-score values', () => {
  /**
   * WHO publishes its month-based tables at exact months of 30.4375 days, not
   * at 30-day or 365-day approximations. Anchoring the spot-checks at the same
   * ages WHO printed them at is the difference between comparing like with like
   * and quietly building in a half-day offset.
   */
  const months = (n: number) => n * 30.4375;
  const years = (n: number) => months(n * 12);

  const cases: Array<{
    measure: 'weight' | 'length' | 'height' | 'hc';
    sex: 'M' | 'F';
    ageDays: number;
    label: string;
    /** WHO published, z = -3, -2, -1, 0, +1, +2, +3 */
    published: [number, number, number, number, number, number, number];
    tolerance: number;
  }> = [
    {
      measure: 'weight', sex: 'M', ageDays: 0, label: 'boys, weight, birth',
      published: [2.1, 2.5, 2.9, 3.3, 3.9, 4.4, 5.0], tolerance: 0.05,
    },
    {
      measure: 'weight', sex: 'F', ageDays: 0, label: 'girls, weight, birth',
      published: [2.0, 2.4, 2.8, 3.2, 3.7, 4.2, 4.8], tolerance: 0.05,
    },
    {
      measure: 'length', sex: 'M', ageDays: 0, label: 'boys, length, birth',
      published: [44.2, 46.1, 48.0, 49.9, 51.8, 53.7, 55.6], tolerance: 0.1,
    },
    {
      measure: 'length', sex: 'F', ageDays: 0, label: 'girls, length, birth',
      published: [43.6, 45.4, 47.3, 49.1, 51.0, 52.9, 54.7], tolerance: 0.1,
    },
    {
      measure: 'hc', sex: 'M', ageDays: 0, label: 'boys, head circumference, birth',
      published: [30.7, 31.9, 33.2, 34.5, 35.7, 37.0, 38.3], tolerance: 0.1,
    },
    {
      measure: 'weight', sex: 'M', ageDays: months(12), label: 'boys, weight, 12 months',
      published: [6.9, 7.7, 8.6, 9.6, 10.8, 12.0, 13.3], tolerance: 0.05,
    },
    {
      measure: 'weight', sex: 'F', ageDays: months(12), label: 'girls, weight, 12 months',
      published: [6.3, 7.0, 7.9, 8.9, 10.1, 11.5, 13.1], tolerance: 0.05,
    },
    {
      measure: 'weight', sex: 'M', ageDays: months(24), label: 'boys, weight, 24 months',
      published: [8.6, 9.7, 10.8, 12.2, 13.6, 15.3, 17.1], tolerance: 0.05,
    },
    {
      measure: 'weight', sex: 'F', ageDays: months(24), label: 'girls, weight, 24 months',
      published: [8.1, 9.0, 10.2, 11.5, 13.0, 14.8, 17.0], tolerance: 0.05,
    },
    {
      measure: 'height', sex: 'M', ageDays: years(10), label: 'boys, height, 10 years',
      published: [118.7, 125.0, 131.4, 137.8, 144.2, 150.5, 156.9], tolerance: 0.1,
    },
  ];

  for (const c of cases) {
    it(`${c.label} reproduces the published SD columns`, () => {
      const chart = selectChart(growthTables, 'WHO', c.measure, c.ageDays, c.sex);
      expect(chart, `no WHO chart for ${c.measure} at ${c.ageDays}d`).not.toBeNull();
      const lms = lmsAt(chart!.data[c.sex], c.ageDays);
      expect(lms).not.toBeNull();
      [-3, -2, -1, 0, 1, 2, 3].forEach((z, i) => {
        const computed = valueAtZ(lms!, z);
        const published = c.published[i]!;
        expect(
          Math.abs(computed - published),
          `z=${z}: computed ${computed.toFixed(3)} vs published ${published}`,
        ).toBeLessThanOrEqual(c.tolerance);
      });
    });

    it(`${c.label} round-trips the published median to the 50th centile`, () => {
      const out = compute(growthTables, 'WHO', {
        measure: c.measure,
        value: c.published[3],
        ageDays: c.ageDays,
        sex: c.sex,
      });
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.percentile).toBeGreaterThan(46);
      expect(out.percentile).toBeLessThan(54);
      expect(out.band).toBe('-1 to +1');
    });
  }
});

describe('compute()', () => {
  it('stores the reference that produced the number', () => {
    const out = compute(growthTables, 'WHO', {
      measure: 'weight', value: 3.3, ageDays: 0, sex: 'M',
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.reference).toBe('WHO');
    expect(out.chart).toBe('weight-for-age');
    expect(out.edition).toMatch(/WHO/);
    expect(out.unit).toBe('kg');
  });

  it('WHO and CDC genuinely disagree under age 2, which is why the reference is stored', () => {
    const input = { measure: 'weight' as const, value: 11.5, ageDays: 730, sex: 'M' as const };
    const who = compute(growthTables, 'WHO', input);
    const cdc = compute(growthTables, 'CDC', input);
    expect(who.ok && cdc.ok).toBe(true);
    if (!who.ok || !cdc.ok) return;
    expect(Math.abs(who.percentile - cdc.percentile)).toBeGreaterThan(5);
  });

  it('refuses rather than extrapolating past the end of a chart', () => {
    const out = compute(growthTables, 'WHO', {
      measure: 'weight', value: 60, ageDays: 30 * 365, sex: 'M',
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe('out-of-range');
  });

  it('refuses when the tables are absent instead of guessing', () => {
    const out = compute(null, 'WHO', { measure: 'weight', value: 10, ageDays: 365, sex: 'M' });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe('no-tables');
  });

  it('rejects a zero or negative measurement', () => {
    const out = compute(growthTables, 'WHO', { measure: 'weight', value: 0, ageDays: 365, sex: 'M' });
    expect(out.ok).toBe(false);
  });

  it('finds a standing height for a 4-year-old on the length-or-height chart', () => {
    const out = compute(growthTables, 'WHO', {
      measure: 'height', value: 103, ageDays: 4 * 365, sex: 'M',
    });
    expect(out.ok).toBe(true);
  });

  it('separates the sexes', () => {
    const boy = compute(growthTables, 'WHO', { measure: 'weight', value: 3.3, ageDays: 0, sex: 'M' });
    const girl = compute(growthTables, 'WHO', { measure: 'weight', value: 3.3, ageDays: 0, sex: 'F' });
    expect(boy.ok && girl.ok).toBe(true);
    if (!boy.ok || !girl.ok) return;
    // Same weight is a higher centile for a girl; if these matched, the parser
    // would have collapsed the two sexes into one table.
    expect(girl.percentile).toBeGreaterThan(boy.percentile + 3);
  });

  it('flags a severely wasted child through the adjusted tail, not a raw LMS number', () => {
    const out = compute(growthTables, 'WHO', {
      measure: 'weight', value: 5.5, ageDays: 730, sex: 'M',
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.z).toBeLessThan(-4);
    expect(out.band).toBe('below -3');
  });
});

describe('curves for plotting', () => {
  it('comes from the same module as the percentile', () => {
    const points = curve(growthTables, 'WHO', 'weight', 'M', 0, 0, 365, 12);
    expect(points.length).toBe(13);
    expect(points[0]!.value).toBeCloseTo(3.3464, 3);
    // monotonic through the first year
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i]!.value).toBeGreaterThan(points[i - 1]!.value);
    }
  });
});

describe('ageDaysBetween', () => {
  it('counts whole days and is not confused by month lengths', () => {
    expect(ageDaysBetween('2024-01-01', '2024-01-01')).toBe(0);
    expect(ageDaysBetween('2024-01-01', '2025-01-01')).toBe(366); // leap year
    expect(ageDaysBetween('2023-01-01', '2024-01-01')).toBe(365);
  });
});
