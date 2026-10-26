import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountLabelLesson} from '../neural-lesson-ui.mjs';
const html=readFileSync(new URL('../neural.html',import.meta.url),'utf8');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const ui=await import('../neural-guide-ui.mjs').catch(()=>({}));
function setup({noCanvas=false,hash='',reduced=false,withLabel=false}={}){
 assert.equal(typeof ui.mountNeuralGuide,'function','newcomer flow controller must exist');
 class Element extends EventTarget{
  constructor(){super();this.hidden=false;this.disabled=false;this.open=false;this.attributes={};this.width=800;this.height=480;this.textContent='';this.dataset={};this.style={};this.checked=true;}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k];}
  click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}
  getContext(){return noCanvas?null:new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}
 }
 const elements=new Map();for(const id of ids)elements.set(id,new Element());
 const firstLinks=[...html.matchAll(/<a\b[^>]*href="#first-lesson"[^>]*>/g)].map(()=>new Element());
 const doc=Object.assign(new EventTarget(),{hidden:false,documentElement:{dataset:{}},querySelectorAll:selector=>{assert.equal(selector,'a[href="#first-lesson"]');return firstLinks;},getElementById:id=>{assert.ok(ids.has(id),'target must exist in real HTML: '+id);return elements.get(id);}});
 const win=Object.assign(new EventTarget(),{location:{hash},matchMedia:()=>({matches:reduced})});
 Object.defineProperty(win,'localStorage',{get(){throw Error('guide must never access storage');}});
 const queue=[];let pauses=0;win.addEventListener('neural-guide-pause',()=>pauses++);
 const c=ui.mountNeuralGuide({document:doc,window:win,schedule:f=>queue.push(f)}),e=id=>elements.get(id);
 const labelQueue=[],label=withLabel?mountLabelLesson({document:doc,window:win,schedule:f=>labelQueue.push(f)}):null;
 const flush=()=>{let n=0;while(queue.length){assert.ok(n++<200);queue.shift()();}};
 return {c,e,doc,win,queue,flush,pauses:()=>pauses,label,labelQueue,firstLinks};
}
for(const navigation of ['changed hash','same-hash link'])test(`returning to the first lesson via ${navigation} checkpoints actual label training`,()=>{
 const {e,win,label,labelQueue,firstLinks}=setup({hash:navigation==='changed hash'?'#label-lab':'#first-lesson',withLabel:true});
 e('guide-open-free').click();e('label-before-run').click();labelQueue.shift()();
 const checkpoint=label.snapshot(),stale=labelQueue.shift();assert.equal(checkpoint.lesson.before.epoch,25);
 if(navigation==='changed hash'){win.location.hash='#first-lesson';win.dispatchEvent(new Event('hashchange'));}
 else{assert.ok(firstLinks.length>0,'the actual page provides a return link');firstLinks[0].click();}
 stale();assert.equal(label.snapshot().running,null);assert.deepEqual(label.snapshot().lesson,checkpoint.lesson);
});
test('starting an advanced lesson pauses the introductory model even when the advanced section was already open',()=>{
 const {c,e,queue,label,labelQueue}=setup({hash:'#label-lab',withLabel:true});
 e('guide-main').click();queue.shift()();const stale=queue.shift();
 assert.equal(c.snapshot().model.epoch,1);e('label-before-run').click();labelQueue.shift()();stale();
 assert.equal(c.snapshot().model.epoch,1);assert.equal(label.snapshot().lesson.before.epoch,25);
 assert.equal(label.snapshot().running,'before');
});
test('new player completes one visible primary route with real results and explanation retry',()=>{
 const {c,e,flush}=setup();assert.equal(e('guide-choices').hidden,true);assert.equal(e('guide-reflection').hidden,true);
 e('guide-main').click();assert.equal(e('guide-main').disabled,true);flush();assert.equal(c.snapshot().model.epoch,120);
 assert.equal(e('guide-compare').hidden,false);assert.equal(e('neural-advanced').open,false);
 e('guide-main').click();assert.equal(c.snapshot().phase,'test');assert.equal(e('guide-choices').hidden,false);assert.equal(e('guide-main').hidden,true);
 assert.ok(e('first-lesson').scrolled,'an explicit stage change keeps the current task in view');assert.ok(e('guide-title').focused,'keyboard focus follows the new task instead of a hidden button');
 e('guide-guess-square').click();assert.equal(c.snapshot().phase,'reveal');assert.match(e('guide-observation').textContent,/你猜方.*模型.*圆/);
 e('guide-before').click();assert.match(e('guide-observation').textContent,/原来.*方区/);assert.match(e('guide-map-text').textContent,/新点 A 按原来的线判方区/);
 assert.equal(c.snapshot().model.epoch,120);e('guide-main').click();assert.equal(e('guide-reflection').hidden,false);
 assert.equal(e('guide-before').getAttribute('aria-pressed'),'false');assert.match(e('guide-map-text').textContent,/新点 A 按现在的线判圆区/);
 e('guide-memory').click();assert.equal(c.snapshot().phase,'reflect');assert.match(e('guide-feedback').textContent,/分界线/);
 e('guide-parameters').click();assert.equal(c.snapshot().phase,'done');assert.equal(e('guide-summary').hidden,false);
 assert.equal(e('guide-open-gradient').hidden,false,'completed first lesson offers the next real learning step');
 assert.match(e('guide-summary-model').textContent,/分界线/);assert.match(e('guide-summary-probe').textContent,/方区.*圆区/);
 assert.match(e('guide-error-count').textContent,/2.*0/);
 e('guide-retest').click();assert.equal(c.snapshot().phase,'test');assert.equal(c.snapshot().model.epoch,120);
 assert.equal(c.snapshot().probeIndex,1);
});
test('opening the gradient lesson pauses ongoing introductory training without resetting its work',()=>{
 const {c,e,win,queue}=setup();assert.equal(e('guide-open-gradient').hidden,true);
 e('guide-main').click();queue.shift()();const stale=queue.shift();
 win.dispatchEvent(new Event('neural-gradient-open'));stale();assert.equal(c.snapshot().model.epoch,1);
});
test('new-point accessible description conveys the same relative side as the visible decision region',()=>{
 const {e,flush}=setup();e('guide-main').click();flush();e('guide-main').click();
 assert.match(e('guide-map-text').textContent,/问号位于当前实线的圆区一侧/);
});
test('training pauses on background and stale callbacks cannot undo reset or continue hidden work',()=>{
 const {c,e,doc,queue,flush}=setup();e('guide-main').click();queue.shift()();assert.equal(c.snapshot().model.epoch,1);
 const stale=queue.shift();doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));stale();assert.equal(c.snapshot().model.epoch,1);
 doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));flush();assert.equal(c.snapshot().model.epoch,1);
 e('guide-main').click();const old=queue.shift();e('guide-restart').click();old();assert.equal(c.snapshot().model.epoch,0);assert.equal(c.snapshot().phase,'intro');
});
test('legacy anchors open advanced controls and leaving either mode pauses work without touching drafts',()=>{
 const {c,e,win,queue,pauses}=setup({hash:'#step-lab'});assert.equal(e('neural-advanced').open,true);assert.ok(e('step-lab').scrolled);
 e('guide-main').click();const stale=queue.shift();e('neural-advanced').open=true;e('neural-advanced').dispatchEvent(new Event('toggle'));stale();
 assert.equal(c.snapshot().model.epoch,0);e('neural-advanced').open=false;e('neural-advanced').dispatchEvent(new Event('toggle'));assert.ok(pauses()>0);
 win.location.hash='#label-lab';win.dispatchEvent(new Event('hashchange'));assert.equal(e('neural-advanced').open,true);
 e('guide-return').click();assert.equal(e('neural-advanced').open,false);assert.ok(e('first-lesson').focused);
});
test('no Canvas is reported locally and the existing advanced work remains available',()=>{
 const {e}=setup({noCanvas:true});assert.equal(e('guide-main').disabled,true);assert.match(e('guide-status').textContent,/Canvas/);
 assert.equal(e('guide-open-free').disabled,false);
});
test('reduced motion performs the same real updates without an animation or duplicate training',()=>{
 const {c,e,queue}=setup({reduced:true});e('guide-main').click();assert.equal(c.snapshot().model.epoch,120);assert.equal(queue.length,0);
 e('guide-main').click();assert.equal(c.snapshot().phase,'test');assert.equal(c.snapshot().model.epoch,120);
});
