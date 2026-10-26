import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../neural.html',import.meta.url),'utf8'),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const api=await import('../neural-residual-ui.mjs').catch(()=>({}));
function setup({hash='',noCanvas=false}={}){
 assert.equal(typeof api.mountResidualLesson,'function','residual lesson controller must exist');
 class Element extends EventTarget{
  constructor(){super();this.hidden=false;this.disabled=false;this.checked=false;this.value='0';this.width=800;this.height=400;this.attributes={};this.textContent='';}
  setAttribute(k,v){this.attributes[k]=String(v);}click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}
  getContext(){return noCanvas?null:new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}
 }
 const elements=new Map([...ids].map(id=>[id,new Element()]));
 const doc=Object.assign(new EventTarget(),{hidden:false,documentElement:{dataset:{}},getElementById:id=>{assert.ok(ids.has(id),'missing real HTML target '+id);return elements.get(id);}});
 const win=Object.assign(new EventTarget(),{location:{hash}});Object.defineProperty(win,'localStorage',{get(){throw Error('must never access saved drafts');}});
 let pauses=0,guidePauses=0;win.addEventListener('neural-guide-pause',()=>pauses++);win.addEventListener('neural-gradient-open',()=>guidePauses++);
 const c=api.mountResidualLesson({document:doc,window:win});return {c,e:id=>elements.get(id),win,doc,pauses:()=>pauses,guidePauses:()=>guidePauses};
}
test('player opens a real shortcut, restores actual branch, then trains both networks and reflects',()=>{
 const {c,e,pauses,guidePauses}=setup();assert.equal(e('residual-lesson').hidden,true);
 e('residual-shortcut').click();assert.equal(c.snapshot().skip,false,'hidden actions must not edit the demo');
 e('gradient-open-residual').click();assert.equal(e('residual-lesson').hidden,false);assert.ok(e('residual-title').focused);assert.equal(pauses(),1);assert.equal(guidePauses(),1);
 assert.equal(e('residual-learn').disabled,true);e('residual-shortcut').click();assert.equal(c.snapshot().skip,true);assert.match(e('residual-reading').textContent,/等于输入/);
 e('residual-zero').click();assert.equal(c.snapshot().zeroBranch,false);assert.equal(c.snapshot().models.residual.epoch,0);
 e('residual-learn').click();assert.equal(e('residual-signal-stage').hidden,true);assert.equal(e('residual-training-stage').hidden,false);
 assert.ok(e('residual-subtitle'),'phase-aware subtitle must exist');assert.match(e('residual-subtitle').textContent,/恢复真实分支/,'training must not still instruct the learner to keep the branch at zero');
 e('residual-step').click();assert.equal(c.snapshot().models.plain.epoch,1);assert.equal(c.snapshot().models.residual.epoch,1);
 e('residual-answer-perfect').click();assert.equal(e('residual-takeaway').hidden,true);e('residual-answer-carry').click();assert.equal(e('residual-takeaway').hidden,false);
 e('residual-reset').click();assert.equal(c.snapshot().stage,'signal');assert.equal(c.snapshot().models.plain.epoch,0);assert.equal(e('residual-training-stage').hidden,true);
});
test('the visible circuit tracks actual shortcut addition rather than only changing button copy',()=>{
 const {e}=setup({hash:'#residual-lesson'});assert.ok(e('residual-circuit'),'a real visible circuit must exist');assert.equal(e('residual-circuit').attributes['data-enabled'],'false');
 e('residual-shortcut').click();assert.equal(e('residual-circuit').attributes['data-enabled'],'true');assert.match(e('residual-circuit-output').textContent,/输入.*变化/);
 e('residual-zero').click();assert.doesNotMatch(e('residual-circuit-branch').textContent,/0\.00, 0\.00/);
});
test('direct route, selected signal, background inputs and the equal-step cap preserve isolated state',()=>{
 const {c,e,doc}=setup({hash:'#residual-lesson'});assert.equal(e('residual-lesson').hidden,false);
 e('residual-pick-B').click();assert.equal(c.snapshot().selected,1);assert.match(e('residual-vector-input').textContent,/-0\.80.*-0\.60/);
 doc.hidden=true;e('residual-shortcut').click();assert.equal(c.snapshot().skip,false);doc.hidden=false;
 e('residual-shortcut').click();e('residual-learn').click();for(let i=0;i<12;i++)e('residual-twenty').click();
 assert.equal(c.snapshot().models.plain.epoch,200);assert.equal(c.snapshot().models.residual.epoch,200);assert.equal(e('residual-step').disabled,true);
 assert.match(e('residual-plain-metric').textContent,/0\.697.*0\.003/);assert.match(e('residual-res-metric').textContent,/0\.672.*0\.003/);
 assert.match(e('residual-comparison').textContent,/普通结构.*较低/);assert.match(e('residual-comparison').textContent,/不.*一定/);
});
test('missing Canvas is a local limitation, while returning to other lessons stays possible',()=>{
 const {c,e}=setup({hash:'#residual-lesson',noCanvas:true});assert.equal(e('residual-shortcut').disabled,true);assert.equal(e('residual-learn').disabled,true);
 assert.match(e('residual-status').textContent,/Canvas/);assert.equal(c.snapshot().models.residual.epoch,0);
});
test('mobile structure switching changes only the displayed field, not models or training evidence',()=>{
 const {c,e}=setup({hash:'#residual-lesson'});e('residual-shortcut').click();e('residual-learn').click();e('residual-twenty').click();
 const state=c.snapshot();assert.equal(e('residual-res-panel').attributes['data-active'],'true');
 e('residual-view-plain').click();assert.equal(e('residual-plain-panel').attributes['data-active'],'true');assert.equal(e('residual-res-panel').attributes['data-active'],'false');
 assert.deepEqual(c.snapshot(),state);e('residual-view-residual').click();assert.equal(e('residual-res-panel').attributes['data-active'],'true');assert.deepEqual(c.snapshot(),state);
});
