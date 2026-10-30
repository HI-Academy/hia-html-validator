'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hia-latest-test-'));
try {
 const input=path.join(root,'input.html'),out=path.join(root,'out'),cli=path.resolve(__dirname,'../bin/hia-html-validator.cjs');
 fs.writeFileSync(input,'<html><body><p>Hello</p></body></html>');
 const run=(extra=[])=>spawnSync(process.execPath,[cli,input,'--static-only','--out',out,...extra],{encoding:'utf8'});
 let r=run();assert.equal(r.status,0,r.stderr);let first=JSON.parse(fs.readFileSync(path.join(out,'latest.json')));assert.equal(first.pass,1);assert.ok(first.warning>0);assert.equal(first.fail,0);
 assert.deepEqual(fs.readdirSync(out).sort(),['latest.json','latest.md']);
 r=run(['--fail-on-warning']);assert.equal(r.status,1,r.stderr);let second=JSON.parse(fs.readFileSync(path.join(out,'latest.json')));assert.equal(second.pass,0);assert.equal(second.fail,1);assert.equal(second.failures[0].file,input);
 assert.deepEqual(fs.readdirSync(out).sort(),['latest.json','latest.md']);
 r=run();assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(fs.readFileSync(path.join(out,'latest.json'))).fail,0);
 const bad=path.join(root,'bad.html');fs.writeFileSync(bad,'<html><script>const = ;</script></html>');
 r=spawnSync(process.execPath,[cli,bad,'--static-only','--out',out],{encoding:'utf8',env:{...process.env,TEMP:root,TMP:root}});assert.equal(r.status,1,r.stderr);const failed=JSON.parse(fs.readFileSync(path.join(out,'latest.json')));assert.equal(failed.fail,1);assert.match(failed.failures[0].summary,/HTML-SOURCE-002/);assert.ok(!fs.readdirSync(root).some(n=>n.startsWith('hia-validation-')));
 const missing=path.join(root,'missing.html');r=spawnSync(process.execPath,[cli,missing,'--out',out],{encoding:'utf8'});assert.equal(r.status,2);assert.equal(JSON.parse(fs.readFileSync(path.join(out,'latest.json'))).fail,1);
 const visual=path.join(root,'visual.html');fs.writeFileSync(visual,'<!doctype html><html><head><title>test</title></head><body><div style="width:5000px">wide</div></body></html>');fs.writeFileSync(path.join(out,'keep.txt'),'user data');
 r=spawnSync(process.execPath,[cli,visual,'--load-mode','memory','--out',out],{encoding:'utf8',env:{...process.env,TEMP:root,TMP:root},timeout:60000});assert.equal(r.status,1,r.stderr);const rendered=JSON.parse(fs.readFileSync(path.join(out,'latest.json')));assert.ok(rendered.results[0].evidence);assert.ok(fs.existsSync(path.join(out,rendered.results[0].evidence)));
 fs.writeFileSync(visual,'<!doctype html><html><head><title>test</title></head><body>ok</body></html>');r=spawnSync(process.execPath,[cli,visual,'--load-mode','memory','--out',out],{encoding:'utf8',env:{...process.env,TEMP:root,TMP:root},timeout:60000});assert.equal(r.status,0,r.stderr);assert.ok(!fs.existsSync(path.join(out,rendered.results[0].evidence)));assert.equal(fs.readFileSync(path.join(out,'keep.txt'),'utf8'),'user data');assert.ok(!fs.readdirSync(root).some(n=>n.startsWith('hia-validation-')));
 console.log('latest output checks passed');
} finally {fs.rmSync(root,{recursive:true,force:true});}
