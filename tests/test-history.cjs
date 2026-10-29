"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { fingerprint, validatorFingerprint, finalise } = require('../src/core/history.cjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hia history test '));
const cli = path.resolve(__dirname, '../bin/hia-html-validator.cjs');
const tests = [];
function test(name, fn) { fn(); tests.push(name); }
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const lines = file => fs.readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
function command(args, extra = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: temporary, encoding: 'utf8', timeout: 30000, ...extra });
  if (result.error) throw result.error;
  return result;
}
function fixture(name, contents) { const file = path.join(temporary, name); fs.writeFileSync(file, contents); return file; }
const html = body => `<!doctype html><html><meta charset="utf-8"><title>History fixture</title><body>${body}</body></html>`;
// Isolate the history/orchestration contract from Chromium availability. Actual
// browser integration remains covered by test-cli.cjs and the profile suites.
const simulatedRunner = fixture('completed runner.cjs', `
if (process.argv[1]?.endsWith('/validators/html.cjs')) {
  const fs = require('node:fs'), path = require('node:path');
  const out = process.argv[process.argv.indexOf('--out') + 1];
  const screenshots = process.argv.includes('--no-screenshots') ? [] : [{file:'screenshots/document.png',label:'Synthetic evidence bytes; not a browser image'}];
  const report = {schemaVersion:1,file:process.argv[2],fileName:path.basename(process.argv[2]),generatedAt:new Date().toISOString(),browser:{status:'COMPLETED'},summary:{errors:0,warnings:0},findings:[],screenshots};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report));
  fs.writeFileSync(path.join(out,'report.md'),'Synthetic runner report');
  fs.writeFileSync(path.join(out,'visual-review.html'),'<p>Synthetic runner evidence</p>');
  if(screenshots.length){fs.mkdirSync(path.join(out,'screenshots'));fs.writeFileSync(path.join(out,'screenshots/document.png'),'synthetic evidence bytes');}
  process.exit(0);
}
`);
const completedRunner = { env: { ...process.env, NODE_OPTIONS: `--require="${simulatedRunner}"` } };
try {
  test('fingerprints are stable for object key order and exact for HTML bytes', () => {
    assert.equal(fingerprint({ b: 2, a: 1 }), fingerprint({ a: 1, b: 2 }));
    assert.notEqual(fingerprint(Buffer.from('x\n')), fingerprint(Buffer.from('x\r\n')));
    assert.match(validatorFingerprint(), /^[a-f0-9]{64}$/);
  });
  const input = fixture('lesson with spaces.html', html('<h1>Initial content</h1>'));
  const out = path.join(temporary, 'latest'), history = path.join(temporary, '.hia-html-validator');
  let first, second;
  test('successful runner completion automatically logs a version and archives evidence', () => {
    const result = command([input, '--out', out], completedRunner);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    first = read(path.join(out, 'run.json'));
    assert.equal(first.status, 'CHECKS_PASSED'); assert.equal(first.documentVersion, 1);
    assert.equal(first.manualApproval, 'NOT_REVIEWED');
    assert.equal(first.changes.baselineRunId, null);
    assert.equal(first.inputFingerprint, fingerprint(fs.readFileSync(input)));
    assert.equal(lines(path.join(history, 'validation-log.jsonl'))[0].runId, first.runId);
    assert.ok(fs.existsSync(path.join(first.archive, 'screenshots/document.png')));
    assert.equal(read(path.join(first.archive, 'change-review.json')).status, 'NEEDS_REVIEW');
    const checks = lines(path.join(first.archive, 'checks.jsonl'));
    assert.equal(checks[0].result, 'CHECKS_PASSED'); assert.equal(checks[0].checkerType, 'SCRIPT');
    assert.equal(checks.length, 1, 'No invented per-rule successes');
  });
  const originalReport = fs.readFileSync(path.join(first.archive, 'report.json'));
  test('changed HTML gets the next version and compares the previous successful run', () => {
    fs.writeFileSync(input, html('<h1>Revised content</h1>'));
    const log = path.join(temporary, 'separate checks.jsonl');
    const result = command([input, '--out', out, '--no-screenshots', '--log', log], completedRunner);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    second = read(path.join(out, 'run.json'));
    assert.equal(second.documentVersion, 2); assert.notEqual(second.runId, first.runId);
    assert.equal(second.changes.baselineRunId, first.runId); assert.equal(second.changes.inputChanged, true);
    assert.equal(second.changes.optionsChanged, true); assert.equal(second.changes.configChanged, false);
    assert.equal(lines(log)[0].runId, second.runId);
    assert.deepEqual(fs.readFileSync(path.join(first.archive, 'report.json')), originalReport);
    assert.equal(fs.existsSync(path.join(second.archive, 'screenshots')), false, 'No stale screenshot in new evidence');
  });
  test('static-only results are logged as preflight and do not replace a browser baseline', () => {
    assert.equal(command([input, '--static-only', '--out', out]).status, 0);
    const preflight = read(path.join(out, 'run.json'));
    assert.equal(preflight.status, 'PREFLIGHT_PASSED'); assert.equal(preflight.documentVersion, 2);
    assert.equal(preflight.changes.baselineRunId, second.runId);
    assert.match(preflight.coverage.automated, /NO rendered/);
  });
  test('findings and incomplete execution never become successful baselines', () => {
    fs.writeFileSync(input, html('<script>const = ;</script>'));
    assert.equal(command([input, '--static-only', '--out', out]).status, 1);
    const failed = read(path.join(out, 'run.json'));
    assert.equal(failed.status, 'FAILED'); assert.equal(failed.changes.baselineRunId, second.runId);
    assert.ok(lines(path.join(out, 'checks.jsonl')).some(c => c.result === 'ERROR'));
    const crash = fixture('simulate runner crash.cjs', "if (process.argv[1]?.endsWith('/validators/html.cjs')) process.exit(2);\n");
    assert.equal(command([input, '--out', out], { env: { ...process.env, NODE_OPTIONS: `--require="${crash}"` } }).status, 2);
    const blocked = read(path.join(out, 'run.json'));
    assert.equal(blocked.status, 'INCOMPLETE'); assert.equal(blocked.changes.baselineRunId, second.runId);
    assert.equal(read(path.join(out, 'report.json')).browser.status, 'BLOCKED');
    assert.match(read(path.join(out, 'report.json')).browser.reason, /without writing a report/);
    assert.equal(fs.existsSync(path.join(blocked.archive, 'screenshots')), false);
  });
  test('input mutation during the runner is incomplete, never a versioned pass', () => {
    const mutator = fixture('simulate input change.cjs', "if (process.argv[1]?.endsWith('/validators/html.cjs')) { require('node:fs').appendFileSync(process.argv[2], '<!-- changed -->'); process.exit(2); }\n");
    assert.equal(command([input, '--out', out], { env: { ...process.env, NODE_OPTIONS: `--require="${mutator}"` } }).status, 2);
    assert.match(read(path.join(out, 'report.json')).browser.reason, /changed during validation/);
    assert.equal(read(path.join(out, 'run.json')).status, 'INCOMPLETE');
  });
  test('separate review assertions bind the exact archived run without changing results', () => {
    const draft = read(path.join(second.archive, 'change-review.json'));
    draft.review = { reviewerType: 'HUMAN', reviewerId: 'synthetic-test-reviewer', reviewedAt: new Date().toISOString(), decision: 'REVIEWED', notes: 'Synthetic fixture review only.', evidence: ['report.md: synthetic fixture'] };
    const reviewFile = fixture('review decision.json', JSON.stringify(draft));
    const result = command(['record-review', second.archive, '--review', reviewFile]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const review = lines(path.join(history, 'review-log.jsonl')).at(-1);
    assert.equal(review.runId, second.runId); assert.equal(review.review.reviewerId, 'synthetic-test-reviewer');
    assert.equal(read(path.join(second.archive, 'run.json')).manualApproval, 'NOT_REVIEWED');
    assert.equal(read(path.join(second.archive, 'change-review.json')).status, 'NEEDS_REVIEW');
    assert.equal(command(['record-review', out, '--review', reviewFile]).status, 2, 'Latest copies cannot impersonate the archive');
    draft.inputFingerprint = '0'.repeat(64); fs.writeFileSync(reviewFile, JSON.stringify(draft));
    assert.equal(command(['record-review', second.archive, '--review', reviewFile]).status, 2);
    assert.equal(lines(path.join(history, 'review-log.jsonl')).length, 1);
  });
  test('review rejects script attribution, missing evidence, future dates and modified evidence', () => {
    const draft = read(path.join(first.archive, 'change-review.json'));
    const valid = { reviewerType: 'AI', reviewerId: 'synthetic-test-reviewer', reviewedAt: new Date().toISOString(), decision: 'REVIEWED', notes: 'Test assertion', evidence: ['screenshots/document.png'] };
    const reviewFile = path.join(temporary, 'invalid review.json');
    for (const overrides of [{ reviewerType: 'SCRIPT' }, { evidence: [] }, { reviewedAt: '2999-01-01T00:00:00Z' }, { reviewedAt: '2000-01-01T00:00:00Z' }]) {
      fs.writeFileSync(reviewFile, JSON.stringify({ ...draft, review: { ...valid, ...overrides } }));
      assert.equal(command(['record-review', first.archive, '--review', reviewFile]).status, 2);
    }
    fs.writeFileSync(reviewFile, JSON.stringify({ ...draft, review: valid }));
    const reportFile = path.join(first.archive, 'report.json');
    fs.appendFileSync(reportFile, '\n');
    assert.equal(command(['record-review', first.archive, '--review', reviewFile]).status, 2);
    fs.writeFileSync(reportFile, originalReport);
  });
  test('history cannot overwrite a protected configuration through a symlink', () => {
    const config = fixture('config.json', '{}');
    const linked = path.join(temporary, 'symlink log'); fs.symlinkSync(config, linked);
    assert.equal(command([input, '--config', config, '--static-only', '--log', linked, '--out', out]).status, 2);
    assert.equal(fs.readFileSync(config, 'utf8'), '{}');
    assert.equal(command([input, '--static-only', '--log', input, '--out', out]).status, 2);
    const hardlink = path.join(temporary, 'hardlinked input log'); fs.linkSync(input, hardlink);
    const before = fs.readFileSync(input);
    assert.equal(command([input, '--static-only', '--log', hardlink, '--out', out]).status, 2);
    assert.deepEqual(fs.readFileSync(input), before);
    assert.equal(command([input, '--static-only', '--log', path.join(out, 'checks.jsonl'), '--out', out]).status, 2);
    assert.equal(command([input, '--history', out, '--out', out]).status, 2);
    assert.equal(command([input, '--history', history, '--no-history']).status, 2);
  });
  test('history write failures are explicit and cannot print a successful completion', () => {
    const lock = path.join(history, '.write-lock'); fs.writeFileSync(lock, 'test');
    const result = command([input, '--static-only', '--out', out]);
    assert.equal(result.status, 2); assert.match(result.stderr, /History is locked/);
    assert.doesNotMatch(result.stdout, /CHECKS COMPLETED/); fs.unlinkSync(lock);
  });
  test('report output cannot be redirected into archived evidence', () => {
    assert.equal(command([input, '--static-only', '--out', first.archive, '--no-history']).status, 2);
    const redirected = path.join(temporary, 'redirected report'); fs.mkdirSync(redirected);
    fs.symlinkSync(path.join(first.archive, 'report.json'), path.join(redirected, 'report.json'));
    assert.equal(command([input, '--static-only', '--out', redirected]).status, 2);
    assert.deepEqual(fs.readFileSync(path.join(first.archive, 'report.json')), originalReport);
  });
  test('history can be disabled while per-run metadata and an explicit log remain available', () => {
    const before = fs.readFileSync(path.join(history, 'validation-log.jsonl'));
    const result = command([input, '--static-only', '--no-history', '--log', path.join(temporary, 'no-history.jsonl'), '--out', out]);
    assert.equal(result.status, 1);
    assert.equal(read(path.join(out, 'run.json')).archive, null);
    assert.deepEqual(fs.readFileSync(path.join(history, 'validation-log.jsonl')), before);
  });
  test('batch logging retains independent run IDs and preflight outcomes for each file', () => {
    const clean = fixture('batch clean.html', html('<p>Clean fixture</p>'));
    const result = command([input, clean, '--static-only', '--out', path.join(temporary, 'batch')]);
    assert.equal(result.status, 1);
    const summary = read(path.join(temporary, 'batch/batch-summary.json'));
    assert.equal(summary.results.length, 2);
    assert.notEqual(summary.results[0].runId, summary.results[1].runId);
    assert.deepEqual(summary.results.map(r => read(path.join(r.archive, 'run.json')).status), ['FAILED', 'PREFLIGHT_PASSED']);
  });
  test('legacy lesson command shares history while retaining the lesson profile', () => {
    const out = path.join(temporary, 'legacy report');
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../validate-b35.cjs'), input, '--static-only', '--out', out], { cwd: temporary, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const run = read(path.join(out, 'run.json'));
    assert.equal(run.profile, 'lesson'); assert.equal(run.status, 'FAILED');
    assert.ok(fs.existsSync(path.join(run.archive, 'change-review.json')));
  });
  test('recursive input discovery excludes custom history even when it contains HTML galleries', () => {
    const { enumerate } = require('../src/cli/index.cjs');
    const base = path.join(temporary, 'scan'); fs.mkdirSync(base);
    fs.writeFileSync(path.join(base, 'page.html'), html('<p>Real input</p>'));
    const customHistory = path.join(base, 'custom history'); fs.mkdirSync(customHistory);
    fs.writeFileSync(path.join(customHistory, 'validation-log.jsonl'), '');
    fs.writeFileSync(path.join(customHistory, 'visual-review.html'), '<p>Generated gallery</p>');
    assert.deepEqual(enumerate([base], true), [fs.realpathSync(path.join(base, 'page.html'))]);
  });
  test('config, validator, profile and warning policy changes are visible independently of content', () => {
    const root = path.join(temporary, 'model history');
    let count = 0;
    function save({ config = {}, engine = 'engine-1', profile = 'html', exitCode = 0, warnings = 0, staticOnly = false } = {}) {
      const directory = path.join(temporary, `model-${count++}`); fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, 'resolved-config.json'), JSON.stringify(config));
      const report = { coverage: { profile }, summary: { errors: 0, warnings }, browser: { status: staticOnly ? 'SKIPPED BY --static-only' : 'COMPLETED' }, findings: [] };
      fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report));
      return finalise({ directory, historyDirectory: root, report, entry: { file: input, profile, exitCode, errors: 0, warnings, browser: report.browser.status }, input: Buffer.from('model HTML'), options: { staticOnly, failOnWarning: exitCode === 1 }, engineFingerprint: engine, startedAt: new Date().toISOString() });
    }
    const initial = save(), warningPass = save({ warnings: 1 });
    assert.equal(warningPass.status, 'CHECKS_PASSED'); assert.equal(warningPass.manualReviewRequired, true);
    const warningFail = save({ warnings: 1, exitCode: 1 }); assert.equal(warningFail.status, 'FAILED');
    const changed = save({ config: { threshold: 2 }, engine: 'engine-2' });
    assert.equal(changed.changes.baselineRunId, warningPass.runId);
    assert.equal(changed.changes.configChanged, true); assert.equal(changed.changes.validatorChanged, true);
    assert.equal(changed.changes.inputChanged, false); assert.equal(changed.documentVersion, initial.documentVersion);
    assert.equal(save({ profile: 'lesson' }).changes.baselineRunId, null);
  });
  console.log(JSON.stringify({ passed: tests.length, failed: 0, tests, coverage: 'History unit/orchestration tests with a simulated completed runner; actual Chromium integration is in test-cli.cjs.' }, null, 2));
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
