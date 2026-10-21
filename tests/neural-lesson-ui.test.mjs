import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../neural.html',import.meta.url),'utf8');
const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
const ui=await import('../neural-lesson-ui.mjs').catch(()=>({}));
class Element extends EventTarget{
 constructor(){super();this.textContent='';this.hidden=false;this.disabled=false;this.attributes={};this.style={};this.innerHTML='';this.width=600;this.height=400;this.checked=true;}
 setAttribute(k,v){this.attributes[k]=String(v);}
 getAttribute(k){return this.attributes[k];}
 click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
 focus(){this.focused=true;}
 getContext(){return new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}
}
function setup(){
 assert.equal(typeof ui.mountLabelLesson,'function','lesson controller must exist');
 const elements=new Map(),queue=[],doc=new EventTarget(),win=new EventTarget();
 Object.assign(doc,{hidden:false,documentElement:{dataset:{}},getElementById:id=>{assert.ok(ids.has(id),`missing real HTML target ${id}`);if(!elements.has(id))elements.set(id,new Element());return elements.get(id);}});
 const controller=ui.mountLabelLesson({document:doc,window:win,schedule:f=>queue.push(f)});
 const e=id=>doc.getElementById(id),flush=()=>{let n=0;while(queue.length){assert.ok(n++<100);queue.shift()();}};
 return {controller,e,doc,win,queue,flush};
}
test('baseline is pinned and wrong-label evidence appears only after equal completed training',()=>{
 const {controller:c,e,flush}=setup();assert.equal(e('label-result').hidden,true);assert.equal(e('label-after-run').disabled,true);
 e('label-before-run').click();assert.equal(e('label-pause').disabled,false);flush();
 const baseline=c.snapshot().lesson.before;assert.equal(baseline.epoch,500);assert.equal(e('label-after-run').disabled,false);
 e('label-after-run').click();assert.equal(e('label-result').hidden,true);flush();
 assert.deepEqual(c.snapshot().lesson.before,baseline);assert.equal(e('label-result').hidden,false);
 assert.match(e('label-probe-A').textContent,/仍判为方/);assert.match(e('label-probe-B').textContent,/方 → 圆/);
 assert.match(e('label-summary').textContent,/并非每个观察点/);
 assert.match(e('label-status').textContent,/没有参与训练/);
 e('label-answer-local').click();assert.match(e('label-judgment').textContent,/共享/);
 e('label-answer-shared').click();assert.match(e('label-judgment').textContent,/答对/);
 e('label-choice-inside').click();assert.equal(e('label-result').hidden,true);assert.equal(e('label-judgment').textContent,'');
 assert.equal(e('label-probe-A').textContent,'','hidden results referenced by canvas descriptions must not retain stale evidence');
 assert.deepEqual(c.snapshot().lesson.before,baseline);assert.equal(c.snapshot().lesson.after.epoch,0);
 e('label-after-run').click();flush();assert.equal(e('label-result').hidden,false);
});
test('pause, visibility and reset reject stale callbacks and never resume automatically',()=>{
 const {controller:c,e,doc,queue,flush}=setup();
 e('label-before-run').click();queue.shift()();assert.equal(c.snapshot().lesson.before.epoch,25);
 const stale=queue.shift();e('label-pause').click();stale();assert.equal(c.snapshot().lesson.before.epoch,25);
 e('label-before-run').click();doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));flush();
 assert.equal(c.snapshot().lesson.before.epoch,25);assert.equal(c.snapshot().running,null);
 doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(c.snapshot().running,null);
 e('label-before-run').click();flush();e('label-after-run').click();const old=queue.shift();
 e('label-restart').click();old();assert.equal(c.snapshot().lesson.before.epoch,0);assert.equal(c.snapshot().lesson.after.epoch,0);
 assert.equal(e('label-result').hidden,true);
});
test('changing the point mid-training discards only the unfinished intervention and old callbacks',()=>{
 const {controller:c,e,queue,flush}=setup();e('label-before-run').click();flush();e('label-after-run').click();queue.shift()();
 const stale=queue.shift();e('label-choice-opposite').click();stale();
 assert.equal(c.snapshot().lesson.before.epoch,500);assert.equal(c.snapshot().lesson.after.epoch,0);
 assert.equal(c.snapshot().lesson.choice.id,'opposite');assert.equal(c.snapshot().running,null);
 e('label-after-run').click();flush();assert.equal(c.snapshot().lesson.after.epoch,500);
});
test('help and free drawing training pause the lesson without losing evidence or touching draft storage',()=>{
 const {controller:c,e,queue,flush}=setup();e('label-before-run').click();queue.shift()();e('about').click();flush();
 assert.equal(c.snapshot().lesson.before.epoch,25);assert.equal(c.snapshot().running,null);
 e('label-before-run').click();queue.shift()();e('fast').click();flush();assert.equal(c.snapshot().running,null);
 e('label-before-run').click();flush();e('label-after-run').click();flush();const result=c.snapshot();
 e('about').click();assert.deepEqual(c.snapshot(),result);
});
