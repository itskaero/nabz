# Medicine pack — what's here, what's missing, what must happen before it ships

Six files, registered in the pack seam as `medicine` (unverified):

| File | What it is |
|---|---|
| `src/data/packs/medicine.ts` | The pack. 9 exam systems, ~120 findings chips, 5 lab categories, ~90 tests, 30 advice + 22 red-flag ids, 18 sig templates, the `gfr` module |
| `src/data/packs/medicine.scores.ts` | CURB-65, CHA₂DS₂-VASc, HAS-BLED — pack data, per `ScoreDefinition` |
| `src/data/formulary/medicine.seed.ts` | ~250 adult brands common in Pakistani practice. All `provenance: 'manual'` |
| `src/data/dosing/medicine.seed.ts` | 52 dosing rows, every one cited to an openly licensed WHO source, every one `verified: false` |
| `src/data/phrases/medicine.strings.ts` | English + Urdu for every advice/red-flag id and the 8 adult-only sig templates |
| `src/data/phrases/medicine.ts` | Composes those into the pack's own self-contained `PackRegistry` |

**Registered, but installed as a badged draft, not shipped as trusted content.** `medicine.verified = false` surfaces in Settings, the pack picker and the pack builder wherever this pack appears. Nothing below is a build instruction any more — the seam, the schema and the seed data all exist and are tested (`tests/pack.test.ts`, `tests/sig.test.ts`, `tests/gfr.test.ts`, `tests/db.test.ts`). What remains is the genuinely clinical work of a real physician reviewing the content.

---

## 1. The rule in `paediatrics.ts` that this bumps into

That file says: *"DO NOT author packs for other specialties… An ENT or derm pack is authored by a clinician OF that specialty."*

That rule is right and I haven't overridden it. What's here is a **draft skeleton for a physician to correct**, not content ready to trust. The header of `medicine.ts` says so, and the three preconditions are listed there. Worth being blunt about the specific risk: you're a paediatrics resident, so for the paediatric pack you *are* the verifying clinician. For this one you aren't, and the gap between "looks plausible to a doctor" and "correct for adult practice" is exactly where a pack like this hurts someone. Get a physician's name on it — and flip `medicine.verified` to `true` — before it goes near a clinic.

## 2. Where the dosing came from, and what's deliberately missing

Sources are all openly licensed, per PRODUCT.md 11a: WHO Model Formulary 2008, the WHO AWaRe antibiotic book (CC BY-NC-SA 3.0 IGO), WHO PEN 2020, HEARTS 2020, TB Module 4 (2022), Guidelines for malaria (2023), the daily-iron guideline (2016), and the 23rd EML. Nothing from BNF, Davidson's, Harrison's, Oxford Handbook or Lexicomp.

**Drugs left out of dosing on purpose**, because I could not cite them from an open source and a fabricated citation is worse than a gap. Each needs a real physician to add the row with a real reference:

- **Vitamin D 60,000 IU weekly** — near-universal in Pakistani practice, but WHO doesn't recommend that regimen. Needs a local or society guideline as its citation.
- **PPI + H. pylori eradication triple therapy** — the 14-day combination is standard but the specific regimen used should follow local resistance patterns.
- **Sitagliptin / vildagliptin / empagliflozin / dapagliflozin** — in the formulary (patients arrive on them) but not in dosing; not in the EML in a form I could cite.
- **Pregabalin, gabapentin** — heavily prescribed in Pakistan, no open WHO adult dosing.
- **Statin intensity beyond atorvastatin**, rosuvastatin dosing.
- **Levetiracetam, phenytoin** adult dosing.
- **Tamsulosin, finasteride** — BPH is a big share of the male OPD.
- **Insulin titration rules** — the row present states a typical starting point and explicitly refuses a formula beyond that; a reviewing physician should confirm the wording, not add a computed dose.

Warfarin and insulin isophane are the two highest-risk rows in the file — both `fixedDose` and neither reducible to a formula. Confirm their wording reads as a caution, not a target dose, before signing off.

## 3. Formulary reconciliation

Run these through `scripts/fetch-drap.mjs`. Expect a **worse hit rate** than the paediatric run (which got 132/150 with candidates). Adult brands turn over faster, and several rows are deliberately listed by generic — `Warfarin`, `Heparin`, `Theophylline SR`, `Tamsulosin`, `Pyrazinamide`, `Isoniazid` — because no single brand dominates. Those will come back `unresolved`, which is correct: resolve them to what your pharmacy stocks, or delete them.

A few rows to check with particular care, because I'm least confident the brand-to-generic mapping is current in Pakistan: `Neodipar`, `Thyronorm`, `Zoltra`, `Rifagut`, `Renasave`, `Mucolator`, `Ambrolex`, `Leflox`, `Oxidil`, `Feburic`.

## 4. Urdu

Written in clinic register, using the respectful plural (لیں / کریں / آئیں) because these address an adult patient — not دیں, which the paediatric pack uses for a caregiver. `tests/pack.test.ts` pins this at the mechanism level (`sigDefaults.slots.administer === 'take'`, resolving to `لیں`), not by scanning prose for the substring `دیں` — that substring also appears legitimately inside compound verbs like چھوڑ دیں ("quit"), so a naive text scan produces false positives.

`advice.follow_up_in` and `advice.limit_fluid` carry `{n}` at different word positions in Urdu than in English; `tests/sig.test.ts` pins that too.

Every line still needs a native clinician to read it aloud as if handing over the slip — the tests catch a *structural* mistranslation, not a stilted one.

## 5. Scores — CURB-65, CHA₂DS₂-VASc, HAS-BLED

Criteria and point values are the published definitions and are not in question. **The band `note`s are the part that needs a clinician's eye**: CURB-65's mortality figures are the ones universally reproduced for that score, but CHA₂DS₂-VASc's and HAS-BLED's bands were deliberately left qualitative (low/moderate/high) rather than citing a specific per-point rate from memory — see `medicine.scores.ts`'s own header for why. A reviewing physician who has the source papers open should feel free to add the numbers back in.

## 6. The `gfr` module

Registered and tested against algebraic identities and hand-computable Cockcroft-Gault examples (`tests/gfr.test.ts`) rather than a memorised "known published value," since eGFR has no shipped reference table the way growth does — see that test file's own header. It never adjusts a dose or flags a drug; it reports a number and a method, full stop. If a reviewing physician wants a second opinion on the formulas themselves: CKD-EPI 2021 (Inker et al., NEJM 2021) and Cockcroft-Gault (Cockcroft & Gault, Nephron 1976), both cited in `domain/modules/gfr.ts`.
