# PRODUCT.md — Bilingual Clinical Prescription PWA

> **One of three specs — read all three.** `PRODUCT.md` (this) = what & why.
> `CLAUDE.md` = how to build it. `DESIGN.md` = how it looks & feels.
> Reference prototypes: `rx-app.html` (main app), `rx-pack-builder.html` (companion).
>
> Master product spec. This is the source of truth for what we're building and,
> just as importantly, what we are deliberately NOT building. Read this before
> writing code. When a decision here conflicts with a "clever" idea, this wins
> unless we explicitly revise this file.

---

## 1. One-line definition

A **stateless-server, local-storage-on-device PWA** that lets a private-clinic
doctor write a full clinical prescription (problems, examination, diagnosis,
medications, advice/follow-up) and print a clean, signed document whose
**patient-facing instructions are bilingual (English + Urdu)**.

It is a **prescribing and patient-communication aid the doctor signs** — NOT a
legal e-prescribing system, NOT an EMR, NOT clinical decision support.

**Qualification (added once patient identity became a real entity):** the app
does now hold a patient record and a visible history, because growth tracking is
meaningless without knowing which child is which — two patients named "Ali Khan"
were previously one, and their measurements merged into a chart that read as
faltering. The line that keeps this from becoming an EMR is:

> **Identity may be remembered. Clinical decisions may not be carried.**

Knowing this is the same child as last month is safe. Loading last month's
prescription because of it is not, and remains an explicit manual search and
select. See rule 3.4.

---

## 2. The wedge (the only reason this exists)

Patients don't read or retain "1 tab TID × 5 days." The differentiating feature is
**medication instructions and advice rendered in the patient's own language
(Urdu first)**, printed alongside English, so the patient (or a literate family
member) can actually follow the plan. Everything else must be at least as fast as
the doctor's current Word template, or adoption dies.

**The wedge is Urdu QUALITY, not Urdu existence.** This was originally written as
"the single differentiating feature", and competitive review disproved that:
MyOPD (India) genuinely composes Urdu patient instructions from structured data,
and several Pakistani products advertise "prescriptions in English and Urdu". But
their output is **Naskh**, in telegraphic table cells (`1 صبح، 1 رات`), with no
verb and units left in English — which is "1 tab BD" with the words swapped, i.e.
exactly the thing patients cannot act on. Ours is Nastaʿlīq, an authored sentence
in its own word order, ending in a verb, with pluralised Urdu units and
bidi-isolated doses.

So the claim is not "we do Urdu". It is that the Urdu is correct, in patient
register, and demonstrably so when the two documents are put side by side. §15.1
always identified this as the real risk; this section simply overstated the
claim. (Neither directly-competing Pakistani product — docpk, Clivita — does Urdu
at all.)

**Market:** global-*architecture*, **Pakistan-first launch**. Urdu is locale #1,
not a hardcode. See §6.

---

## 3. Hard product rules (do not violate without revising this file)

1. **Server stores NOTHING clinical.** No clinical data leaves the device, ever.
   A server we operate holds only license/payment state (v2+) — never diagnoses,
   never medications, never examinations, never growth records.
   *Clarification (two-station clinics):* a clinic that runs a reception desk may
   run **its own machine, on its own premises**, holding the CLINIC LAYER only —
   patient identity, the queue, and fees. That machine is the clinic's, not ours,
   and the boundary is enforced twice: the sync client sends only those fields
   and the server whitelists them again independently (`tests/server.test.ts`
   asserts clinical content posted to it is dropped). A **cloud** relay for
   patient identity remains forbidden. Hosting the app itself (e.g. Railway) is a
   web host handing over a bundle and holds nothing.
2. **The library suggests; the doctor decides.** Autocomplete a drug *name*, but
   NEVER silently fill dose/strength/frequency. Every clinical value is
   doctor-confirmed each time.
3. **Never automate judgement.** No diagnosis suggested from problems, no drug
   suggested from diagnosis. We speed up *transcription*, never *decisions*.
