"use strict";

// Self-contained browser snapshot; hidden reveal children can reserve geometry.
function captureLayoutState({config,metadata}) {
  if(config.layoutStability?.enabled===false)return null;
  const shown=e=>{for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<=.01)return false;}return true;};
  const slides=[...document.querySelectorAll(config.selectors.slides)];
  const slide=slides.find(e=>e.classList.contains('active'))||slides.find(e=>shown(e)&&e.getBoundingClientRect().width>0);
  if(!slide||slide.matches('.cover,.closing,[data-b35-page-kind="cover"],[data-b35-page-kind="closing"]'))return null;
  const root=slide.getBoundingClientRect(),scale=slide.offsetWidth?root.width/slide.offsetWidth:1;
  if(!(scale>0))return null;
  const path=e=>{const a=[];for(let n=e;n;n=n.parentElement){if(n.id){a.unshift('#'+n.id);break;}const peers=[...n.parentElement.children].filter(p=>p.localName===n.localName);a.unshift(n.localName+(peers.length>1?':nth-of-type('+(peers.indexOf(n)+1)+')':''));if(n===slide)break;}return a.join(' > ');};
  const rect=e=>{const r=e.getBoundingClientRect();return {left:(r.left-root.left)/scale,top:(r.top-root.top)/scale,width:r.width/scale,height:r.height/scale};};
  const role=e=>e.matches('.challenge-box,.student-question')?'task':e.matches('.steps-col,.working')?'working':e.matches('.formula-panel')?'concept':e.matches('.visual-card')?'diagram':e.matches('.practice-questions')?'questions':e.matches('.practice-answers')?'answers':e.matches('.summary-card')?'summary':e.matches('.route-card')?'route':e.matches('.card')?'card':null;
  const selector=config.layoutStability?.groupSelectors||'.two,.three,.four,.concept-board,.practice-grid,.paired-practice,[data-b35-layout-columns]';
  const groups=[];
  for(const group of slide.querySelectorAll(selector)){
    if(!shown(group)||group.parentElement.closest(selector))continue;
    const children=[...group.children].filter(e=>!e.matches('script,style'));
    if(children.length<2||children.length>4)continue;
    const roles=children.map(role),declared=group.getAttribute('data-b35-layout-family')||slide.getAttribute('data-b35-layout-family');
    const signature=roles.join('/');
    const uniform=roles[0]&&roles.every(r=>r===roles[0])&&['card','summary','route'].includes(roles[0]);
    const inferred={'task/working':'worked-example','concept/diagram':'concept-diagram','concept/card':'concept-detail','questions/answers':'paired-practice'}[signature]||(uniform?{'card':'comparison','summary':'summary','route':'route-map'}[roles[0]]:null);
    if(!declared&&!inferred)continue;
    const box=rect(group),padding=parseFloat(getComputedStyle(group).paddingTop)||0;
    const slots=children.map((e,i)=>{
      const b=rect(e),style=getComputedStyle(e),first=[...e.children].find(c=>c.getBoundingClientRect().height>0);
      const innerTopGap=roles[i]==='working'&&first?(first.getBoundingClientRect().top-e.getBoundingClientRect().top)/scale-(parseFloat(style.paddingTop)||0):0;
      return {role:roles[i]||'column-'+i,selector:path(e),...b,topGap:b.top-box.top-padding,innerTopGap};
    });
    groups.push({selector:path(group),family:(declared||inferred)+':'+signature,slots,
      variationReason:(group.getAttribute('data-b35-layout-variation')||slide.getAttribute('data-b35-layout-variation')||'').trim()});
  }
  return {...metadata,slideId:slide.id,groups};
}

function auditLayoutStability(snapshots,config) {
  const settings=config.layoutStability||{};if(settings.enabled===false)return [];
  const tolerance=settings.tolerancePx??8,severity=config.policy.layoutStabilitySeverity||'warning';if(severity==='off')return [];
  const records=snapshots.filter(Boolean),findings=[],seen=new Set(),initial=new Map(),families=new Map();
  const emit=(rule,record,group,kind,message,evidence,relatedLocations=[])=>findings.push({rule,severity,slide:record.slideId,runtimeSlide:record.runtimeSlide,header:record.header,selector:group.selector,state:`${record.step}/${record.maxStep}`,message,
    expected:'Use a stable top-aligned frame for each page type; reserve working space before revealing answers.',
    suggestedAction:'Repair the shared layout template: top-align columns, reserve the final working area and keep comparable frame positions, widths and heights stable. Do not shrink fonts or remove teaching content. Use a distinct layout family or a specific documented variation when content genuinely needs another frame.',
    impact:'Centred, content-sized frames move between pages or reveal states, making the reader repeatedly relocate the question and working.',
    confidence:'Settled, unscaled DOM frame geometry for recognized or explicitly declared two-to-four-column page types; not screenshot analysis or proof that the reference page is correct.',
    verification:['Revalidate initial and final reveals and compare normal-size screenshots of the affected page family.'],
    constraints:['Different page types are not required to share dimensions.','Individual solution-line heights are not compared across pages.','Whitespace approvals do not exempt alignment or reveal stability.'],relatedLocations,evidence:{kind,tolerancePx:tolerance,...evidence}});
  for(const record of records)for(const group of record.groups||[]){
    const key=record.runtimeSlide+'|'+group.selector;
    if(!seen.has(key)&&group.slots.some(s=>Math.abs(s.topGap)>tolerance||s.innerTopGap>tolerance)){
      emit('B35-LAYOUT-007',record,group,'teaching-frame-top-alignment','Teaching columns or the working stack start below their shared top anchor; review vertical centring.',{slots:group.slots});seen.add(key);
    }
    if(!initial.has(key)){
      initial.set(key,{record,group});
      if(!group.variationReason){if(!families.has(group.family))families.set(group.family,[]);families.get(group.family).push({record,group});}
    }else{
      const before=initial.get(key),changed=[];
      group.slots.forEach((s,i)=>{const old=before.group.slots[i];if(!old)return;for(const dimension of ['left','top','width','height'])if(Math.abs(s[dimension]-old[dimension])>tolerance)changed.push({selector:s.selector,dimension,initial:old[dimension],current:s[dimension]});});
      if(changed.length&&!seen.has('reveal|'+key)){emit('B35-LAYOUT-008',record,group,'teaching-frame-reveal-shift','Question/working frame moves or resizes as content is revealed.',{initialState:before.record.step,currentState:record.step,changed});seen.add('reveal|'+key);}
    }
  }
  for(const [family,members]of families){
    if(members.length<2)continue;
    const changed=[];
    members[0].group.slots.forEach((slot,index)=>{for(const dimension of ['left','top','width','height']){
      const values=members.map(m=>({runtimeSlide:m.record.runtimeSlide,slide:m.record.slideId,selector:m.group.slots[index].selector,value:m.group.slots[index][dimension]}));
      const range=Math.max(...values.map(v=>v.value))-Math.min(...values.map(v=>v.value));
      if(range>tolerance)changed.push({role:slot.role,dimension,range,values});
    }});
    if(changed.length){const first=members[0];emit('B35-LAYOUT-009',first.record,first.group,'page-family-frame-variation','Pages sharing a layout family have inconsistent question/working frame positions or sizes.',{family,changed,referenceCertified:false},members.slice(1).map(m=>({slide:m.record.slideId,runtimeSlide:m.record.runtimeSlide,selector:m.group.selector})));}
  }
  return findings;
}
module.exports={captureLayoutState,auditLayoutStability};
