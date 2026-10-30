"use strict";
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const pkg = require('../../package.json');

const RULE_VERSION = 'html-validation/3';
const fingerprint = value => crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex');
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
function validatorFingerprint() {
  const root = path.resolve(__dirname, '../..');
  function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? files(file) : [[path.relative(root, file), fingerprint(fs.readFileSync(file))]];
    });
  }
  return fingerprint({ version: pkg.version, dependencies: pkg.dependencies, files: [...files(path.join(root, 'src')), ...files(path.join(root, 'config')), ...files(path.join(root, 'bin')), ...['html-cli.cjs', 'validate-b35.cjs'].map(name => [name, fingerprint(fs.readFileSync(path.join(root, name)))])] });
}
// Resolve existing parent symlinks too, including when the target does not yet exist.
function canonical(file) {
  const absolute = path.resolve(file);
  if (fs.existsSync(absolute)) return fs.realpathSync(absolute);
  const parent = path.dirname(absolute);
  return parent === absolute ? absolute : path.join(canonical(parent), path.basename(absolute));
}
const inside = (file, directory) => file === directory || file.startsWith(directory + path.sep);
function protect(target, inputs) {
  const resolved = canonical(target);
  const observed = fs.existsSync(target) ? fs.statSync(target) : null;
  const collision = inputs.some(input => {
    if (input === resolved) return true;
    if (!observed || !fs.existsSync(input)) return false;
    const source = fs.statSync(input);
    return source.dev === observed.dev && source.ino === observed.ino;
  });
  if (collision) throw new Error(`Output would overwrite an input/configuration: ${target}`);
}
function json(file, value, exclusive = false) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: exclusive ? 'wx' : 'w' });
}
function readLog(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch { throw new Error(`Invalid history log at line ${index + 1}: ${file}. Preserve it and choose another --history directory.`); }
  });
}
function withLock(directory, action) {
  fs.mkdirSync(directory, { recursive: true });
  const lock = path.join(directory, '.write-lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`History is locked: ${lock}. Wait for the other writer; after a crash, confirm it has stopped before removing the lock.`);
    throw error;
  }
  try { return action(); } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function outcome(report, exitCode, staticOnly) {
  if (exitCode === 2) return 'INCOMPLETE';
  if (exitCode === 1) return 'FAILED';
  return staticOnly ? 'PREFLIGHT_PASSED' : 'CHECKS_PASSED';
}
function changes(previous, current) {
  return {
    baselineRunId: previous?.runId || null,
    baselineStatus: previous?.status || null,
    inputChanged: previous ? previous.inputFingerprint !== current.inputFingerprint : null,
    configChanged: previous ? previous.configFingerprint !== current.configFingerprint : null,
    validatorChanged: previous ? previous.validatorFingerprint !== current.validatorFingerprint : null,
    optionsChanged: previous ? fingerprint(previous.options) !== fingerprint(current.options) : null,
    renderingChanged: previous ? previous.renderingFingerprint !== current.renderingFingerprint : null,
    findingCounts: { before: previous ? { errors: previous.errors, warnings: previous.warnings } : null, after: { errors: current.errors, warnings: current.warnings } },
    pageCounts: { before: previous?.metrics?.runtimeSlides ?? null, after: current.metrics?.runtimeSlides ?? null },
    revealStates: { before: previous?.metrics?.revealStatesInspected ?? null, after: current.metrics?.revealStatesInspected ?? null }
  };
}
function checkRows(run, report) {
  const common = { schemaVersion: 1, runId: run.runId, checkedAt: run.completedAt, file: run.file, profile: run.profile, checkerType: 'SCRIPT', ruleVersion: run.ruleVersion, validatorVersion: run.version, inputFingerprint: run.inputFingerprint, configFingerprint: run.configFingerprint, validatorFingerprint: run.validatorFingerprint, evidenceFingerprint: run.evidenceFingerprint };
  // The auditors emit findings, not a pass for each rule. Record only the observed
  // overall result and actual findings; never invent successful per-rule checks.
  return [
    { ...common, check: 'AUTOMATED_VALIDATION', result: run.status, errors: run.errors, warnings: run.warnings, manualReviewRequired: true },
    ...report.findings.map(f => ({ ...common, check: f.rule, result: f.severity === 'error' ? 'ERROR' : f.severity === 'warning' ? 'REVIEW' : 'INFO', finding: f }))
  ];
}
function evidence(directory) {
  function files(base, relative = '') {
    return fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
      const name = path.join(relative, entry.name);
      // Reviews are separate assertions and never alter the validation evidence.
      if (!relative && !['report.json', 'report.md', 'visual-review.html', 'resolved-config.json', 'screenshots'].includes(entry.name)) return [];
      if (entry.isSymbolicLink()) throw new Error('Validation evidence cannot contain symlinks.');
      return entry.isDirectory() ? files(path.join(base, entry.name), name) : [{ file: name, sha256: fingerprint(fs.readFileSync(path.join(base, entry.name))) }];
    });
  }
  return files(directory);
}
function finalise({ directory, historyDirectory, logPath, report, entry, input, options, startedAt, engineFingerprint }) {
  const runId = crypto.randomUUID();
  const run = {
    schemaVersion: 1, runId, version: pkg.version, ruleVersion: RULE_VERSION,
    startedAt, completedAt: new Date().toISOString(), ...entry,
    status: outcome(report, entry.exitCode, options.staticOnly),
    inputFingerprint: fingerprint(input), configFingerprint: fingerprint(JSON.parse(fs.readFileSync(path.join(directory, 'resolved-config.json'), 'utf8'))),
    validatorFingerprint: engineFingerprint, options, coverage: report.coverage,
    renderingFingerprint: fingerprint({browserVersion:report.browser?.fontEnvironment?.browserVersion||null,fonts:options.fonts||[],loadMode:options.loadMode||'file'}),
    metrics: report.metrics || null, manualReviewRequired: true, manualApproval: 'NOT_REVIEWED',
    fingerprintScope: 'Exact HTML bytes, resolved configuration, validator source/dependencies, supplied font-file SHA256/descriptors, browser version, load mode and saved evidence. Other assets, system-font bytes and browser binary bytes are not versioned.'
  };
  run.evidence = evidence(directory);
  run.evidenceFingerprint = fingerprint(run.evidence);
  function save(previousRuns) {
    const sameFile = previousRuns.filter(r => r.file === run.file);
    const knownVersions = [...new Set(sameFile.map(r => r.inputFingerprint))];
    run.documentVersion = knownVersions.includes(run.inputFingerprint) ? knownVersions.indexOf(run.inputFingerprint) + 1 : knownVersions.length + 1;
    // Only a successful browser run is the rendered baseline. A preflight or
    // failed run never displaces it, and profiles have independent baselines.
    const previous = sameFile.filter(r => r.profile === run.profile && r.status === 'CHECKS_PASSED' && fingerprint(r.options?.pages||null)===fingerprint(run.options.pages||null)).at(-1);
    run.changes = changes(previous, run);
    run.historyDirectory = historyDirectory || null;
    run.archive = historyDirectory ? path.join(historyDirectory, 'runs', runId) : null;
    const review = {
      schemaVersion: 1, runId, inputFingerprint: run.inputFingerprint, configFingerprint: run.configFingerprint,
      validatorFingerprint: run.validatorFingerprint, evidenceFingerprint: run.evidenceFingerprint,
      status: 'NEEDS_REVIEW', changes: run.changes,
      review: { reviewerType: null, reviewerId: null, reviewedAt: null, decision: null, notes: '', evidence: [] },
      limitations: ['Automated success is not visual/source/mathematical approval.', 'Supplied font hashes are recorded; other external/local assets and system-font binary bytes are not covered. Compare screenshots and check changed assets separately.', 'Review attribution is a supplied assertion, not authenticated identity.']
    };
    json(path.join(directory, 'run.json'), run);
    json(path.join(directory, 'change-review.json'), review);
    fs.writeFileSync(path.join(directory, 'checks.jsonl'), checkRows(run, report).map(row => JSON.stringify(row)).join('\n') + '\n');
    fs.writeFileSync(path.join(directory, 'change-review.md'), `# HTML validation change review\n\nRun: ${runId}\nDocument version: ${run.documentVersion}\nResult: ${run.status}\nBaseline successful run: ${previous?.runId || 'none'}\n\nReview required; no approval has been recorded.\n\n\`\`\`json\n${JSON.stringify(run.changes, null, 2)}\n\`\`\`\n\nCopy change-review.json, fill its review fields with actual review evidence, then use record-review with the archived run directory. Do not edit archived evidence.\n`);
    if (run.archive) {
      fs.mkdirSync(path.dirname(run.archive), { recursive: true });
      fs.mkdirSync(run.archive); // Exclusive: never reuse a run ID or overwrite evidence.
      fs.cpSync(directory, run.archive, { recursive: true, force: false, errorOnExist: true });
      fs.appendFileSync(path.join(historyDirectory, 'validation-log.jsonl'), JSON.stringify(run) + '\n');
    }
    if (logPath) {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.appendFileSync(logPath, fs.readFileSync(path.join(directory, 'checks.jsonl')));
    }
    return run;
  }
  return historyDirectory ? withLock(historyDirectory, () => save(readLog(path.join(historyDirectory, 'validation-log.jsonl')))) : save([]);
}
function recordReview(directory, reviewFile) {
  directory = canonical(directory);
  const run = JSON.parse(fs.readFileSync(path.join(directory, 'run.json'), 'utf8'));
  const supplied = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
  if (!run.archive || canonical(run.archive) !== directory || !run.historyDirectory) throw new Error('record-review requires the archived run directory from run.json.');
  if (supplied.schemaVersion !== 1 || !['runId', 'inputFingerprint', 'configFingerprint', 'validatorFingerprint', 'evidenceFingerprint'].every(key => supplied[key] === run[key])) throw new Error('Review must bind the exact run and all four fingerprints from change-review.json.');
  if (fingerprint(evidence(directory)) !== run.evidenceFingerprint) throw new Error('Archived validation evidence has changed; review cannot be recorded.');
  const protectedPaths = [canonical(reviewFile), canonical(run.file), canonical(path.join(directory, 'run.json')), ...run.evidence.map(item => canonical(path.join(directory, item.file)))];
  protect(path.join(run.historyDirectory, 'review-log.jsonl'), protectedPaths);
  const review = supplied.review;
  if (!review || !['AI', 'HUMAN'].includes(review.reviewerType) || typeof review.reviewerId !== 'string' || !review.reviewerId.trim() || !['REVIEWED', 'CHANGES_REQUESTED'].includes(review.decision) || !Number.isFinite(Date.parse(review.reviewedAt)) || Date.parse(review.reviewedAt) < Date.parse(run.completedAt) || Date.parse(review.reviewedAt) > Date.now() || typeof review.notes !== 'string' || !review.notes.trim() || !Array.isArray(review.evidence) || !review.evidence.length || review.evidence.some(e => typeof e !== 'string' || !e.trim())) throw new Error('Supply reviewerType AI/HUMAN, reviewerId, reviewedAt (after completion, not future), decision REVIEWED/CHANGES_REQUESTED, notes and evidence references.');
  return withLock(run.historyDirectory, () => {
    const record = { schemaVersion: 1, reviewId: crypto.randomUUID(), recordedAt: new Date().toISOString(), runId: run.runId, inputFingerprint: run.inputFingerprint, configFingerprint: run.configFingerprint, validatorFingerprint: run.validatorFingerprint, evidenceFingerprint: run.evidenceFingerprint, review, attribution: 'External assertion; identity is not authenticated. Does not change automated results or rule approvals.' };
    const target = path.join(directory, 'reviews', record.reviewId + '.json');
    protect(target, [canonical(reviewFile)]);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    json(target, record, true);
    fs.appendFileSync(path.join(run.historyDirectory, 'review-log.jsonl'), JSON.stringify(record) + '\n');
    return target;
  });
}
module.exports = { RULE_VERSION, fingerprint, validatorFingerprint, canonical, inside, protect, finalise, recordReview };
