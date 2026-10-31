# Cover layout verification — 2026-10-31

Baseline: master 4cbc89b, validator 1.8.0; local Node/Playwright 1.62.1 on Windows.
The owner explicitly requested a common cover component and validator enforcement.

- `node tests/test-cover-layout.cjs`: 18 cases pass, including crowded header,
  row moved instead of extended, shortened bottom edge, missing Program, missing
  heading/description, incorrect card text size/weight/gap, unequal gutters,
  wrong insets, scaling, wrapped title and disabled generic-HTML profile.
- `node tests/test-visual-models.cjs`: passes existing model regressions.
- Actual approved Pythagoras cover and maintained shared template: no
  B35-COVER-001 findings. Browser tests at 960×540 and 1920×1080 confirm spacing,
  actual fonts, topic fit, answer reset and unaffected documentation examples.
- Whole shared-template memory-mode runs at both sizes: zero automated errors;
  92 review warnings remain from inherited mathematical/SVG/presentation content.
  No warning is waived by the cover check.

`npm test` stopped in test-text-contrast.cjs:66 (expected 0, received 1).
The same failure occurs in a clean detached checkout of unmodified master
4cbc89b. The local file transport emits a unique-file-origin resource/console
failure; memory transport completes the actual self-contained template run.
This records a pre-existing environment/baseline limitation, not a passing full
suite. No runtime check was suppressed and no browser security policy changed.
