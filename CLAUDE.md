# CLAUDE.md — Build guide

> **One of three specs — read all three.** `PRODUCT.md` = what & why (source of
> truth). `CLAUDE.md` (this) = how to build. `DESIGN.md` = how it looks & feels.
> Reference prototypes: `rx-app.html` (main app), `rx-pack-builder.html` (companion).
>
> Read `PRODUCT.md` first. When product intent and implementation ease conflict,
> `PRODUCT.md` wins; when visual questions arise, follow `DESIGN.md`. This file is
> safe to evolve as the codebase grows.

---

## 0. Prime directives (repeated from PRODUCT.md because they're easy to violate mid-build)

1. **Server persists NO clinical data.** On-device only. Only license/payment
   state may ever touch a server (v2). If you're about to POST a diagnosis or
   patient name anywhere, STOP.
2. **No machine translation of free prose.** Advice tier-3 prints as-typed.
3. **No automated clinical judgement**, **no cross-patient auto-carryover** — refill
   is always an explicit manual search + select.
4. **Library suggests; doctor confirms.** Never silently fill dose/strength/freq.
5. **Print a signature line; never auto-stamp a stored signature.**
6. **Per-locale templates have their own word order.** Never build Urdu by
   reversing English tokens.

---

## 1. Stack

- **App:** React + Vite, PWA (installable, offline via service worker).
- **Language:** TypeScript (strict). Clinical data structures must be typed — an
  untyped `sig` object is how a wrong-unit bug ships.
- **State:** local component/store state; no server state in v1.
- **Storage:** IndexedDB (via a thin typed wrapper, e.g. `idb`). NOT localStorage
  (too small, sync, evicted first).
- **PDF:** a real PDF generator that embeds fonts and renders at exact mm
  dimensions (e.g. `pdf-lib` or a headless-render pipeline). **Do NOT** rely on
  `window.print()` of the live DOM for the final artifact — see §5.
- **i18n:** a locale-pack structure keyed by `locale + string_id` (see §4). Do not
  reach for a heavy i18n lib that assumes simple string swaps — our medication
  strings are *composed templates with per-locale word order*, which most i18n
  libs handle badly. A small custom resolver is likely cleaner.
- **Fonts:** bundle **Noto Nastaliq Urdu** (or equivalent Nastaʿlīq face) as an
  embedded asset for both screen and PDF.

Confirm versions in `package.json`; don't assume from memory.

**For anything in `render/screen/` or `render/pdf/`, follow `DESIGN.md`** — palette,
colour discipline, the bilingual medication row, two-register model, multi-channel
safety signalling, and print rules all live there. Read the `frontend-design` skill
before building UI, then apply `DESIGN.md` over its defaults.

---

## 2. Suggested structure

```
src/
  domain/            # pure, framework-free clinical types + logic
    prescription.ts  # Prescription, Section, MedicationLine, Sig types
    sig.ts           # sig composition (structured -> rendered string, per locale)
    advice.ts        # advice tiers 1/2/3 model
    exam.ts          # findings-chip state model (present/absent/value)
    pluralize/       # per-locale number/plural rules (en, ur-PK)
    bidi.ts          # helpers to wrap LTR tokens inside RTL text
    growth/          # LMS -> z-score -> percentile (pure, TESTED, safety-critical)
  data/
    formulary/       # drug library (brand -> generic + strength), seeded ~150
    phrases/         # locale packs: sig slots, advice tiers 1/2
    palettes/        # exam findings palettes per system (editable defaults)
    packs/           # specialty content packs; v1 ships paediatrics.ts only
    growth/          # embedded WHO (default) + CDC LMS reference tables
  storage/           # IndexedDB wrapper, export/import (encrypted)
  render/
    screen/          # React UI
    pdf/             # fixed-dimension PDF renderer (the real print target)
  config/            # app defaults + per-doctor profile (kept separate, §7)
  app/               # routing, PWA shell
```

