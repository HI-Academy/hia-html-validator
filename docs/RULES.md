# Detailed validation rules

For a single procedure connecting these rules to fonts, scope, repairs and
before/after evidence, use [Reproducible validation and repair](VALIDATE_AND_FIX.md).

## General lesson content contracts

The following rules use shared component selectors or explicit declarations,
never chapter names, slide IDs, page numbers or lesson wording. Defaults target
HI Academy lessons; general HTML disables `contentQuality` by default.

| Concern | Rule |
|---|---|
| Content outside its question/solution panel | B35-LAYOUT-004 |
| Content crosses an unrelated panel | B35-LAYOUT-005 |
| Large answer panel uses only a small top region | Existing B35-COMPOSITION-001: low occupancy / excessive bottom whitespace |
| Wrong role-specific font, including numerator/denominator variables | B35-TYPE-002 |
| Inconsistent role sizes across pages | B35-TYPE-001 |
| Sentence prose versus inline mathematics has a regular/bold emphasis mismatch | B35-TYPE-003 |
| Approved question and explanation font-family/weight roles | B35-TYPE-004 |
| Inline maths displaced from prose or separated by excessive gaps | B35-TYPE-005 |
| Large gaps between method panels and a summary; short callout endings; watermark clutter | B35-COMPOSITION-003/004/005 |
| Explanation visible before required working is ready | B35-REVEAL-002 |
| Fragile radical construction / declared SVG bounds | B35-MATH-020, with B35-MATH-019 optical review |

Configure `complementaryChecks.contentQuality` with `enabled`, `tolerancePx`,
`panelSelectors`, `mathSelectors`, `mathFontFamily`, `proseSelectors`,
`proseFontFamily`, and `revealDependencies`. Lesson typography uses Nunito for
question prose, hints and notes, and STIX Two Math for complete mathematical
expressions, worked solutions and answers. Inline expressions may use the math
face without changing the surrounding prose. Both settings remain configurable;
this is the HI Academy lesson default, not a universal font requirement. `B35-TYPE-002` checks
computed primary declarations on visible text, including MathML fraction tokens.
Actual glyph fallback is not verified. Decorative labels, script-size tokens and
generated radical SVG text are excluded. Use `data-b35-allow-font-family` for a
documented variation.

Panel checks use rendered content bounds (text ranges, canvas metrics, MathML
and graphic boxes), with tolerance in slide design pixels. Ancestor/descendant
panels are not treated as unrelated overlaps. Intentional overlays may declare
`data-b35-allow-content-overlap`. These warning heuristics are not pixel-perfect
collision detection; bounding-box whitespace and complex diagrams need review.

Reveal dependencies are explicit to avoid guessing pedagogical intent from
English wording. For example, an explanation with `data-b35-after="#result"`
must not be visible until the element `#result` is visible on the same slide.
Alternatively configure `{ "selector": ".explanation", "after": ".working",
"requireComplete": true }` to require all descendant reveal elements of the
working container to be visible. Missing/invalid prerequisite selectors also
report. Exceptions may use `data-b35-allow-reveal-order`. Unannotated semantic
teaching order still needs review.

Severities: `contentPanelBoundsSeverity`, `contentPanelOverlapSeverity`, and
`requiredFontFamilySeverity` default to warning; `revealDependencySeverity`
defaults to error. These contracts run at each visited state; composition
occupancy is intentionally final-state only, so hidden answers are not penalised.

## Sentence and inline mathematics typography — B35-TYPE-002 / B35-TYPE-003

Lesson defaults enable `complementaryChecks.proseTypography` across question,
practice-question, worked-solution, hint and note roles. General HTML defaults leave it disabled;
it can be explicitly enabled. `selectors`, prose `fontFamily` (Nunito by default)
and `minimumWeightDifference` (200) are configurable.

`B35-TYPE-002` additionally reports sentence-like English text in configured
Nunito roles that declares the wrong primary font (`sentence-prose-font-family`).
Worked-solution English prose uses a separate Nunito 800–900 role contract;
mathematical expressions in those solutions use STIX Two Math 400. Hints and
notes remain Nunito. Mathematical renderers, explicit equations, labels and
structural scripts are excluded from the generic prose-family comparison. An
English word heuristic distinguishes prose from short equations; unfamiliar
notation, non-English prose and prose incorrectly authored inside a math renderer
still need review.

`B35-TYPE-003` reports a review-required regular/bold contrast between prose and
embedded base mathematics in the same role. A configured `allowedInlineMathPairs`
entry explicitly permits a reviewed font/weight combination (the lesson default
allows Nunito 800 or 900 prose with STIX Two Math 400 notation). Other pairs are compared
by numeric CSS weights
(regular <=500 versus bold >=600 with the configured minimum difference), not
actual glyph strokes. Different prose/math families are permitted; identical CSS
weights do not certify optical harmony. Exponent/subscript/index tokens, labels
and hidden reveals are excluded. An inline `data-b35-formula` wrapper does not
remove the surrounding sentence comparison. Symbol approvals for B35-MATH-019
cannot waive this rule. `policy.inlineMathContrastSeverity` defaults to warning.

Findings provide selectors, text samples, font/weight evidence, repair guidance,
verification and limitations. Keep complete mathematical expressions coherent;
do not make all prose mathematical, shrink structural fractions, or blindly force
math glyphs bold. Inspect normal-size and enlarged output after repairs. A
documented intentional font comparison may use
`data-b35-allow-prose-typography`; this is not an automatic visual approval.

## Approved lesson font roles — B35-TYPE-004

The reusable lesson defaults in `complementaryChecks.proseTypography.roleContracts`
require question prose (`.prompt`, `.practice-question` or an explicit question
role) to use **Nunito 900**, and mathematical base tokens inside those questions
to use **STIX Two Math 400**. Worked-solution/explanation English text and answer
prose use **Nunito 800–900**, while complete mathematical expressions within them
use **STIX Two Math 400**; hints and notes use **Nunito 800**. Labels
remain separate interface roles. Role sizes follow the measured CH08 hierarchy:
questions 14–18px, worked steps and working 18px, practice answers 14px,
display formulas 26px, hints 12–13px and notes 16px.
The shared typography is an HI Academy design default,
not a universal font requirement or page-specific exception. Each contract's
selector, family and weight are editable.
The existing proseTypography switch is lesson-only by default.

`B35-TYPE-004` checks computed primary family and configured numeric CSS weight range on
visible text. It checks inline math even in `data-b35-formula` wrappers and in
math-only questions. It excludes labels and structural exponent/subscript/index
tokens, preserves fraction sizing, and resolves nested roles to their nearest
owner. Pure equation rows in solution panels are not explanation prose. English
prose recognition has the same limits as B35-TYPE-002. Renderer-specific or
unmarked mathematics may need explicit annotation and manual review.

Findings include the expected role, family and weight, actual token measurements,
location and repair/verification guidance. `policy.roleTypographySeverity` defaults
to warning. A documented `data-b35-allow-prose-typography` comparison is respected;
symbol-stroke approvals do not waive this separate contract. Passing computed
styles does not prove the intended font loaded, actual bold glyphs exist, or
that glyph strokes are optically harmonious. Review actual rendering at lesson
size and enlarged resolution; never change operands, shrink fractions or convert
all explanatory prose into mathematics to obtain a pass.

## Content font-size hierarchy — B35-TYPE-001

Lesson defaults enforce design CSS pixel sizes: heading 18, question 14–18,
worked steps and work 18, practice answers 14, display formulas 26,
explanation/instructions 18, notes/checks 16, diagram labels 14–16, citations
11. These defaults target the 960×540 lesson system. Scaling a
slide does not change its design-size requirement. General HTML disables this
lesson-specific policy by default.

Configure `complementaryChecks.typographyHierarchy`: `enabled`, `tolerancePx`
(default 0.5), and `roles` entries with `name`, `selector`, `sizePx` or
`minimumPx`/`maximumPx`. Arrays replace defaults. Severity is configured through
`policy.typographyHierarchySeverity` (default warning). Explicit
`data-b35-content-role` wins over inferred roles; otherwise the first matching
configured role wins. `.eq` takes precedence over `.step-solution`.

The audit checks visible direct base text and descendants, excluding nested
roles, fraction parts, superscripts, subscripts, radical indices, UI tags and
watermarks. SVG radical text is excluded because its viewBox uses different
coordinate units. Arbitrary graphics need review. A documented intentional
exception may use `data-b35-allow-type-size` on its container. No lesson is edited
automatically. Resize or restructure crowded content and recheck bounds; never
shrink maths merely to remove overflow. This checks computed base size, not
optical glyph height or actual font fallback.

