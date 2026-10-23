"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const config = require("../config/b35.rules.json");
const { captureAnswerSequence, observeAnswerSequence, auditAnswerReentry } = require("../src/rules/answer-sequence-rules.cjs");
const shell = body => `<!doctype html><style>.slide{display:none;width:960px;height:540px}.slide.active{display:block}[data-step]{visibility:hidden;opacity:0}[data-step].visible{visibility:visible;opacity:1}</style><section class="slide active" id="one">${body}</section><section class="slide" id="two">Summary</section>`;
async function main() {
  const browser = await chromium.launch(), passed = [];
  try {
    const page = await browser.newPage({ viewport: config.viewport });
    const capture = () => page.evaluate(captureAnswerSequence, { config });
    for (const [container, q, a] of [["p-box", "p-q", "p-a"], ["et-box", "et-q", "et-a"]]) {
      await page.setContent(shell(`<div class="${container}" data-step="1"><div class="${q}">Which is longer?</div><div class="${a}">Blue</div></div>`));
      const s = await capture();
      assert.equal(s.findings.length, 1); assert.equal(s.answers[0].answerVisible, false);
      assert.equal(s.findings[0].evidence.questionStep, 1); assert.equal(s.findings[0].evidence.answerStep, 1);
      passed.push(`${container}: shared parent reveal detected even while initially hidden`);
    }
    await page.setContent(shell('<div class="p-box" data-step="3"><div class="p-q" data-step="1">Q</div><div class="p-a" data-step="2">A</div></div>'));
    assert.equal((await capture()).findings[0].evidence.answerStep, 3);
    passed.push("ancestor gating takes precedence over smaller child step numbers");
    await page.setContent(shell('<div class="et-box"><div class="et-q">Q</div><div class="et-a">A</div></div>'));
    assert.equal((await capture()).findings.length, 1);
    passed.push("answers visible at initial question state are detected");
    await page.setContent(shell('<div class="p-box"><div class="p-q">Q</div><div class="p-a" data-step="1">A</div></div>'));
    let s = await capture(); const history = new Set();
    assert.equal(s.findings.length, 0); assert.equal(observeAnswerSequence(s, history, config).length, 0);
    await page.locator('.p-a').evaluate(e => e.classList.add('visible'));
    assert.equal(observeAnswerSequence(await capture(), history, config).length, 0);
    passed.push("question first, later answer passes in actual reveal history");
    await page.setContent(shell('<div class="p-box"><div class="p-q">Q</div><div class="p-a" style="display:none">A</div></div>'));
    s = await capture(); const customHistory = new Set();
    assert.equal(s.findings.length,0); assert.equal(observeAnswerSequence(s,customHistory,config).length,0);
    await page.locator('.p-a').evaluate(e=>e.style.display='block');
    assert.equal(observeAnswerSequence(await capture(),customHistory,config).length,0);
    passed.push("independent CSS/JavaScript answer gates are not inferred to be initially visible");
    await page.setContent(shell('<div class="p-box"><div class="p-q" data-step="1">Q</div><div class="p-a" data-step="2" style="visibility:visible;opacity:1">A</div></div>'));
    s = await capture(); assert.equal(s.findings.length, 0);
    assert.equal(observeAnswerSequence(s, new Set(), config).length, 1);
    passed.push("CSS that leaks a nominally later answer is detected from rendered visibility");
    await page.setContent(shell('<p id="question">Question</p><p data-role="answer" data-b35-question-ref="question" data-step="1">Answer</p>'));
    assert.equal((await capture()).answers[0].questionSelector, '#question');
    assert.equal((await capture()).findings.length, 0);
    passed.push("explicit question references support separate sibling panels");
    await page.setContent(shell('<p>Definition and demonstration: a long object.</p><p class="ans">Longer means more length.</p><div class="p-box"><p class="p-q">Q1</p><p class="p-q">Q2</p><p class="p-a">A</p></div>'));
    assert.equal((await capture()).findings.length, 0);
    assert.ok((await capture()).answers.every(a => a.questionSelector === null));
    passed.push("unpaired definitions and ambiguous multi-question wrappers are not guessed");
    await page.setContent(shell('<div class="p-box" data-step="1"><p class="p-q">Q</p><p class="p-a">A</p></div>'));
    await page.locator('#one').evaluate(e => { e.classList.remove('active'); e.style.display = 'block'; });
    assert.equal((await capture()).findings.length, 1);
    await page.evaluate(() => { document.querySelector('#one').style.display='none'; const s=document.querySelector('#two');s.innerHTML='<div class="et-box"><p class="et-q">Later Q</p><p class="et-a">Later A</p></div>';s.classList.add('active'); });
    assert.ok((await capture()).findings.every(f => f.runtimeSlide === 2 && f.slide === 'two'));
    passed.push("display-only and later active slides have the same coverage");
    for (const mode of ['reset', 'stale', 'fade']) {
      await page.setContent(shell('<div class="p-box"><p class="p-q">Q</p><p class="p-a" data-step="1">A</p></div>') + '<button id="prev">Back</button>');
      if (mode === 'fade') await page.addStyleTag({ content: '.p-a{transition:opacity .3s,visibility .3s}' });
      const baseline = await capture();
      await page.evaluate(mode => {
        document.querySelector('.p-a').classList.add('visible');
        document.querySelector('#prev').onclick=()=>{document.querySelector('#two').classList.remove('active');document.querySelector('#one').classList.add('active');if(mode==='fade')void document.querySelector('.p-a').offsetWidth;if(mode!=='stale')document.querySelector('.p-a').classList.remove('visible');};
      }, mode);
      await page.evaluate(async()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));
      await page.evaluate(()=>{document.querySelector('#one').classList.remove('active');document.querySelector('#two').classList.add('active');});
      const result = await auditAnswerReentry(page, config, new Map([[1,baseline],[2,await capture()]]));
      assert.equal(result.findings.length, mode === 'reset' ? 0 : 1, mode);
      assert.equal(result.coverage.comparedAnswers, 1);
      if (mode === 'fade') { assert.equal(result.findings[0].evidence.immediate.answerVisible,true); assert.equal(result.findings[0].evidence.settled.answerVisible,false); }
      passed.push(`re-entry ${mode}: immediate and settled answer visibility checked`);
    }
    await page.setContent(shell('<div class="p-box"><p class="p-q">Q</p><p class="p-a" data-step="1">A</p></div>'));
    const first = await capture();
    await page.evaluate(()=>{document.querySelector('#one').classList.remove('active');document.querySelector('#two').classList.add('active');});
    const unavailable = await auditAnswerReentry(page, config, new Map([[1,first],[2,await capture()]]));
    assert.ok(unavailable.coverage.stopReason); assert.deepEqual(unavailable.coverage.notCheckedSlides,[1]);
    passed.push("missing previous-page navigation is disclosed, not fabricated as checked");
    await page.setContent(shell('Summary'));
    await page.evaluate(()=>{document.querySelector('#one').classList.remove('active');const s=document.querySelector('#two');s.classList.add('active');s.innerHTML='<p data-role="answer" data-step="1">Last-page answer</p>';});
    const last = await capture();
    const limited = await auditAnswerReentry(page,config,new Map([[2,last]]));
    assert.deepEqual(limited.coverage.notCheckedSlides,[2]);
    passed.push("last-page hidden answers are disclosed as not revisited");
    const disabled = {...config,answerSequence:{enabled:false}};
    assert.deepEqual((await page.evaluate(captureAnswerSequence,{config:disabled})).findings,[]);
    passed.push("configured disable is respected");
    const off = {...config,policy:{...config.policy,answerSequenceSeverity:'off'}};
    assert.equal((await page.evaluate(captureAnswerSequence,{config:off})).answers.length,0);
    assert.equal((await auditAnswerReentry(page,off,new Map())).coverage.enabled,false);
    passed.push("severity off consistently disables sequence and reset checks");
    console.log(JSON.stringify({passed:passed.length,failed:0,tests:passed},null,2));
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
