# Verification

## 1.7.0 — Presentation review additions (30 October 2026)

- All 57 new presentation cases pass using in-memory rendered DOM fixtures,
  including comparison cards, explanatory prose, large block gaps, short final
  lines, inline maths, watermark interference and intentional exceptions.
- Existing focused suites pass: 83 visual-review, 127 complementary typography/
  geometry, 105 formula-style, 40 visual-model and seven SVG-formula cases.
  The 16 history and nine structure cases also pass.
- These browser-audit checks use the existing system Chromium 154.0.8037.57 via
  the package's Playwright dependency, rather than a downloaded matching binary.
  They do not navigate to local HTML files or establish screenshot approval.
- `npm test` was attempted with that browser. Structure, display-based slide and
  answer-sequence tests pass before the grouped-reveal CLI check reaches the
  browser's local-file navigation restriction. Full local-file/profile/package
  rendering integration remains blocked by environment policy.
- The installer rebuild succeeds. `npm run test:package` passes inventory,
  temporary installation, aliases, source-preflight history and dependency-file
  checks before local HTML rendering hits the same navigation policy.

The screenshot's source HTML was not supplied; these are reusable rule
regressions, not a completed validation of that particular page. The additions
change the ruleset to `html-validation/2`; previous history records remain intact.

## 1.7.0 — Validation history (29 October 2026)

Checked in the Linux development environment with Node.js 24.19.0, npm 11.9.0
and the package's pinned Playwright 1.62.1:

- All 16 browser-independent history/orchestration cases pass, including
  successful runner outcomes, exact version tracking, previous-success baselines,
  source-only and incomplete outcomes, crash/stale-report handling, batch logs,
  review identity/evidence binding, tampered evidence, failed writes and input
  path protection. Completed-browser outcomes are simulated in this suite;
  these are not rendered-validation results.
- All nine structure/syntax/documentation/metadata cases pass.
- The versioned installer ZIP and npm tarball build successfully, include the
  history module/tests/guide, and pass checksum verification.
- A fresh temporary-prefix installation from the built local tarball passes
  real source-preflight validation, history and check-log creation, review-draft
  creation, input preservation, and installed history/structure test suites.
- `npm test` and `npm run test:package` were attempted. Browser stages are blocked
  by the missing matching Chromium. The installed system Chromium rejects local
  HTML navigation by administrator policy. The approved matching-browser setup
  redirects from `cdn.playwright.dev` to `storage.googleapis.com`, which the
  environment's network allowlist currently blocks. No browser pass is claimed.

The history-only change did not alter rule implementations or thresholds. No real lesson, remote file,
global package prefix or shell startup file was modified. Browser regression and
fresh-install rendered checks must still be run after matching Chromium is
available. Nothing was published to npm or GitHub.

## 1.6.1 — Refactor verification

Verified locally on macOS with Node.js 24.19.0, npm 12.2.0 and pinned Playwright 1.62.1. A matching Chromium cache was already available. No system software, shell startup files or real global package prefix was changed.

- All 294 existing regression cases pass after moving source and tests.
- Nine additional structure cases pass: directory boundaries, executable aliases, legacy CLI imports/commands, working-directory independence, documentation links, lockfile metadata, JavaScript syntax and both npm pack JSON formats.
- Ten release smoke cases pass: artifact generation/checksums, npm and ZIP inventories, bash installation into a temporary prefix with spaces, all three installed aliases, dependency/browser availability, general-HTML rendering with screenshot evidence, lesson source preflight, lesson browser traversal, and installed-package structure/docs checks.
- The synthetic lesson smoke test covers two displayed pages, three reveal states and three screenshots. Test fixture findings are not evidence of visual approval; the test checks complete traversal and report generation.
- Tests of the installed commands unset NODE_PATH, preventing reliance on unrelated global dependencies.
- All six rule modules and config/b35.rules.json are byte-identical to the pre-refactor release. No thresholds, rule IDs, formula presentation policy, report acceptance rules or accessibility coverage changed.
- The root compatibility entry points remain available. Package binaries all use bin/hia-html-validator.cjs; source/default-config paths no longer depend on the current working directory.
- Generated tarballs, ZIPs, node_modules and reports are excluded from the source tree's Git inventory. No private lesson content or reports are packaged.

The new package builder was exercised with npm 12's object-shaped JSON; its compatibility with older npm array-shaped output is covered by a unit case, not a separate old-npm runtime installation. Linux/WSL, first-time Chromium downloads, automatic visual acceptance and mathematical correctness remain unverified. No package is published to npm by these checks or scripts.
