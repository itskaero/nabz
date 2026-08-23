/**
 * Reconcile the formulary seed against DRAP, the Pakistani regulator.
 *
 * WHY THIS IS THE SANCTIONED USE, AND WHAT IT STILL MAY NOT DO
 * -----------------------------------------------------------
 * CLAUDE.md 8a says "Seed `formulary` from DRAP", and the header of
 * `src/data/formulary/seed.ts` says every row must be reconciled against the
 * DRAP registry and flipped to `provenance: 'DRAP'` with its registration
 * number before this ships. This script is that reconciliation. The scraping
 * prohibition in PRODUCT.md 11a targets the COMMERCIAL catalogue sites
 * (druginfo.pk, dvago, Pharmapedia) whose "dosage" text is leaflet marketing
 * copy; DRAP is the registry of record. `robots.txt` on eapp.dra.gov.pk names
 * the paths DRAP does not want crawled -- /admin/, /attachments/, /inc/,
 * /application.php and friends -- and productView is not among them.
 *
 * THE LINE THAT DOES NOT MOVE: this populates the CATALOGUE layer only. Not one
 * field may reach the `dosing` table. DRAP's disclaimer says the list "cannot
 * be used as a reference for any purpose", and it is a REGISTRATION registry
 * regardless: it records that a product exists, never what dose a child should
 * receive. Dosing stays hand-authored and cited (PRODUCT.md 11a).
 *
 * WHY THIS RECONCILES 150 BRANDS RATHER THAN IMPORTING EVERYTHING
 * --------------------------------------------------------------
 * Two measurements, not a preference. Searching by generic returned 2,800
 * products for "Paracetamol" and "Amoxicillin" alone, so the full registry is
 * tens of thousands of rows -- autocomplete noise to a paediatrician with a
 * 200-drug repertoire, and a large bundle to ship offline.
 *
 * More seriously: **DRAP registers veterinary and human products in one index,
 * and the list endpoint does not say which.** A bulk import puts
 * "amcorox-80% Water Soluble Powder" by Vetrox Pharmaceuticals into a
 * paediatric prescribing autocomplete. Only the per-product detail view carries
 * `Used For: Human`, so every row here is confirmed human before it is kept.
 *
 * WHY THIS PROPOSES AND DOES NOT DECIDE
 * -------------------------------------
 * It was written to assign registration numbers automatically. It could not be
 * made safe. Measured failures, each from a real run:
 *
 *   Panadol 500mg tablet   -> "Panadol Night 500mg/25mg"  (adds diphenhydramine)
 *   Brufen 400mg tablet    -> "Brufen 400mg/4ml Injection" (wrong route)
 *   Brufen 400mg tablet    -> "Medibrufen 400mg Tablet"    (different company)
 *   Calpol 120mg/5ml syrup -> "Calpol Tablets"             (wrong form)
 *   3 Augmentin syrups     -> one shared tablet registration
 *
 * Each fix broke a different case: tightening the form check turned syrups into
 * tablets; treating "DS"/"BD" as line extensions rejected four CORRECT rows.
 * Brand-name matching against a national registry is genuinely ambiguous, and
 * the cost of being wrong is a row that *looks verified* while naming another
 * company's product, another route, or another molecule.
 *
 * So this assigns nothing. It gathers ranked candidates -- each confirmed human
 * and carrying its composition -- and the doctor picks in the pack builder.
 * That is the same rule the rest of the app already lives by: the library
 * suggests, the prescriber confirms (PRODUCT.md rule 3.2). `provenance` flips
 * to 'DRAP' only when a person has chosen.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src', 'data', 'formulary', 'drap.generated.json');
const VIEW = 'https://eapp.dra.gov.pk/productView.php';
const PAUSE_MS = Number(process.env.NABZ_DRAP_PAUSE ?? 300);
const MAX_CANDIDATES = Number(process.env.NABZ_DRAP_CANDIDATES ?? 4);

const DISCLAIMER =
  'This is an expanded provisional list of drugs registered by the Registration ' +
  'Board. Whilst due care has been taken in preparation of the provisional list of ' +
  'registered drugs, there might be some errors or omissions. This list cannot be ' +
  'used as a reference for any purpose including but not limited to litigation, ' +
  'claim, right, research, citation, or statistical analysis. ' +
  'Source: https://eapp.dra.gov.pk/WebProductIndex.php';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA =
  'nabz-formulary-seed/1.0 (paediatric prescribing app; catalogue reconciliation)';

async function ask(body) {
  const res = await fetch(VIEW, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.text()).replace(/^﻿/, '');
}

async function searchBrand(term) {
  const url = new URL(VIEW);
  url.searchParams.set('search', term);
  url.searchParams.set('_type', 'brand name');
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) return [];
  try {
    const body = JSON.parse((await res.text()).replace(/^﻿/, ''));
    return body.results ?? [];
  } catch {
    return [];
  }
}

/** Pull the fields we are allowed to keep out of the HTML detail view. */
function parseDetail(html) {
  const cells = html
    .replace(/<[^>]*>/g, '|')
    .split('|')
    .map((s) => s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const after = (label) => {
    const i = cells.findIndex((c) => c.toLowerCase() === label.toLowerCase());
    return i >= 0 ? cells[i + 1] ?? '' : '';
  };
  return {
    productName: after('Product Name'),
    usedFor: after('Used For'),
    dosageForm: after('Dosage Form'),
    composition: after('Composition'),
    status: after('Registration Status'),
    company: after('Company Name'),
  };
}

const norm = (s) =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * How well does a DRAP entry match the brand we are looking for?
 *
 * DRAP brand names carry the form and often the strength ("Panadol Tablet.",
 * "Children's Panadol Liquid"), so an exact string match almost never happens.
 * The seed's own form and strength are the tie-breakers -- without them,
 * "Panadol" would match "Panadol CF Day Tablet" as readily as "Panadol Tablet".
 */
/**
 * Words that turn a brand into a DIFFERENT product rather than describing the
 * same one. "Panadol" and "Panadol Night" share a name and share nothing else:
 * Night adds diphenhydramine. Treated as disqualifying unless the seed brand
 * says the same word, because a line extension wearing the parent brand's
 * registration number is a wrong drug that looks verified.
 */
const LINE_EXTENSIONS = [
  'night', 'nite', 'pm', 'day', 'extra', 'plus', 'cold', 'flu', 'cf', 'sinus',
  'cough', 'expectorant', 'menthol', 'lemon', 'dry', 'chesty', 'allergy',
];

/*
  Deliberately NOT in that list: forte, ds, bd, sr, xr, la, junior, extend.
  Those name a different STRENGTH or release profile of the same molecule --
  "Augmentin DS" is what the seed's 312mg/5ml row actually is -- and the
  strength check below is the right tool to tell them apart. Treating them as
  disqualifying rejected four correct Augmentin rows.
*/

/** Dosage forms, used both as harmless words and to catch a form mismatch. */
const FORM_WORDS = [
  'tablet', 'capsule', 'syrup', 'suspension', 'drops', 'injection', 'infusion',
  'cream', 'ointment', 'gel', 'lotion', 'sachet', 'powder', 'solution',
  'inhaler', 'suppository', 'emulsion', 'spray', 'granules', 'elixir',
];

/** Words that merely describe presentation and do not change the product. */
const HARMLESS = new Set([
  'tablet', 'tablets', 'capsule', 'capsules', 'syrup', 'suspension', 'drops',
  'injection', 'infusion', 'cream', 'ointment', 'gel', 'lotion', 'sachet',
  'powder', 'solution', 'inhaler', 'suppository', 'emulsion', 'spray',
  'granules', 'elixir', 'oral', 'liquid', 'eye', 'ear', 'nasal', 'mg', 'ml',
  'mcg', 'iu', 'gm', 'g', 'w', 'v',
]);

function score(seed, candidateText) {
  const c = norm(candidateText);
  const b = norm(seed.brand);
  if (!c.includes(b)) return 0;

  // Everything the candidate says that the seed brand does not.
  const extras = c
    .replace(b, ' ')
    .split(' ')
    .filter(Boolean)
    .filter((w) => !/^\d/.test(w) && !HARMLESS.has(w));

  // A line extension is not a weaker match, it is the wrong product.
  if (extras.some((w) => LINE_EXTENSIONS.includes(w) && !b.includes(w))) return 0;

  // Nor is a different dosage form. "Brufen 400mg tablet" matched "Brufen
  // 400mg/4ml Injection" while form only ever ADDED points and never removed
  // any -- an injection standing in for a tablet on a paediatric script.
  if (seed.form) {
    const wantForm = norm(seed.form);
    const words = new Set(c.split(' '));
    const named = FORM_WORDS.filter((f) => words.has(f));
    if (named.length && !named.some((f) => f === wantForm || wantForm.includes(f))) return 0;
  }

  let s = 50;
  s += Math.max(0, 24 - extras.length * 12);
  if (c.startsWith(b)) s += 10;
  if (seed.form && c.includes(norm(seed.form))) s += 15;
  if (seed.strength) {
    const digits = norm(seed.strength).replace(/[^0-9]/g, '');
    if (digits && norm(candidateText).replace(/[^0-9]/g, '').includes(digits)) s += 20;
  }
  return s;
}

/**
 * Does DRAP's own text back up the strength the seed claims?
 *
 * Compares the leading number only ("156mg/5ml" -> 156), because DRAP states
 * strengths inconsistently: sometimes in the product name, sometimes only in
 * the composition, sometimes per-5ml and sometimes per-dose. A seed row with no
 * strength has nothing to corroborate and passes on name and form alone.
 */
function strengthAgrees(seed, detail, candidateName) {
  if (!seed.strength) return true;
  const want = String(seed.strength).match(/\d+/)?.[0];
  if (!want) return true;
  const haystack = `${candidateName} ${detail.productName} ${detail.composition}`;
  const numbers = haystack.match(/\d+/g) ?? [];
  return numbers.includes(want);
}

async function main() {
  const { formularySeed } = await import('../src/data/formulary/seed.ts');
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const seeds = only.length
    ? formularySeed.filter((r) => only.some((o) => norm(r.brand) === norm(o)))
    : formularySeed;

  const resolved = [];
  const unresolved = [];
  const rejectedVeterinary = [];
  let n = 0;

  for (const seed of seeds) {
    n += 1;
    const tag = `${n}/${seeds.length} ${seed.brand}`;
    try {
      const hits = await searchBrand(seed.brand);
      await sleep(PAUSE_MS);

      const ranked = hits
        .map((h) => ({ ...h, score: score(seed, h.text) }))
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_CANDIDATES);

      if (ranked.length === 0) {
        unresolved.push({ ...seed, why: 'no DRAP entry matched the brand name' });
        process.stderr.write(`  ${tag}: no candidates
`);
        continue;
      }

      // Confirm human use and capture composition for each candidate. The
      // search endpoint cannot say whether a product is veterinary; only the
      // detail page can, and DRAP indexes both in one registry.
      const candidates = [];
      for (const hit of ranked) {
        const detail = parseDetail(await ask({ webRegNo: hit.id }));
        await sleep(PAUSE_MS);
        if (!/human/i.test(detail.usedFor)) {
          rejectedVeterinary.push({
            brand: seed.brand,
            drapRegNo: hit.id,
            name: hit.text.trim(),
            usedFor: detail.usedFor,
          });
          continue;
        }
        candidates.push({
          /**
           * A PRESENTATION HINT ONLY, never a licence to auto-accept.
           *
           * A single candidate is not a correct candidate: the full run matched
           * "Curam 457mg/5ml" to Curamin Tablets and three different Augmentin
           * syrups to one 375mg tablet, each as the ONLY result. This flag says
           * the strength and form corroborate, so the builder can sort the
           * easy confirmations first -- a human still confirms every one.
           */
          looksExact:
            strengthAgrees(seed, detail, hit.text) &&
            (!seed.form ||
              norm(`${detail.dosageForm} ${detail.productName}`).includes(norm(seed.form))),
          drapRegNo: String(hit.id).trim(),
          drapProductName: detail.productName || hit.text.trim(),
          company: detail.company,
          registrationStatus: detail.status,
          dosageForm: detail.dosageForm,
          composition: detail.composition,
          rank: hit.score,
        });
      }

      if (candidates.length === 0) {
        unresolved.push({ ...seed, why: 'every DRAP match was a veterinary product' });
        process.stderr.write(`  ${tag}: all veterinary
`);
        continue;
      }

      resolved.push({
        brand: seed.brand,
        generic: seed.generic,
        ...(seed.strength ? { strength: seed.strength } : {}),
        ...(seed.form ? { form: seed.form } : {}),
        // PROPOSALS. Nothing here is chosen; the builder asks a human.
        candidates,
      });
      process.stderr.write(`  ${tag}: ${candidates.length} candidate(s)
`);
    } catch (err) {
      unresolved.push({ ...seed, why: `lookup failed: ${err.message}` });
      process.stderr.write(`  ${tag}: FAILED ${err.message}
`);
      await sleep(PAUSE_MS);
    }
  }

  resolved.sort((a, b) => a.generic.localeCompare(b.generic) || a.brand.localeCompare(b.brand));
  // Fewest candidates first: the one-candidate rows are the quick wins a
  // reviewer can clear in a sitting, and burying them under the ambiguous ones
  // is how a review queue never gets finished.
  for (const row of resolved) {
    row.candidates.sort((a, b) => Number(b.looksExact) - Number(a.looksExact) || b.rank - a.rank);
  }
  // Rows with a corroborated candidate first: those are the quick confirmations
  // a reviewer can clear in a sitting, and burying them under the ambiguous
  // ones is how a review queue never gets finished.
  resolved.sort(
    (a, b) =>
      Number(b.candidates.some((c) => c.looksExact)) -
        Number(a.candidates.some((c) => c.looksExact)) ||
      a.candidates.length - b.candidates.length,
  );

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        source: 'DRAP public product index',
        url: 'https://eapp.dra.gov.pk/WebProductIndex.php',
        fetchedAt: new Date().toISOString(),
        disclaimer: DISCLAIMER,
        note:
          'CATALOGUE ONLY: brand, generic, strength, form, company, registration ' +
          'number. No dosing information is present, and none may be derived from ' +
          'this file. Dosing lives in a separate table where every row is cited. ' +
          'Every product here was confirmed "Used For: Human" on its DRAP detail ' +
          'page -- DRAP indexes veterinary products alongside human ones and the ' +
          'search endpoint does not distinguish them.',
        counts: {
          seedRows: seeds.length,
          withCandidates: resolved.length,
          unresolved: unresolved.length,
          veterinaryFiltered: rejectedVeterinary.length,
        },
        /**
         * PROPOSALS ONLY. Nothing here has been accepted. Each seed row carries
         * ranked DRAP candidates for a human to choose between in the pack
         * builder; `provenance` flips to 'DRAP' at that moment and not before.
         */
        review: resolved,
        unresolved,
        rejectedVeterinary,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(
    `\nresolved ${resolved.length}/${seeds.length}  unresolved ${unresolved.length}  vet-rejected ${rejectedVeterinary.length}`,
  );
  console.log(`-> ${OUT}`);
}

await main();