Keep `domain/` **framework-free and pure** so sig/advice/exam composition is unit-
testable without React. The composition + pluralization + bidi logic is where the
safety-critical bugs live; it must be testable in isolation.

---

## 3. Core domain types (starting point — refine in code)

```ts
type Locale = 'en' | 'ur-PK'; // extensible; adding a locale must be data, not code

interface Quantity { value: number; unit: string; } // dose, duration, etc.

interface Drug {
  brand?: string;      // free-text allowed; library autocompletes name only
  generic?: string;
  strength?: string;
  form?: string;
  raw?: string;        // fallback when doctor typed an unknown drug
}

interface Sig {
  templateId: string;          // -> phrases/sig pack
  dose: Quantity;
  frequency: string;           // slot id -> phrases pack (BID/TID/...)
  timing?: string;             // slot id (after_food/empty_stomach/...)
  duration?: Quantity;
  // NOTE: every field here is doctor-confirmed; no silent library defaults
}

interface MedicationLine { drug: Drug; sig: Sig; }

type AdviceItem =
  | { tier: 1; templateId: string; slots: Record<string, string | number> }
  | { tier: 2; redFlagId: string }            // library-only, no free text
  | { tier: 3; lang: Locale; text: string };  // printed as-is, NO translation

interface ExamFinding {
  id: string;
  state: 'present' | 'absent';   // 'not-tapped' == absent from list entirely
  value?: string;                // "3cm", grade, etc.
}
interface ExamSystem { system: string; findings: ExamFinding[]; freeText?: string; }

interface Prescription {         // language-NEUTRAL; language chosen at render
  patient: { name: string; age?: string; weightKg?: number; /* ... */ };
  date: string;
  problems: string[];            // en
  examination: ExamSystem[];     // en
  diagnosis: string[];           // en
  medications: MedicationLine[]; // rendered en + ur-PK
  advice: AdviceItem[];          // tiers per §PRODUCT.md 9
  // doctor block + config come from the per-doctor profile, not stored per-Rx
}
```

The stored `Prescription` is **language-neutral structured data**. Renderers turn
it into an English chart view and an Urdu patient view from the *same* object.

---

## 4. Locale pack + composition rules (the wedge — get this right)

- Pack shape: `phrases[packId][slotId][locale] = string`, and template strings
  `templates[templateId][locale]` with `{slot}` placeholders.
- **Each locale has its OWN template string with its OWN slot order.** `en` and
  `ur-PK` for the same `templateId` are independent. Never derive one from the other.
- **Composition:** resolve each slot value in the target locale, run per-locale
  **pluralization** on `Quantity` slots, then fill the locale template.
- **Bidi:** when the target render is RTL (`ur-PK`) and a slot contains LTR content
  (drug name, "250mg"), wrap it in a bidi isolate (`\u2066…\u2069` or `dir` in DOM)
  so it can't reorder the dose. Unit-test with a real drug name + number.
- Adding a language = adding a locale to the packs. **If adding a language touches
  `.tsx`/`.ts` logic, that's a bug** — it should be data only.

Tests that MUST exist for this module:
- "1 day" vs "5 days" (en plural); "1 دن" vs "5 دن" (ur-PK number grammar).
- Urdu template word order differs from English (assert not a reversal).
- Bidi: "Amoxil 250mg" stays intact and correctly placed inside an Urdu line.

---

## 5. Print / PDF (first-class target, not CSS-on-screen)

- Render the final artifact as a **fixed-dimension PDF** (A4 or Letter from config),
  fonts embedded. The doctor prints THAT. Screen preview must be generated from the
  same renderer so **preview == print**.
- Do NOT ship `window.print()` of the live DOM as the real output: browser/printer
  scale-to-fit silently breaks margins and shrinks Urdu below the legibility floor.
- Implement, per PRODUCT.md §10:
  - paper-size + letterhead-suppression + top-offset from config;
  - signature block **pinned to page bottom**;
  - **keep-together** on each medication row / sig block (never split en|ur across pages);
  - **repeating per-page identity strip** (patient + date + page X/Y + doctor reg);
  - **row-locked bilingual grid** (row height = taller language) OR split
    English-clinical / Urdu-patient block;
  - **Urdu minimum point size** enforced;
  - no color-only emphasis.
