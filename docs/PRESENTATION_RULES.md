# Presentation review rules

These checks address comparative method pages, their explanatory prose, and
summary callouts. They measure DOM geometry and computed styles. A warning
identifies a review candidate, not a confirmed visual defect or automatic approval.
No screenshot image analysis, source-content rewriting or watermark removal is
performed.

Use [Reproducible validation and repair](VALIDATE_AND_FIX.md) for the common
commands, font manifest, diagnosis/repair recipes and before/after evidence.

## Existing coverage and extensions

| Issue | Coverage |
| --- | --- |
| Wrong prose family or inconsistent prose/math emphasis | Existing `B35-TYPE-002/003/004`; generic prose-family coverage now includes `.card p`, `.summary-card p`, `.caption`, `[data-b35-card-example]` and `[data-b35-comparison-caption]`. Math-only paragraphs remain excluded. |
| Uneven comparison cards or equation rows | Existing `B35-LAYOUT-001`, extended to `.two` groups as well as `.three`, `.four` and `[data-b35-comparison]`. |
| Low occupancy inside a panel or unused column height | Existing `B35-COMPOSITION-001`; retained unchanged. |
| Excessive space *between* separate teaching blocks | New `B35-COMPOSITION-003`. |
| Short final line in a callout | New `B35-COMPOSITION-004`. |
| Raised/lowered inline maths or excessive surrounding spacing | New `B35-TYPE-005`. |
| Watermark intersections with instructional content | New `B35-COMPOSITION-005`. |

`B35-LAYOUT-001` checks card top/bottom edges and heights at the final reveal.
For matching visible equation-row counts, it also compares each corresponding
row's top inset. It does not infer mathematical equivalence from row indices or
force equal step counts. It skips vertically stacked/wrapped layouts and retains
`data-b35-allow-card-variation` for reviewed intentional differences. Flex/grid
stretching that actually equalizes card edges is accepted.

Automatic comparison recognition includes `.eq` and `[data-b35-equation]` in
addition to `.formula`, `.work` and `[data-b35-card-formula]`.
Default equation rows are `.qa-text-row`, `.eq`, `.formula` and `[data-b35-formula-row]`, with
nested wrappers reduced to their innermost matching rows. A custom
`visualReview.comparisonGroups` entry can set `rowSelector`, `cardSelector` and
`roles`. Default roles now recognize `.work` as a formula group, `.tag` headings
and `.caption` explanations. The existing normalized alignment tolerance remains
8px; these are box comparisons, not optical equation-baseline measurements.

## New presentation checks

`presentationReview.enabled` defaults to **true for lessons** and **false for
general HTML**. Opt in for a general document through a configuration override:

```json
{"presentationReview":{"enabled":true}}
```

General HTML still needs its own desired prose-font policy; enabling presentation
review does not impose Nunito or enable all existing lesson comparison rules.
The common severity is `policy.presentationReviewSeverity`, default `warning`.
Use `off` to disable its findings. Each new check has its own enabled switch and
editable selectors under `presentationReview`.

### Large block gaps — B35-COMPOSITION-003

At the final reveal, visible in-flow sibling blocks in `.body` or
`[data-b35-layout-flow]` are checked for vertically empty space. A gap must exceed
both 48px and 10% of the slide height. Dimensions are normalized for slide scale.
The closest occupied bottom edge of earlier horizontally overlapping blocks
provides the boundary, so a tall peer card is not mistaken for blank space.
For transparent, unbordered flex/grid comparison groups matched by
`gapContainerSelectors` (default `.two,.three,.four,[data-b35-comparison]`), the
occupied bottom is the lowest visible in-flow child edge. This detects blank
space inside an expanded comparison container before the next block; evidence
includes both occupied-space and container-box gaps. Painted/bordered groups,
direct text and marked intentional space retain the container boundary. This is
a bounded one-level child-box inspection, not a universal whitespace detector.
Headers, absolute/fixed decorations, hidden reveals and separate columns are
excluded. The default general-HTML reference height is the configured viewport.

