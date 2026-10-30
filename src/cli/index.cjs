#!/usr/bin/env node
"use strict";
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {configuration,profileFor,coverage,blockedReport,writeReport}=require('../core/cli-support.cjs');
const {canonical,inside,protect,fingerprint,validatorFingerprint,finalise,recordReview}=require('../core/history.cjs');
const {parsePages,readFontManifest}=require('../core/rendering.cjs');
const pkg=require('../../package.json');
const help=`hia-html-validator ${pkg.version}

Usage: hia-html-validator FILE.html [MORE.html ...] [options]
       hia-html-validator DIRECTORY --recursive [options]
       hia-html-validator setup [--with-deps]
       hia-html-validator doctor
       hia-html-validator init-config [FILE.json]
       hia-html-validator record-review RUN_DIRECTORY --review FILE.json

Options:
  --profile auto|lesson|html  auto selects B35 for .slide lesson markup
  --out DIRECTORY           output directory (batch: a subdirectory per file)
  --config FILE.json        JSON overrides, merged over profile defaults
  --viewport WIDTHxHEIGHT   single viewport, e.g. 1280x800
  --pages NUMBERS           lesson runtime pages, e.g. 44 or 2,4-6
  --font-manifest FILE.json local font files/descriptors/checksums for this run
  --load-mode file|memory   file default; memory requires self-contained HTML
  --static-only             source preflight only; NOT a visual pass
  --no-screenshots          run browser checks without image capture
  --offline                 block HTTP(S), WebSocket and service-worker access
  --fail-on-warning         exit 1 for warnings as well as errors
  --recursive               include nested .html/.htm files
  --timeout MILLISECONDS    per-file process limit, default 300000
  --history DIRECTORY       history root (default: .hia-html-validator in cwd)
  --no-history              omit persistent run archives/version history
  --log FILE.jsonl          append overall results and actual findings
  --help, -h                show help
  --version, -v             show version

Exit: 0 no errors (manual review remains); 1 findings; 2 invalid/incomplete.
Only validate trusted HTML: browser checks execute its JavaScript. --offline
is not an operating-system security sandbox. Reports never auto-fix input.`;
function parse(argv){
 const a={files:[],profile:'auto',timeout:300000,screenshots:true};
 for(let i=0;i<argv.length;i++){
  const v=argv[i];if(v==='--'){a.files.push(...argv.slice(i+1));break;}
  if(['--profile','--out','--config','--viewport','--timeout','--history','--log','--pages','--font-manifest','--load-mode'].includes(v)){const next=argv[++i];if(!next||next.startsWith('--'))throw new Error(`Missing value for ${v}`);a[v.slice(2)]=next;}
  else if(v==='--no-screenshots')a.screenshots=false;
  else if(['--static-only','--offline','--recursive','--fail-on-warning','--no-history'].includes(v))a[v.slice(2)]=true;
  else if(v==='--help'||v==='-h')a.help=true;
  else if(v==='--version'||v==='-v')a.version=true;
  else if(v.startsWith('-'))throw new Error(`Unknown option: ${v}`);
  else a.files.push(v);
 }
 if(!['auto','lesson','html'].includes(a.profile))throw new Error('--profile must be auto, lesson or html');
 if(a.history&&a['no-history'])throw new Error('--history and --no-history cannot be combined');
 a.pages=parsePages(a.pages);
 a['load-mode']=a['load-mode']||'file';
 if(!['file','memory'].includes(a['load-mode']))throw new Error('--load-mode must be file or memory');
 if(a.pages&&a['static-only'])throw new Error('--pages requires browser validation; source checks are document-wide');
 if(a['font-manifest']&&a['static-only'])throw new Error('--font-manifest requires browser validation');
 a.timeout=Number(a.timeout);if(!Number.isInteger(a.timeout)||a.timeout<1000||a.timeout>3600000)throw new Error('--timeout must be 1000–3600000 milliseconds');
 if(a.viewport){const m=/^(\d+)x(\d+)$/.exec(a.viewport);if(!m)throw new Error('--viewport must be WIDTHxHEIGHT');a.viewport={width:Number(m[1]),height:Number(m[2])};}
 return a;
}
function enumerate(inputs,recursive,exclude,historyDirectory){
 const results=new Set();
 function visit(file){
  const stat=fs.lstatSync(file);if(stat.isSymbolicLink()){if(fs.statSync(file).isFile()&&/\.html?$/i.test(file))results.add(fs.realpathSync(file));return;}
  if(stat.isDirectory()){
   const absolute=fs.realpathSync(file);if(absolute===path.parse(absolute).root||absolute===os.homedir())throw new Error('Choose a specific HTML folder, not the filesystem root or home folder.');
   for(const item of fs.readdirSync(file,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    if(item.name.startsWith('.')||item.name==='node_modules')continue;
    const target=path.join(file,item.name);if([exclude,historyDirectory].filter(Boolean).some(d=>inside(canonical(target),canonical(d))))continue;
    if(item.isDirectory()){const generatedReport=['report.json','report.md','visual-review.html'].every(name=>fs.existsSync(path.join(target,name)));const history=fs.existsSync(path.join(target,'validation-log.jsonl'));if(recursive&&!generatedReport&&!history)visit(target);}
    else if(/\.html?$/i.test(item.name))visit(target);
   }
  }else if(stat.isFile()&&/\.html?$/i.test(file))results.add(fs.realpathSync(file));
  else throw new Error(`Expected a local .html/.htm file or directory: ${file}`);
 }
 for(const input of inputs)visit(path.resolve(input));
 return [...results];
}
function doctor(){
 const result={version:pkg.version,node:process.version,nodeSupported:Number(process.versions.node.split('.')[0])>=20,playwright:null,chromiumInstalled:false};
 try{result.playwright=require('playwright/package.json').version;result.chromiumPath=require('playwright').chromium.executablePath();result.chromiumInstalled=fs.existsSync(result.chromiumPath);}catch(e){result.reason=e.message;}
 console.log(JSON.stringify(result,null,2));if(!result.nodeSupported||!result.chromiumInstalled){console.error('Install Node.js 20+ and run: hia-html-validator setup');process.exitCode=2;}
}
function playwrightCli(){return path.join(path.dirname(require.resolve('playwright/package.json')),'cli.js');}
function main(argv){
 if(argv[0]==='record-review'){
  if(argv.length!==4||argv[2]!=='--review')throw new Error('Usage: hia-html-validator record-review RUN_DIRECTORY --review FILE.json');
  console.log(`Review recorded: ${recordReview(argv[1],argv[3])}`);return;
 }
 if(argv[0]==='setup'){
  if(argv.slice(1).some(v=>v!=='--with-deps'))throw new Error('Usage: hia-html-validator setup [--with-deps]');
  const args=[playwrightCli(),'install',...(argv.includes('--with-deps')?['--with-deps']:[]),'chromium'];
  const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status===0?0:2;return;
 }
 if(argv[0]==='doctor'){if(argv.length!==1)throw new Error('Usage: hia-html-validator doctor');doctor();return;}
 if(argv[0]==='init-config'){
  if(argv.length>2)throw new Error('Usage: hia-html-validator init-config [FILE.json]');
  const target=path.resolve(argv[1]||'b35.config.json');fs.writeFileSync(target,JSON.stringify({schemaVersion:1,thresholds:{formulaMaximumFontSizeRatio:1.2},policy:{svgAccessibleNameSeverity:'off'}},null,2)+'\n',{flag:'wx'});console.log(`Created ${target}\nUse --config to load these overrides; existing files are never overwritten.`);return;
 }
 const a=parse(argv);if(a.help){console.log(help);return;}if(a.version){console.log(pkg.version);return;}if(!a.files.length)throw new Error(help);
 const explicitOut=a.out?path.resolve(a.out):null;
 const historyDirectory=a['no-history']?null:canonical(a.history||'.hia-html-validator'),logPath=a.log?canonical(a.log):null;
 const files=enumerate(a.files,a.recursive,explicitOut,historyDirectory);if(!files.length)throw new Error('No .html or .htm files found.');
 const batch=files.length>1,outRoot=explicitOut||path.resolve('html-validation');
 const fontManifest=a['font-manifest']?fs.realpathSync(a['font-manifest']):null,fonts=readFontManifest(fontManifest);
 const protectedPaths=files.concat(a.config?[fs.realpathSync(a.config)]:[],fontManifest?[fontManifest]:[],fonts.map(f=>f.path));
 function protectOutput(target){protect(target,protectedPaths);if(historyDirectory&&inside(canonical(target),historyDirectory))throw new Error(`Report output cannot overwrite history: ${target}`);}
 if(batch)protectOutput(path.join(outRoot,'batch-summary.json'));
 // Validate every input/config/output plan before any generated file is written.
 const jobs=files.map(file=>{
  const input=fs.readFileSync(file),profile=profileFor(input.toString('utf8'),a.profile),config=configuration(a.config,profile,a.viewport);
  if(a.pages&&profile!=='lesson')throw new Error('--pages is supported only by the lesson profile');
  const slug=path.basename(file,path.extname(file)).replace(/[^\p{L}\p{N}_.-]/gu,'-')||'document';
  const key=slug+'-'+crypto.createHash('sha256').update(file).digest('hex').slice(0,8);
  const out=batch?path.join(outRoot,key):explicitOut||path.resolve(slug+'-b35-report');
  const previousRun=path.join(out,'run.json');
  if(fs.existsSync(previousRun)){
   const previous=JSON.parse(fs.readFileSync(previousRun,'utf8'));
   if(previous.archive&&canonical(previous.archive)===canonical(out))throw new Error('An archived run cannot be reused as report output.');
  }
  for(const artifact of ['report.json','report.md','visual-review.html','resolved-config.json','run.json','checks.jsonl','change-review.json','change-review.md']){
   protectOutput(path.join(out,artifact));
  }
  if(historyDirectory&&(inside(canonical(out),historyDirectory)||inside(historyDirectory,canonical(out))))throw new Error('History and report output directories must be separate.');
  return {file,profile,config,out,input};
 });
 if(historyDirectory)for(const name of ['validation-log.jsonl','review-log.jsonl','.write-lock'])protect(path.join(historyDirectory,name),protectedPaths);
 if(logPath){protect(logPath,protectedPaths);if(jobs.some(j=>inside(logPath,canonical(j.out)))||(batch&&inside(logPath,canonical(outRoot)))||(historyDirectory&&inside(logPath,historyDirectory)))throw new Error('--log must be separate from report output and history directories.');}
 const engineFingerprint=validatorFingerprint();
 const options={staticOnly:!!a['static-only'],screenshots:a.screenshots,offline:!!a.offline,failOnWarning:!!a['fail-on-warning'],timeout:a.timeout,pages:a.pages,loadMode:a['load-mode'],fonts:fonts.map(({data,...metadata})=>metadata)};
 let code=0;const results=[];
 for(const job of jobs){
  const startedAt=new Date().toISOString(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'hia-validation-'));
  try{
  const resolved=path.join(directory,'resolved-config.json');fs.writeFileSync(resolved,JSON.stringify(job.config,null,2)+'\n');
  const runner=job.profile==='lesson'?'lesson.cjs':'html.cjs';
  const args=[path.join(__dirname,'../validators',runner),job.file,'--config',resolved,'--out',directory,'--load-mode',a['load-mode'],...(a.pages?['--pages',a.pages.join(',')]:[]),...(fontManifest?['--font-manifest',fontManifest]:[]),...(a['static-only']?['--static-only']:[]),...(!a.screenshots?['--no-screenshots']:[]),...(a.offline?['--offline']:[])];
  console.log(`Validating ${job.file} [${job.profile}]`);
  const child=spawnSync(process.execPath,args,{stdio:'pipe',encoding:'utf8',timeout:a.timeout,maxBuffer:16*1024*1024});
  let report;
  const reportPath=path.join(directory,'report.json');
  if(child.error||child.signal){
   const message=child.error?.code==='ETIMEDOUT'?`Validation exceeded ${a.timeout}ms; browser coverage is incomplete.`:child.error?.message||child.stderr?.trim()||'Validation could not complete. Run doctor and inspect the input.';
   report=blockedReport(job.file,job.profile,message);writeReport(directory,report);
  }else if(fs.existsSync(reportPath)){
   // Profile runners persist the detailed blocked report before exiting 2;
   // preserve its browser diagnostics instead of replacing it with a generic CLI error.
   report=JSON.parse(fs.readFileSync(reportPath,'utf8'));report.coverage={...coverage(job.profile,!!a['static-only'],a.pages),...report.coverage};fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  }else{
   const message=child.stderr?.trim()||`Validation runner exited ${child.status} without writing a report.`;
   report=blockedReport(job.file,job.profile,message);writeReport(directory,report);
  }
  if(!fs.existsSync(job.file)||fingerprint(fs.readFileSync(job.file))!==fingerprint(job.input)){
   report=blockedReport(job.file,job.profile,'Input HTML changed during validation. Rerun on a stable file; these results cannot identify a single version.');writeReport(directory,report);
  }
  report.coverage={...coverage(job.profile,!!a['static-only'],a.pages),...report.coverage};
  if(a.pages)report.coverage={...report.coverage,...coverage(job.profile,false,a.pages)};
  try{
   if(fontManifest&&fingerprint(readFontManifest(fontManifest).map(({data,...metadata})=>metadata))!==fingerprint(options.fonts))throw new Error('Font manifest/files changed during validation');
  }catch(error){report=blockedReport(job.file,job.profile,`${error.message}; rerun with stable font assets.`);report.coverage=coverage(job.profile,false,a.pages);writeReport(directory,report);}
  report.coverage.fullDeckValidated=job.profile==='lesson'&&!a.pages&&!a['static-only']&&report.browser.status==='COMPLETED';
  if(report.config)report.config='resolved-config.json';
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  const incomplete=child.error||child.signal||child.status===2||![0,1,2].includes(child.status)||(!a['static-only']&&report.browser.status!=='COMPLETED')||report.browser.status==='BLOCKED';
  const status=incomplete?2:report.summary.errors||(a['fail-on-warning']&&report.summary.warnings)?1:0;
  code=Math.max(code,status);const entry={file:job.file,profile:job.profile,exitCode:status,errors:report.summary.errors,warnings:report.summary.warnings,browser:report.browser.status,report:path.join(job.out,'report.md')};results.push(entry);
  const run=finalise({directory,historyDirectory,logPath,report,entry,input:job.input,options,startedAt,engineFingerprint});
  // Stage each run in a fresh directory: a crashed child must never reuse a
  // previous successful report or include its screenshots as fresh evidence.
  function copy(source,target){for(const item of fs.readdirSync(source,{withFileTypes:true})){const from=path.join(source,item.name),to=path.join(target,item.name);protectOutput(to);if(item.isDirectory()){fs.mkdirSync(to,{recursive:true});copy(from,to);}else fs.copyFileSync(from,to);}}
  fs.mkdirSync(job.out,{recursive:true});copy(directory,job.out);
  entry.runId=run.runId;entry.documentVersion=run.documentVersion;entry.archive=run.archive;
  console.log(`${status===2?'INCOMPLETE':status===1?'FINDINGS':'CHECKS COMPLETED'}: ${entry.errors} errors, ${entry.warnings} warnings; ${entry.report}`);
  if(run.archive)console.log(`Run ${run.runId}; document v${run.documentVersion}; history: ${run.archive}`);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
 }
 if(batch){fs.mkdirSync(outRoot,{recursive:true});fs.writeFileSync(path.join(outRoot,'batch-summary.json'),JSON.stringify({version:pkg.version,exitCode:code,results},null,2)+'\n');console.log(`Batch summary: ${path.join(outRoot,'batch-summary.json')}`);}
 process.exitCode=code;
}
function run(argv=process.argv.slice(2)){try{main(argv);}catch(error){console.error(`hia-html-validator: ${error.message}`);process.exitCode=2;}}
if(require.main===module)run();
module.exports={parse,enumerate,playwrightCli,run};