Lesson defaults also set `typographyHierarchy.inlineMathMaximumFontRatio` to
**1.05**. Inline mathematical islands in question, solution, answer, hint and
note prose must stay within 5% of the surrounding text's base size. This catches
MathML display-style defaults that make inline digits visibly larger than the
sentence. Structural numerator/denominator, root indices and superscripts are
not independently constrained; standalone equations use their own role size.

`typographyHierarchy.questionPartsMaximumFontRatio` (default **1.05**) checks
letter-labelled descendants such as `(a)` and `(b)` against their enclosing
question stem. A part more than 5% larger than the stem receives a `B35-TYPE-001`
finding with the measured child/stem ratio and the exact affected element. This
relative hierarchy check supplements the absolute question-size role; it is not
a blanket selector for every nested span. A documented
`data-b35-allow-type-size` exception on the question owner suppresses the check.

## Radical construction — B35-MATH-020

Split HTML `.root` components containing `.root-mark` or `.radicand` receive a
construction warning: independently aligned glyphs and CSS borders need review.
SVG radicals marked `data-b35-diagram="radical"` must identify the sign path with
`data-b35-radical-sign` and radicand text with `data-b35-radicand`. Their rendered
boxes are checked for radicands extending above the sign, beyond the bar,
or outside the SVG. Text descenders may extend below the hook when they remain
inside the SVG. Missing markers also warn.

Configure `complementaryChecks.symbolRendering.radicalGeometryEnabled` (default
true), `thresholds.radicalGeometryTolerancePx` (default 2), and
`policy.radicalGeometrySeverity` (default warning). An intentional construction
comparison may use `data-b35-allow-radical-variation` with a documented reason.
This heuristic does not measure screenshot pixels, hook/bar connectivity or
optical stroke balance, and does not certify native MathML. Review the complete
expression after fonts settle; existing B35-MATH-019 review gates remain active.

For installation and everyday use, start with [README.md](../README.md). LLM assistants should also read [AGENTS.md](../AGENTS.md).

**Installable terminal package (v1.6.1):** see [installation and command-line guide](CLI_GUIDE.md). Run `hia-html-validator file.html`; auto mode selects the existing B35 lesson checks or a bounded general-HTML profile. Reports remain diagnostic, not automatic visual approval. The direct commands below retain the original lesson-only entry point.

This package converts the automated parts of **B35. Manual lesson-compaction acceptance record** into repeatable checks for self-contained HTML lesson decks.

It deliberately does **not** claim that automation completes B35. Source fidelity, mathematical correctness, teaching purpose, page economy and final visual judgment remain manual yes/no gates. A deck can receive an automated pass while its overall B35 status remains `MANUAL REVIEW REQUIRED`.

## Run

```bash
npm install
npx playwright install chromium
npm run validate -- /absolute/path/to/lesson.html \
  --config ./config/b35.rules.json \
  --out ./results/lesson-name
```

For a source-only preflight, which does not render the deck:

```bash
npm run validate -- /absolute/path/to/lesson.html \
  --config ./config/b35.rules.json \
  --out ./results/lesson-name-static \
  --static-only
```

The browser run creates:

- `report.json` — machine-readable findings and evidence.
- `report.md` — concise audit report and B35 manual checklist.
- `visual-review.html` — initial/middle/final reveal gallery with manual checkboxes.
- `screenshots/` — rendered evidence used by the gallery.

The process exits with:

- `0` — automated checks passed; manual B35 review is still required.
- `1` — one or more automated errors were found.
- `2` — the browser stage could not run or the command was invalid.

## Text on coloured cards — B35-CONTRAST-001 / 002 / 003

All visible direct text is inspected, including plain `div`, `span`, `b`, labels,
and MathML tokens. This is not limited to known component classes. Each nested
card uses its own CSS background, not the outer task card's colour. Transparent
backgrounds, text alpha and ancestor group opacity are composited against their
ancestors. The current lesson page is checked on every visited reveal; document
mode checks its current visible body. Hidden/revealed-later text is checked only
when visible; configured decorative watermark selectors are excluded.

Default pairing guidance (not an arbitrary colour-name whitelist):

| Card background | Suggested text |
|---|---|
| Navy `#1A2B5F` | White `#FFFFFF` |
| Pale blue `#D9F7FF` | Navy `#1A2B5F` or slate `#1E293B` |
| Pale yellow `#FFF3BF` | Navy or slate, not inherited white |
| Pale green `#DCFCE7` | Navy or slate, not inherited white |
| Pale orange `#FFF0D6` | Navy or slate, not inherited white |
| Saturated teal, green, purple, orange, or custom colour | Measure the actual pair; white is not automatically valid |

