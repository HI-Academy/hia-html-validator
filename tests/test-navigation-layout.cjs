"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { runtimeAuditFunction } = require("../src/validators/lesson.cjs");
const defaults = require("../config/b35.rules.json");

(async () => {
  const browser = await chromium.launch();
  const passed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const fixture = async (css = "", markup = "", config = defaults) => {
      await page.setContent(`<!doctype html><style>
        *{box-sizing:border-box}body{margin:0;font:16px Arial}.slide{position:absolute;top:0;left:0;width:100vw;height:calc(100vh - 42px)}
        .hdr{height:48px}.body{height:calc(100% - 48px);display:flow-root}
        .nav{position:fixed;bottom:5px;left:50%;transform:translateX(-50%);height:32px;display:flex;align-items:center;gap:8px;padding:4px;background:#123;color:white}
        .nav span{display:inline-block;white-space:nowrap}button{height:24px}${css}</style>
        <section id="lesson" class="slide active"><div class="hdr">Question</div><div class="body"><p>Explain the answer.</p></div></section>
        <div class="nav"><button>Back</button><span id="counter">${markup || "1 / 1"}</span><span id="step">Step 0 / 0</span><button>Next</button></div>`);
      return (await page.evaluate(runtimeAuditFunction, config)).issues.filter(f => /^B35-NAV-/.test(f.rule));
    };
    const check = async (name, css, expected, markup, config) => {
      const findings = await fixture(css, markup, config);
      assert.deepEqual([...new Set(findings.map(f => f.rule))].sort(), expected.sort(), name + ": " + JSON.stringify(findings));
      passed.push(name);
    };
    await check("bottom-centred separate footer passes", "", []);
    await check("top-right navigation is caught without panel overlap", ".nav{top:5px;bottom:auto;right:8px;left:auto;transform:none}", ["B35-NAV-001", "B35-NAV-002"]);
    await check("bottom-left navigation fails centring", ".nav{left:5px;transform:none}", ["B35-NAV-001"]);
    await check("centred navigation far above footer fails", ".nav{bottom:100px}", ["B35-NAV-001", "B35-NAV-002"]);
    await check("clipped navigator fails viewport bounds", ".nav{bottom:-10px}", ["B35-NAV-001"]);
    await check("empty body space is not a reserved footer", ".slide{height:100vh}", ["B35-NAV-002"]);
    await check("footer within slide below shorter body passes", ".slide{height:100vh}.body{height:calc(100% - 90px)}", []);
    await check("hidden navigator fails", ".nav{display:none}", ["B35-NAV-001"]);
    await check("wrapped counters fail", ".nav{height:46px}.nav #step{width:32px;white-space:normal}", ["B35-NAV-002", "B35-NAV-003"]);
    await check("clipped counter text fails", ".nav #step{width:20px;overflow:hidden}", ["B35-NAV-003"]);
    await check("nested same-line markup is allowed", "", [], "<b>1</b> / <em>1</em>");
    const alternate = structuredClone(defaults); alternate.selectors.navigator = ".controls";
    await fixture(); await page.locator(".nav").evaluate(n => n.className = "controls");
    await page.addStyleTag({ content: ".controls{position:fixed;bottom:5px;left:50%;transform:translateX(-50%);display:flex;height:32px;align-items:center;gap:8px}" });
    assert.ok(!(await page.evaluate(runtimeAuditFunction, alternate)).issues.some(f => /^B35-NAV-/.test(f.rule))); passed.push("configured navigator selector works");
    const disabled = structuredClone(defaults); disabled.navigationLayout.enabled = false;
    await check("explicit policy opt-out is respected", ".nav{top:5px;bottom:auto}", [], undefined, disabled);
    for (const [width, height] of [[1280, 720], [768, 1024]]) {
      await page.setViewportSize({ width, height }); await check(`responsive footer ${width}x${height}`, "", []);
    }
    // Re-audit an actual later page/reveal: position must not be cached at entry.
    await page.setViewportSize({ width: 960, height: 540 }); await fixture();
    await page.evaluate(() => {
      document.querySelector(".slide").insertAdjacentHTML("afterend", '<section id="later" class="slide active"><div class="hdr">Later</div><div class="body"><p data-step="1">Working</p></div></section>');
      document.querySelector("#lesson").classList.remove("active"); document.querySelector("#lesson").style.display = "none";
      document.querySelector("#counter").textContent = "2 / 2"; document.querySelector("#step").textContent = "Step 1 / 1";
      document.querySelector(".nav").style.cssText = "top:5px;bottom:auto;right:8px;left:auto;transform:none";
    });
    assert.ok((await page.evaluate(runtimeAuditFunction, defaults)).issues.some(f => f.rule === "B35-NAV-001" && f.runtimeSlide === 2));
    passed.push("later reveal geometry is rechecked");
    console.log(JSON.stringify({ passed: passed.length, failed: 0, tests: passed }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
