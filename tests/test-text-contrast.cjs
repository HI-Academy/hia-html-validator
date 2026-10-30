"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const defaults = require('../config/b35.rules.json');
const { auditTextContrast } = require('../src/rules/text-contrast-rules.cjs');
async function main() {
  const browser = await chromium.launch(), tests = [];
  try {
    const page = await browser.newPage({ viewport: defaults.viewport });
    async function check(name, body, verify, overrides = {}) {
      await page.setContent(`<!doctype html><style>body{margin:0}.slide{width:960px;min-height:540px;background:#fff;font:20px Arial}.dark{background:#1a2b5f;color:white;padding:20px}.chip{display:inline-block;padding:12px;margin:6px;font-size:28px;font-weight:900}[data-step]{visibility:hidden}</style><section id="page" class="slide active"><div class="hdr">Contrast fixture</div><div class="body">${body}</div></section>`);
      await page.evaluate(() => document.fonts.ready);
      const cfg = { ...defaults, ...overrides, policy: { ...defaults.policy, ...overrides.policy } };
      const findings = await page.evaluate(auditTextContrast, cfg);
      verify(findings); tests.push(name); return findings;
    }
    const cards = ['#D9F7FF', '#FFF3BF', '#DCFCE7', '#FFF0D6'];
    for (const color of cards) {
      await check(`white inherited by plain div/span on ${color} fails`, `<div class="dark"><div id="chip" class="chip" style="background:${color}"><span id="label">9 thousands</span></div></div>`, xs => {
        const f = xs.find(f => f.selector === '#label'); assert.equal(f.rule, 'B35-CONTRAST-002'); assert.equal(f.severity, 'error');
        assert.equal(f.evidence.backgroundSelector, '#chip'); assert.ok(f.evidence.ratio < 1.6); assert.ok(f.evidence.recommended.some(c => c.color === '#1A2B5F'));
        for (const key of ['expected','impact','suggestedAction','confidence','verification','constraints']) assert.ok(f[key]);
      });
      await check(`navy on ${color} passes`, `<div class="dark"><div class="chip" style="background:${color};color:#1A2B5F">9 thousands</div></div>`, xs => assert.deepEqual(xs, []));
    }
    await check('white on navy passes', '<div class="dark">Question and answer</div>', xs => assert.deepEqual(xs, []));
    await check('black on near-black fails', '<div id="bad" style="background:#111;color:black">Answer 42</div>', xs => assert.ok(xs.some(f => f.selector === '#bad' && f.rule === 'B35-CONTRAST-002')));
    await check('transparent child uses nearest painted ancestor', '<div class="dark"><div id="pale" style="background:#fff3bf"><b id="label">5 hundreds</b></div></div>', xs => assert.ok(xs.some(f => f.selector === '#label' && f.evidence.backgroundSelector === '#pale')));
    await check('translucent background composited, not skipped', '<div style="background:black"><div id="alpha" style="background:rgba(255,255,255,.9);color:white">42</div></div>', xs => {
      const f = xs.find(f => f.selector === '#alpha'); assert.ok(Math.abs(f.evidence.background[0] - 229.5) < .1); assert.ok(f.evidence.ratio < 1.3);
    });
    await check('foreground alpha is accounted for', '<div id="alpha" style="background:white;color:rgba(0,0,0,.1)">Answer</div>', xs => assert.ok(xs.some(f => f.selector === '#alpha' && f.evidence.ratio < 1.3)));
    await check('ancestor group opacity is accounted for', '<div style="background:white"><div style="opacity:.1"><span id="faint">Answer</span></div></div>', xs => assert.ok(xs.some(f => f.selector === '#faint' && f.evidence.ratio < 1.3 && !f.evidence.recommended.length)));
    await check('hidden ancestors, unrevealed answers, watermark excluded', '<div style="display:none"><p style="background:white;color:white">Hidden</p></div><div style="opacity:0"><span>Transparent</span></div><div data-step="1" style="background:white;color:white">Future answer</div><div class="hi-wm" style="color:white;background:white">HI Academy</div>', xs => assert.deepEqual(xs, []));
    await check('visible child can override inherited visibility hidden', '<div style="visibility:hidden"><span id="override" style="visibility:visible;background:white;color:white">Visible child</span></div>', xs=>assert.ok(xs.some(f=>f.selector==='#override'&&f.rule==='B35-CONTRAST-002')));
    await check('large text gets 3:1, small text gets 4.5:1', '<div id="large" style="background:white;color:#888;font-size:24px">Large</div><div id="small" style="background:white;color:#888;font-size:20px">Small</div>', xs => { assert.ok(!xs.some(f => f.selector === '#large')); assert.equal(xs.find(f => f.selector === '#small').evidence.minimum, 4.5); });
    await check('14pt bold qualifies, just below does not', '<div id="large" style="background:white;color:#888;font:700 18.667px Arial">Large</div><div id="small" style="background:white;color:#888;font:700 18.66px Arial">Small</div>', xs => { assert.ok(!xs.some(f => f.selector === '#large')); assert.ok(xs.some(f => f.selector === '#small')); });
    await check('near-threshold ratios are not rounded up', '<div id="near" style="background:white;color:#959595;font-size:24px">Near threshold</div>', xs => assert.ok(xs.some(f=>f.selector==='#near'&&f.evidence.ratio<3)));
    await check('gradient requires review rather than fabricated contrast', '<div id="gradient" style="background:linear-gradient(white,black);color:white">Gradient</div>', xs => {const f=xs.find(f=>f.selector==='#gradient');assert.equal(f.rule,'B35-CONTRAST-003');assert.equal(f.evidence.screenshotPixelsVerified,false);});
    await check('opaque inner card masks ancestor gradient', '<div style="background:linear-gradient(white,black)"><div style="background:#fff;color:#1a2b5f">Readable</div></div>', xs => assert.deepEqual(xs, []));
    await check('SVG paint requires explicit review', '<svg width="300" height="60"><rect width="300" height="60" fill="#fff3bf"/><text id="svglabel" x="10" y="35" fill="white">5 hundreds</text></svg>', xs => assert.ok(xs.some(f => f.selector==='#svglabel'&&f.rule==='B35-CONTRAST-003')));
    await check('MathML tokens inherit and are checked', '<div class="dark"><div style="background:#fff3bf"><math><mfrac><mn id="numerator">3</mn><mn>5</mn></mfrac></math></div></div>', xs => assert.ok(xs.some(f => f.selector==='#numerator'&&f.rule==='B35-CONTRAST-002')));
    await check('document mode is supported', '<div style="background:#fff;color:white">Document</div>', xs => assert.ok(xs.some(f=>f.rule==='B35-CONTRAST-002')), {documentMode:true});
    await check('severity is configurable', '<div style="background:white;color:white">Review</div>', xs => assert.ok(xs.some(f=>f.rule==='B35-CONTRAST-002'&&f.severity==='warning')), {policy:{cardTextContrastSeverity:'warning'}});
    await check('rule can be explicitly disabled', '<div style="background:white;color:white">Review</div>', xs => assert.deepEqual(xs, []), {textContrast:{enabled:false}});
    await check('unmarked display-based slides covered, hidden slides excluded', '<span id="shown" style="background:white;color:white">Visible</span>', xs=>assert.ok(xs.some(f=>f.selector==='#shown')));
    await page.evaluate(()=>{document.querySelector('.slide').classList.remove('active');document.body.insertAdjacentHTML('beforeend','<section class="slide" style="display:none"><span style="background:white;color:white">Hidden page</span></section>');});
    assert.ok((await page.evaluate(auditTextContrast,defaults)).every(f=>f.runtimeSlide===1)); tests.push('display-based slide metadata excludes hidden page');
    await page.evaluate(()=>document.querySelector('#shown').style.color='#1a2b5f');
    assert.deepEqual(await page.evaluate(auditTextContrast, defaults), []); tests.push('correcting text colour clears the finding without changing content');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hia-text-contrast-'));
    try {
      const cli = path.resolve(__dirname, 'legacy-rule-runner.cjs');
      function run(name, html, profile) {
        const file=path.join(temp,name+'.html'),out=path.join(temp,name);
        fs.writeFileSync(file,html);
        const result=spawnSync(process.execPath,[cli,file,'--profile',profile,'--load-mode','memory','--no-screenshots','--out',out],{encoding:'utf8',timeout:60000});
        assert.ok(!result.error,String(result.error));
        return {code:result.status,report:JSON.parse(fs.readFileSync(path.join(out,'report.json')))};
      }
      const bad='<!doctype html><body><div style="background:#1a2b5f;color:white"><div id="card" style="background:#fff3bf"><span>5 hundreds</span></div></div></body>';
      let result=run('bad-document',bad,'html');
      assert.equal(result.code,1);assert.equal(result.report.browser.status,'COMPLETED');assert.ok(result.report.findings.some(f=>f.rule==='B35-CONTRAST-002'&&f.severity==='error'));tests.push('HTML CLI reports card contrast as an error and exits 1');
      result=run('good-document',bad.replace('id="card" style="','id="card" style="color:#1a2b5f;'),'html');
      assert.equal(result.code,0);assert.ok(!result.report.findings.some(f=>f.rule==='B35-CONTRAST-002'));tests.push('HTML CLI passes the same card after explicit navy text');
      const lesson='<!doctype html><style>.slide{width:960px;height:540px}.nav{position:fixed;bottom:0}[data-step]{visibility:hidden}[data-step].visible{visibility:visible}</style><section class="slide active" id="one"><div class="hdr">Contrast</div><div class="body"><div data-step="1" id="late" style="background:#fff3bf;color:white">Later answer</div></div></section><div class="nav"><button id="prev">Back</button><span id="counter">1 / 1</span><span id="step">Step 0 / 1</span><button id="next">Next</button></div><script>document.getElementById("next").onclick=()=>{document.getElementById("late").classList.add("visible");document.getElementById("step").textContent="Step 1 / 1"};document.getElementById("prev").onclick=()=>{document.getElementById("late").classList.remove("visible");document.getElementById("step").textContent="Step 0 / 1"};</script>';
      result=run('late-lesson',lesson,'lesson');
      assert.equal(result.code,1);assert.equal(result.report.browser.status,'COMPLETED');
      const failures=result.report.findings.filter(f=>f.rule==='B35-CONTRAST-002');
      assert.ok(failures.some(f=>f.state==='1/1'));assert.ok(!failures.some(f=>f.state==='0/1'));tests.push('lesson CLI checks later reveals, not hidden initial text');
    } finally { fs.rmSync(temp,{recursive:true,force:true}); }
    console.log(JSON.stringify({passed:tests.length,failed:0,tests},null,2));
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