4. **Never auto-carry CLINICAL data across patients/encounters.** History refill
   is ALWAYS an explicit manual search + select. Auto-loading a returning
   patient's last script is a wrong-patient medication-error vector — forbidden.
   *Named exception:* the growth module may load ONE confirmed patient's prior
   measurement series after the doctor explicitly opens Growth for that identified
   patient (doctor-initiated, single-series, not silent auto-carry). See §4b.
   *Clarification (clinic queue):* carrying a patient's NAME, AGE and SEX from a
   queue entry into the prescription for that same visit is **within-encounter**
   identity carry and is permitted — it is the paper file walking into the room.
   It is gated behind an explicit confirm naming the patient, because a mis-tap
   on a queue row pre-fills the wrong child and looks correct. Nothing clinical
   crosses with it.
5. **Bilingual output is printed side-by-side / both languages**, never
   Urdu-only for a printed instruction — the English is the safety net that lets
   the doctor/pharmacist catch a bad translation.
6. **The doctor signs on paper.** Print a signature line; do NOT auto-stamp a
   stored signature image (forgery/liability).
7. **Configurable shell, strong paediatric defaults.** Paper size, letterhead,
   languages, exam systems, findings palette, doctor block — all configurable.
   Nothing clinical or locale-specific is hardcoded.
8. **No machine translation of free prose in v1.** Advice is authored
   Urdu-primary by the doctor (see §9), not English-typed-then-translated.

---

## 4. Scope

### v1 (build this)

- Investigations / labs section (§8a), seeded per specialty and editable.
- Five-section prescription: Problems, Examination, Diagnosis, Medications, Advice/Follow-up.
- Locale-keyed **approved phrase library** for medication instructions (`en`, `ur-PK`).
- **Free-text drug entry** with a brand→generic→strength **autocomplete library** (name only auto-filled).
- **Exam findings palette** (tap-chips: present/absent/value) + free text, per system.
- **Local-device storage** (history), manual search/refill, manual encrypted export/import.
- **PDF print** at exact physical dimensions, bilingual, per-doctor letterhead/doctor-block.
- Per-doctor config profile.
- **Pack builder** — the content-authoring surface (`DESIGN.md` §12). Edits the
  content pack and the locale packs, and refuses to export an uncited dose, a
  half-translated phrase, an unsigned red flag, or a generic spelled two ways.
- **Patient identity** — a real record with a generated id, explicit matching and
  merge. Identity only; see §1's qualification.
- **Clinic layer (optional, off by default)** — queue, paid status, one visit fee
  and a day-end total. Explicitly NOT itemised billing: no receipts, no invoices,
  no tax records, and therefore no retention obligations. A prescription app
  first, a clinic system second.
- **Share the printed PDF** via the OS share sheet (which offers WhatsApp). No
  WhatsApp integration, no server, no third party.

### v2+ (explicitly deferred — do NOT build in v1)
- Opt-in **encrypted cloud backup/sync** (this is the paid tier + the durability fix).
- **Per-doctor license-key subscription** (region-based *pricing*, never geo-*locking*).
- Advice mini-library composition beyond free text, if justified by use.

### Never (out of scope by design)
- Legal e-prescribing / controlled-substance compliance across jurisdictions.
- Clinical decision support / interaction checking as a primary feature.
- Auto-translation of arbitrary doctor prose.
- Geo-locking the app's execution.

---

## 4a. Specialty architecture — content packs + modules (LOCKED)

Same discipline as the locale layer: **specialty-ready architecture, paediatrics-first
content.** Global architecture / Pakistan-first content. Specialty-ready seam /
paeds-first content. Identical pattern — the abstraction is cheap now, brutal to
retrofit.

"Specialty" is really THREE things; do not conflate them:

1. **Specialty as content (a `ContentPack`).** Exam systems, findings chips, advice
   tiers 1–2, formulary seed — all *data*, no code. A different specialty = a
   different pack file. The app loads exactly ONE pack; v1 ships one: `paediatrics`,
   authored by the clinician (Ali). Everything specialty-specific reads from the pack;
   NOTHING specialty-specific is a hardcoded constant.
2. **Specialty as module (code + data + computation).** Some specialty features are
   real instruments, not content — e.g. **growth charts** (see §4b). These are
   modules with their own logic, datasets, tests, and sometimes storage exceptions.
3. **Specialty as profile/pricing.** The doctor's specialty is a profile attribute
   selecting the default pack, and later a gate for paid modules.

