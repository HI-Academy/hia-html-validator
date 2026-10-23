"use strict";

// Self-contained: serialized into the lesson browser. No lesson-specific IDs.
function captureAnswerSequence(options = {}) {
  const config = options.config || {}, settings = config.answerSequence || {};
  const empty = { findings: [], answers: [], runtimeSlide: null, navigationAttempted: false };
  if (settings.enabled === false || config.policy?.answerSequenceSeverity === "off") return empty;
  const slides = [...document.querySelectorAll(config.selectors?.slides || ".slide")];
  const visible = node => {
    if (!node?.isConnected) return false;
    if (node.checkVisibility) return node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    for (let p = node; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.01) return false;
    }
    return node.getClientRects().length > 0;
  };
  let navigationAttempted = false;
  if (options.navigation === "previous") {
    const controls = [...document.querySelectorAll("button,[role=button],a[onclick]")].filter(visible);
    const back = controls.find(e => e.id === "prev" || /\b(?:prevSlide|previousSlide|prev|previous|back)\s*\(/i.test(e.getAttribute("onclick") || ""))
      || controls.find(e => e.closest(config.selectors?.navigator || ".nav") && /\b(?:back|previous)\b|^[←‹❮]/i.test(`${e.getAttribute("aria-label") || ""} ${e.textContent}`.trim()));
    navigationAttempted = true;
    if (back) back.click();
    else document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  }
  const active = slides.filter(s => s.classList.contains("active") && visible(s));
  const displayed = active.length ? active : slides.filter(visible);
  if (displayed.length !== 1) return { ...empty, navigationAttempted };
  const slide = displayed[0], runtimeSlide = slides.indexOf(slide) + 1;
  const pathFor = node => {
    if (!node) return null;
    const parts = [];
    for (let n = node; n; n = n.parentElement) {
      if (n.id) { parts.unshift(`#${CSS.escape(n.id)}`); break; }
      const peers = [...(n.parentElement?.children || [n])].filter(e => e.tagName === n.tagName);
      parts.unshift(`${n.localName}:nth-of-type(${peers.indexOf(n) + 1})`);
    }
    return parts.join(" > ");
  };
  const earliest = node => {
    let step = 0;
    for (let n = node; n; n = n.parentElement) {
      if (n.hasAttribute("data-step")) {
        const value = Number(n.getAttribute("data-step"));
        if (!Number.isInteger(value) || value < 1) return null;
        step = Math.max(step, value);
      }
      if (n === slide) break;
    }
    return step;
  };
  const answerSelector = settings.answers || ".p-a,.et-a,.practice-answer,.ans,[data-role=answer]";
  const questionSelector = settings.questions || ".p-q,.et-q,.qtitle,.prompt,[data-role=question]";
  const containerSelector = settings.containers || ".p-box,.et-box,.qcard,.practice-question,.student-question,[data-b35-question-answer]";
  const answers = [], findings = [];
  for (const answer of slide.querySelectorAll(answerSelector)) {
    let question = null;
    const reference = answer.getAttribute("data-b35-question-ref");
    if (reference) {
      const candidate = document.getElementById(reference);
      if (candidate && slide.contains(candidate) && candidate !== answer && !answer.contains(candidate)) question = candidate;
    } else {
      const container = answer.closest(containerSelector);
      if (container && slide.contains(container)) {
        const candidates = [...container.querySelectorAll(questionSelector)].filter(q => q !== answer && !answer.contains(q) && !q.closest(answerSelector));
        // Multiple questions in one wrapper are ambiguous; require an explicit ref.
        if (candidates.length === 1) question = candidates[0];
      }
    }
    const record = { selector: pathFor(answer), questionSelector: pathFor(question), text: answer.textContent.trim().slice(0, 250),
      questionVisible: question ? visible(question) : null, answerVisible: visible(answer),
      questionStep: question ? earliest(question) : null, answerStep: earliest(answer) };
    answers.push(record);
    if (question && record.answerStep !== null && record.questionStep !== null && record.answerStep <= record.questionStep
      && (record.answerStep > 0 || record.answerVisible)) {
      findings.push({ rule: "B35-ORDER-002", severity: config.policy?.answerSequenceSeverity || "error", slide: slide.id || null, runtimeSlide,
        header: slide.querySelector(config.selectors?.header || ".hdr")?.textContent.trim() || "", selector: record.selector,
        message: "An identified answer can appear no later than its question; give the question an independent attempt state.",
        evidence: { kind: "question-answer-reveal-dependency", ...record },
        expected: "The question and required model appear before its answer, including when both share a revealing parent.",
        impact: "A shared question/answer reveal exposes the answer before learners have an opportunity to attempt the task.",
        suggestedAction: "Show the question first and give its answer a later data-step. Mark legacy answers explicitly; do not hide the whole task to conceal its answer.",
        confidence: "Known question/answer classes or an explicit question reference; maximum ancestor data-step dependencies, not natural-language answer inference.",
        verification: ["Check every click, not only page entry; revisit the page after revealing its answers."],
        constraints: ["No automatic edits or mathematical changes. Unmarked diagram conclusions and ambiguous multi-question wrappers still need manual review."] });
    }
  }
  return { findings, answers, runtimeSlide, slide: slide.id || null, navigationAttempted };
}