The configured minima are normally **4.5:1**, or **3:1** for large text (at least
24 CSS px regular, or 18⅔ CSS px and weight 700+). These use the
[WCAG contrast-minimum definition](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
as a legibility metric, not a claim of full WCAG certification. A near-threshold
failure is not rounded up to a pass. Existing `thresholds.minimumContrastNormal`
and `thresholds.minimumContrastLarge` remain configurable.

`B35-CONTRAST-002` defaults to **error** through
`policy.cardTextContrastSeverity`. Non-card text keeps `B35-CONTRAST-001` and
`policy.contrastSeverity`. Findings include the exact text/background selectors,
computed effective RGB colours, unrounded ratio, threshold, font size/weight,
and passing navy/slate/white alternatives when available after compositing.
Recommendations may be empty when opacity prevents these alternatives passing.

SVG paint order, gradients/images, background-clipped text, filters/blends and
unsupported CSS colour spaces instead produce **review-required**
`B35-CONTRAST-003` (`policy.contrastReviewSeverity`). No screenshot pixels are
sampled. Pseudo-elements, sibling overlays, images of text, clipping geometry,
anti-aliasing and optical readability still need visual inspection. An opaque
inner card can mask an outer gradient, but an unresolved painted background must
not be claimed safe. This is not an accessibility suite.

`textContrast.enabled` controls this audit; `textContrast.decorativeSelectors`
defaults to `.hi-wm,.watermark,.watermark-text`. Do not add teaching text to this
list to clear failures. Tests: `node tests/test-text-contrast.cjs` and `npm test`.

## Question before answer — B35-ORDER-002 / B35-ORDER-003

### Shared numeric reveal beats

Several elements may share one `data-step`, including a diagram and its label
in different columns. Runtime state uses the authored step counter when present,
or the highest visible positive `data-step` otherwise; it never equates visible
element count with the number of elapsed teaching beats. Counter maxima must
match declared groups, and visible future groups still report an error.

For intentional cross-column source order (for example `1,2` in one column and
`1,2,3` in another), declare `data-b35-reveal-sequence="numeric-groups"` on that
slide. This explicitly specifies temporal order by number rather than DOM order.
Positive integer and contiguous-step checks, observed visibility, navigation,
question-before-answer and answer-reset checks remain enabled. Unannotated
descending DOM order remains an error. This does not certify teaching intent.
Regression coverage is in `tests/test-grouped-reveals.cjs` and `npm test`.

Lesson mode recognises `.p-q` / `.p-a` and `.et-q` / `.et-a` inside their
corresponding cards, plus configured question/answer selectors. A shared
`data-step` parent does not create an attempt state: each element's earliest
declared reveal is the maximum step on itself and its ancestors. A later
answer step, or an independently hidden answer observed after its question,
is required. Actual visibility is also checked at every forward state, so
CSS that exposes a nominally later answer cannot pass on step numbers alone.

Use `data-role="answer"` to identify answer conclusions in diagrams/callouts.
For sibling panels, give the question an `id` and the answer
`data-b35-question-ref="that-id"`. Otherwise only an unambiguous single
question in a configured card is paired. Definitions, unpaired demonstration
text and arbitrary words such as “longest” are not guessed to be answers;
unmarked conclusions and multi-question wrappers need manual review or
explicit markup. A correct answer's mathematical truth is not checked here.

After forward traversal, the runner exercises available previous-page
controls (or ArrowLeft) and compares answers hidden on first entry with both
immediate and animation-settled visibility on return. Retained answers and
visible fade-outs are errors. `answerSequenceCoverage` and the Markdown
report record compared answers, visited pages, unavailable navigation and
pages not revisited. The final forward page is not automatically revisited;
asynchronous navigation may provide settled evidence only. These limits are
not silently reported as a fully checked reset, and this is DOM visibility,
not frame-by-frame screenshot analysis.

`answerSequence.enabled` and `.reentry` default to true in lesson mode.
`answers`, `questions` and `containers` configure the bounded structural
selectors; `policy.answerSequenceSeverity` defaults to `error`. General HTML
mode does not traverse a lesson or run these checks. Synthetic positive,
negative, display-based, independent-gate and reset regressions run with
`npm run test:answers` and are included in `npm test`. The validator does not
edit inputs or fabricate reviewer approvals.

## Rules derived from B35

| Rule | What it checks | Gate |
|---|---|---|
| `B35-SOURCE-001` | Required lesson shell and unique IDs | Automated |
| `B35-SOURCE-002` | Every inline script parses | Automated |
| `B35-REVEAL-001` | Reveal steps are positive, contiguous and DOM-ordered | Automated |
| `B35-PAGE-001` | Source-only standalone answer-page compaction candidate | Review warning |
| `B35-PAGE-002` | Adjacent question-only page duplicates the worked page's initial state without detected unique first-page material | Cross-page review warning |
| `B35-PAGE-003` | Prefer a single page with hidden solution for one repeated worked example; generic keep-page markers do not waive review | Cross-page review warning |
| `B35-CONTENT-002` | Teacher-only reveal, pacing or delivery directions leak into reusable student HTML | Text/metadata review warning |
| `B35-CONTENT-003` | Potential learner-specific titles, metadata, references or named word-problem actors | Text/metadata review warning |
| `B35-LAYOUT-006` | Consecutive lettered question tasks need explicit line breaks or separate block rows | Rendered-authoring review warning |
| `B35-RUNTIME-001` | Exactly one active slide; navigator counter and step counter are correct | Automated |
| `B35-CANVAS-001` | Slide/panel overflow, clipping and internal scrolling | Automated |
| `B35-CANVAS-002` | Visible panels remain inside all four slide edges | Automated |
| `B35-CANVAS-003` | Navigator does not cover visible teaching content | Automated |
| `B35-CANVAS-004` | Unexpected sibling-panel collisions | Automated |
| `B35-CANVAS-005` | Mostly-empty large cards and isolated short lines | Heuristic warning |
| `B35-ORDER-001` | No answer element is visible at the initial reveal | Automated |
| `B35-ORDER-002` | Identified question/answer pairs need a distinct question-only state, including shared revealing parents | Automated bounded structure/visibility check |
| `B35-ORDER-003` | Previously hidden answers must reset on available previous-page navigation, without a visible fade-out | DOM visibility check; explicit coverage limits |
| `B35-ORDER-004` | Content boxes reveal in visual reading order: top to bottom, then left to right within a row | Rendered sequencing review warning |
| `B35-TASK-001` | Semantically marked student-attempt cards use dark treatment; numbered task cards also have a numeric chip | Automated |
| `B35-TASK-002` | Question and answer treatment remains distinguishable | Automated |
| `B35-MATH-001` | No legacy `.frac` remains after runtime transformation | Automated |
| `B35-MATH-002` | Formula/fraction/root boxes have non-zero readable geometry | Automated |
| `B35-MATH-003` | Math and diagram typography meets configured size thresholds | Heuristic warning |
| `B35-MATH-004` | Math ink extends beyond a visible-overflow line box; inspect collision/clipping in context | Heuristic warning |
| `B35-MATH-005` | SVG formula tokens overlap, or a fraction bar is displaced from a neighbouring equals-sign axis | Collision error; axis warning |
| `B35-MATH-006` | Different computed font families within a formula, including ordinary digits beside a rendered fraction, between its numerator/denominator, or across related formula rows | Review warning |
| `B35-MATH-007` | Base formula font sizes differ beyond a configured ratio | Review warning |
| `B35-MATH-008` | Slash, Unicode, CSS and MathML fraction styles are mixed within one formula | Review warning |
| `B35-MATH-009` | Percentage glyphs or number-to-percent spacing vary in one formula | Review warning |
| `B35-MATH-010` | Raw caret powers or mixed Unicode/semantic power notation | Review warning |
| `B35-MATH-011` | Empty/malformed fractions or visible math-renderer error output | Automated error |
| `B35-MATH-012` | Formula ink extends beyond an ancestor that clips or scrolls its content | Automated error |
| `B35-MATH-013` | Ink from adjacent br-separated equation lines collides or has insufficient clearance | Error for collisions; warning for tight spacing |
| `B35-MATH-014` | Fraction numeric glyph boxes are too small, disproportionate to surrounding digits, or inconsistent with peer fractions | Review warning |
| `B35-MATH-022` | Inline radicals have excessive vertical wrapper padding relative to their surrounding prose | Review warning |
| `B35-LAYOUT-007` | Teaching columns or working stack do not start at the shared top anchor | Review warning |
| `B35-LAYOUT-008` | Question/working frames move or resize between settled reveal states | Review warning |
| `B35-LAYOUT-009` | Same-family pages use inconsistent teaching frame positions or dimensions | Review warning |
| `B35-MATH-015` | A formula soft-wraps across rendered lines without explicit equation-row boundaries | Review warning |
| `B35-MATH-016` | Comparable equation base tokens mix regular and bold weights, including MathML radicals/fractions and SVG text | Review warning |
| `B35-MATH-017` | A standalone teaching equation is consistently too small, even if its left/right font sizes match | Configurable readability warning |
| `B35-MATH-018` | A standalone equation is split across HTML/renderer fragments, or is not wholly in the configured complete renderer (MathML by default) | Authoring-contract review warning |
| `B35-MATH-019` | Radical/fraction-bar strokes lack current visual-review evidence, or an inspectable SVG stroke violates its declared range | Review-required warning; not pixel certification |
| `B35-MATH-021` | Decimal-looking split tokens, terminal fraction punctuation, or an operator-free trailing three-digit group make numeric grouping ambiguous | Review warning; compare with source, never auto-concatenate operands |
| `B35-LAYOUT-001` | Matching comparison cards have inconsistent edges/heights, corresponding equation rows, role positions or formula typography | Review warning |
| `B35-LAYOUT-002` | Corresponding card footers, including plain text, differ in base font, size, weight, line-height or padding | Measured-style warning |
| `B35-LAYOUT-003` | Footer heights/insets differ, or content is not centred under an explicit alignment contract | Geometry/estimated-content warning |
| `B35-DIAGRAM-001` | Declared fraction-bar geometry/labels contradict the model; also reviews narrowly inferred labelled bars | Declared model error; inferred review warning |
| `B35-DIAGRAM-002` | Nested rectangles contradict declared percentages, or inferred labels suggest an ambiguous area representation | Declared model error; inferred review warning |
| `B35-DIAGRAM-004` | An explicitly declared added-percentage segment has the wrong reference-length ratio or adjoining geometry | Declared model error; no label/intent inference |
| `B35-DIAGRAM-003` | A diagram label is detached from its target without a verified connector, or a reference is missing | Review warning |
| `B35-CONTENT-001` | A configured answer concept is absent from selected visible premises/context | Bounded-vocabulary review warning |
| `B35-COMPOSITION-001` | Large panels have low content occupancy or columns leave substantial unused height | Final-state review warning |
| `B35-COMPOSITION-002` | Related panels have very different densities, or adjacent teaching blocks have insufficient clearance | Final-state review warning |
| `B35-COMPOSITION-003` | Horizontally overlapping teaching blocks leave excessive vertical space | Final-state review warning |
| `B35-COMPOSITION-004` | A callout soft-wraps to a very short final line | Final-state review warning |
| `B35-COMPOSITION-005` | Watermark text geometrically intersects several teaching elements at reviewable opacity | Review warning; pixels/occlusion unverified |
| `B35-TYPE-005` | Inline mathematical base tokens have a displaced estimated baseline or excessive surrounding spacing | Review warning |
| `B35-SVG-001` | SVG has a `viewBox` and non-zero geometry; accessible-name check is optional and off by default | Automated |
| `B35-CONTRAST-001` | Visible direct text meets configured CSS colour contrast ratios outside cards | Warning |
| `B35-CONTRAST-002` | Card text contrasts with its own nested/painted CSS background | Error |
| `B35-CONTRAST-003` | Background/foreground paint cannot be resolved by solid-colour CSS compositing | Review warning |
| `B35-RUNTIME-002` | No page exception, console error or failed essential local resource | Automated |

## SVG formula collision and alignment rule

### Equation discovery, weight and classroom readability

`B35-MATH-006/007` already compare font families and relative base font sizes. They do not establish that a consistently small equation is readable, or that regular-weight MathML looks balanced against a bold answer. Formula discovery now also includes `.mini` teaching callouts and the nearest ordinary paragraph/callout around semantic maths. It does not promote unrelated card headings into equation text.

For prose containing inline semantic maths, including a short cue such as “For (d):”, `B35-MATH-006/007/016` compare the maths tokens with other maths tokens, but do not compare the intentionally distinct prose font/weight to the maths font/weight. Peer rows likewise measure the semantic maths rather than a preceding prose cue. A short standalone equation still compares all of its base tokens, and mismatched maths tokens inside a sentence still warn. This is a DOM/text heuristic; visual balance and ambiguous short labels still require review.

Question-number chips (`.question-number`) are labels, like `.qnum`, and are excluded from formula comparisons. Peer size comparisons distinguish display formulas (`.formula` or an explicit `display-formula` content role) from working: a larger property formula may accompany smaller working, while size differences between peers with the same role still warn. Formula families remain compared across these roles.

An adjoining mathematical operator in prose is still part of the expression: `A student claims [MathML fraction] = 5 + 3` compares the HTML equation suffix with the fraction, while the English cue stays outside the comparison. Prose-only explanatory rows are excluded from peer equation comparisons.

`B35-MATH-014` estimates the reference digits with the mathematical font/weight at the surrounding role's base size. It retains the absolute glyph-size floor, the peer-fraction comparison and actual SVG reference text. Using a different prose face must not change an otherwise identical fraction's optical ratio. A small mathematical font in a much larger paragraph can still warn.

`B35-MATH-020` also flags a bare MathML radical glyph followed by operands without `msqrt`/`mroot`; writing `<mo>√</mo>` alone does not construct a bar over its radicand. An isolated radical-symbol reference is allowed.

The question role contract also covers `.student-question`, `.question-math` and `.question-prose`: a class name containing “math” does not make an English sentence mathematical prose. Reusability checks include named readiness directions such as “Stop here when Casey is ready” on transition pages, and teacher pacing text such as “Teach one segment at a time”.

Solution role coverage includes `.wide-answer`. A pure algebraic text fragment there, such as `(2x + 3)(x - 3)`, is checked as mathematics even when it is wrapped only in `strong`; English explanation remains prose. An answer panel does not inherit a valid mathematical role merely by using a bold font.

`B35-MATH-016` warns when comparable base glyphs mix regular weight (≤500) and bold weight (≥600), with a difference of at least `formulaMaximumFontWeightDifference` (default 200). It examines fraction digits but excludes intentional exponent/subscript/root-index tokens. Renderer wrappers can reset weight to 400 even when both sides report the same font family and size. This is a review candidate, not a prohibition on deliberate emphasis; use `data-b35-allow-formula-weight` only after documenting an intentional exception.

`B35-MATH-017` checks concise standalone equations selected by `formulaConsistency.teachingEquationSelectors` (default `.formula,.mini,[data-b35-equation],[data-b35-formula-role='teaching']`). They must contain a relation/equality and numeric or semantic maths. `teachingEquationMinimumFontPx` defaults to **18px in unscaled slide-design coordinates**, so browser zoom cannot hide the problem. Fractions and superscripts retain their intentional structural size reductions. This is a lesson-design threshold, not an accessibility standard or a universal minimum for inline prose. Configure the selectors, `teachingEquationMaximumCharacters`, threshold, or a documented `data-b35-allow-small-equation` exception for a different design.

Both new warnings include the slide, precise selector, measured tokens, expected appearance, impact, proposed review/action and verification steps. They never edit the lesson. Limits remain: computed styles are not pixel-level font recognition; screenshot review still matters.

Example actionable warning: **B35-MATH-016, page 3** — “Equation mixes regular-weight maths (400) with bold base text (900); align the visual weight across the equation.” Its evidence identifies the radicand and `= 5`; the action asks the repairer to inherit the equation weight into the maths wrapper, preserve the equation and recheck clipping/spacing.

### Complete standalone equations — B35-MATH-018

Standalone equations should be generated as complete MathML expressions, not token-only conversions such as a MathML root followed by an HTML equals sign and answer. The check also warns for an equation written wholly in ordinary HTML. It is an authoring convention, **not an assertion that mixed HTML/MathML is invalid HTML**.

The rule examines settled visible equation rows. It handles HTML wrappers, explicit BR/block rows, powers, fraction/root islands, and multiple complete equations. Labels are excluded and trailing sentence punctuation is allowed outside the maths. A complete equation's units, operators and both sides of the relation belong inside its renderer.

Ordinary explanatory sentences with inline maths are allowed. Automatic classification is deliberately conservative: it looks for a concise relation/equality row with no detected explanatory prose outside the maths. It is **not a natural-language or mathematical proof engine**. Ambiguous labels can be reviewed and marked with `data-b35-standalone-equation` or `data-b35-equation` to declare the contract explicitly. The existing `.mini`, `.formula`, `.work`, known worked/answer rows and paragraphs are scanned by default; custom containers can be supplied through `standaloneEquationSelectors`.

Configuration lives under `formulaConsistency`:

- `fullEquationMathML`: enabled by default; set false to disable.
- `standaloneEquationRenderers`: defaults to `["mathml"]`. A coherent complete `katex` or `mathjax` renderer can be explicitly accepted, without accepting split pieces of it.
- `standaloneEquationMaximumCharacters`: default 160 for inferred rows; explicit standalone declarations bypass this inference limit.
- `standaloneEquationWords`: optional list of permitted mathematical functions, units and named quantities for inference; overrides the built-in list.
- `standaloneEquationSelectors`: customise which display containers are scanned.
- `policy.fullEquationMathMLSeverity`: warning by default; can be configured independently.

Use `data-b35-allow-split-equation` only for a documented intentional exception. The validator never converts or repairs equations automatically. Each finding provides row evidence, renderer fragments/markup, text outside maths, selectors, expected structure, an LLM-actionable repair instruction, and verification safeguards.

**A complete MathML expression does not prove that radical signs and bars have balanced visual strokes.** The complementary footer and symbol checks below address the separately proposed checks; they do not turn MathML structure or matching CSS weights into visual approval.

### Complementary footer and symbol checks — version 1.5.0

All three run through `auditComplementaryChecks` in `complementary-rules.cjs`, on every settled reveal state, without editing the lesson. Findings include selectors, measurements, expected appearance, impact, repair/review instructions, confidence, verification steps and safeguards.

1. **B35-LAYOUT-002 — shared footer typography.** Compare corresponding footer roles across cards, whether they contain plain text or maths. Compare the base family, size, weight, line-height declaration and padding, and the configured minimum size. This catches a maths-only override that leaves other footers smaller. Intentional mathematical script-size reductions remain covered by the existing formula rules rather than flattened to one size.
2. **B35-LAYOUT-003 — footer geometry and content alignment.** Compare footer heights and bottom/side insets within their cards. Independently check horizontal/vertical content centres when the model explicitly requires centring. Matching bottom edges or matching `text-align` values are not sufficient. Content bounds combine text ranges/canvas ink estimates and MathML structural boxes, excluding outer maths padding. These are geometric estimates, not pixel-level optical approval.
3. **B35-MATH-019 — mathematical-symbol stroke review.** Native radicals, fraction bars, CSS roots/fractions, SVG radical text and explicitly declared SVG symbols require rendered review. Equal CSS weight, even 900, does **not** verify the drawn strokes. Findings retain `visualWeightVerified: false` and `status: "review-required"`. Inspectable SVG stroke widths/filled bar thicknesses can additionally be tested against an explicit range; that measurement alone still does not certify visual balance with the rest of the equation. Mathematical bars need not have exactly the same thickness as digits.

The default configuration defines a template-specific contract for `.three,.four,[data-b35-footer-group]`, direct child cards, and their `.mini` or `[data-b35-card-footer]` footers. It requires shared styling, an 18px base size, and centred content. **This is not a universal rule that all HTML footers must be centred.** Customise `complementaryChecks.footerGroups`, including `selector`, `cardSelector`, `footerSelector`, `minimumFontSizePx`, `requireAll` and `alignment`. Omit `alignment` to compare boxes without requiring centred content. A grid with no footer roles is skipped unless explicitly marked as a footer group or configured with `expectFooters: true`. Missing required visible footers are reported at the final reveal, not while content is intentionally hidden.

Tolerances are `footerFontTolerancePx` (0.5), `footerWeightTolerance` (100), `footerBoxTolerancePx` (1), and `footerContentCenterTolerancePx` (2), in unscaled slide-design coordinates where applicable. Independent policy switches are `footerTypographySeverity`, `footerAlignmentSeverity`, and `symbolRenderingSeverity`; each accepts `"off"`. Set `complementaryChecks.footersEnabled` or `complementaryChecks.symbolRendering.enabled` to false to disable that family. A documented group-level `data-b35-allow-footer-variation` or `data-b35-allow-card-variation` exempts an intentional footer variation.

Symbol configuration lives under `complementaryChecks.symbolRendering`: customise `selectors`, `formulaScopes` and optional `strokeContracts` entries such as `{ "selector": "#example-bar", "minimumPx": 1, "maximumPx": 2 }`. Explicit SVG shapes use `data-b35-math-symbol="radical"` or `"fraction-bar"`.

To resolve a pending symbol review, a reviewer must inspect the actual equation at lesson size and close-up, then supply a configuration `approvals` record with the exact finding's `selector` and `fingerprint`, `decision: "accepted"`, a named `reviewer`, ISO `reviewedAt`, and an `evidenceRef` pointing to retained review evidence. No approvals are generated automatically, and an HTML `reviewed` attribute does not clear a finding. Changed equation markup/styles invalidate the matching fingerprint; an unmet explicit stroke contract cannot be waived by an approval.

An approval is a **trusted reviewer assertion**, not independent machine verification of its screenshot or evidence file. The fingerprint detects changes in the sampled DOM, styles, geometry and font-load state; it is not a cryptographic content signature or a hash of font binaries/browser builds. Re-review after font or browser changes, and retain the viewport/render details with the evidence. Without genuine review, leave the warning open. These checks are not accessibility checks.

Run the new controlled regressions with `npm run test:complementary`. Include the real Chapter 8 page-3 regression with:

```bash
npm run test:complementary -- --chapter8 /absolute/path/to/Y8_Ch08_Pythagoras_validated.html
```

Development Chapter 8 reports are not included in this distributable. The installer bundle's VERIFICATION.md records release-test coverage; run the tool on your own input to obtain fresh evidence.

### SVG collision details

`B35-MATH-005` measures visible text and MathML/HTML formula tokens inside SVG conversion groups after fonts and reveal animations settle. It treats a fraction as one token, so its numerator, bar, denominator and superscripts are not tested as mutually colliding elements. It includes MathML descendant extents when measuring the token.

Collisions exceeding both 2 CSS pixels and 10% of the smaller token area are errors by default. Fraction bars more than 6 CSS pixels from the neighbouring equals-sign axis produce review warnings. Configure these limits with `svgFormulaOverlapTolerancePx`, `svgFormulaMinimumOverlapRatio`, and `svgFormulaAxisTolerancePx`; severities are also configurable.

Axis alignment is checked in a shared SVG `<g>` or an explicitly marked `data-b35-formula-row`. Without a neighbouring equals sign, no axis assertion is made. This rule covers formulas converted into SVG `foreignObject` elements; it does not certify arbitrary diagrams, pure SVG fraction paths, or ordinary HTML equation layout. Baseline inference is approximate and requires visual review.

An intentional overlap may be exempted with `data-b35-allow-math-overlap` on its group. Intentional axis offsets may be exempted with `data-b35-allow-math-offset`. Keep any exemption documented in the manual acceptance record.

Run the browser regression cases with `npm test`. To include the known Chapter 7 page-3 failure:

```bash
npm test -- --lesson /absolute/path/to/Y8_Ch07_Percentages.html
```

## Adding a rule

Source rules are registered in `staticRuleRegistry`. Browser checks run in `runtimeAuditFunction`, `auditSvgFormulas` (in `svg-formula-rules.cjs`), `auditFormulaStyles` (in `formula-style-rules.cjs`), `auditVisualModels` (in `visual-model-rules.cjs`), `auditVisualReview` (in `visual-review-rules.cjs`) and `auditComplementaryChecks` (in `complementary-rules.cjs`). Each is called for every reveal state. Each finding uses the same shape:

```js
{
  rule: "B35-CANVAS-006",
  severity: "error",
  slide: "s12",
  state: "2/4",
  selector: ".worked-example",
  message: "Worked example extends 14px beyond the bottom edge.",
  evidence: { overflowBottomPx: 14 }
}
```

Configuration belongs in `config/b35.rules.json`. New thresholds and selectors can therefore be changed without editing the browser traversal logic.

## Formula typography and notation consistency

The style checks compare the entire formula, so differences between its left and right sides are included. Candidate contexts include `.formula`, `.work`, explicit `[data-b35-formula]` elements, SVG formula conversion groups, math-like SVG text (including styled tspans), and mathematical prompt/solution/answer blocks. Related rows are compared inside `.steps-col`, `.practice-answers`, or `[data-b35-formula-set]`.

The default maximum base font-size ratio is **1.2** (a 20% difference). Structural superscripts, subscripts and MathML fraction script levels are allowed to differ from base text. Numerator and denominator are compared to each other instead. Different font weights or italic variables are not treated as font-family failures.

Answer tags, question-number chips and other component labels are excluded from formula typography; their deliberately smaller type is not an equation-size mismatch. `formulaConsistency.labelSelectors` controls that exclusion. Font changes inside MathML expressions and SVG tspans are included, not just changes between whole formula containers.

Examples:

- `1/2 =` followed by a stacked MathML fraction is a fraction-style candidate.
- `25% + 25 % = 50%` has inconsistent percentage spacing.
- `25% + 25％ = 50%` mixes ASCII and full-width percent signs.
- `50% = 0.5` is a valid representation conversion and does not fail percentage consistency.
- A mixed number such as `3 [stacked one-half]%` is not treated as a spaced `3 %`; the fraction is retained as a semantic boundary when checking percent spacing.
- `x² = x<sup>2</sup>` mixes power representations; `x^2` is flagged as raw caret notation.
- Fractions with blank numerators or denominators are errors unless intentionally marked as exercise blanks.

These style findings are **warnings by default**. An intentional teaching comparison may use different representations; record that choice and exempt its container with `data-b35-allow-mixed-notation`. Intentional typography differences can use `data-b35-allow-formula-style`. Intended blanks can use `data-b35-allow-empty-math`.

Tune `formulaMaximumFontSizeRatio`, `formulaMinimumLineGapPx`, `formulaClippingTolerancePx`, the `formulaConsistency` selectors and aliases, and the formula-related severity entries in `config/b35.rules.json`. Font-family alias keys are lowercase, for example `{"times new roman":"serif","georgia":"serif"}` if those families are intentionally interchangeable in your design.

Font comparisons use computed CSS font families and rendered sizes, not a guarantee about the actual fallback font selected for each glyph. The notation checks identify common presentation patterns; they do not prove mathematical equality or enforce identical representations where a conversion is the teaching goal. The equation-line check currently covers explicit `<br>` breaks in recognised formula blocks; arbitrary wrapping or independent SVG labels still require visual review.

Run **all browser regression checks** with `npm test`, or only the new style checks with `npm run test:styles`. `npm test -- --lesson /absolute/path/to/Y8_Ch07_Percentages.html` also includes the original page-3 collision regression.

## Important interpretation

- Source-only success is candidate discovery, not visual acceptance.
- Runtime checks inspect the post-script DOM, so decks that merge pages or convert fractions on load are tested in their delivered state.
- The browser waits for reveal transitions before measuring or capturing a state. Source task-colour warnings are cleared when computed browser styles verify all the corresponding cards.
- Math ink outside a line box is a review warning when overflow is visible; it is not automatically labelled clipping. A clipped or scrolling container still fails the bounds check.
- SVG text contrast requires visual review: CSS ancestor backgrounds do not account for coloured rectangles and paths painted behind labels. Gradient/image backgrounds and unsupported colour effects produce `B35-CONTRAST-003`, not an invented ratio or silent pass.
- Initial, middle and final images are evidence shortcuts. B35 still requires a reviewer to inspect every meaningful reveal state; the geometry checks do visit every state even when only three are captured.
- A screenshot baseline is intentionally not included. These lesson packs change materially during compaction, so B35 calls for reviewed evidence rather than blindly accepting a pixel diff.

## Optical size, diagram models and composition

### Optical readability — B35-MATH-014

This measures numeric MathML fraction glyph boxes after browser layout. Defaults warn when a fraction digit is below **7 CSS pixels** high, its median digit height is below **60%** of the estimated surrounding digit ink height, or peer fraction digit heights differ by a factor above **1.4**. This complements the CSS base-font-size rule: two tokens with equal CSS font size can render very differently.

Top-level numeric fraction components must also use at least **85%** of the surrounding content role's base font size (`inlineFractionMinimumBaseFontRatio`). This is a lesson typography policy, not a claim that the browser's default 70% inline fraction is malformed. Equal root CSS sizes do not satisfy it: an 18px expression with 12.6px components warns. Font-size ratios are independent of viewport scaling and do not compare different prose and math faces' cap heights. Nested fractions and exponent/subscript fractions retain their structural reduction; nested digits are not counted again as outer fraction digits.

The check does not require numerator glyphs to have exactly the same ink height as whole numbers. It ignores hidden content and structural exponent/subscript digits. Measurements are browser geometry plus canvas font-metric estimates, not screenshot segmentation or visual acceptance. Current coverage is numeric MathML fractions; arbitrary path-drawn or image formulas need visual review. Symbol-stroke approval records do not suppress this independent size check.

Configure the `opticalFraction...` thresholds or use `data-b35-allow-optical-size` for a documented intentional exception.

### Inline radical line boxes — B35-MATH-022

An inline MathML wrapper containing a radical inside recognized prose warns when its combined vertical padding exceeds **20%** of that prose's font size (`inlineRadicalMaximumVerticalPaddingRatio`). For example, 9px bottom padding beside 18px prose warns. Hidden content, explicit block-display mathematics and structural exponent/subscript mathematics are excluded. A previous symbol-stroke approval cannot clear this check. The finding diagnoses wrapper geometry; it does not prove that a native radical's hook, overbar, weight or proportions are visually acceptable. Inspect those at lesson size, and retain ink/clipping checks after changing padding.

### Fraction-bar models — B35-DIAGRAM-001

For strict checking, supply a reviewer-approved model either in the SVG or in the configuration. For example:

```html
<svg id="fraction-example" viewBox="0 0 350 80"
     data-b35-diagram="fraction-bar"
     data-b35-numerator="2" data-b35-denominator="7">
  <rect data-b35-whole x="0" y="0" width="350" height="70"
        fill="cyan" stroke="black" />
  <rect data-b35-shaded x="0" y="0" width="100" height="70"
        fill="purple" />
  <path d="M50 0V70 M100 0V70 M150 0V70 M200 0V70 M250 0V70 M300 0V70"
        fill="none" stroke="black" />
  <text data-b35-fraction-label x="50" y="40">2/7</text>
</svg>
```

A configuration entry offers the same model without editing the lesson:

```json
{
  "diagramModels": [
    {
      "selector": "#fraction-example",
      "type": "fraction-bar",
      "numerator": 2,
      "denominator": 7,
      "wholeSelector": "[data-b35-whole]",
      "shadedSelector": "[data-b35-shaded]",
      "partSelector": "[data-b35-part]",
      "labelSelector": "[data-b35-fraction-label]",
      "orientation": "horizontal",
      "requireEqualParts": true
    }
  ]
}
```

Add that entry to the existing configuration; the snippet alone is not a complete validator configuration. Partition boundaries can come from full-height SVG lines, simple absolute `M...V...`/`M...H...` path dividers, marked part rectangles, and shaded rectangle edges. Transforms and overlapping shaded rectangles are handled in screen coordinates; shade coverage is the union of their intervals. Vertical models use `orientation: "vertical"` or `data-b35-orientation="vertical"`. Set `requireEqualParts: false` / `data-b35-require-parts="false"` if an unpartitioned proportional bar is intended.

Strict checks cover the shaded proportion, partition count/equal sizes and an explicitly marked aggregate fraction label. A label for each individual unit should not be marked as the aggregate label. The reference model must be supplied by a reviewer; geometry matching it does not establish that the reference mathematics is correct.

Without declarations, the validator only infers a model for a simple horizontal rectangular bar with a different-colour full-height shaded rectangle and a fraction label inside the shading. Proportion/partition disagreements produce **warnings**, never inferred-model errors. Arbitrary diagrams, pies, complex SVG paths or ambiguous semantic intent remain outside this rule's coverage. `data-b35-ignore-diagram-model` exempts an intentional exception.

### Numeric token integrity — B35-MATH-021

This bounded review check detects `<mn>1</mn><mo>.</mo><mn>10</mn>` rather
than a single decimal `<mn>1.10</mn>`, a denominator ending in an isolated
punctuation operator, and a fraction immediately followed by a three-digit
number without an operator. The latter can reveal a truncated thousands
group: an intended `3900/(22 000)` rendered as `(3900/22) 000`.

These patterns are **warnings**, not proof of incorrect mathematics. Compare
the original expression before editing: implicit multiplication or unusual
decimal notation can be deliberate. Explicit multiplication and punctuation
outside the fraction are not flagged. Hidden content is deferred; a
documented `data-b35-allow-numeric-notation` marks an intentional exception.
No operands are joined or rewritten automatically.

### Adjacent percentage additions — B35-DIAGRAM-004

For an explicit rectangular model of an addition to a 100% reference, declare
`data-b35-diagram="percentage-change"` on the SVG, `data-b35-base` on its
reference rectangle, and `data-b35-change="10"` on an adjoining rectangle
representing an additional 10%. A 5% addition must have 5% of the reference
length, not an exaggerated width chosen to fit its label. Put labels outside
narrow segments with a connector. This applies equally to tax, interest,
growth and other explicitly authored percentage models; no lesson IDs or
financial vocabulary are assumed.

The rule checks the rendered length ratio (default absolute ratio tolerance
0.005), equal cross-section and adjoining edge. The default orientation is
horizontal (addition to the right); `data-b35-orientation="vertical"` means
addition below the base. Nonnegative finite percentages, including zero,
are supported. Hidden entire models are deferred until visible. Missing,
invalid, rotated, reflected or skewed geometry is reported rather than
certified. Arbitrary unannotated bars do not imply this contract.

Measurements test a declared mathematical model, not the correctness of its
premise, text, optical appearance or accessibility. Existing documented
`data-b35-ignore-diagram-model` exceptions remain available. The validator
does not alter the diagram or infer a percentage from a label.

### Composition — B35-COMPOSITION-001

At the final reveal, large panels occupying at least **15%** of the slide are reviewed if text/graphic content boxes occupy less than **30%** of the panel. The area is a union of text and meaningful graphic boxes: empty card/SVG frames and watermarks do not inflate the teaching-content estimate. Columns leaving more than **40%** of their height unused below the last content box are also reviewed.

This is a heuristic, not a judgment of teaching quality. Bounding boxes can overestimate the ink of complex SVG paths. Intermediate reveal states are skipped so purposeful hidden answer space is not penalised. Use `data-b35-allow-empty-space` for a writing area or deliberate pause layout, and `data-b35-ignore-composition` for decorations. Selectors and thresholds are configurable.

Run `npm run test:models -- --lesson /absolute/path/to/Y8_Ch07_Percentages.html` for these regressions and the actual page-14 case. `npm test -- --lesson /absolute/path/to/Y8_Ch07_Percentages.html` runs all suites.

The accessible SVG-name check is disabled through `svgAccessibleNameSeverity: "off"`, reflecting the current scope. Contrast checks remain available as visual-legibility checks.

## Additional automated visual-review rules

The [presentation rules](PRESENTATION_RULES.md) document two-method card and
equation-row alignment, card explanation prose coverage, inter-block gaps,
short callout endings, inline mathematical placement and watermark interference.
They reuse existing font/alignment rules where applicable, and add configurable
review warnings for the gaps. Presentation policy is lesson-default and opt-in
for general HTML; geometry never establishes automatic visual approval.

Content-bound checks (`B35-LAYOUT-004` / `005`) use rendered Range fragments for words that wrap across lines, including hyphenated words. They must not measure the entire word at every fragment origin, which invents horizontal overflow. Single-line tokens retain canvas ink estimates; genuinely unbreakable overflow is still reported. Fragment bounds are geometry, not pixel-level glyph certification.

Version 1.1 adds the six checks documented in [VISUAL_REVIEW_RULES.md](VISUAL_REVIEW_RULES.md), including configuration, annotations, exceptions and coverage limits. They run automatically in the normal `validate` command; no separate review command or account is needed.

They inspect rendered geometry and a configurable concept vocabulary, **not screenshot pixels**. The report now explicitly records `visualReviewCoverage`, and the gallery states that no AI image analysis is performed. A clean automated report still requires separate visual approval.

Run the new regression suite, including both the original problem pages and their repaired counterparts:

```bash
npm run test:visual-review -- \
  --lesson /absolute/path/to/Y8_Ch07_Percentages.html \
  --repaired /absolute/path/to/Y8_Ch07_Percentages_pages14_23_32_fixed.html
```

Use `npm test -- --lesson ... --repaired ...` to run all five suites. `--out /absolute/path/to/evidence.json` saves SVG-suite evidence and separate `-models` / `-visual-review` / `-page-pairs` evidence files; the style suite reports its results in the console.

## Diagram frame label bounds — B35-DIAGRAM-005

Visible `.diagram-label` and `[data-b35-diagram-label]` boxes inside `.diagram-frame` or `[data-b35-diagram-frame]` must fit the frame within `visualReview.diagramFrameTolerancePx` (default 2 design pixels). The warning reports the measured frame and label rectangles; wrapping, repositioning or enlarging the frame can repair genuine overflow. An intentionally external callout may use `data-b35-allow-label-outside` after review. This measures the declared HTML frame, not a decorative shape inside it, and cannot prove a bracket points to the correct mathematical token. Existing B35-DIAGRAM-003 target annotations address declared label targets but do not infer mathematical intent; check bracket-to-token relationships visually.

## Teaching note reveal order — B35-ORDER-005

When a page has delayed working or answers, a visible `data-b35-note-role="conclusion"` should appear on a later reveal beat than the last recognised solution or answer. A `data-b35-note-role="preface"` identifies a prerequisite or question hint that may appear earlier, and is excluded from the generic box-order warning. An unclassified `.note` visible before the final solution beat triggers a purpose-review warning rather than being assumed to be a conclusion. The check uses DOM roles and data-step ancestry, not note colour or inferred semantic meaning. It does not require a new reveal on pages without delayed working.

The known working/answer selectors are `.step-solution`, `.practice-answer`, `[data-role="answer"]` and `[data-b35-reveal-role="working"|"answer"]`. If a note legitimately depends on only some of several independent tasks, or a lesson uses another navigation engine, inspect its purpose and reveal states manually. The rule emits review warnings and never hides or deletes content; an author must annotate the correct role and implement the reveal. Set `visualReview.conclusionRevealEnabled` to false only when intentionally omitting this coverage.

## Card boundary visibility — B35-LAYOUT-010

Visible cards on similar solid backgrounds should have discernible boundaries. The rendered check compares each border side and the card fill with the surrounding background, including transparent CSS colours. A missing/transparent edge or faint border warns when neither border nor fill meets `visualReview.cardBoundaryMinimumContrast` (default 1.5). This is a review heuristic, not a WCAG criterion or a requirement that every card have a border. No specific colour or first-card styling is prescribed.

Default coverage includes summary/concept/visual cards, task and answer cards, worked-step cards and `[data-b35-content-panel]`. `visualReview.cardBoundarySelectors` can override the selection; `cardBoundaryEnabled` disables the check. A reviewed borderless layout may declare `data-b35-boundary-intent="open-layout"`. Existing shadows/outlines are left to visual review rather than rejected solely for missing borders. Gradients, image backgrounds, filters and translucent ancestor compositing are not certified. Findings include fill contrast and measurements for each edge. Do not add exceptions or replace approved colours merely to clear a warning; inspect the rendered card and its peers.

## Radical hook/overbar continuity — B35-MATH-024

Native `msqrt`/`mroot` semantics do not prove that the renderer draws a smooth join. Visible native roots receive a `native-radical-join-review` warning requiring normal-size and enlarged inspection, even if an older symbol-stroke approval exists. This is a review request, not a claim that every native root is defective. Set `visualReview.radicalJoinReviewEnabled` to false only when deliberately omitting this review coverage; report that limitation.

For declared `svg[data-b35-diagram="radical"]`, use one connected path/polyline marked `data-b35-radical-sign`, with the radicand marked `data-b35-radicand`. A separate bar uses `data-b35-radical-overbar`. The rule compares transformed line/path endpoints, warning when the nearest endpoints differ by more than 0.75 design pixels; multiple path subpaths or unsupported geometry require review. A passing path check is not pixel analysis and does not certify stroke balance, clipping, the mathematical content, or arbitrary interior path junctions. Preserve radicands, root indices and accessible meaning during repair. Existing MATH-020 bounds checks and MATH-019 optical review still apply.

## Unmarked mathematics in prose — B35-MATH-023

Visible question and explanation prose, formula-prose containers, HTML diagram labels and captions are checked for plain-text mathematical runs such as `9a + 9b`, `x + 2 = 4`, `N = kA` and `3 × 4`. Each complete expression belongs inside MathML or the configured semantic maths renderer, with numbers, variables and operators using the maths font. Surrounding English retains the prose font. Changing the entire paragraph's font is not the remedy. Inline HTML wrappers do not bypass detection; semantic renderer boundaries, line breaks and separate blocks are respected. Findings include matched expressions and the affected panel selector, and are review warnings rather than automatic content rewrites.

This is a conservative heuristic, not a parser or proof of mathematical completeness. It excludes existing MathML/KaTeX/MathJax, SVG, code, hidden content, navigation-style number badges and answer tags. Lone numbers/variables, ordinary words, units and unspaced hyphenated dates are not expressions for this check. Unsupported notation, separate-block expressions and rendered SVG text still need their existing checks or manual review. The rule follows `policy.visualReviewSeverity` and runs in the normal rendered lesson audit on each settled reveal state.

## Visual box reading order — B35-ORDER-004

Diagram purpose matters: an original question figure may appear with the question, before worked steps. Mark it `data-b35-diagram-role="question"`, or place it inside `.challenge-box`, `.practice-question` or `[data-role="question"]`. A worked/answer figure uses `data-b35-diagram-role="solution"` and follows the normal reading/reveal order; an explicit solution role takes precedence over question-container location. `.visual-card` and `.step-solution` are included in the default panel coverage. Hiding only a diagram's answer labels does not hide its enclosing panel. An unclassified diagram that appears ahead of preceding hidden steps produces a `diagram-role-review` warning asking for purpose confirmation, rather than asserting an answer leak or automatically hiding it. These annotations express teaching intent; they do not certify that a figure contains no answer.

The rendered lesson compares content boxes by position, top to bottom and left to right within a row. A static box has reveal step 0; a box inside one or more `data-step` containers takes the latest ancestor step. If a visually later box appears while an earlier box is still hidden, the validator emits a review warning at the later box's first appearance, with both box positions and steps. This applies to questions, notes, examples, explanations and other content boxes without relying on their wording. Nested boxes are compared through their outer box.

The rule is enabled by `visualReview.boxReadingOrderEnabled`; `boxReadingOrderRowTolerancePx` controls how close two top edges must be to count as one row. For genuinely independent parallel panels, use `data-b35-order-independent` on their shared container. Inspect the actual reveal states before using this exemption. A CSS layout change can alter reading order, so validate at the intended viewport.

## Lettered question parts — B35-LAYOUT-006

In reusable lesson questions, put the common stem once, followed by each `(a)`, `(b)`, `(c)`, `(d)` task on its own line. Both `(a)` and `a)` labels are recognised. A `<br>`, block row or vertical semantic list provides deliberate separation; ordinary source whitespace and natural wrapping at one viewport do not.

This review warning is enabled by `visualReview.questionPartsEnabled` in lesson validation. The configured `questionPartSelectors` default to `.prompt,.practice-question,[data-b35-question],[data-b35-question-parts]`. It examines visible question text and CSS/DOM row boundaries. Mathematical renderer contents, function notation, lone labels and label-only references such as “use parts (a) and (b)” are conservatively excluded. Hidden tasks wait for their reveal. It recognises consecutive lowercase sequences starting with `a`; arbitrary numbering, generated custom labels and ambiguous prose still require review.

Keep every operand, unit, task label, diagram and reveal in order. After inserting breaks, recheck the entire question/solution layout at the agreed font size. Do not shrink text or delete working to force a fit; allow a justified continuation page if needed. The rule does not fix HTML or certify optical layout. For an intentionally inline label-format comparison only, document the purpose using `data-b35-allow-inline-question-parts` and review it explicitly. Findings include the unseparated labels, text with explicit rows, proposed repair, safeguards and revalidation steps.

## Reusable, student-neutral lesson content

`B35-CONTENT-002` flags bounded teacher-delivery cues such as “reveal one line at a time”, “ask the students…”, a named learner being asked to explain, pacing instructions and explicit `.teacher-note` / `data-b35-teacher-note` blocks. It also detects turn-taking workflow headings and observation-recording directions (independent / prompted / not yet, and withholding teaching until a response is recorded). Question-side panels should contain mathematical explanations, not teacher administration. Preserve questions and genuine mathematical explanations on mixed pages; remove whole workflow-only slides only after human confirmation that no substantive mathematics is lost, then revalidate navigation. The words OBSERVE, PROMPT or CHECK alone are not violations. Student-facing mathematical hints and questions are not removed or inherently prohibited. The audit detects bounded cues, not semantic correctness or completeness of an explanation, and never automatically deletes or invents content.

The same rule also reviews explicit teacher-facing labels such as “Teacher language”, “Teacher talk”, “Teacher prompt” and “Teacher:” and delivery timing such as “Answers appear after students try.” These are bounded student-page cues, not a ban on teachers as actors in word problems or on “Teacher-written” source attribution. A student-facing “Think:” question is allowed; inspect the surrounding mathematics before changing any flagged content.

`B35-CONTENT-003` reviews personalisation in browser titles (for example `Casey Y8`, `Casey’s maths lesson`, `Practice for Casey`), explicit student metadata (`meta[name="student-name"]`, `student`, `learner-name`), `data-student-name`, named-learner teacher directions, common named word-problem actor contexts, and configured exact name matches. Known mathematical names, pronouns and common topic/audience terms are protected from inferred-name matching. Add other legitimate terms under `allowedTerms`. Explicitly configured `studentNames` are still reported even if a name overlaps an otherwise protected term.

These are **review warnings, not universal name recognition or identity verification**. An unknown name outside the recognised contexts can be missed, and a fictional/historical name can be a false positive. The policy is to keep reusable lesson HTML anonymous; replace a named story actor with a generic role while preserving the mathematics. Review source attribution and historical names before editing. There is no automatic deletion, anonymisation or privacy certification.

Both checks run by default in the `lesson` profile. They inspect the active page’s authored text, including unrevealed text, at each visited reveal; unchanged findings are de-duplicated across steps. Global title/metadata are checked once on the first page. Accessibility labels and alternative text are included. Scripts, comments, external documents, unvisited dynamically generated text and unknown name contexts need separate review. Ordinary HTML websites do not inherit this classroom policy: use `lessonReusability.enabled: true` explicitly with the `html` profile if desired.

```json
{
  "lessonReusability": {
    "enabled": true,
    "teacherDirectionsEnabled": true,
    "personalisationEnabled": true,
    "studentNames": ["Casey", "Jordan"],
    "allowedTerms": ["Hypatia"]
  },
  "policy": {
    "teacherDirectionSeverity": "warning",
    "studentPersonalisationSeverity": "warning"
  }
}
```

No private student names are hardcoded in the defaults. Findings include the matched text, selector, active-page location, metadata attribute where relevant, expected policy, repair guidance, limits and verification steps. `evidence.automaticIdentityVerified` is always false. Quoted teaching directions remain reviewable rather than serving as an arbitrary exemption. Recheck all reveals and layout after any authorised cleanup. Run the focused synthetic regression suite with `npm run test:reusability`.

## Adjacent question and worked-page duplication

### One worked example per page where practical — B35-PAGE-003

Prefer the complete question and its worked solution on one page, with the question visible at step zero and the working revealed in order. Do not spend a sparse question-only page on the same question that the next worked page already displays. A pause for student attempts can normally happen at the worked page's initial state.

The enabled-by-default `pagePairs.singlePageExamplesEnabled` check applies to **one** exactly matched question on adjacent pages, not multi-question practice sets. It reuses PAGE-002's protections for unique instructions, diagrams, opaque media, mathematical notation and initially hidden answers. It emits one PAGE-003 review instead of a duplicate PAGE-002 finding for the same pair.

Generic `data-b35-keep-question-page` / `data-b35-allow-repeated-question` markers do **not** suppress PAGE-003. They still apply to the legacy PAGE-002 check. A concrete split requirement may be documented with a nonempty `data-b35-split-example-reason` on either page, or via the existing configured slide exemptions. Document actual requirements (for example a separate timed assessment); do not apply a blanket reason merely to clear a report.

This is a preference **warning**, not an automatic merge or a proof that content fits. Inspect all reveals at the target viewport and agreed font sizes. Preserve the question, meaningful instructions, diagrams, every working step and delayed answers. If the combined content is crowded, allow a justified continuation page; never shrink type or delete reasoning to force one page. Findings explicitly record `fitVerified: false`. A page with unmatched substantive material is conservatively retained for human review rather than treated as redundant.

Version 1.2 adds `B35-PAGE-002`, enabled automatically during browser validation. It compares **settled initial states of adjacent runtime pages**, not adjacent source IDs (which can differ after runtime compaction).

A warning requires all four conditions:

1. All recognised question texts match after NFC and whitespace normalisation. Numbers, case-sensitive variables, units, mathematical signs, MathML descriptions and superscripts are preserved. No fuzzy/paraphrase matching is used.
2. The first page has questions, but no recognised answer elements or reveal sequence.
3. The next page repeats those questions and has a reveal sequence plus recognised worked-answer elements; every reveal and answer is hidden initially.
4. The first page has no unmatched diagram, instruction, other task or residual teaching text. Opaque media/background-image content conservatively prevents a warning because equivalence cannot be verified.

The configured `pagePairs.boilerplateTexts` explicitly excludes two known generic prompts in this lesson template. Their text is recorded in each finding's evidence. Other unique instructions are **not** silently treated as boilerplate. Decorations such as headers, book tags and watermarks are excluded through `decorationSelectors`; do not classify substantive teaching material as a decoration.

The rule captures SVG/image DOM references, not pixel equivalence. A unique diagram prevents the warning. Identical DOM/reference fingerprints can support a candidate, but their actual teaching purpose and appearance still need review. CSS pseudo-element material and unrecognised custom question/answer components are limitations; configure selectors or retain manual review for such components.

Configure question/answer/instruction selectors, explicit boilerplate and exempt slide IDs under `pagePairs` in `config/b35.rules.json`. Set `pagePairs.enabled` to `false` to disable the rule. For an intentional standalone pause/workspace, mark either page with `data-b35-keep-question-page` or `data-b35-allow-repeated-question`, or add its source slide ID to `pagePairs.exemptSlideIds`.

The warning is self-contained for a human or LLM: it names both displayed pages/source IDs, quotes the questions in `evidence`, identifies selectors and initial reveal states, explains why the pair may be redundant, and supplies `expected`, `impact`, `confidence`, `suggestedAction`, `verification`, and `constraints`. These fields are included in JSON and expanded in Markdown. They explicitly prohibit automatic deletion or merging and preserve mathematical content and delayed reveal order.

Initial-state snapshots are saved as `pagePairStates` in the JSON report so another reviewer can inspect the basis of the comparison. A static-only or blocked browser run does **not** validate this rule. The validator never edits the lesson.

Run its focused regressions with:

```bash
npm run test:page-pairs -- --lesson /absolute/path/to/Y8_Ch07_Percentages.html
```

## Stable teaching frames — B35-LAYOUT-007/008/009

Lesson-mode browser traversal captures unscaled frame geometry at every settled reveal in `layoutStates`. Recognized roles are grouped separately: worked examples (task/working), concept diagrams (concept/diagram), concept details (concept/card), paired practice (questions/answers), and uniform comparison, summary or route-map groups with two to four columns. Column count and role signatures remain distinct. Cover/closing pages and unrecognized layouts are outside automatic coverage. General HTML mode and source-only validation do not certify cross-page or reveal stability.

- `007` checks the columns' top anchor and the working stack's first laid-out child. Content-dependent vertical centring leaves an offset and warns.
- `008` compares each page's question/working frame positions, widths and heights with its first observed reveal. Reserve the final working area with layout-preserving hiding instead of letting new answers resize the frame. Individual step cards may be different heights; the check compares their containing frame.
- `009` compares initial frames across pages of the same inferred/declared family. It reports dimensional ranges and every related page; the first page is not assumed to be an approved reference. Different page types are not forced into identical frames.

`layoutStability` configures `enabled`, `groupSelectors`, and `tolerancePx` (default **8 design pixels**). `policy.layoutStabilitySeverity` defaults to `warning`. A non-empty `data-b35-layout-family` on the slide or group identifies an intended template variant; the column role signature remains part of its comparison key. A specific `data-b35-layout-variation="reason"` excludes that page/group from cross-page frame comparison only. It does not exempt top alignment, reveal shifts, bounds or content fit. A whitespace approval cannot suppress these checks.

Repair the shared template rather than adjusting each page to its current amount of text. Use a different documented frame variant if a longer question genuinely requires more room; do not shrink type, clip content or remove working to force equal heights. DOM geometry is not visual acceptance. Inspect normal-size initial/final screenshots after repair.

Focused regressions: `node tests/test-layout-stability.cjs` (also included in `npm test`).
