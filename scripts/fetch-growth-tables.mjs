/**
 * Fetch the growth-reference LMS tables into src/data/growth/tables/.
 *
 * WHY THIS IS A SCRIPT AND NOT A HAND-WRITTEN CONSTANT:
 * a percentile bug is a clinical-safety bug (PRODUCT.md 4b). Nobody types these
 * numbers by hand, ever. They are pulled from the publishers of record and stored
 * verbatim, with provenance, so every value in the app is traceable to a source.
 *
 * SOURCES (both openly licensed / public domain for exactly this use):
 *   WHO  - Child Growth Standards (0-5y) + Growth Reference (2007, 5-19y), LMS
 *          tables as published in WHO's own reference implementations
 *          (WorldHealthOrganization/anthro and /anthroplus).
 *   CDC  - 2000 Growth Charts, LMS z-score data files published by NCHS.
 *
 * Usage:  npm run assets:growth
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'growth', 'tables');

const WHO_GS = 'https://raw.githubusercontent.com/WorldHealthOrganization/anthro/master/data-raw/growthstandards';
const WHO_GR = 'https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/master/data-raw/growthstandards';
const CDC = 'https://www.cdc.gov/growthcharts/data/zscore';

/** measure ids are the app's own vocabulary; see src/domain/growth/types.ts */
const WHO_SPECS = [
  { file: 'weianthro.txt',  measure: 'weight', chart: 'weight-for-age', unit: 'kg',    xUnit: 'day',   base: WHO_GS, range: '0-5y'  },
  { file: 'lenanthro.txt',  measure: 'length', chart: 'length-for-age', unit: 'cm',    xUnit: 'day',   base: WHO_GS, range: '0-5y'  },
  { file: 'hcanthro.txt',   measure: 'hc',     chart: 'hc-for-age',     unit: 'cm',    xUnit: 'day',   base: WHO_GS, range: '0-5y'  },
  { file: 'bmianthro.txt',  measure: 'bmi',    chart: 'bmi-for-age',    unit: 'kg/m2', xUnit: 'day',   base: WHO_GS, range: '0-5y'  },
  { file: 'wfawho2007.txt', measure: 'weight', chart: 'weight-for-age', unit: 'kg',    xUnit: 'month', base: WHO_GR, range: '5-10y' },
  { file: 'hfawho2007.txt', measure: 'height', chart: 'height-for-age', unit: 'cm',    xUnit: 'month', base: WHO_GR, range: '5-19y' },
  { file: 'bfawho2007.txt', measure: 'bmi',    chart: 'bmi-for-age',    unit: 'kg/m2', xUnit: 'month', base: WHO_GR, range: '5-19y' },
  // MUAC is keyed by age, so unlike weight-for-height it is an ordinary chart.
  // The table starts at day 91, which is why MUAC-for-age is a three-months-up
  // indicator rather than a birth-onwards one.
  { file: 'acanthro.txt',   measure: 'muac',   chart: 'muac-for-age',   unit: 'cm',    xUnit: 'day',   base: WHO_GS, range: '3m-5y' },
];

/**
 * Weight-for-length and weight-for-height, which are NOT age tables.
 *
 * They are kept apart from WHO_SPECS because their x axis is centimetres, and
 * everything in `domain/growth` compares x against an age in days. A cm-keyed
 * table pushed through `selectChart` would match on the wrong axis and answer
 * confidently -- so these land under their own `wasting` key, and only the
 * malnutrition module reads them.
 *
 * The two overlap between 65 and 110cm and are NOT interchangeable there:
 * `wfl` is recumbent length (how an infant is measured) and `wfh` is standing
 * height. WHO's rule is length under about 24 months / 87cm, height after.
 * Scoring a child against the wrong one is wrong exactly in the range where
 * severe wasting is decided.
 */
const WHO_WASTING_SPECS = [
  { file: 'wflanthro.txt', chart: 'weight-for-length', axis: 'lengthCm', xCol: 'length', unit: 'kg', base: WHO_GS, range: '45-110cm' },
  { file: 'wfhanthro.txt', chart: 'weight-for-height', axis: 'heightCm', xCol: 'height', unit: 'kg', base: WHO_GS, range: '65-120cm' },
];