function observeAnswerSequence(snapshot, history, config = {}) {
  const findings = [];
  if (config.answerSequence?.enabled === false || config.policy?.answerSequenceSeverity === "off") return findings;
  for (const a of snapshot.answers) {
    if (!a.questionSelector) continue;
    const key = `${snapshot.runtimeSlide}:${a.selector}`;
    if (a.answerVisible && !history.has(key)) findings.push({ rule: "B35-ORDER-002", severity: config.policy?.answerSequenceSeverity || "error",
      slide: snapshot.slide, runtimeSlide: snapshot.runtimeSlide, selector: a.selector,
      message: "An identified answer is visible before a separate question-only state was observed.",
      evidence: { kind: "observed-answer-before-attempt", ...a },
      expected: "A question-only attempt state precedes the answer in actual navigation.",
      suggestedAction: "Separate question and answer reveals and check CSS visibility, including their ancestors.",
      verification: ["Advance from page entry one click at a time and verify the question is visible before any answer."],
      constraints: ["Bounded to identified question/answer pairs; this does not infer answers from prose."] });
    if (a.questionVisible) history.add(key);
  }
  return findings;
}

async function auditAnswerReentry(page, config, baselines) {
  const findings = [], coverage = { enabled: config.answerSequence?.reentry !== false, visitedSlides: [], comparedAnswers: 0, notCheckedSlides: [], stopReason: null };
  if (!coverage.enabled || config.answerSequence?.enabled === false || config.policy?.answerSequenceSeverity === "off") { coverage.enabled = false; return { findings, coverage }; }
  let current = await page.evaluate(captureAnswerSequence, { config });
  for (let guard = 0; current.runtimeSlide > 1 && guard < baselines.size; guard++) {
    const before = current.runtimeSlide;
    const immediate = await page.evaluate(captureAnswerSequence, { config, navigation: "previous" });
    await page.evaluate(async () => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
    const settled = await page.evaluate(captureAnswerSequence, { config });
    if (!settled.runtimeSlide || settled.runtimeSlide >= before) { coverage.stopReason = "Previous-page navigation did not reach an earlier slide; remaining re-entry checks were not performed."; break; }
    current = settled;
    coverage.visitedSlides.push(settled.runtimeSlide);
    const baseline = baselines.get(settled.runtimeSlide);
    for (const a of baseline?.answers || []) {
      if (a.answerVisible) continue;
      const now = settled.answers.find(x => x.selector === a.selector);
      const instant = immediate.runtimeSlide === settled.runtimeSlide ? immediate.answers.find(x => x.selector === a.selector) : null;
      if (!now) continue;
      coverage.comparedAnswers++;
      if (now.answerVisible || instant?.answerVisible) findings.push({ rule: "B35-ORDER-003", severity: config.policy?.answerSequenceSeverity || "error",
        slide: settled.slide, runtimeSlide: settled.runtimeSlide, selector: a.selector,
        message: "An answer hidden on first entry is visible when returning to the page.",
        evidence: { kind: "answer-reset-on-reentry", initial: a, immediate: instant, settled: now },
        expected: "Answers reset to the same hidden state on re-entry, without a visible fade-out of the old solution.",
        suggestedAction: "Reset answer reveals on page entry and remove delayed hide transitions; keep the question available for a fresh attempt.",
        verification: ["Reveal the answer, navigate away, then return; check both immediate and settled visibility."],
        constraints: ["DOM visibility is sampled, not screenshot-pixel analysis. Async navigation may only have a settled observation; see evidence and coverage."] });
    }
  }
  coverage.notCheckedSlides = [...baselines].filter(([i, s]) => s.answers.some(a => !a.answerVisible) && !coverage.visitedSlides.includes(i)).map(([i]) => i);
  return { findings, coverage };
}
module.exports = { captureAnswerSequence, observeAnswerSequence, auditAnswerReentry };