**Content credibility rule (why paeds-only content in v1):** a clinical tool built on
non-expert content is a liability with your name on it. Author ONLY your own field.
ENT/derm/GP packs come later, authored by a clinician *of that specialty* against this
schema, cited the same way doses are — never guessed by a non-specialist. The
bottleneck was never code (shared); it's expert content (not shareable).

`ContentPack` shape:
`{ id, specialty, examSystems[], findingsPalette{}, advicePacks{ tier1, tier2 },
formularySeed[], modules[] }`

---

## 4b. Growth charts — in v1, SAFETY-CRITICAL module (LOCKED)

Decided: growth is **table-stakes for paediatricians, ships in v1** (a paediatric tool
without growth reads as a toy to the actual audience). Consequence to internalise:
**v1 now contains a safety-critical clinical calculation, not just document
generation.** Growth is the SECOND thing (after Urdu quality) that must be *provably*
correct — a percentile bug misclassifies a malnourished / failing-to-thrive child.

- **A growth chart is NOT a chip — it's a computational instrument.** Inputs
  (weight / length-height / head circumference + age + sex) → **LMS method → z-score →
  percentile**, plotted, and tracked **longitudinally across visits**.
- **Reference dataset = configurable default.** Default **WHO** (openly licensed,
  standard in Pakistan + global health, covers 0–19); allow **CDC** (also public) as an
  option. WHO and CDC genuinely disagree under age 2. **Store which reference produced
  each percentile** — a percentile is meaningless without its curve, same "cite the
  number's source" discipline as dosing.
- **Reference data is embeddable** (unlike the copyrighted drug refs): WHO/CDC LMS
  tables are published for exactly this use. Confirm per source; this is a rare
  free-data case.
- **Longitudinal storage carve-out (named exception to rule 3.4).** Growth tracking
  needs this child's prior points pulled forward — which the no-auto-carry rule forbids
  by default. Resolution mirrors manual refill: the doctor **explicitly opens Growth for
  an identified, confirmed returning patient**, then that ONE measurement series loads.
  It is doctor-initiated retrieval of one confirmed patient's series — NOT silent
  cross-encounter auto-carry. This is an allowed, explicit exception; see rule 3.4.
- **Testing bar:** the LMS→z-score→percentile computation must have a dedicated test
  suite validated against published WHO/CDC reference values. No growth feature ships
  without it.

---

## 5. Architecture

- **Frontend:** React PWA (installable, offline-capable). Play to existing PWA strength.
- **Storage:** on-device (IndexedDB). No server persistence of clinical data.
- **Server (v2 only):** license/payment verification. Holds license keys + payment
  status ONLY. This keeps us non-custodial of health data.
- **Print/PDF:** render a **real fixed-size PDF** (exact A4/Letter mm dimensions)
  and have the doctor print *that*. Do NOT rely on `window.print()` on the live
  DOM — browser/printer scaling silently breaks margins and shrinks Urdu below
  legibility. Preview MUST equal print, and that's only guaranteed via the PDF path.

---

## 6. The language / locale model (core design)

**Reframe:** this is NOT a "bilingual app." It is a **per-section, language-by-
audience app.** Bilingual is simply what the medication section happens to be.

| Section       | Audience                     | Default language      |
|---------------|------------------------------|-----------------------|
| Problems      | doctor / record              | `en`                  |
| Examination   | doctor / record / pharmacist | `en`                  |
| Diagnosis     | doctor / record              | `en`                  |
| Medications   | pharmacist + patient         | `en` + `ur-PK` (both) |
| Advice        | patient                      | `ur-PK` primary + `en`|

- Each section's language is a **render-time flag**, overridable per doctor.
- The stored prescription is **language-neutral structured data**; language is
  chosen at render. Same object → English chart render AND Urdu patient render.
- Locale layer keyed by `locale + string_id`. `en` and `ur-PK` ship first;
  adding `ar`, etc., must be a **data/locale pack**, never a code change.

---

## 7. Phrase-library data model (medication instructions)

**A phrase is a template with typed slots, NOT a fixed string.** This avoids the
combinatorial explosion of "every dose × frequency × timing × duration" sentence.

```json
{
  "id": "sig.oral.liquid.standard",
  "slots": ["dose", "unit", "frequency", "timing", "duration"],
  "templates": {
    "en":    "Take {dose} {unit} {frequency} {timing} for {duration}",
    "ur-PK": "{duration} تک {timing} {frequency} {dose} {unit} لیں"
  }
}
```

