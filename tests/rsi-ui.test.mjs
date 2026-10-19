import test from 'node:test';
import assert from 'node:assert/strict';
let uiModule={};try{uiModule=await import('../rsi.mjs');}catch{}
import {briefs,createWorkflow,draw} from '../rsi-core.mjs';
function boot(width=1280){
 const doc=new EventTarget(),nodes=new Map();
 class Element extends EventTarget{
  constructor(id){super();this.id=id;this.hidden=false;this.disabled=false;this.dataset={};this.attrs={};this.innerHTML='';this.textContent='';this.scrolls=[];}
  setAttribute(k,v){this.attrs[k]=String(v);}removeAttribute(k){delete this.attrs[k];}
  focus(){doc.activeElement=this;}scrollIntoView(o){this.scrolls.push(o);}
 }
 doc.getElementById=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
 doc.documentElement={dataset:{}};doc.querySelectorAll=()=>[];
 const ui=uiModule.initStudio(doc,{innerWidth:width,confirm:()=>true});
 return {ui,doc,nodes,click(id){const n=doc.getElementById(id);assert.equal(n.hidden,false,id);assert.equal(n.disabled,false,id);n.dispatchEvent(new Event('click'));}};
}
test('poster drawing reflects species, clothing and pose rather than a canned score',()=>{
 const job=briefs('first')[1],w=createWorkflow(),bad=draw(w,job),good={...bad,species:'fox',coat:'green',pose:'jump'};
 const a=uiModule.poster(bad),b=uiModule.poster(good);
 assert.notEqual(a,b);assert.match(a,/兔子/);assert.match(b,/狐狸/);assert.match(b,/跃起/);
 assert.match(a,/viewBox=/);assert.doesNotMatch(a,/<script|<image|https?:/);
});
test('skipping first repairs does not claim the pictures were fixed',()=>{
 const b=boot();b.click('start');b.click('next');
 assert.doesNotMatch(b.nodes.get('guide-title').textContent,/图修好了/);
 assert.match(b.nodes.get('guide-copy').textContent,/没有返修/);
});
test('phone stage changes bring the next instruction back below the pinned artwork',()=>{
 const b=boot(390);b.click('start');b.click('next');b.click('trial');
 assert.equal(b.nodes.get('guide-stage').scrolls.length,3);
 assert.equal(b.nodes.get('guide-stage').scrolls.at(-1).block,'start');
});
test('fixed-method ending acknowledges that its improvement method was not changed',()=>{
 const b=boot();b.click('start');b.click('next');b.click('method-cycle');b.click('trial');
 b.click('adopt');b.click('repair-next');b.click('finish-keep');b.click('answer-method');
 assert.equal(b.ui.state.workflow.improver,'cycle');
 assert.match(b.nodes.get('answer-feedback').textContent,/这轮.*固定顺序.*没有/);
 assert.doesNotMatch(b.nodes.get('answer-feedback').textContent,/也被改变/);
});
test('rejecting a successful candidate distinguishes the trial score from installed results',()=>{
 const b=boot();b.click('start');b.click('next');b.click('trial');b.click('adopt');b.click('repair-next');b.click('finish-keep');
 assert.equal(b.ui.state.transferRecord.after.passed,3);assert.equal(b.ui.state.finalRecord.passed,0);
 assert.match(b.nodes.get('recap-transfer-copy').textContent,/候选.*保留原版.*0/);
});
test('actual buttons repair selected artwork, update credit count and invalidate curation',()=>{
 const b=boot();b.click('start');b.click('pick-1');b.click('fix-identity');
 assert.equal(b.ui.state.art[1].species,'fox');assert.equal(b.ui.state.credits,2);
 assert.equal(b.nodes.get('budget').textContent,'2 / 3');
 b.click('curate');assert.equal(b.ui.state.selected[1],true);
 b.click('redraw');assert.equal(b.ui.state.selected[1],false);assert.match(b.nodes.get('notice').textContent,/整张/);
 b.click('fix-outfit');assert.equal(b.nodes.get('redraw').disabled,true);
 assert.equal(b.nodes.get('fix-identity').disabled,true);
});
test('phase controls are mutually exclusive, independent method choice reaches different real outcome',()=>{
 const b=boot();assert.equal(b.nodes.get('edit-controls').hidden,true);
 b.click('start');assert.equal(b.nodes.get('edit-controls').hidden,false);
 b.click('next');b.click('method-cycle');b.click('trial');
 assert.equal(b.ui.state.candidate.after.passed,1);assert.equal(b.nodes.get('edit-controls').hidden,true);
 b.click('adopt');b.click('repair-next');assert.equal(b.ui.state.transferRecord.after.passed,0);
 b.click('finish-keep');assert.equal(b.ui.state.stage,'ending');assert.equal(b.doc.activeElement.id,'ending-title');
 assert.equal(b.nodes.get('ending').hidden,false);
});
test('diagnosis route reuses new method and ending records evidence without assuming learning',()=>{
 const b=boot();b.click('start');b.click('next');b.click('trial');b.click('adopt');b.click('repair-next');
 assert.equal(b.ui.state.transferRecord.after.passed,3);
 b.click('finish-adopt');assert.equal(b.ui.state.finalRecord.passed,3);
 assert.equal(b.ui.state.answer,null);b.click('answer-picture');assert.match(b.nodes.get('answer-feedback').textContent,/不只/);
 b.click('answer-method');assert.match(b.nodes.get('answer-feedback').textContent,/下一/);
});
test('alternative trial preserves earlier report and uses the same work, not a harder task',()=>{
 const b=boot();b.click('start');b.click('next');b.click('trial');b.click('alternate');
 assert.equal(b.ui.state.methodReports.diagnose.after.passed,3);assert.equal(b.ui.state.methodReports.cycle.after.passed,1);
 assert.deepEqual(b.ui.state.methodReports.diagnose.before.art,b.ui.state.methodReports.cycle.before.art);
 b.click('alternate');assert.equal(b.ui.state.candidate.method,'diagnose');
});
test('replay restores controls, old pictures and empty evidence; theme does not reset work',()=>{
 const b=boot();b.click('start');b.click('fix-outfit');b.click('theme');
 assert.equal(b.ui.state.credits,2);assert.equal(b.doc.documentElement.dataset.theme,'dark');
 b.click('reset');assert.equal(b.ui.state.stage,'welcome');assert.equal(b.nodes.get('ending').hidden,true);
 assert.equal(b.nodes.get('start').hidden,false);
});
