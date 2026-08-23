# DESIGN.md — Design system

> One of three specs. `PRODUCT.md` = what/why. `CLAUDE.md` = how (build). **This =
> how it looks & feels.** Read all three. When visual polish conflicts with a
> `PRODUCT.md` safety rule, safety wins. Reference implementations: `rx-app.html`
> (main app) and `rx-pack-builder.html` (companion), which already embody this system.

---

## 0. The one idea

This is a **clinical safety instrument used at speed by an expert** that also produces
a **document a patient must read.** Two users, two needs, pulling opposite ways:

| | Doctor surface (workspace) | Patient surface (printed doc) |
|---|---|---|
| wants | fast, dense, quiet, unadorned | legible, calm, warm, Urdu-forward |
| feels like | an instrument | something you hand a worried parent |

Every design choice serves one of these two. If it serves neither, cut it. This is the
**two-register** principle and it governs everything below.

---

## 1. Design build-order (each step constrains the next)

1. **Name the job** — instrument + patient document (above).
2. **Base register = clinical light** — near-white, cool grey-green neutrals, near-zero
   decoration. Rejected: cream/serif (editorial, not clinical) and dark/neon (kills
   trust, murders Urdu legibility).
3. **Spend boldness in ONE place** — the **bilingual medication row** (EN+UR locked
   per drug) is the hero, because it's the one thing nothing else does. Everything
   else stays quiet so the row carries the eye. Not a dashboard, not a stat.
4. **Colour means something or isn't used** — three roles only (see §3).
5. **Type carries the bilingual identity** — geometric Latin sans vs flowing
   Nastaʿlīq; the *contrast* is the personality. Clinical values in monospace so a
   number reads as *data* (a legibility-safety property, not decoration).
6. **Input shaped for expert speed** — free text where the expert is fast; chips where
   vocabulary is bounded; structured slots only where safety-critical/composable.
7. **Shift register for the patient** — the printed doc warms and calms; the Urdu
   patient block is larger and gentler. Distinct, but *continuous* (see §7).
8. **Encode safety in >1 channel** — never colour alone (mono printers, colourblind).
9. **Print is a first-class target** — designed, not screen-exported (see §8).

---

## 2. Palette

Clinical-light. Cool, slightly green-shifted neutrals; a single medical accent.

```
--bg:        #eef1f2   app chrome (cool grey-white)
--surface:   #ffffff   work cards
--ink:       #14201f   near-black, green-shifted
--ink-soft:  #55635f   secondary text
--ink-faint: #8a9691   tertiary / placeholders
--line:      #dfe4e3   hairlines
--line-soft: #eceeed   faint dividers

--teal:      #0f766e   ACCENT — actions + "vetted/safe" only
--teal-ink:  #0b5a54   accent text on wash
--teal-wash: #e6f2f0   accent background

--alert:     #b4232a   DANGER — allergy / red-flag ONLY, never decorative
--alert-wash:#fbeceb
--unvetted:  #a8722a   amber — "doctor's own, not vetted" (tier-3)
--warn-wash: #f6eddf
```

Radius 7–8px. Shadow soft and low. No gradients except functional ones.

**Teal is deliberately the "safe" medical accent.** It's disciplined (§3), not
decorative. A more distinctive brand primary is an open option but not required; if
changed, keep it in the clinical register (deep indigo / ink-petrol / desaturated
teal-green), never a warm or playful hue.

---

## 3. Colour discipline (semantic, not paint)

Exactly three roles. Nothing else gets colour.

- **Teal** = interactive actions **and** the "vetted/approved/safe" signal.
- **Amber (`--unvetted`)** = "doctor's own words, not vetted" (advice tier-3).
- **Red (`--alert`)** = danger only: allergy banner, red-flag advice. **Red must never
  be decorative** — so when it appears, the eye trusts it means *danger*.

Everything else is neutral ink. If a thing isn't an action, a safety state, or a
danger, it is grey.

