"use strict";
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {auditComplementaryChecks}=require('../src/rules/complementary-rules.cjs');
const config=require('../config/b35.rules.json');
const formula='<math id="outer"><mrow><mi>p</mi><mtext><svg width="30" height="36" viewBox="0 0 30 36"><path d="M1 20L5 17L9 32L15 2H29" fill="none" stroke="black"/><foreignObject x="15" y="6" width="15" height="28"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>A</mi></math></foreignObject></svg></mtext><mo>+</mo><mi>q</mi></mrow></math>';
(async()=>{const b=await chromium.launch(),passed=[];try{const p=await b.newPage({viewport:{width:960,height:540}});
async function load(html=formula,css=''){await p.setContent('<!doctype html><style>body{margin:0}.slide{width:960px;height:540px;transform-origin:top left}math{font:24px serif}'+css+'</style><section id="fixture" class="slide active"><div class="hdr">Baseline</div>'+html+'</section>');await p.evaluate(()=>document.fonts.ready)}
async function audit(cfg=config){const before=await p.locator('#fixture').innerHTML();const findings=(await p.evaluate(auditComplementaryChecks,cfg)).filter(x=>x.rule==='B35-MATH-025');assert.equal(await p.locator('#fixture').innerHTML(),before,'audit must restore markup');return findings}
async function align(){return p.evaluate(()=>{const ns='http://www.w3.org/1998/Math/MathML',text=document.querySelector('mtext'),inner=text.querySelector('math'),a=document.createElementNS(ns,'mspace'),c=document.createElementNS(ns,'mspace');for(const n of[a,c])for(const k of['width','height','depth'])n.setAttribute(k,'0px');text.after(a);inner.append(c);const scale=document.querySelector('.slide').getBoundingClientRect().width/960,d=(a.getBoundingClientRect().top-c.getBoundingClientRect().top)/scale/parseFloat(getComputedStyle(text).fontSize);a.remove();c.remove();const m=document.createElementNS(ns,'mpadded');m.setAttribute('voffset',-d+'em');m.setAttribute('height',-d+'em');m.setAttribute('depth','+'+d+'em');text.before(m);m.append(text);return d})}
await load();let f=await audit();assert.equal(f.length,1);assert.ok(Math.abs(f[0].evidence.offsetPx)>2);passed.push('unadjusted mixed SVG/MathML baseline is detected and probe markup restored');
await load();await align();assert.equal((await audit()).length,0);passed.push('measured MathML carrier aligns the embedded baseline');
await p.addStyleTag({content:'svg{transform:translateY(-8px)}'});assert.equal((await audit()).length,1);passed.push('visually displaced embedded content still fails after carrier correction');
await load();const cfg=structuredClone(config);cfg.complementaryChecks.symbolRendering.approvals=[{selector:'#outer',decision:'accepted'}];assert.equal((await audit(cfg)).length,1);passed.push('symbol review cannot bypass independent baseline check');
await load(formula,'svg{visibility:hidden}');assert.equal((await audit()).length,0);passed.push('unrevealed embeddings wait for visibility');
// Well-formed structural variants contain the embedding in a script/fraction.
const body=formula.match(/<mrow>([\s\S]*)<\/mrow>/)[1];
for(const [name,content] of [['fraction','<mfrac><mrow>'+body+'</mrow><mn>2</mn></mfrac>'],['exponent','<msup><mi>x</mi><mrow>'+body+'</mrow></msup>']]){await load('<math>'+content+'</math>');assert.equal((await audit()).length,0);passed.push(name+' structural positioning is excluded')}
await load('<math><mi>p</mi><msqrt><mi>A</mi></msqrt></math>');assert.equal((await audit()).length,0);passed.push('native MathML retains its separate checks');
await load();const off=structuredClone(config);off.complementaryChecks.embeddedMathBaseline.enabled=false;assert.equal((await audit(off)).length,0);passed.push('explicit policy disable works');
await load();const severity=structuredClone(config);severity.policy.embeddedMathBaselineSeverity='off';assert.equal((await audit(severity)).length,0);passed.push('severity off works');
await load(formula,'.slide{transform:scale(.75)}');const scaled=await audit();assert.ok(Math.abs(scaled[0].evidence.offsetPx-f[0].evidence.offsetPx)<.2);passed.push('offset measurement normalizes slide scale');
await align();assert.equal((await audit()).length,0);passed.push('aligned mixed renderer passes under slide scaling');
console.log(JSON.stringify({passed:passed.length,failed:0,tests:passed},null,2));}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
