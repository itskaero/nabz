---
target: src/render/screen
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-02T18-10-16Z
slug: src-render-screen
---
# Nabz — Second-Pass Critique: the redesign, weighted toward color & theming

Method: dual-agent (A: design review, second pass vs Aug 30 baseline; B: detector + live contrast evidence, both themes)

## Design Health Score

| # | Heuristic | Score | Delta vs pass 1 | Key Issue |
|---|-----------|-------|---|---|
| 1 | Visibility of System Status | 4/4 | +1 | PatientStrip closes the gap, confirmed live both themes. |
| 2 | Match System / Real World | 3/4 | -1 | Sig-form picker leaks raw i18n keys (sig.injection.im etc.) as button labels. |
| 3 | User Control and Freedom | 3/4 | 0 | Unchanged, not retested. |
| 4 | Consistency and Standards | 2/4 | 0 | Native select outlier persists; .builder-status uses teal styling for both success and error. |
| 5 | Error Prevention | 4/4 | 0 | Untouched, excellent. |
| 6 | Recognition Rather Than Recall | 2/4 | +1 | .topbar-nav auto-scroll verified working; .tabs gets edge-fade only, zero auto-scroll coverage, and overflows too. |
| 7 | Flexibility and Efficiency | 3/4 | 0 | Dark mode is comfort, not power-user flexibility. |
| 8 | Aesthetic and Minimalist Design | 2/4 | 0 | Home gets real 2-col layout at 900px+ but its own cards use identical treatment; .card.emphasis/--fs-xl have zero call sites. |
| 9 | Error Recovery | 4/4 | 0 | Untouched, excellent. |
| 10 | Help and Documentation | 1/4 | 0 | Unchanged. |
| Total | | 28/40 | +1 | Acceptable |

## Design Specificity Verdict

LLM assessment: dark mode is authored, not generated -- --teal held at the same hex in both themes so --on-teal's white-on-solid-fill stays theme-invariant (numerically justified, see below); --alert-wash dark is hand-tuned, not inverted; shadow strategy rewritten for dark. Home reuses the app's own vocabulary. But pass 1's "nothing signals weight" finding is still true and now provable: .card.emphasis and --fs-xl, built to answer it, have zero call sites anywhere.

Deterministic scan: 8 static findings, all side-tab. 7 confirmed false positives (DESIGN.md 8 mandates border as a required non-colour channel, each carries a second channel). One (.builder-status) is a genuine but different issue -- teal/vetted styling regardless of success or failure. Live injection (27 findings) found what static scan couldn't: --ink-faint still measures 2.70-3.1:1 (below AA) on .hint, .ref-note, .empty -- three classes the prior P1 fix never touched. Light-mode-only; invisible once dark mode became the focus.

## Overall Impression

Theming work is genuinely strong -- a real second palette with its own reasoning, verified by a passing 14-test contrast suite. Carry-through from the first critique is uneven: two fixes shipped fully working (PatientStrip, print-stays-light), one shipped half-covered (nav auto-scroll, top strip only), one shipped as unused scaffolding (hierarchy tokens). The top finding this pass is the same --ink-faint-on-real-text pattern the first critique caught, now proven still live on different selectors, with a new contrast suite that doesn't check for it.

## What's Working

1. --on-teal fixed across both themes and numerically justified: 4.95:1 in both, confirmed by direct measurement. A lighter dark-mode teal would have dropped this to ~2.6:1.
2. Print-stays-light invariant confirmed via computed style (background: rgb(255,255,255)) while the app itself sat in dark theme.
3. Bilingual medication row holds up fully in dark mode: 14.44:1 dark / 15.50:1 light, correct Urdu word order, correct bidi-isolated dose numeral.

## Priority Issues

[P1] --ink-faint still fails AA on .hint/.ref-note/.empty, and the new contrast suite doesn't cover it
Why it matters: same defect class the first critique flagged as P1. .ref-note is the dosing-citation line CLAUDE.md 8a requires; .hint covers most Settings explanatory copy. Light-mode-only, invisible once dark mode became the focus; tests/contrast.test.ts doesn't include these classes so CI is green while the defect is live.
Fix: repoint .hint/.ref-note/.empty to --ink-soft; add all three to the contrast suite.
Suggested command: /impeccable harden

[P1] The sig-form picker leaks raw i18n keys as clickable options
Why it matters: sig.injection.im, sig.tapering, sig.weekly and 5 more render verbatim as buttons beside correctly-resolved options, in the highest-stakes modal in the app. Also 18 flat options at once, no grouping.
Fix: find the missing en labels for those template ids in the medicine pack's phrase data; group the picker by route family while there.
Suggested command: /impeccable clarify

[P2] Nav overflow persists at 390px, and the fix only covers half the problem
Why it matters: .topbar-nav gets edge-fade + working auto-scroll. .tabs gets edge-fade only -- own overflow (73px even at full width), nothing scrolls it into view.
Fix: extend the scrollIntoView effect to .tabs; consider an overflow menu for .topbar-nav past 6-7 items.
Suggested command: /impeccable layout

[P2] The hierarchy fix from the last pass shipped as dead code
Why it matters: .card.emphasis and --fs-xl exist to answer "nothing signals what matters more" and have zero call sites. Home's own two cards use the identical undifferentiated treatment as every Settings card.
Fix: apply .card.emphasis to Home's monthly-volume card at minimum, or remove the unused tokens.
Suggested command: /impeccable layout

[P3] The old accent hex survives in the marketing site's own logo assets
Why it matters: docs/assets/favicon.svg, logo.svg, logo-dark.svg, and one inline stroke in docs/index.html still hardcode #0f766e, confirmed independently by both agents, while the surrounding page correctly uses #0f8055.
Fix: regenerate the three SVGs and fix the inline stroke.
Suggested command: /impeccable polish

## Persona Red Flags

Sam (accessibility): dark mode itself is strong and fully tested. --ink-faint was never fixed at the token level, only routed around at specific selectors -- Home's own new bar-chart month labels reintroduce the identical pattern in freshly-shipped code.

Casey (distracted mobile): touch targets now genuinely fixed. Still meets a 7-destination nav strip that doesn't fit at 390px, and section tabs inside an in-progress script now also overflow with no recovery.

Riley (stress tester): the i18n-key leak is exactly Riley's kind of find -- a control that visibly works while displaying broken text.

## Minor Observations

- .builder-status renders identically for a success save and a blocked-with-errors save -- both get the teal/vetted box.
- Dark-mode card boundaries lean more on the re-tuned shadow than a strong lightness step between --bg and --line -- real but subtler than light mode's crisp white-on-grey.
- Settings -> Appearance is well-built: correct aria-pressed state, reassurance line placed exactly where a doctor would worry.
- .card.emphasis/--fs-xl being unused reads as "built ahead of its call sites" rather than neglect -- but only if someone reaches for them before they rot.