Thresholds: `presentationMaximumGapPx`, `presentationMaximumGapRatio`.
Selectors/switch: `flowSelectors`, `largeGapsEnabled`.
An intentional writing/pause area can use the existing
`data-b35-allow-empty-space` or a reviewed `data-b35-allow-large-gap` on the flow
or adjacent block. The rule does not judge whether teaching content is missing.

### Short final callout lines — B35-COMPOSITION-004

For `.note`, `.rule`, `.warning`, `.check`, `.callout` or `[data-b35-callout]`,
rendered word ranges identify soft-wrapped lines. A candidate has at least eight
prose tokens, two to four rendered prose lines, and a final line of at most three
words narrower than 28% of the longest preceding line. Inline mathematical
renderers remain atomic; fractions/scripts are not counted as separate prose
lines. Explicit BRs and block paragraphs are treated as intentional boundaries.
Intermediate reveals and hidden callouts are skipped.

Thresholds: `calloutShortLineMaximumWords`, `calloutShortLineMaximumRatio`.
Selectors/switch: `calloutSelectors`, `shortLinesEnabled`.
Use `data-b35-allow-short-line` for a reviewed deliberate ending. The suggested
repair is wording/width or a deliberate break, preserving meaning and font size;
the tool does not rewrite text.

### Inline mathematical placement — B35-TYPE-005

The rule compares base text-token baselines with neighboring prose using rendered
Ranges and canvas font bounding-box ascent. An offset must exceed both 4px and
0.2em. This avoids comparing a radical's tall bounding box with the prose centre.
Fraction internals and structural scripts/root indices are excluded. Pure
fractions, complex renderer stacks, missing font metrics and ambiguous natural
line breaks can remain unassessed; no optical alignment is certified.

It also reviews gaps above both 12px and 0.65em before/after inline maths, and
gaps above 0.25em before trailing punctuation. Normal mathematical operator
spacing inside the expression is not inspected or rewritten. Known standalone
equation rows and block display maths are excluded. Visible content is checked
on each reveal; general HTML covers only the current document state.

Thresholds: `inlineMathBaselineTolerancePx`, `inlineMathBaselineToleranceEm`,
`inlineMathMaximumGapPx`, `inlineMathMaximumGapEm`, `inlineMathPunctuationGapEm`.
Selectors/switch: `inlineProseSelectors`, `inlineMathEnabled`.
Use `data-b35-allow-inline-math-offset` on a reviewed expression or prose scope.
The evidence records signed baseline offsets, spacing, thresholds and the
measurement method. `opticalAlignmentVerified` remains false.

### Watermark interference — B35-COMPOSITION-005

Visible text in `.hi-wm`, `.watermark`, `.watermark-text` or
`[data-b35-watermark]` is checked for geometric intersections with instructional
text/math elements. A warning needs at least three distinct content selectors
intersecting a watermark whose estimated text opacity is at least 0.08. The
estimate multiplies ancestor opacity and CSS text-color alpha.

Thresholds: `watermarkReviewMinimumOpacity`,
`watermarkMinimumContentIntersections`.
Selectors/switch: `watermarkSelectors`, `watermarksEnabled`.
Faint/nonintersecting/hidden watermarks are not reported. A reviewed branding
layout can use `data-b35-allow-watermark-overlap`.

Text-range rectangles can overstate intersections for rotated or spaced glyphs.
Stacking, opaque intervening cards, brightness, actual ink and pixel occlusion
are not resolved: `screenshotPixelsVerified` and `occlusionVerified` remain false.
Raster/background-image/pseudo-element watermarks require separate visual review.
This complements the contrast audit's exclusion of decorative watermark text;
it does not establish a universal opacity limit or remove required branding.

## Verification

Run `npm run test:presentation`. Fixtures include normal and problematic layouts,
responsive/flex layouts, slide scaling, hidden/intermediate reveals, natural
fraction/root/script geometry, repeated watermarks, configured HTML opt-in and
intentional exceptions. They run in a browser with in-memory HTML. They do not
require the private lesson HTML or certify a particular screenshot. Run
`npm run test:reproducible` for CLI scope, fonts, rendering evidence and history.