Slot values are themselves locale library entries, reused across all drugs:

```json
{
  "frequency": {
    "BID": { "en": "twice daily",        "ur-PK": "دن میں دو بار" },
    "TID": { "en": "three times daily",  "ur-PK": "دن میں تین بار" }
  },
  "timing": {
    "after_food":    { "en": "after food",         "ur-PK": "کھانے کے بعد" },
    "empty_stomach": { "en": "on an empty stomach", "ur-PK": "خالی پیٹ" }
  }
}
```

A stored medication line (structured, language-neutral):

```json
{
  "drug": { "brand": "Amoxil", "generic": "Amoxicillin", "strength": "250mg", "form": "syrup" },
  "sig": {
    "template": "sig.oral.liquid.standard",
    "dose": { "value": 5, "unit": "ml" },
    "frequency": "TID",
    "timing": "after_food",
    "duration": { "value": 5, "unit": "day" }
  }
}
```

### Non-negotiable implementation gotchas (these ARE the wedge)
- **Per-locale templates have their OWN word order.** Urdu is SOV/RTL; the
  duration leads in Urdu, trails in English. NEVER produce Urdu by reversing the
  English skeleton. If you're calling `.reverse()` on words, stop.
- **Number/plural grammar is per-locale.** "1 day" vs "2 days"; Urdu's noun
  behaviour differs again. Duration/dose are `{value, unit}` resolved through a
  per-locale pluralization rule. Bare interpolation → "1 days" → instant loss of trust.
- **Bidi rendering.** Urdu (RTL) lines contain Latin drug names/numerals (LTR):
  "Amoxil 250mg دن میں تین بار". Wrap embedded LTR tokens in bidi isolates /
  explicit `dir` or the "250mg" jumps sides and the dose becomes ambiguous —
  a *safety* bug. Test with real drug names early.
- **Free-text drug still composes:** unknown drug → raw text in `drug`, `sig`
  still works. Degrade gracefully, never block.

---

## 8. Examination — findings palette

Per-system sections (General, CVS, Respiratory, Abdomen, CNS, ENT, … — editable).
Each system: **tap-chips of common findings + free text.**

- A chip is a **stateful control, not a text macro**: states =
  **present / absent / not-tapped**, plus optional **value/modifier** (e.g. "3cm",
  a grade). Tap→present, tap→absent (records the pertinent negative — matters
  medico-legally), tap→clear. Inline field or long-press for the value.