- Test on a **real cheap mono laser**, not just on-screen/good-printer PDF.

---

## 6. Exam findings chips

- A chip is a **stateful control**: present / absent / cleared, + optional value.
- Omit unexamined systems; allow explicit pertinent negatives ("no neck stiffness")
  as fast as positives.
- Palette per system, **editable + self-growing** (frequent free-text finding ->
  offered as chip). Ship strong paediatric/general default; do NOT hardcode
  paediatric-only.
- Chips compose to **English prose** (exam is en-only — no translation/bidi here).
- **Do NOT** add chips to Diagnosis (free text + own-history autocomplete instead).

---

## 6a. Specialty content packs (build the seam in v1; ship ONE pack)

See PRODUCT.md §4a. Enforce in code:

- All specialty-specific content loads from a `ContentPack`; NO specialty content is a
  hardcoded constant in a component. If adding a specialty would require editing
  `.tsx`/logic, that's a bug — it must be a new pack file (data only), mirroring the
  "adding a locale is data not code" rule.
- `ContentPack = { id, specialty, examSystems[], findingsPalette{},
  advicePacks{ tier1, tier2 }, formularySeed[], modules[] }`.
- v1 ships exactly one pack: `data/packs/paediatrics.ts` (authored by Ali).
- `modules[]` lists specialty modules the pack enables (v1 paeds: `['growth']`).
- Do NOT author non-paediatric packs. The schema is open for others; the content is not
  ours to write.

## 6b. Growth module (in v1, SAFETY-CRITICAL — treat like the sig, not like a chart)

See PRODUCT.md §4b. This is the second provably-correct requirement after Urdu.

- Put the math in `domain/growth/` — pure, framework-free, unit-tested:
  `lms.ts` (LMS → z-score → percentile), typed inputs `{ measure, value, ageDays, sex }`.
- **Reference data** in `data/growth/` as embedded WHO (default) + CDC LMS tables.
  Every computed percentile stored WITH `{ reference: 'WHO'|'CDC', chart, edition }`.
- **Mandatory test suite** validating `lms.ts` output against published WHO/CDC
  reference values (spot-check known age/sex/measure → known percentile). No growth
  code ships without this suite green. A percentile bug is a clinical-safety bug.
- **Longitudinal storage carve-out:** growth may load one confirmed patient's prior
  series, but ONLY via an explicit doctor action ("open Growth for this patient") —
  never auto-injected on patient match. Gate it behind a confirm step; see rule 3.4.
- Plotting is presentation only; never let the chart UI recompute percentiles — it
  renders values from `domain/growth`, single source of truth.

## 7. Config layers (keep physically separate)

- `config/appDefaults` — shipped defaults (A4, bilingual meds on, …).
- `config/doctorProfile` — per-doctor: paper, letterhead+offset, logo, doctor block
  (name/quals/**registration field is locale-aware: PMDC/GMC/…**/clinic), per-section
  language overrides, exam systems, findings palette. Also the future anchor for the
  v2 per-doctor license.
- Never merge these into one blob. "App default" and "my letterhead" are different scopes.

---

## 8. Storage, history, backup

- IndexedDB for prescriptions + learned autocomplete + templates/favourites.
- **Manual refill only:** search + explicit select. No auto-load by patient match.
- **Manual encrypted export/import** (doctor owns the file). Server holds nothing.
- Ship a **loud, repeated** "records live only on this device — back up regularly"
  nudge. Local storage is evictable; this is the known v1 weakness (v2 cloud backup
  is the fix + the paid tier). Add an obvious "Export my data" from day one.

---

## 8a. Data sourcing & schema (two databases, kept separate)

See PRODUCT.md §11a. Enforce in code:

