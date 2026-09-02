---
target: src/render/screen
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-30T11-01-50Z
slug: src-render-screen
---
# Nabz — Design Critique: src/render/screen

Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Every clinical module records a result with zero on-screen patient identity. |
| 2 | Match System / Real World | 4/4 | Clinical vocabulary throughout, no translated-tech jargon. |
| 3 | User Control and Freedom | 3/4 | No undo on deletes; sig-editor modal has no Escape handler. |
| 4 | Consistency and Standards | 2/4 | Sex select is the one native control among custom pills; focus styling only defined for text inputs. |
| 5 | Error Prevention | 4/4 | Weekly-only-drug hard stop, library-only red flags, disabled buttons until valid. |
| 6 | Recognition Rather Than Recall | 1/4 | Nav/tab strips overflow at 390px with zero affordance; active Settings button scrolls fully off-screen. |
| 7 | Flexibility and Efficiency | 3/4 | Strong free-text escape hatches; no keyboard shortcuts or bulk actions. |
| 8 | Aesthetic and Minimalist Design | 2/4 | Every card identical; type scale only 9.5-16px; 1280px surface half-empty. |
| 9 | Error Recovery | 4/4 | Excellent, specific error copy with named fallbacks throughout. |
| 10 | Help and Documentation | 1/4 | No help surface anywhere in the app. |
| Total | | 27/40 | Acceptable |

## Design Specificity Verdict

Split verdict: the interaction model (bilingual medication row, three-state chips, tier-1/2/3 advice, "reports a number and stops" modules) is unmistakably authored for this product. The visual execution is category-interchangeable — uniform card treatment everywhere except the medication row. detect.mjs's 8 findings (all `side-tab`/border-left on semantic-colour variables) are confirmed false positives — documented deliberate multi-channel safety signalling per DESIGN.md. Live injection independently confirmed 10 low-contrast hits (3.06-3.1:1, need 4.5:1) on field labels and tab language tags, plus 21 undersized-text hits (9.5-11.5px).

## Overall Impression

The hardest problem (bidi-safe bilingual composition) is solved with real rigor. What's missing is hierarchy elsewhere: every card looks the same, type scale barely moves, and both nav strips silently hide destinations at the primary 390px viewport. Fixing hierarchy, not colour, is the biggest lever on the "generic" complaint.

## What's Working

1. The bilingual medication row: row-locked grid, live composition, correctly bidi-isolated dose token inside RTL Urdu — verified live.
2. Multi-channel safety signalling: chip states differ by prefix, strikethrough, border, and colour together, never colour alone.
3. Honest citation discipline: unverified-pack badges, "confirm before signing" copy, weekly-only-drug hard stop — suggestions never outrank the doctor's authority.

## Priority Issues

**[P0] Clinical modules compute and record results with zero patient identity on screen**
Why it matters: this product treats patient-identity confusion as a first-order safety hazard everywhere else (no auto-carryover, explicit confirm-tap on queue pull) — modules are the one surface that doesn't.
Fix: surface the linked patient's name/age/sex atop every module panel via a compact patient-bar variant.
Suggested command: /impeccable clarify

**[P1] Nav and tab strips overflow with no affordance, hiding the active destination**
Measured at 390px with Internal Medicine + Queue active: nav 387px content in 321px strip, tabs 463px in 390px strip, no fade/arrow/scrollbar hint. Active Settings button scrolls fully off-screen.
Fix: cap strip contents with an overflow menu, or add a real edge-fade + chevron affordance.
Suggested command: /impeccable layout

**[P1] --ink-faint fails contrast on the text it's used for most**
Independently measured at 3.06-3.1:1 (need 4.5:1) on field labels and the tab language tags — the exact text DESIGN.md calls "the product model made visible."
Fix: darken the token or reserve it for true placeholder text; promote labels/tags to --ink-soft (6.29:1).
Suggested command: /impeccable harden

**[P2] Touch targets fall below the 44pt floor across primary controls**
Measured live: nav buttons 55x32px, Add button 56x40px, bottom action bar ~40px tall, most Settings action buttons ~40px, exam/lab chips ~26-29px.
Fix: raise minimum height to 44px on .opt/.mini/nav buttons/bottom bar — padding-only change.
Suggested command: /impeccable adapt

**[P2] Uniform card treatment and flat type hierarchy make everything look interchangeable**
Every section uses identical white surface/1px border/8px radius/shared shadow. Type scale spans only 9.5-16px. At 1280px roughly half the viewport is empty background.
Fix: differentiate card weight by importance, widen the type scale, compose the 1280px surface rather than leaving it empty.
Suggested command: /impeccable layout, then /impeccable typeset

## Persona Red Flags

**Casey (distracted mobile)**: nav/tab overflow is Casey's worst case; touch targets Casey depends on most (nav 55x32, Add 56x40, bottom bar ~40px) measure under 44pt.

**Sam (accessibility)**: --ink-faint ~3:1 on labels/tags confirmed. Keyboard focus trace (18 stops, 1280px) found a visible indicator everywhere — inconsistent styling (default vs custom token), not missing. Sig-editor modal Escape/focus-trap unverified live.

**Riley (stress tester)**: deleting a medication line/advice item/problem is a single unconfirmed tap with no undo or toast.

## Minor Observations

- Device-role tagline hidden below 480px, exactly where a doctor might glance at a borrowed phone.
- Amber warn-box styling appears on nearly every screen; frequency risks dulling the one channel the product needs sharp.
- .mini delete buttons only differentiate on :hover, which never fires on touch.
- Settings copy: 7 over-length lines (~142 chars), 1 all-caps run, 8 em-dashes.
- Zero SVG/icon usage in chrome, one CSS transition total, no prefers-color-scheme, single reused --shadow value.
