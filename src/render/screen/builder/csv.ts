/**
 * Bulk import of catalogue rows.
 *
 * WHY THIS EXISTS AND WHAT IT REFUSES TO DO
 * -----------------------------------------
 * A competitor ships 75,000 medicines. If someone wants to load a large
 * catalogue here, this is the door — but everything that comes through it
 * arrives marked `provenance: 'manual'` and carries no DRAP registration
 * number, because nothing about a CSV proves a brand exists as described.
 *
 * That is the counter-position in one sentence: they have 75,000 rows nobody
 * can audit; we have per-row provenance. An imported row is visibly unverified
 * until a human looks it up, and the pack validator already refuses any row
 * claiming DRAP provenance without a registration number.
 *
 * Dosing is NOT importable. `PRODUCT.md` 11a is explicit that commercial
 * catalogue "dosage" text is leaflet-derived marketing copy, not evidence, and
 * that every dose is authored by a clinician against a cited source. A bulk
 * path into the dosing table would launder exactly the data the two-table split
 * exists to keep out.
 */
import type { FormularyEntry } from '@domain/pack.ts';
import { normaliseGeneric } from '@domain/generics.ts';

export interface CsvImportResult {
  rows: FormularyEntry[];
  /** rows that could not be used, with the reason, so nothing fails silently */
  rejected: Array<{ line: number; reason: string; raw: string }>;
  /** rows whose brand+strength already exists in the pack */
  duplicates: number;
}

/** Minimal RFC-4180-ish split: handles quoted fields and embedded commas. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const HEADER_ALIASES: Record<string, string> = {
  brand: 'brand',
  'brand name': 'brand',
  product: 'brand',
  name: 'brand',
  generic: 'generic',
  'generic name': 'generic',
  composition: 'generic',
  salt: 'generic',
  strength: 'strength',
  form: 'form',
  'dosage form': 'form',
  price: 'price',
  mrp: 'price',
};

/**
 * Parse a catalogue CSV.
 *
 * Requires `brand` and `generic` columns, because the formulary/dosing join is
 * on generic and a row without one can never be given a dose.
 */
export function parseFormularyCsv(
  text: string,
  existing: FormularyEntry[],
  currency = 'PKR',
): CsvImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const rejected: CsvImportResult['rejected'] = [];
  if (lines.length < 2) {
    return { rows: [], rejected: [{ line: 0, reason: 'file has no data rows', raw: '' }], duplicates: 0 };
  }

  const header = parseCsvLine(lines[0]!).map((h) => HEADER_ALIASES[h.toLowerCase()] ?? h.toLowerCase());
  const at = (field: string) => header.indexOf(field);
  if (at('brand') === -1 || at('generic') === -1) {
    return {
      rows: [],
      rejected: [
        {
          line: 1,
          reason: `needs a brand and a generic column; found: ${header.join(', ')}`,
          raw: lines[0]!,
        },
      ],
      duplicates: 0,
    };
  }

  const seen = new Set(
    existing.map((r) => `${r.brand.toLowerCase()}|${r.strength ?? ''}|${r.form ?? ''}`),
  );
  const rows: FormularyEntry[] = [];
  let duplicates = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]!);
    const pick = (field: string) => {
      const index = at(field);
      return index === -1 ? '' : (cells[index] ?? '').trim();
    };
    const brand = pick('brand');
    const generic = pick('generic');
    if (!brand) {
      rejected.push({ line: i + 1, reason: 'no brand', raw: lines[i]! });
      continue;
    }
    if (!generic) {
      // Without a generic the row can never be joined to a dose, so it would be
      // a name in a list and nothing else.
      rejected.push({ line: i + 1, reason: 'no generic — a dose could never be matched to it', raw: lines[i]! });
      continue;
    }
    const strength = pick('strength');
    const form = pick('form');
    const key = `${brand.toLowerCase()}|${strength}|${form}`;
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);

    const priceRaw = pick('price').replace(/[^\d.]/g, '');
    const price = priceRaw ? Number(priceRaw) : Number.NaN;

    rows.push({
      brand,
      // Fold whitespace so an import cannot mint a second spelling of a generic
      // that already exists and silently split its dosing in two.
      generic: generic.replace(/\s+/g, ' '),
      ...(strength ? { strength } : {}),
      ...(form ? { form: form.toLowerCase() } : {}),
      ...(Number.isFinite(price) && price > 0
        ? { price: { amount: price, currency } }
        : {}),
      // Never 'DRAP'. A CSV proves nothing about a registration.
      provenance: 'manual' as const,
    });
  }

  return { rows, rejected, duplicates };
}

/**
 * Generics an import would ADD to the pack's vocabulary.
 *
 * Surfaced before the import commits, because every new generic is a new name
 * the dosing table has to match exactly — and a near-miss there is silent.
 */
export function newGenerics(
  rows: FormularyEntry[],
  existing: FormularyEntry[],
): string[] {
  const known = new Set(existing.map((r) => normaliseGeneric(r.generic)));
  const added = new Set<string>();
  for (const row of rows) {
    const key = normaliseGeneric(row.generic);
    if (!known.has(key)) added.add(row.generic);
  }
  return [...added].sort();
}