---

## 4. Typography

- **Latin UI + clinical text:** IBM Plex Sans (neutral, fast, data-like).
- **Clinical values (dose, strength, IDs, reg numbers):** IBM Plex Mono. Monospace
  numerals are less mistakable — "7.5" vs "75" — which for a **dose** is a safety
  property. Mono = "this is a precise value," not prose.
- **Urdu:** Noto Nastaliq Urdu (or equivalent Nastaʿlīq face). The Latin-geometric ↔
  Urdu-Nastaʿlīq contrast IS the type personality; don't add a decorative display face.
- **Mono containment:** mono belongs in the clinical/pharmacist-facing zones. Keep it
  OUT of the patient's Urdu prose (which stays pure Nastaʿlīq). The single exception is
  the isolated LTR dose token inside an Urdu line — that's bidi safety isolation (§6),
  not styling.

---

## 5. The hero: bilingual medication row

The signature element. A single card per drug:

- **Header:** brand (semibold) · generic (soft) · strength (mono chip) · delete.
- **Two tracks side by side:** EN (left, LTR) | UR (right, RTL), same drug, same row,
  so they can never drift apart (drug↔instruction correspondence is a safety property).
- **Vetted marker** on the Urdu track (see §8 — glyph + border, not colour alone).
- **Sig-builder chips below:** dose / freq / timing / days — each a tappable slot.
  Filled = teal; empty = dashed. Tapping opens the sig editor.
- **Cited dose hint** under the row when available: "BNFC: 25 mg/kg TID — suggestion,
  confirm before signing." A *suggestion*, never an auto-fill (mirrors PRODUCT rule 4).

The Urdu composes **live** as slots change, with correct SOV/RTL word order (duration
leads, verb trails) — never a word-reversal of English. See CLAUDE.md §4.

---

## 6. Bidi & RTL rules (safety-relevant, not cosmetic)

- Urdu renders RTL; wrap the app/preview regions with correct `dir`.
- **Any LTR token inside an RTL line** (drug name, "7.5 ml", "250mg") must be wrapped in
  a bidi isolate (`unicode-bidi:isolate` / `\u2066…\u2069`) so it can't reorder the
  dose. A misplaced dose is a *safety* bug. Class `.ltr` in the reference app does this.
- Never rely on visual mirroring to convey meaning; structure each locale independently.

---

## 7. Two registers, made continuous (grilling outcome)

The workspace (teal, cool, dense) and the printed document (warm, calm) are two
registers — but the jump must not feel like *a different app*.

- **Do NOT use the cream/beige paper cliché** (`#f4f1ea` etc.) for the patient block —
  it reads as generic-AI aesthetic. **Resolved:** the patient instruction block uses a
  faint in-palette teal-tint (`#f2f7f6`) with a teal left-border — distinct and calmer,
  but visibly the same product's family.
- The preview sheet sits on a soft cool neutral (`#f6f8f8`), not stark white, so
  app→preview is a gradient within one family, not whiplash.
- The patient block is the ONE place warmth and larger Urdu are allowed — it's the
  parent-facing artifact.

---

## 8. Multi-channel safety signalling (grilling outcome — was a real violation)