- **Two tables, joined on generic:**
  - `formulary` (catalogue) keyed by brand: `{ brand, generic, strength, form,
    drapRegNo, price?, alternates?, provenance: 'DRAP' | 'manual' }`.
  - `dosing` (evidence) keyed by generic: `{ generic, indication?, ageBand?,
    weightBand?, mgPerKg?, maxPerDay?, route, reference /* REQUIRED */ }`.
- **`reference` is a required, non-empty field on every dosing row** (source +
  edition + page/section). A dosing entry without a citation is a build/data error —
  add a validation/test that fails if any `dosing` row has an empty reference.
- **Do NOT import catalogue "dosage" text into `dosing`.** Commercial catalogue
  sources (druginfo.pk/dvago/Pharmapedia) may populate price/alternates only.
- **Do NOT write a bulk PDF-table parser for copyrighted references.** Owned PDFs
  (BNFC/Nelson/Harriet Lane/etc.) are consult-and-cite: a human authors the entry,
  the app stores the citation. If asked to "extract all doses from this PDF into
  JSON", refuse for licensed sources; WHO (open-licensed) is the exception.
- **Dose UI = cited suggestion, doctor-confirmed** (show the reference), never a
  silent default (consistent with the library-suggests rule).
- Seed `formulary` from DRAP + the ~150 real brands; grow from usage.

---

## 9. What NOT to build in v1 (guard against scope creep)

- No cloud sync/backup, no accounts, no license enforcement (all v2).
- No interaction/decision-support engine.
- No auto-translation anywhere.
- No geo-locking.
- No national formulary — seed ~150 from real use, grow from usage.
- No rigid dropdown-ification of exam/diagnosis (kills expert speed).
- No bulk-parsing of copyrighted reference PDFs into the dosing DB (consult-and-cite
  only; WHO open-licensed sources excepted).

---

## 10. Definition of "good v1" (adoption test)

Every non-wedge interaction must be **at least as fast as the doctor's current Word
template**, and the Urdu output must read as **natural patient-register Urdu** a
real patient/pharmacist would validate — not stilted textbook Urdu. If either fails,
the product fails regardless of how clean the code is. Optimize the build around
these two, not around architectural elegance.

---

## 11. Commands

```
npm install              # install
npm run assets           # fetch WHO/CDC LMS tables + the OFL fonts (once, or to refresh)
npm run dev              # dev server
npm run build            # typecheck + production build
npm test                 # full suite; domain composition + pluralize + bidi is the priority part
npm run typecheck        # tsc only
npm run preview          # serve the built PWA (installable, offline)
npm start                # serve the built app only -- holds no data (Railway runs this)
npm run start:clinic     # reception station: serves the app AND shares the queue on the LAN
```

Two server modes, and the difference is the whole privacy story. `npm start`
hands over the app and stores nothing -- there is no data endpoint to call. Clinic
mode adds ONE endpoint carrying patients and queue rows, and the server
whitelists those fields independently of the client, so a client bug cannot write
a prescription onto a shared machine. `tests/server.test.ts` posts clinical
content at it and asserts the disk never sees it.

`npm run assets` is not optional on a fresh clone. Neither the growth tables nor
the fonts are committed: the tables come from WHO's and CDC's own published LMS
files and the fonts are OFL binaries, and both should be traceable to their
source rather than to a copy someone pasted in. Without them the growth module
refuses to compute and the renderer refuses to draw, loudly, rather than
producing a document with no Urdu in it.

Two artifact checks, off by default (they write files, so `npm test` does not
run them). Both work in PowerShell, cmd and bash -- the wrapper sets the
environment variable in JavaScript rather than in shell syntax:

```
npm run artifact:pdf          # -> artifacts/sample.pdf, a real script to print
npm run artifact:visual       # -> artifacts/visual/page-N.png
npm run artifact:pdf -- out/rx.pdf     # or pass your own path
```

The second one exists because "the Nastaliq is correct" is not a claim a string
assertion can settle -- letters have to join and marks have to sit in the right
place. Use the first to get paper for PRODUCT.md 10's last acceptance check: a
real cheap mono laser.
