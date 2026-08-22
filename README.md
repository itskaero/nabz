# Nabz

A bilingual clinical prescription PWA. A private-clinic doctor writes the whole
script — problems, examination, diagnosis, medications, advice — and prints a
signed document whose **patient-facing instructions are in English and Urdu**.

Records live on the device. No server holds anything clinical.

The three specs are the source of truth and this README is not one of them:
[`PRODUCT.md`](PRODUCT.md) (what & why) · [`CLAUDE.md`](CLAUDE.md) (how to build)
· [`DESIGN.md`](DESIGN.md) (how it looks & feels).

---

## Getting started

```bash
npm install
npm run assets      # fetch WHO/CDC growth tables + the OFL fonts
npm run dev
```

`npm run assets` is required on a fresh clone — see "Assets are fetched, not
committed" below.

```bash
npm test            # 212 tests
npm run build       # typecheck + production build
npm run preview     # serve the built PWA
```

### Running it as a server

```bash
npm start              # serves the built app and NOTHING else — no data endpoint
npm run start:clinic   # reception station: also shares the queue on the LAN
```

`npm start` is what a host like Railway runs. It hands over the app bundle; every
record lives in the browser on the doctor's device, so a hosted instance holds no
patient data — there is nowhere for it to go.

Clinic mode adds exactly one endpoint, carrying **patients and queue rows only**.
The server whitelists those fields independently of the client, so a client bug
cannot write a prescription onto a shared machine. `tests/server.test.ts` posts
clinical content at a live server and asserts the disk never sees it.

Two more checks write files, so they are not part of `npm test`:

```bash
npm run artifact:pdf      # -> artifacts/sample.pdf   a real script, for a real printer
npm run artifact:visual   # -> artifacts/visual/*.png rasterised pages, to look at the Nastaliq
```

---

## What is here

```
src/
  domain/     pure clinical logic — no React, no DOM, no storage
    sig.ts        structured medication line -> a sentence, per locale
    phrases.ts    locale-pack shape, template grammar, cross-locale validation
    pluralize/    per-locale number grammar
    bidi.ts       LTR-inside-RTL isolation (a safety file, not a formatting one)
    exam.ts       findings-chip state model -> English prose
    advice.ts     the three advice tiers and what the app vouches for
    growth/       LMS -> z-score -> percentile
    pack.ts       ContentPack + the "no dose without a citation" validator
  data/       content: locale packs, formulary seed, dosing seed, paeds pack,
              growth tables (generated)
  config/     appDefaults (shipped) and doctorProfile (per-doctor) — kept apart
  storage/    IndexedDB + encrypted export/import
  render/
    text/     HarfBuzz shaping + bidi line layout
    pdf/      page model, document layout, PDF and SVG backends
    screen/   the React app
      builder/  the pack builder — content authoring + its refusals
  app/        PWA entry
```

---

## Three decisions worth knowing before you read the code

### 1. Text is shaped by HarfBuzz and drawn as outlines