The **vetted vs unvetted** distinction must NOT be colour-only (mono printers,
colourblind users, and PRODUCT §10's own "no colour-only" print rule).

- **Vetted** (tiers 1–2, sig library): teal + **✓ glyph** + border.
- **Red-flag** (tier-2): red + **! glyph** + border.
- **Doctor's own / unvetted** (tier-3): amber + **✎ glyph** + border.

Colour reinforces; the glyph + border + label carry the meaning without it. Any new
safety state follows this rule: at least one non-colour channel.

---

## 9. Input patterns (shaped for expert speed)

- **Chips, like exam:** investigations. Bounded set, so the chip is right here
  (PRODUCT.md 8a). On the printed sheet the investigations block is a
  CLINICAL-register English block and takes Examination's treatment — it must
  not inherit the patient block's warmth, because a laboratory reads it.
- **Free text + own-history autocomplete:** problems, diagnosis. Diagnosis is
  judgement — NEVER chip-ify it.
- **Findings chips (exam):** per-system, collapsible. A chip is a **stateful control**:
  present → absent → cleared, plus optional value ("3cm"). Present = teal solid + "+ ";
  absent = struck + "− " (records the pertinent negative). Untouched systems collapse
  and drop from output. System header shows a live finding count.
- **Structured slots (sig only):** the one place structure pays and is safe. Slots
  compose the bilingual sentence; editor is a quick modal of tappable options + numeric
  dose/days.
- **Autocomplete suggests the NAME only** (drug), never silently fills a clinical value.
- **Tab badges** show counts (meds, exam findings, advice) so progress is visible.

---

## 10. Print / document design (first-class target)

The printed script is the actual product the patient holds — design it, don't export it.

- **Fixed physical dimensions** (A4 default / Letter), fonts embedded (Nastaʿlīq must
  embed). Preview == print via the real PDF path, not `window.print()` of the DOM.
- **Three letterhead modes** (per-doctor): app-draws-text · app-draws-text+logo ·
  pre-printed-pad (app suppresses its header, reserves a configurable top zone). Preview
  renders the chosen mode (pad mode shows the blank reserved zone).
- **Signature block pinned to page bottom** (no floating mid-page, no forgeable blank).
- **Keep-together** on each medication row — EN+UR never split across a page break.
- **Repeating per-page identity strip:** patient + date + page X/Y + doctor reg — no
  orphan page 2.
- **Bilingual = row-locked grid** (row height = taller language) OR split
  English-clinical / Urdu-patient block. The patient block is the warm, larger-Urdu zone.
- **Urdu legibility floor:** enforce a minimum point size for the patient Urdu (cheap
  mono lasers turn small Nastaʿlīq to mud).
- **No colour-only encoding** anywhere on print (mono printers).

---

## 11. Layout & platform

- **Mobile-first PWA.** Reference frame ~390px. Everything must work one-handed at OPD
  speed. Desktop is a widened version of the same, not a separate design.
- **Exception: the reception station is a desk.** The clinic queue and the pack
  builder are used two-handed, sitting down, scanning twenty rows — so they take
  the width (1200px) rather than the phone frame. The 390px constraint was always
  about one-handed use at OPD speed, which does not apply to either. The doctor's
  own surfaces stay phone-shaped.
- **Section model:** top bar (brand + patient) → segmented section tabs (Problems /
  Exam / Dx / Tests / Meds / Advice, each tagged with its render language) →
  scroll body →
  bottom action bar (Save local · Preview & Print).
- **Language-per-section tags** in tabs (EN, EN·UR, UR·EN) make the audience model
  visible. Keep them.
- **Allergy banner** persistent above the working area (red, always visible).

---

## 12. Companion pack-builder (rx-pack-builder.html)

Same design system, desktop-form layout. Its distinctive job: **enforce spec rules at
authoring time** with the §8 badges — uncited dose → red "no cite" + export blocked;
half-translated phrase → "incomplete" + blocked. Live JSON preview = exactly what the
app imports. It is the visual editor that makes the specialty content-pack architecture
usable by non-coding specialists.

---

## 13. Tone of voice (microcopy)

- Plain, calm, clinical. No exclamation marks, no cheerfulness, no emoji in-product.
- Safety copy is direct: "confirm before signing," "prints as typed — no translation."
- Never imply the app made a clinical decision. It transcribes and composes; the doctor
  decides and signs.

---

## 14. Open design decision (not yet ruled)

- **Base accent:** keep safe medical teal, or move to a distinctive brand primary
  (deep indigo / ink-petrol / desaturated teal-green)? Aesthetic judgement, not a
  correctness issue — either is acceptable if it stays in the clinical register and
  preserves the §3 colour discipline.
