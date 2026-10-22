"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const config = require("../config/b35.rules.json");
const { auditSvgFormulas } = require("../src/rules/svg-formula-rules.cjs");
const { auditFormulaStyles } = require("../src/rules/formula-style-rules.cjs");
const { auditVisualModels } = require("../src/rules/visual-model-rules.cjs");
const { auditVisualReview } = require("../src/rules/visual-review-rules.cjs");
const { auditComplementaryChecks } = require("../src/rules/complementary-rules.cjs");
const { auditLessonReusability } = require("../src/rules/reusability-rules.cjs");
const { capturePagePairState } = require("../src/rules/page-pair-rules.cjs");

const content = `<header class="hdr">Display-based lesson</header><div class="body">
  <p class="prompt" style="font:42px Arial">Find (a) the area, (b) the perimeter.</p>
  <div class="formula"><span style="font-family:Arial">2 + </span><span style="font-family:Georgia">3 = 5</span></div>
  <div class="work" style="font-size:10px"><math><mfrac><mn>1</mn><mn>2</mn></mfrac></math></div>
  <p>Teacher note: pause here.</p>
  <svg width="600" height="200" viewBox="0 0 600 200"><g>
    <text x="20" y="100" font-size="24">1% =</text>
    <foreignObject x="20" y="67" width="70" height="50">
      <div xmlns="http://www.w3.org/1999/xhtml" style="height:100%;display:flex;align-items:center;font-size:24px">
        <math><mfrac><mn>1</mn><mn>100</mn></mfrac></math>
      </div>
    </foreignObject>
  </g></svg></div>`;
const fixture = `<!doctype html><html><head><style>
  body{margin:0;font:20px Arial}.slide{width:960px;height:540px}p{margin:0}
</style></head><body>
  <section class="slide active" id="first">${content}</section>
  <section class="slide" id="second" style="display:none">${content}</section>
</body></html>`;

async function main() {
  const browser = await chromium.launch();
  const tests = [];
  try {
    const page = await browser.newPage({ viewport: config.viewport });
    await page.setContent(fixture);
    await page.evaluate(() => document.fonts.ready);
    const audits = [
      ["SVG collision", auditSvgFormulas, "B35-MATH-005"],
      ["formula typography", auditFormulaStyles, "B35-MATH-006"],
      ["fraction optical size", auditVisualModels, "B35-MATH-014"],
      ["question subparts", auditVisualReview, "B35-LAYOUT-006"],
      ["font size", auditComplementaryChecks, "B35-TYPE-001"],
      ["teacher directions", auditLessonReusability, "B35-CONTENT-002"]
    ];
    for (const [name, audit, rule] of audits) {
      const marked = await page.evaluate(audit, config);
      assert.ok(marked.some(item => item.rule === rule), `${name}: fixture must expose its known defect`);
      assert.ok(marked.every(item => item.slide === "first"));
      await page.evaluate(() => document.querySelector("#first").classList.remove("active"));
      const displayed = await page.evaluate(audit, config);
      assert.deepEqual(displayed, marked, `${name}: losing the active class must not lose coverage`);
      await page.evaluate(() => {
        document.querySelector("#first").style.display = "none";
        document.querySelector("#second").style.display = "block";
      });
      const later = await page.evaluate(audit, config);
      assert.ok(later.some(item => item.rule === rule));
      assert.ok(later.every(item => item.slide === "second" && item.runtimeSlide === 2));
      await page.evaluate(() => {
        document.querySelector("#second").style.display = "none";
        document.querySelector("#first").style.display = "block";
        document.querySelector("#first").classList.add("active");
      });
      tests.push(`${name}: marked and display-based pages have equal coverage; hidden pages excluded`);
    }
    const options = { config, metadata: { step: 0, runtimeSlide: 1, maxStep: 0 } };
    const marked = await page.evaluate(capturePagePairState, options);
    assert.ok(marked && marked.questions.length);
    await page.evaluate(() => document.querySelector("#first").classList.remove("active"));
    assert.deepEqual(await page.evaluate(capturePagePairState, options), marked);
    tests.push("page-pair snapshots also support display-based pages");
    await page.evaluate(() => document.querySelector("#first").style.display = "none");
    for (const [, audit] of audits) assert.deepEqual(await page.evaluate(audit, config), []);
    assert.equal(await page.evaluate(capturePagePairState, options), null);
    tests.push("no visible page yields no fabricated findings or page-pair snapshot");
    console.log(JSON.stringify({ passed: tests.length, failed: 0, tests }, null, 2));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
