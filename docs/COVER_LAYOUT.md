# HI Academy standard cover — B35-COVER-001

Owner-approved layout, 31 October 2026, based on the accepted Pythagoras cover.
This lesson-only rule measures DOM geometry, not aesthetic screenshots. It applies
to declared `.cover`, `.unified-cover`, `[data-b35-page-role=cover]` slides and a
first slide with h1. General HTML disables it by default.

At 960×540 design scale: Program plus Chapter/Lesson, 48px title, 17px subtitle,
roughly 26px title/subtitle and subtitle/cards gaps (22–30px, difference ≤6px),
12–20px label/title gap, four aligned topic cards ending near y=477 (63px bottom
inset, ±3px). Cards must fit text and remain at least 180px tall. Normal one-line
title gives a row near y=199; long titles may wrap, with the lower edge retained
and card height reflowed. Do not move the whole row down when only extending it.

Configure `coverLayout` selectors/tolerances and `policy.coverLayoutSeverity`
(error by default). Explicit semantic selectors use `data-b35-cover` values
`program`, `title`, `subtitle`, `topics`. Unrecognised/missing cover components
report rather than silently pass. The rule does not infer year or curriculum
from filename, prove mathematical accuracy, or compare reference screenshot
pixels. Program text presence is bounded English Chapter/Lesson recognition;
human confirmation of the actual Program remains required.

The same component tokens apply to every topic card: 28px outer horizontal inset,
30px Program top inset, four equal columns with 12px gutters, 16px internal
padding, Nunito 900 17px topic heading, Nunito 800 16px/1.45 description, 12px
heading/description gap. The title is Nunito 900 and subtitle Nunito 800 at 1.5
line height. Each card must contain a real topic heading and learning description;
copy varies with the lesson but the semantic roles and typography stay consistent.
Existing role-family checks still apply; cover geometry does not certify that the
correct font binary loaded. Colours/watermark remain the maintained template's
visual contract rather than being inferred from theme names.

Reuse the maintained cover layout; do not fix geometry by shrinking teaching text,
disabling unrelated checks or fabricating visual approval. Run both 960×540 and
1920×1080 with real fonts. `node tests/test-cover-layout.cjs` exercises positive,
negative, wrapped-title, scaling and disabled-profile cases; included in npm test.
