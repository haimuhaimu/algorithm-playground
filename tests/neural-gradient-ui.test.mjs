import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../neural.html',import.meta.url),'utf8');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const api=await import('../neural-gradient-ui.mjs').catch(()=>({}));
function setup({hash='',noCanvas=false}={}){
 assert.equal(typeof api.mountGradientLesson,'function','gradient lesson controller must exist');
 class Element extends EventTarget{
  constructor(){super();this.hidden=false;this.disabled=false;this.value='';this.width=800;this.height=480;this.attributes={};this.textContent='';}
  setAttribute(k,v){this.attributes[k]=String(v);}click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
  focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}
  getContext(){return noCanvas?null:new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}
 }
 const elements=new Map([...ids].map(id=>[id,new Element()]));
 const doc=Object.assign(new EventTarget(),{hidden:false,documentElement:{dataset:{}},getElementById:id=>{assert.ok(ids.has(id),'missing real HTML target '+id);return elements.get(id);}});
 const win=Object.assign(new EventTarget(),{location:{hash}});
 Object.defineProperty(win,'localStorage',{get(){throw Error('gradient lesson must not access storage');}});
 const c=api.mountGradientLesson({document:doc,window:win});return {c,e:id=>elements.get(id),doc,win};
}
test('optional lesson opens from the completed guide and changes real weights without training the guide or drafts',()=>{
 const {c,e}=setup();assert.equal(e('gradient-lesson').hidden,true);
 e('gradient-step').click();assert.equal(c.snapshot().model.epoch,0,'hidden lesson actions cannot train');
 e('guide-open-gradient').click();assert.equal(e('gradient-lesson').hidden,false);assert.ok(e('gradient-title').focused);
 e('gradient-step').click();assert.equal(c.snapshot().model.epoch,1);assert.equal(e('gradient-rate').disabled,true);
 assert.match(e('gradient-loss').textContent,/0\.666.*0\.647/);assert.match(e('gradient-reading').textContent,/分错数.*2.*2/);
 e('gradient-answer-points').click();assert.equal(c.snapshot().answer,'points');assert.equal(e('gradient-takeaway').hidden,true);
 e('gradient-answer-parameters').click();assert.equal(e('gradient-takeaway').hidden,false);
 assert.equal(c.snapshot().model.epoch,1);e('gradient-reset').click();assert.equal(c.snapshot().model.epoch,0);
 assert.equal(e('gradient-rate').disabled,false);assert.equal(e('gradient-takeaway').hidden,true);
});
test('same-origin comparison is explicit: rate locks after updates and reset restores initial geometry',()=>{
 const {c,e}=setup({hash:'#gradient-lesson'});assert.equal(e('gradient-lesson').hidden,false);
 e('gradient-rate').value='.6';e('gradient-rate').dispatchEvent(new Event('change'));e('gradient-ten').click();
 const large=c.snapshot();assert.equal(large.rate,.6);assert.equal(large.model.epoch,10);
 e('gradient-rate').value='.03';e('gradient-rate').dispatchEvent(new Event('change'));assert.equal(c.snapshot().rate,.6);
 e('gradient-original').click();assert.match(e('gradient-view').textContent,/原来的/);
 e('gradient-reset').click();assert.deepEqual(c.snapshot().model.weights,[1,-1,0]);
 assert.equal(e('gradient-current').attributes['aria-pressed'],'true');
 e('gradient-rate').value='.03';e('gradient-rate').dispatchEvent(new Event('change'));e('gradient-ten').click();
 assert.equal(c.snapshot().model.epoch,10);assert.notDeepEqual(c.snapshot().model.weights,large.model.weights);
 for(let i=0;i<15;i++)e('gradient-ten').click();assert.equal(c.snapshot().model.epoch,120);assert.equal(e('gradient-step').disabled,true);
});
test('direct hash navigation, hidden-document input, and missing Canvas fail locally without storage or other experiments',()=>{
 const {c,e,doc,win}=setup();win.location.hash='#gradient-lesson';win.dispatchEvent(new Event('hashchange'));assert.equal(e('gradient-lesson').hidden,false);
 doc.hidden=true;e('gradient-ten').click();assert.equal(c.snapshot().model.epoch,0);doc.hidden=false;e('gradient-ten').click();assert.equal(c.snapshot().model.epoch,10);
 const n=setup({hash:'#gradient-lesson',noCanvas:true});assert.equal(n.e('gradient-step').disabled,true);assert.equal(n.e('gradient-ten').disabled,true);
 assert.match(n.e('gradient-status').textContent,/Canvas/);assert.equal(n.c.snapshot().model.epoch,0);
});
test('entering the gradient route checkpoints advanced training through its existing pause boundary',()=>{
 const {c,e,win}=setup();let checkpoints=0;
 win.addEventListener('neural-guide-pause',()=>checkpoints++);
 e('neural-advanced').open=true;win.location.hash='#gradient-lesson';win.dispatchEvent(new Event('hashchange'));
 assert.equal(checkpoints,1,'the existing free-drawing and label engines must receive their checkpoint/pause event');
 assert.equal(e('neural-advanced').open,true,'pausing must not destroy or replace advanced work');assert.equal(c.snapshot().model.epoch,0);
});