The obvious build is pdf-lib + fontkit with Noto Nastaliq Urdu embedded. It does
not work: fontkit throws on that font's GPOS anchors (`Cannot read properties of
null (reading 'xCoordinate')`), and does the same on every Nastaliq face tried.
Naskh Arabic faces shape fine — which is the trap, because the pipeline would
look healthy while printing Urdu in the wrong script.

So `render/text/engine.ts` shapes with HarfBuzz (the engine browsers use) and
emits glyph outlines. The PDF backend and the on-screen preview draw the *same*
outlines at the *same* coordinates, which makes "preview == print" structural
rather than aspirational. The cost, accepted deliberately: text in the PDF is not
selectable. The delivery format is paper handed to a parent.

### 2. Assets are fetched, not committed

`npm run assets` pulls:

- **Growth tables** — WHO Child Growth Standards (0–5y) and WHO Growth Reference
  (5–19y) from WHO's own reference implementations, plus CDC 2000 from NCHS.
  ~17,000 LMS rows, stored with the source URL for every range. A percentile bug
  is a clinical-safety bug, so nobody types these by hand and nobody edits the
  generated file.
- **Fonts** — Noto Nastaliq Urdu, IBM Plex Sans, IBM Plex Mono (all SIL OFL 1.1),
  with a manifest of sizes and hashes.

If they are missing, the growth module refuses to compute and the renderer
refuses to draw. Both fail loudly. Neither falls back.

### 3. The pack builder edits content; the app refuses to run bad content

Settings → *Open the pack builder* edits everything specialty-specific: the drug
catalogue, the cited dosing, the EN/ur-PK phrase library, the advice tiers and
the exam chips. It is a route in this app, lazy-loaded, and it needs no server —
a pack holds no patient data, which is why its export is plain shareable JSON
while a records backup is encrypted.

Its real job is refusing. Export is blocked on an uncited dose, a DRAP claim
with no registration number, a phrase written in one language and not the other,
locales whose slot sets have drifted apart, an unsigned red flag, or one generic
spelled two ways. Those are the failures that reach a patient without anything
on the printed script looking wrong.

Edited content lives in IndexedDB and overrides the shipped packs — but only if
it validates. If it does not, the app runs on the shipped packs and says so
rather than degrading quietly (`src/data/provider.ts`).

Two details worth knowing:

- **Generic names are derived, not sourced.** The join from `formulary` to
  `dosing` is on `generic`, so a typo silently returns no dose. Autocomplete
  comes from the pack's own ~100 generics and an edit-distance check blocks a
  near-duplicate. An external list was considered and rejected: DRAP has no bulk
  download, the WHO EMLc publication is CC BY-NC-SA (non-commercial, conflicting
  with the v2 paid tier), and RxNorm is online-only against an offline-first app.
- **Red flags need a named sign-off.** Tier 2 is library-only because a
  mistranslated return precaution can hurt a child, and no validator can catch a
  *wrong* translation — only a missing one. So a red flag carries what a dose
  carries: a person, on a date, saying they read it. Editing the wording clears
  the signature.

### 4. Two layers, and only one of them can ever be shared

| Layer | Holds | Lives |
|---|---|---|
| **Clinic** | patients, queue, paid status, visit fee | shared when a clinic runs two stations |
| **Clinical** | prescriptions, growth, examination, learned vocabulary | always the doctor's device |

A receptionist cannot read clinical content because **it is not on their
machine** — a boundary enforced by which data exists rather than by a permission
flag. It is also what keeps rule 3.1 literally true: a shared box holds a name
and a paid flag, never a diagnosis.

Solo mode is the degenerate case: both layers on one machine, nothing syncs,
identical code path. The clinic layer is off by default and a doctor working
alone never meets it.

### 5. Two databases, joined on generic

`formulary` is the catalogue (brand → generic, strength, form) and `dosing` is
the evidence (generic → mg/kg, with a **mandatory citation**). They are separate
tables so commercial catalogue data can never become prescribing evidence. A test
fails the build if any dosing row has an empty `reference`.

---

## Status of the shipped content

The code is complete; three pieces of **content** need a clinician before this
goes near a patient.

- **`src/data/formulary/seed.ts`** — ~150 real Pakistani paediatric brands, all
  marked `provenance: 'manual'` with no DRAP registration number. This is a
  starting vocabulary for name-autocomplete, not a verified extract of the DRAP
  registry. Reconcile each row against DRAP before clinical use; the validator
  refuses any row claiming `'DRAP'` provenance without a registration number.
- **`src/data/dosing/seed.ts`** — ten entries, drawn only from WHO's openly
  licensed paediatric guidance, every one marked `verified: false` and labelled
  as unverified in the UI. They exist to prove the citation pipeline end to end.
  The pack author authors and verifies the real ones.
- **`src/data/phrases/ur-PK.ts`** — plain patient-register Urdu, but PRODUCT.md
  §15 is explicit that the validators are real patients and pharmacists, not the
  person who wrote the code. Treat it as a first draft awaiting that pass.

No non-paediatric content pack is shipped, on purpose. The schema is open; the
content is not ours to write.

---

## What is deliberately absent

No cloud sync, no accounts, no licence enforcement (all v2). No interaction
checker. No auto-translation anywhere. No geo-locking. No national formulary. No
chips on diagnosis. No bulk-parsing of copyrighted reference PDFs.

And two rules the code structure enforces rather than documents: nothing loads a
prior prescription by matching a patient, and the app never fills a clinical
value the doctor did not choose.

**Known spec gap:** the pack builder is specified in `DESIGN.md` §12 but is not
scoped anywhere in `PRODUCT.md` §4 — not v1, not v2+, not Never. It is built and
shipping regardless; `PRODUCT.md` should say where it belongs.