const CDC_SPECS = [
  { file: 'wtageinf.csv',  measure: 'weight', chart: 'weight-for-age', unit: 'kg',    range: '0-3y'  },
  { file: 'lenageinf.csv', measure: 'length', chart: 'length-for-age', unit: 'cm',    range: '0-3y'  },
  { file: 'hcageinf.csv',  measure: 'hc',     chart: 'hc-for-age',     unit: 'cm',    range: '0-3y'  },
  { file: 'wtage.csv',     measure: 'weight', chart: 'weight-for-age', unit: 'kg',    range: '2-20y' },
  { file: 'statage.csv',   measure: 'height', chart: 'height-for-age', unit: 'cm',    range: '2-20y' },
  { file: 'bmiagerev.csv', measure: 'bmi',    chart: 'bmi-for-age',    unit: 'kg/m2', range: '2-20y' },
];

const DAYS_PER_MONTH = 30.4375;

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(res.status + ' ' + res.statusText + ' - ' + url);
  return res.text();
}

/**
 * WHO igrowup / who2007 tables: whitespace-delimited, columns sex <x> l m s
 * (+ extras). `xCol` names the x column -- 'age' for the age tables, 'length'
 * or 'height' for the wasting ones -- and `xUnit` decides whether it is
 * converted to days. Those two must never disagree: see the guard in `load`.
 */
function parseWho(text, xUnit, xCol) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].trim().split(/[\t,]|\s+/).map((h) => h.toLowerCase());
  const col = (n) => head.indexOf(n);
  const iSex = col('sex');
  const named = xCol ? col(xCol) : -1;
  const iAge = named !== -1 ? named : col('age') !== -1 ? col('age') : col('month');
  const iL = col('l'), iM = col('m'), iS = col('s');
  if ([iSex, iAge, iL, iM, iS].some((i) => i === -1)) {
    throw new Error('unexpected WHO header: ' + head.join('|'));
  }
  const rows = { M: [], F: [] };
  for (const line of lines.slice(1)) {
    const c = line.trim().split(/[\t,]|\s+/);
    if (c.length < head.length) continue;
    // WHO codes sex 1 = boys, 2 = girls.
    const sex = c[iSex] === '1' ? 'M' : 'F';
    const x = Number(c[iAge]);
    const l = Number(c[iL]), m = Number(c[iM]), s = Number(c[iS]);
    if (![x, l, m, s].every(Number.isFinite)) continue;
    rows[sex].push([xUnit === 'month' ? Math.round(x * DAYS_PER_MONTH) : x, l, m, s]);
  }
  rows.M.sort((a, b) => a[0] - b[0]);
  rows.F.sort((a, b) => a[0] - b[0]);
  return rows;
}

