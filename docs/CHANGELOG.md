# Changelog

## 1.7.0 — Validation history and change review

- Add configurable presentation-review warnings for large inter-block gaps,
  short final callout lines, displaced/spaced inline maths and watermark
  intersections. Extend existing comparison-card checks to two-method layouts,
  card edges and repeated equation rows; cover explanatory card prose through
  the existing prose-family rule. Preserve intentional-layout exceptions and
  fraction/root/script geometry. Update ruleVersion to html-validation/2.

- Automatically archive unique runs and append successful validations, failures,
  incomplete execution and source-only preflights to a local history log.
- Track document versions, run IDs, UTC timestamps, package/check versions and
  exact input/configuration/validator/evidence fingerprints.
- Generate change-review records against the last successful browser run per
  input/profile; record separate evidence-bound AI/human review assertions.
- Add `--history`, `--no-history`, `--log` and `record-review`; retain rule IDs,
  diagnostic evidence and exit-code meanings.
- Stage fresh output per run so a crashed runner cannot reuse an earlier pass or
  archived screenshot; flag input changes during execution as incomplete.
- Add history, review, failure and input-protection regressions and documentation.

## 1.6.1 — Project structure

- Separate CLI, orchestration helpers, profile runners and browser rules under src/.
- Move the installed command into bin/; preserve all three executable names and the two documented root source entry points.
- Group default configuration, manual record template, documentation and tests into dedicated directories.
- Add architecture/contributor guides, structural regression tests and fresh-install release smoke tests.
- Add npm run package to rebuild checksummed installer ZIPs and npm tarballs into ignored dist/; remove the generated ZIP from the source root.
- Update paths and versioned examples without changing rule implementations, defaults, finding schemas or report/exit semantics.

## 1.6.0 — Packaged validator

Terminal installation, auto/general-HTML profiles, full B35 lesson traversal, LLM-friendly diagnostics and human/agent installation guidance. Project/package renamed to hia-html-validator with compatibility aliases retained.