- **Omit unexamined systems**; allow explicit **pertinent negatives** ("no neck
  stiffness") to be recorded as fast as positives. It is NOT "positives-only".
- Palette is **per-system, per-specialty, editable**, and **self-growing** (a
  frequently free-texted finding gets offered as a chip). Ship a strong
  paediatric/general default.
- Exam is **English-only** → chips compose to clean English prose
  ("Abdomen: hepatomegaly 3cm, no splenomegaly"). No translation/bidi here — this
  is the *easy* section precisely because of its language choice.
- **Do NOT extend chips to Diagnosis.** Diagnoses aren't a bounded set and chips
  push click-convenience over judgement. Diagnosis = free text + autocomplete
  from the doctor's OWN history.

---

## 8a. Investigations — the labs section

Same chip control as §8, and the reason it is allowed here when §8 forbids it for
Diagnosis is **boundedness**. Diagnoses are an open set, so a closed list pushes
click-convenience ahead of judgement. A paediatrician's investigation repertoire
is roughly thirty tests with ten covering most days — the same shape as exam
findings. So labs reuse that machinery, and the distinction is written down so
nobody later reads this as a contradiction.

- **English-only, and this is a safety decision, not a scope cut.** A laboratory
  technician reads "CBC". Transliterating a test name would hand the patient a
  slip nobody at the lab can act on. Consequently the section has no locale pack,
  no bidi and no plural rules.
- **Patient-facing instruction about the tests is tier-1 advice** — fasting, when
  to go, bringing the report. That keeps the Urdu in the authored-and-reviewed
  path rather than inventing a second one here (§9).
- **Free text never blocks.** "Serum ceruloplasmin" must type and print.
- A chip carries an optional **qualifier** ("Chest X-ray *PA view*", "Ultrasound
  abdomen *full bladder*") — the same `takesValue` affordance as an exam chip.
- **No third state.** An exam chip records a pertinent negative because that is
  a clinical claim; there is no "pertinently un-ordered" test, and inventing one
  would print "no CBC" on a prescription.
- Palette is **per-specialty, editable and self-growing**, seeded from the
  content pack (§4a) and adjustable in the pack builder. A doctor may hide
  categories they never order from.
- **Placement is a per-doctor setting** — after Diagnosis (default) or after
  Medications. Practice genuinely differs on where "Advised" belongs.

**Explicitly NOT in this section:**

- **No test suggested from a diagnosis.** "Pneumonia → order CXR" is automated
  clinical judgement (rule 3.3) and a decision-support engine, which §9 of
  CLAUDE.md rules out. The palette offers what the specialty commonly orders;
  the doctor decides.
- **No results, reference ranges, or result entry.** That is a laboratory
  information system, and it is what would turn this into the EMR §1 says it is
  not.
- **No lab integrations, e-ordering, prices, or commercial panels** — every one
  of them would put clinical content on a server.

---

## 9. Advice / follow-up (three-tier model)

Audience = patient → needs Urdu. But advice is free-form, so it can't be a closed
library, AND "just type Urdu" fails on speed (doctors type Urdu slowly; the section
that most needs Urdu is the one they'd skip). Resolution = same shape as the drug
formulary: **library accelerates, free text never blocks, nothing unsafe is
auto-generated.** Three tiers:

- **Tier 1 — Composable advice templates (the frequent ~70%).** Common lines are a
  small closed set with a slot, treated exactly like the sig library: pre-approved
  `en` + `ur-PK`, reviewed Urdu, composed with a slot. E.g. "return if fever
  persists beyond {n} days", "complete the full course", "follow up in {n} days",
  "increase fluids". One tap → correct Urdu → instant. Most real advice lives here.
- **Tier 2 — Red-flag / return-precautions (safety-critical subset).** "Return
  immediately if drowsy / not feeding / difficulty breathing" etc. Curated,
  reviewed, tappable. **Free text FORBIDDEN here** — a mistranslated red flag can
  hurt a child, so these must be library-selected, never typed-and-mistranslated.
- **Tier 3 — Free text (the long tail escape hatch).** Doctor types in whichever
  language they're fast in; it prints **as-is in that language, NO machine
  translation.** English in → English out (no worse than status quo, and honest);
  Urdu in → Urdu out. This is how we keep rule 3.8: tier-3 is faithful passthrough,
  never translation, so the unverifiable-AI problem never returns.

**Self-growth:** frequently-typed tier-3 lines become candidates for review and
promotion into tiers 1–2, shrinking the slow-typing path over time.

**Residual to disclose (keep crisp in UI):** tiers 1–2 are *vetted* Urdu; tier-3
free text is the doctor's own words at the doctor's own risk and is NOT covered by
the "approved Urdu" guarantee. Do not let the UI make tier-3 look equally
authoritative.

---

## 10. Print layout (first-class render target, designed around A4 + a bad laser)

Print is NOT styled-div-plus-print-button. Requirements:

- **Paper size setting** (A4 default / Letter) affecting margins + usable height.
- **Letterhead has THREE modes (per-doctor setting), not a toggle:**
  1. **App draws text header** — full doctor block on plain paper.
  2. **App draws header + uploaded logo** — doctor block plus clinic logo image.
  3. **Pre-printed pad — app SUPPRESSES its header** and reserves a configurable
     top zone so it never overprints the physical letterhead.
  The **preview must render whichever mode the doctor chose** (mode 3 shows the
  blank reserved zone), or "preview == print" breaks for pad users.
- **Signature block pinned to page bottom** regardless of content height (short
  scripts must not float the signature mid-page or leave a forgeable blank zone).
- **Keep-together** on every medication row and the sig block
  (`break-inside: avoid`): a drug's English + Urdu must NEVER split across pages.
- **Repeating per-page identity strip**: patient name + date + page X of Y +
  doctor registration on EVERY page — no orphan/anonymous page 2.
- **Bilingual medication layout = row-locked grid** (row height driven by the
  taller language) so English and Urdu for the SAME drug can't drift apart.
  Alternative acceptable design: English clinical block + separate Urdu
  patient-instructions block (two audiences, no cross-column alignment to break).
- **Urdu legibility floor:** minimum point size for the Urdu patient block —
  cheap mono lasers turn small Nastaʿlīq to mud.
- **Embed a proper Nastaʿlīq font** (e.g. Noto Nastaliq Urdu) in the PDF. Verify
  on a real cheap printer, not just on screen / good-printer PDF.
- **No color-only encoding** (mono printers). Use weight/boxes/size for emphasis.
- **Doctor block** = name, qualifications, PMDC/registration (locale-aware field:
  PMDC/GMC/…), clinic, signature line, stamp area. Set once per doctor.

---

## 11. Drug formulary

- **Free-text primary** (doctor never blocked by a missing drug).
- Library is an **accelerator**: autocomplete `brand → (generic strength)`,
  displayed generic-first ("Panadol (Paracetamol 500mg)") to teach generics and
  travel globally.
- **Autocomplete the NAME only.** Dose/strength/frequency are always
  doctor-selected (may offer presets as suggestions, never silent defaults).
- **Seed from real prescribing (~150 drugs)**, grow from usage. Do NOT attempt a
  national formulary on day one — that fantasy kills the project.

---

## 11a. Data sourcing (two separate databases — do NOT conflate)

Two fundamentally different data kinds, from different sources, kept in separate
tables. **Never let commercial-catalogue "dosage" text become clinical dosing.**

### Layer 1 — Catalogue (what brands exist: name, generic, strength, form, price)
- **Authoritative source: DRAP** (Drug Regulatory Authority of Pakistan) public
  database — brand name, dosage form, composition, **registration number**,
  manufacturer. This is the registry of record; store the DRAP reg no. as provenance.
- **Commercial (price/brand-availability/alternates ONLY):** druginfo.pk, dvago.pk,
  Pharmapedia. Use for local price + alternate-brand mapping. **Do NOT import their
  "dosage" fields into prescribing logic** — it's leaflet/marketing-derived, not
  verified evidence.
- **Licensing:** these commercial sites have no open reuse API; scraping them for a
  monetized product is a ToS/legal risk. Seed the catalogue from **DRAP + the ~150
  real brands you actually prescribe**, not a bulk scrape.

### Layer 2 — Dosing evidence (the referenced, both-ages part)
Every dose is authored/verified by a clinician against a recognised reference and
carries a **mandatory citation**. None of the Pakistani commercial sites qualify here.
- **Paediatric:** BNF for Children (BNFC) [gold standard], Nelson / Nelson's Pediatric
  Antimicrobial Therapy, Harriet Lane Handbook, **WHO Model Formulary for Children**,
  **WHO Pocket Book of Hospital Care for Children**, Lexicomp Pediatric & Neonatal.
- **Adult / both ages:** BNF, **WHO Model Formulary / WHO EML**, Lexicomp/Micromedex,
  AMH or AHFS DI.
- **Pakistan context:** WHO EMRO guidance; official national guidelines / EPI schedule
  (verify against the official source, not a third-party site).

### What reconciling against DRAP actually established

DRAP is the registry of record and seeding the catalogue from it is sanctioned
(CLAUDE.md 8a). `scripts/fetch-drap.mjs` does that. Three findings from the real
run, which constrain how its output may be used:

- **DRAP indexes veterinary and human products together, and the search endpoint
  does not say which.** Only the per-product detail page carries
  `Used For: Human`. A bulk import therefore puts animal drugs into a paediatric
  autocomplete — six were caught and filtered in one run of 150 brands.
- **Automated brand matching is not safe enough to assign registration numbers.**
  Measured mismatches: `Curam 457mg/5ml` → Curamin (different brand),
  `Panadol 500mg` → Panadol Night (adds diphenhydramine), `Brufen tablet` →
  Brufen Injection and → Medibrufen (different company), three Augmentin syrups
  → one shared tablet registration. Each was the *only* candidate returned, so
  "one result" is not "the right result".
- Therefore the script **proposes and never decides**: it collects ranked,
  human-use-confirmed candidates and `provenance` flips to `'DRAP'` only when a
  person picks one in the pack builder. This is the same rule the rest of the
  app lives by — the library suggests, the prescriber confirms (rule 3.2).

Scale is the second reason not to import everything: two generics alone returned
2,800 products. Tens of thousands of unranked rows are autocomplete noise to a
doctor with a 200-drug repertoire, and a large bundle to ship offline.

**Under no circumstances may DRAP data reach the `dosing` table.** It is a
registration registry: it records that a product exists, never what dose a child
should receive. DRAP's own disclaimer says the list "cannot be used as a
reference for any purpose". Dosing stays hand-authored and cited.

### Copyright rule for references (INCLUDING owned PDFs)
- BNF/BNFC, Nelson, Harriet Lane, Lexicomp, Micromedex are **copyrighted/licensed.**
  Owning a PDF does NOT permit bulk-copying its tables into the app.
- **Pattern: consult-and-cite, not scrape.** A clinician reads the reference and
  **authors each dosing entry in their own words**, storing source + edition +
  page/section in a `reference` field. Same discipline as the CPSP logbook / Ward
  Round `verifiedNote`. Do NOT bulk-parse a copyrighted PDF into the dosing DB.
- **WHO materials are openly licensed** → the WHO Model Formulary for Children and
  Pocket Book are the references to lean on most, and they suit the Pakistan context.

### Schema consequence
- `formulary` (catalogue) keyed by **brand**; provenance = DRAP reg no.
- `dosing` (evidence) keyed by **generic**; every entry has a mandatory `reference`.
- Join on **generic** so a brand inherits its generic's dosing. This quarantines
  messy commercial catalogue data away from the safety-critical, citable dosing data.
- **A referenced dose surfaces as a CITED SUGGESTION** the doctor confirms
  ("BNFC: 25 mg/kg TID" with source shown) — never a silent auto-fill. The citation
  is both legal cover and a prescriber sanity-check before signing.

---

## 12. Local storage, history, backup

- History lives **on-device (IndexedDB)**. Enables patient recall, repeat-script,
  learned autocomplete — all with zero server.
- **Refill is manual only**: doctor searches + explicitly selects a prior visit.
  Never automatic (see rule 3.4).
- **Durability is the known weakness.** Local storage is evictable/loseable.
  v1 mitigation = **loud, repeated in-app warning** ("records live only on this
  device — back up regularly") + **manual encrypted export/import** (doctor owns
  the backup file; we stay non-custodial).
- Accept as a known v1 cost: some doctors won't back up and will lose data. Fully
  solving this = v2 cloud backup (the paid upgrade). Don't hide the weakness;
  convert it into the upgrade path.

---

## 13. Config layers (keep separate)

- **App defaults:** sensible starting values (A4, bilingual meds on).
- **Per-doctor/clinic profile:** paper, letterhead + offset, logo, doctor block,
  per-section language overrides, exam systems, findings palette. This profile is
  also the natural anchor for the v2 per-doctor license.
- Do NOT merge these into one flat blob — "my clinic's letterhead" and "the app's
  default" live at different layers.

---

## 14. Monetization (v2, deferred)

- **Per-doctor (or per-clinic) license key.** App phones home only to verify an
  active license; unpaid → read-only or refuse-run. License/payment is the ONLY
  server-side data. Still non-custodial of patient data.
- **Region-based pricing** at checkout (a Pakistani and a US doctor can't pay the
  same). Pricing by region — **never geo-lock the app's execution** (fights the
  global goal, defeated by VPN, punishes travellers/diaspora/locums).

---

## 15. The two things most likely to actually kill this (watch continuously)

1. **Urdu quality.** Awkward/stilted Urdu = doctors don't trust it = wedge dead.
   The phrase library must be medically correct, unambiguous, and in natural
   patient-register Urdu. Validate phrasing with real patients/pharmacists, not
   only doctors.
2. **Adoption inertia.** A working Word template is the incumbent. Every non-wedge
   interaction must be at least as fast as it is today, or the doctor bounces.

---

## 16. Guiding principle (the through-line)

**A fast, configurable transcription surface for an expert — not a structured
clinical database.** Free text + smart autocomplete where the expert is fast
(exam free text, diagnosis); structure only where it pays and is safe (the sig
library, the findings chips); configuration not hardcoding for everything
identity/paper/language/specialty; a document whose language follows its audience;
and never, ever automated clinical judgement or automated cross-patient carryover.