/** CDC z-score data files: CSV with Sex,Agemos,L,M,S,... Sex 1 = male, 2 = female. */
function parseCdc(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
  const col = (...names) => {
    for (const n of names) {
      const i = head.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const iSex = col('sex');
  const iAge = col('agemos', 'age');
  const iL = col('l'), iM = col('m'), iS = col('s');
  if ([iSex, iAge, iL, iM, iS].some((i) => i === -1)) {
    throw new Error('unexpected CDC header: ' + head.join('|'));
  }
  const rows = { M: [], F: [] };
  for (const line of lines.slice(1)) {
    const c = line.split(',').map((v) => v.trim().replace(/"/g, ''));
    const sex = c[iSex] === '1' ? 'M' : 'F';
    const months = Number(c[iAge]);
    const l = Number(c[iL]), m = Number(c[iM]), s = Number(c[iS]);
    if (![months, l, m, s].every(Number.isFinite)) continue;
    rows[sex].push([Math.round(months * DAYS_PER_MONTH), l, m, s]);
  }
  rows.M.sort((a, b) => a[0] - b[0]);
  rows.F.sort((a, b) => a[0] - b[0]);
  return rows;
}

/**
 * Merge an age range into a chart. Where two published ranges overlap (CDC infant
 * vs child files both cover 24-36mo), the first-loaded range wins: the narrower,
 * age-specific file is listed first in the specs above precisely so it does.
 */
function merge(target, incoming) {
  for (const sex of ['M', 'F']) {
    const seen = new Set(target[sex].map((r) => r[0]));
    for (const row of incoming[sex]) if (!seen.has(row[0])) target[sex].push(row);
    target[sex].sort((a, b) => a[0] - b[0]);
  }
}

/**
 * The one guard worth having in this file.
 *
 * `parseWho` multiplies by DAYS_PER_MONTH when xUnit is 'month'. A cm table
 * that picked up that conversion would produce plausible-looking numbers at
 * roughly thirty times the right scale, and nothing downstream would notice --
 * it would just quietly score every child against the wrong row. So assert the
 * axis is the one we asked for, in the units we asked for, before it is
 * written.
 */
function assertAxis(chart, rows, axis) {
  for (const sex of ['M', 'F']) {
    const xs = rows[sex].map((r) => r[0]);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    const [min, max] = axis === 'day' ? [0, 7500] : [40, 130];
    if (!(lo >= min && hi <= max)) {
      throw new Error(
        `${chart} [${sex}] spans ${lo}..${hi}, which is not a plausible ` +
          `${axis === 'day' ? 'age in days' : 'measurement in cm'} -- unit conversion bug`,
      );
    }
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const charts = {};
  const wasting = [];
  const provenance = [];

  const load = async (kind, spec, url, rows) => {
    const key = kind + ':' + spec.chart;
    if (!charts[key]) {
      charts[key] = {
        reference: kind,
        chart: spec.chart,
        measure: spec.measure,
        unit: spec.unit,
        data: { M: [], F: [] },
      };
    }
    merge(charts[key].data, rows);
    const n = rows.M.length + rows.F.length;
    provenance.push({ reference: kind, chart: spec.chart, range: spec.range, url, rows: n });
    console.log(n + ' rows');
  };

  for (const spec of WHO_SPECS) {
    const url = spec.base + '/' + spec.file;
    process.stdout.write('WHO  ' + spec.chart.padEnd(19) + spec.range.padEnd(9));
    const rows = parseWho(await get(url), spec.xUnit, 'age');
    assertAxis(spec.chart, rows, 'day');
    await load('WHO', spec, url, rows);
  }

  /*
    The wasting tables, into their own bucket. Deliberately NOT merged into
    `charts`: everything that reads `charts` treats x as an age in days.
  */
  for (const spec of WHO_WASTING_SPECS) {
    const url = spec.base + '/' + spec.file;
    process.stdout.write('WHO  ' + spec.chart.padEnd(19) + spec.range.padEnd(9));
    const rows = parseWho(await get(url), 'cm', spec.xCol);
    assertAxis(spec.chart, rows, 'cm');
    wasting.push({ axis: spec.axis, chart: spec.chart, unit: spec.unit, data: rows });
    const n = rows.M.length + rows.F.length;
    provenance.push({ reference: 'WHO', chart: spec.chart, range: spec.range, url, rows: n });
    console.log(n + ' rows');
  }

  for (const spec of CDC_SPECS) {
    const url = CDC + '/' + spec.file;
    process.stdout.write('CDC  ' + spec.chart.padEnd(19) + spec.range.padEnd(9));
    const rows = parseCdc(await get(url));
    assertAxis(spec.chart, rows, 'day');
    await load('CDC', spec, url, rows);
  }

  const bundle = {
    generatedAt: new Date().toISOString().slice(0, 10),
    editions: {
      WHO: 'WHO Child Growth Standards (2006) + WHO Growth Reference (2007)',
      CDC: 'CDC 2000 Growth Charts (NCHS), z-score LMS data files',
    },
    provenance,
    charts: Object.values(charts),
    wasting,
  };

  await writeFile(join(OUT, 'lms.json'), JSON.stringify(bundle), 'utf8');
  const total = [...bundle.charts, ...bundle.wasting].reduce(
    (n, c) => n + c.data.M.length + c.data.F.length,
    0,
  );
  console.log(
    '\nwrote src/data/growth/tables/lms.json - ' +
      bundle.charts.length + ' charts, ' +
      bundle.wasting.length + ' wasting tables, ' +
      total + ' LMS rows',
  );
}

main().catch((err) => {
  console.error('\nfetch-growth-tables failed:', err.message);
  process.exit(1);
});
