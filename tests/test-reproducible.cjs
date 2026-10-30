"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const {parsePages,readFontManifest}=require('../src/core/rendering.cjs');
const {parse}=require('../src/cli/index.cjs');
const {fingerprint}=require('../src/core/history.cjs');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'hia reproducible ')),tests=[];
const cli=path.resolve(__dirname,'../bin/hia-html-validator.cjs');
function test(name,fn){fn();tests.push(name);}
function fixture(name,content){const p=path.join(temporary,name);fs.writeFileSync(p,content);return p;}
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function command(args){const r=spawnSync(process.execPath,[cli,...args],{cwd:temporary,encoding:'utf8',timeout:90000});if(r.error)throw r.error;return r;}
function validate(file,name,extra=[]){const out=path.join(temporary,name),r=command([file,'--load-mode','memory','--out',out,...extra]);assert.notEqual(r.status,2,r.stderr+r.stdout);return{out,result:r,report:read(path.join(out,'report.json')),run:read(path.join(out,'run.json'))};}
try{
 test('page selection is normalized and deduplicated',()=>assert.deepEqual(parsePages('4-6,2,4'),[2,4,5,6]));
 test('malformed, empty, reversed and excessive page selections fail',()=>{for(const v of ['','0','1,','a','3-1','1-10001'])assert.throws(()=>parsePages(v));});
 test('page-only preflight and invalid loading modes are rejected',()=>{assert.throws(()=>parse(['x.html','--pages','1','--static-only']));assert.throws(()=>parse(['x.html','--load-mode','server']));});
 const font=fixture('fixture.ttf',require('./fixtures/font.cjs'));
 const manifest=fixture('fonts.json',JSON.stringify({schemaVersion:1,fonts:[{family:'Validation Fixture',path:'fixture.ttf',weight:'400',sha256:fingerprint(fs.readFileSync(font))}]}));
 test('font manifest resolves local relative paths and exact hashes',()=>{const [f]=readFontManifest(manifest);assert.equal(f.path,font);assert.equal(f.sha256,fingerprint(fs.readFileSync(font)));assert.ok(f.bytes>0);});
 test('font checksum mismatch and descriptor errors fail before rendering',()=>{for(const change of [{sha256:'bad'},{weight:'900 100'},{path:'https://example.invalid/font.ttf'},{family:''}]){const file=fixture('invalid-fonts.json',JSON.stringify({schemaVersion:1,fonts:[{family:'Fixture',path:'fixture.ttf',...change}]}));assert.throws(()=>readFontManifest(file));}});
 const doc=fixture('font document.html','<!doctype html><html><meta charset="utf-8"><style>p{font:24px "Validation Fixture"}</style><body><p>AAAA</p></body></html>');
 let original;
 test('manifest font loads in Chromium and reports real platform glyph usage',()=>{
  original=validate(doc,'font report',['--font-manifest',manifest]);
  const env=original.report.browser.fontEnvironment;assert.equal(env.status,'OBSERVED');assert.equal(env.suppliedFonts[0].sha256,fingerprint(fs.readFileSync(font)));
  assert.ok(env.platformFonts.some(p=>p.fonts.some(f=>f.familyName==='Validation Fixture'&&f.isCustomFont&&f.glyphCount>0)),JSON.stringify(env));
  assert.match(original.run.renderingFingerprint,/^[a-f0-9]{64}$/);assert.ok(fs.existsSync(path.join(original.run.archive,'screenshots/document.png')));
 });
 test('font content changes rendering fingerprint and change review without changing HTML version',()=>{
  const bytes=fs.readFileSync(font);bytes[bytes.length-1]^=1;fs.writeFileSync(font,bytes);
  // A metadata/padding byte mutation keeps this self-authored fixture loadable.
  fs.writeFileSync(manifest,JSON.stringify({schemaVersion:1,fonts:[{family:'Validation Fixture',path:'fixture.ttf'}]}));
  const next=validate(doc,'changed font report',['--font-manifest',manifest,'--no-screenshots']);
  assert.equal(next.run.documentVersion,original.run.documentVersion);assert.notEqual(next.run.renderingFingerprint,original.run.renderingFingerprint);assert.equal(next.run.changes.renderingChanged,true);
 });
 const lesson=fixture('scoped lesson.html',`<!doctype html><html><meta charset="utf-8"><style>body{margin:0}.slide{display:none;width:960px;height:540px}.slide.active{display:block}.hdr{height:40px}.body{height:400px}.nav{position:fixed;bottom:0}[data-step]{visibility:hidden}[data-step].visible{visibility:visible}</style><body>
 <section class="slide active" id="first"><header class="hdr">First</header><div class="body"><div style="width:3000px">Unselected overflow</div></div></section>
 <section class="slide" id="second"><header class="hdr">Second</header><div class="body"><p>Initial text.</p><p data-step="1">One explanation.</p><p data-step="2">Final explanation.</p></div></section>
 <section class="slide" id="third"><header class="hdr">Third</header><div class="body">More content.</div></section>
 <span id="counter"></span><span id="step"></span><nav class="nav"><button id="prev" onclick="prev()">Previous</button><button id="next" onclick="next()">Next</button></nav>
 <script>const slides=[...document.querySelectorAll('.slide')];let index=0,beat=0;function render(){slides.forEach((s,i)=>{s.classList.toggle('active',i===index);s.querySelectorAll('[data-step]').forEach(n=>n.classList.toggle('visible',Number(n.dataset.step)<=beat))});document.querySelector('#counter').textContent=(index+1)+' / 3';document.querySelector('#step').textContent='Step '+beat+' / '+(index===1?2:0)}function next(){if(index===1&&beat<2)beat++;else if(index<2){index++;beat=0}render()}function prev(){if(index>0){index--;beat=0}render()}render();</script></body></html>`);
 let scoped;
 test('page selection audits only requested page and captures every reveal without removing other DOM pages',()=>{
  scoped=validate(lesson,'page 2',['--pages','2']);assert.equal(scoped.report.browser.status,'COMPLETED');assert.deepEqual(scoped.report.states.map(s=>[s.runtimeSlide,s.step]),[[2,0],[2,1],[2,2]]);
  assert.ok(scoped.report.findings.every(f=>!f.runtimeSlide||f.runtimeSlide===2));assert.equal(scoped.report.metrics.runtimeSlides,3);assert.equal(scoped.report.screenshots.length,3);assert.equal(scoped.report.coverage.fullDeckValidated,false);
  assert.equal(scoped.report.coverage.scope,'SELECTED_RUNTIME_PAGES');assert.equal(scoped.report.pagePairStates.length,0);assert.equal(scoped.report.answerSequenceCoverage.enabled,false);assert.equal(scoped.report.findings.some(f=>f.rule==='B35-SOURCE-001'),false);
 });
 test('full runs retain unselected overflow and do not use scoped successful baseline',()=>{
  const full=validate(lesson,'full report',['--no-screenshots']);assert.ok(full.report.findings.some(f=>f.runtimeSlide===1&&f.severity==='error'));assert.equal(full.run.changes.baselineRunId,null);assert.equal(full.report.coverage.scope,'FULL_LESSON');
 });
 test('selection history stays separate for other page scopes',()=>{const other=validate(lesson,'page 3',['--pages','3','--no-screenshots']);assert.equal(other.run.changes.baselineRunId,null);const repeat=validate(lesson,'page 2 repeat',['--pages','2','--no-screenshots']);assert.equal(repeat.run.changes.baselineRunId,scoped.run.runId);});
 test('out-of-range page is incomplete rather than a false pass',()=>{const out=path.join(temporary,'missing page');assert.equal(command([lesson,'--pages','4','--load-mode','memory','--out',out]).status,2);const r=read(path.join(out,'report.json'));assert.equal(r.browser.status,'BLOCKED');assert.equal(r.coverage.fullDeckValidated,false);assert.match(r.browser.reason,/exceeds/);});
 test('ordinary HTML rejects lesson page selection',()=>assert.equal(command([doc,'--pages','1']).status,2));
 test('memory loading rejects unresolved relative resources',()=>{for(const body of ['<img src="photo.png">','<style>body{background:url(photo.png)}</style>','<img srcset="a.png 1x,b.png 2x">']){const file=fixture('relative.html','<!doctype html><html><body>'+body+'</body></html>'),out=path.join(temporary,'relative report');assert.equal(command([file,'--load-mode','memory','--out',out,'--no-screenshots']).status,2);assert.match(read(path.join(out,'report.json')).browser.reason,/self-contained/);}});
 test('bad font bytes produce an incomplete run, not fallback assurance',()=>{fixture('bad.ttf','not a font');const bad=fixture('bad.json',JSON.stringify({schemaVersion:1,fonts:[{family:'Bad',path:'bad.ttf'}]}));assert.equal(command([doc,'--font-manifest',bad,'--load-mode','memory','--out',path.join(temporary,'bad font report')]).status,2);});
 console.log(JSON.stringify({passed:tests.length,failed:0,tests},null,2));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
