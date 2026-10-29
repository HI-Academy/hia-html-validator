# Validation history and change review

Every run through `hia-html-validator` now records successful checks as well as
findings and incomplete execution. This follows the run IDs, timestamps,
versioned checks, fingerprints and separate review assertions used by the
[question bank validator](https://github.com/HI-Academy/HIA-website/blob/v2-y4-data-model/scripts/validate-question-bank.mjs).
The validation rules and approval requirements have not changed.

## Run and find the records

```bash
hia-html-validator lesson.html --out ./results/lesson
hia-html-validator lesson.html --out ./results/lesson --history ./validation-history
hia-html-validator lesson.html --log ./audit/checks.jsonl
```

The default history root is `.hia-html-validator/` in the working directory.
Use the same root on subsequent runs to retain version numbering and comparisons,
including when changing the report output directory. Each file in a batch gets
its own run ID and history record. Recursive discovery excludes history and
report directories. The default history directory is ignored by Git.

```text
.hia-html-validator/
  validation-log.jsonl       One append-only summary per run, including successes
  review-log.jsonl           Separately supplied review assertions
  runs/<runId>/
    run.json                Version, identity, result, coverage and fingerprints
    report.json / report.md Detailed findings
    resolved-config.json    Actual settings used
    visual-review.html      Screenshot gallery
    screenshots/            Captured evidence, when enabled
    checks.jsonl            Overall outcome plus actual findings
    change-review.json      Fingerprint-bound review draft and comparison
    change-review.md        Readable change summary
    reviews/<reviewId>.json  Append-only review assertions, when supplied
```

The selected `--out` directory still contains the latest reports and now includes
`checks.jsonl` and both change-review files. Reusing it does not overwrite earlier
history runs. Archives are created under unique run IDs and are never reused by
the tool. They remain ordinary local files, not a tamper-proof remote audit store.
Treat these local records as private content and manage retention yourself;
screenshots can consume substantial disk space. Nothing is uploaded.

`--log FILE.jsonl` additionally appends check records to a separate file, as in
the question bank validator. Each record includes the run ID, timestamp,
`checkerType: SCRIPT`, rule/package versions and fingerprints. The auditors emit
findings rather than exhaustive per-rule results, so the log records one overall
outcome and the actual findings. It never invents a PASS for an unobserved rule.

Use `--no-history` to omit the persistent archive and history logs. Per-run files
and an explicitly selected `--log` are still written. Without history, document
versions restart at 1 and no prior successful baseline is available. `--history`
and `--no-history` cannot be combined. The legacy lesson-only
`node validate-b35.cjs` / `npm run validate` entry points also use this history
layer and retain their forced `lesson` profile.

## What a version means

`run.json` retains its existing package `version`, profile, exit status and
coverage fields, with these additions:

- `runId`, `startedAt`, `completedAt`: unique run identity and UTC timestamps.
- `documentVersion`: the first-seen version of the exact HTML bytes at the
  canonical input path within this history root. Unchanged HTML retains its
  number; reverting to previously observed bytes reuses their original number.
  Renaming or moving an input starts a separate document history.
- `ruleVersion`: `html-validation/1`, the history/check contract version.
  `version` identifies the package release; `validatorFingerprint` detects
  implementation changes even if the release number was not updated.
- `inputFingerprint`: SHA-256 of the exact HTML bytes.
- `configFingerprint`: SHA-256 of the canonical resolved configuration.
- `validatorFingerprint`: SHA-256 over validator source, default configuration,
  package version and pinned dependency declarations.
- `evidenceFingerprint`: SHA-256 of the saved report/config/gallery/screenshot
  manifest. The manifest lists the SHA-256 of each evidence file.
- `options`: source-only, screenshot, offline, warning policy and timeout settings.
- `archive`: the preserved run directory; null when history is disabled.

Configuration and implementation objects use sorted keys for hashing. HTML and
saved evidence use exact bytes. HTML fingerprints do not track linked local or
remote asset bytes, fonts, browser binaries, source PDFs or mathematical truth.
The history preserves validation evidence, not an executable source/asset backup.
Check changed assets separately and inspect screenshots. Changed files during a
run are reported as incomplete; before/after hashing is not an atomic filesystem
snapshot and cannot detect a change that is reverted during execution.

Each comparison uses the last `CHECKS_PASSED` browser run for the same canonical
file and profile. It reports input, configuration, implementation and option
changes, before/after finding counts, runtime page counts and reveal-state counts
where available. It is not a semantic HTML diff. A successful run with warnings is
eligible as a baseline unless `--fail-on-warning` made it fail. Failed, incomplete
and source-only runs are logged but never replace a successful browser baseline.

| Logged status | Meaning |
| --- | --- |
| `CHECKS_PASSED` | Browser checks completed, with exit 0; warnings/manual review may remain. |
| `PREFLIGHT_PASSED` | Source-only checks returned exit 0; no rendered assurance. |
| `FAILED` | Exit 1: errors, or warnings under `--fail-on-warning`. |
| `INCOMPLETE` | Exit 2: browser/runner failure, timeout or changing input. |

No status grants manual acceptance. Every run keeps
`manualApproval: NOT_REVIEWED`. History/log write failures return exit 2, so a
run cannot silently claim that its required audit record was saved. A lock
serializes history writes; if a writer crashes, confirm it has stopped before
removing the specific `.write-lock` file. Never delete prior logs to get a pass.

## Record a change review

After inspecting the archived report, screenshots and relevant source evidence:

1. Copy the archived `change-review.json` to a separate working file.
2. Keep its run ID and all four fingerprints. Fill the `review` object:

   ```json
   {
     "reviewerType": "HUMAN",
     "reviewerId": "actual-reviewer-identifier",
     "reviewedAt": "actual ISO-8601 review timestamp",
     "decision": "REVIEWED",
     "notes": "Describe the changes checked and remaining limitations.",
     "evidence": ["report.md", "screenshots/document.png: describe observations"]
   }
   ```

3. Record that assertion against the archived run:

   ```bash
   hia-html-validator record-review \
     ./.hia-html-validator/runs/RUN_ID --review ./review-decision.json
   ```

Review types are `HUMAN` or `AI`; decisions are `REVIEWED` or `CHANGES_REQUESTED`.
Supply actual identity, date, notes and evidence references. The command rejects
missing fields, future dates, reviews predating completion, mismatched run/content/
config/validator/evidence fingerprints, modified archived evidence, and `SCRIPT`
claims of visual review. References are supplied assertions; the tool does not
authenticate reviewer identity or prove the cited material was inspected.

Review records are appended to `review-log.jsonl` and the archived run's
`reviews/` directory. Corrections require another assertion; previous entries
are retained. These records never suppress warnings, mutate automated results,
satisfy existing symbol-rendering approval contracts, or approve another run.
An AI reviewer must actually inspect the claimed evidence; merely filling this
form is not a visual review.
