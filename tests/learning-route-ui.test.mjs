import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const source=new URL('../learn.html',import.meta.url),html=existsSync(source)?readFileSync(source,'utf8'):'';
const api=await import('../learning-route-ui.mjs').catch(()=>({}));
function setup({noCanvas=false,width=1280,height=720}={}){
 assert.equal(typeof api.mountLearningRoute,'function','real focused route controller must exist');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 class El extends EventTarget{constructor(){super();this.hidden=false;this.disabled=false;this.attributes={};this.dataset={};this.value='';this.width=800;this.height=480;this.textContent='';}
  setAttribute(k,v){this.attributes[k]=String(v);}click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}
  getContext(){return noCanvas?null:new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}}
 const nodes=new Map(ids.map(id=>[id,new El()])),doc=Object.assign(new EventTarget(),{hidden:false,documentElement:{dataset:{}},getElementById:id=>{assert.ok(nodes.has(id),'missing actual page control '+id);return nodes.get(id);}});
 const media=Object.assign(new EventTarget(),{matches:false}),win={innerWidth:width,innerHeight:height,matchMedia:()=>media};Object.defineProperty(win,'localStorage',{get(){throw Error('route must not access drafts or storage');}});
 const c=api.mountLearningRoute({document:doc,window:win});return {c,e:id=>nodes.get(id),doc,win};
}
function first(r){r.e('route-main').click();r.e('route-main').click();r.e('route-guess-square').click();r.e('route-explain-good').click();r.e('route-continue').click();}
function second(r){r.e('route-predict-points').click();r.e('route-main').click();r.e('route-explain-good').click();r.e('route-continue').click();}
test('actual controller completes three tasks and reports computed evidence, not navigation clicks',()=>{
 const r=setup();assert.equal(r.e('route-summary').hidden,true);r.e('route-continue').click();assert.equal(r.c.snapshot().stage,'classify');
 first(r);assert.equal(r.c.snapshot().stage,'gradient');assert.equal(r.e('route-main').disabled,true);
 second(r);assert.equal(r.c.snapshot().stage,'test');assert.match(r.e('route-condition').textContent,/0.15.*120/);
 r.e('route-main').click();r.e('route-guess-all').click();assert.match(r.e('route-evidence').textContent,/13.*16/);
 const frozen=r.c.snapshot().test.model;r.e('route-point-next').click();assert.deepEqual(r.c.snapshot().test.model,frozen);
 r.e('route-explain-bad').click();assert.equal(r.e('route-continue').disabled,true);
 r.e('route-explain-good').click();r.e('route-continue').click();assert.equal(r.c.snapshot().stage,'summary');
 assert.equal(r.e('route-summary').hidden,false);assert.match(r.e('route-summary-test').textContent,/13.*16/);assert.equal(r.e('route-summary-title').focused,true);
 r.e('route-reset').click();assert.equal(r.c.snapshot().guide.model.epoch,0);assert.equal(r.c.snapshot().stage,'classify');
});
test('retry and back retain real work; new rate only applies from restored baseline',()=>{
 const r=setup();first(r);r.e('route-rate').value='.6';r.e('route-rate').dispatchEvent(new Event('change'));r.e('route-predict-rule').click();r.e('route-main').click();
 assert.equal(r.c.snapshot().gradient.model.epoch,1);r.e('route-retry').click();assert.deepEqual(r.c.snapshot().gradient.model.weights,[1,-1,0]);assert.equal(r.e('route-main').disabled,true);
 r.e('route-back').click();assert.equal(r.c.snapshot().guide.model.epoch,120);assert.equal(r.c.snapshot().stage,'classify');
});
test('hidden document and unavailable Canvas cannot create completion, and links remain available',()=>{
 const r=setup();r.doc.hidden=true;r.e('route-main').click();assert.equal(r.c.snapshot().guide.model.epoch,0);r.doc.hidden=false;r.e('route-main').click();assert.equal(r.c.snapshot().guide.model.epoch,120);
 const n=setup({noCanvas:true});assert.equal(n.e('route-main').disabled,true);n.e('route-main').click();assert.equal(n.c.snapshot().guide.model.epoch,0);assert.match(n.e('route-status').textContent,/Canvas/);assert.equal(n.e('route-free').hidden,false);
});
test('revealing a guess focuses the task while real updates and retry bring the visible observation into focus',()=>{
 const r=setup();r.e('route-main').click();r.e('route-main').click();r.e('route-title').focused=false;
 r.e('route-guess-round').click();assert.equal(r.e('route-title').focused,true,'a now-hidden guess control must not leave focus on the page body');
 r.e('route-explain-good').click();r.e('route-continue').click();r.e('route-predict-rule').click();r.e('route-title').focused=false;
 r.e('route-map-label').focused=false;r.e('route-main').click();assert.equal(r.e('route-map-label').focused,true,'hidden run action yields focus to the actual visible observation');
 r.e('route-map-label').focused=false;r.e('route-retry').click();assert.equal(r.e('route-map-label').focused,true,'retry returns to the visible baseline');
});
test('same-point controller exposes real before and after values without inventing success or training while looking',()=>{
 const r=setup();assert.ok(r.e('route-inspector'),'same-point observation must be available at the canvas');
 assert.equal(r.e('route-inspector').hidden,false);assert.match(r.e('route-point-after').textContent,/尚未/);
 const initial=r.c.snapshot().guide;r.e('route-inspect-6').click();assert.deepEqual(r.c.snapshot().guide,initial);assert.match(r.e('route-inspect-title').textContent,/6/);
 r.e('route-main').click();assert.match(r.e('route-point-after').textContent,/判方区/);assert.equal(r.e('route-inspect-6').attributes['aria-pressed'],'true');
 r.e('route-before').click();assert.match(r.e('route-view-note').textContent,/起点|原来/);assert.match(r.e('route-view-note').textContent,/记录/);
 r.e('route-inspect-3').click();assert.equal(r.e('route-before').attributes['aria-pressed'],'true','changing the watched example must not unexpectedly replace the selected baseline view');
 assert.match(r.e('route-legend').textContent,/只显示.*起点/,'the baseline-only view must not describe the displayed solid line as a new result');
 r.e('route-main').click();assert.equal(r.e('route-inspector').hidden,true,'unseen probe is not a training example');
 r.e('route-guess-round').click();r.e('route-explain-good').click();r.e('route-continue').click();
 r.e('route-rate').value='.03';r.e('route-rate').dispatchEvent(new Event('change'));r.e('route-predict-rule').click();r.e('route-main').click();
 assert.match(r.e('route-point-after').textContent,/判方区/,'a small step still predicts the wrong category');
 assert.ok(Number(r.e('route-score-after').value)>Number(r.e('route-score-before').value));assert.match(r.e('route-point-verdict').textContent,/还没分对|仍.*分错/);
 r.e('route-retry').click();assert.match(r.e('route-point-after').textContent,/尚未/);assert.equal(r.e('route-after-reading').hidden,true);
});
test('gradient observation changes only after a real update and retry restores the baseline caption',()=>{
 const r=setup();first(r);const initial=r.e('route-map-label').textContent;
 r.e('route-predict-rule').click();assert.equal(r.e('route-map-label').textContent,initial,'a prediction is not a model update');
 r.e('route-main').click();assert.notEqual(r.e('route-map-label').textContent,initial,'completed observation must be distinguished from the unrun baseline');
 r.e('route-retry').click();assert.equal(r.e('route-map-label').textContent,initial);assert.equal(r.c.snapshot().gradient.model.epoch,0);
});
test('a narrow-screen update starts at the computed metric so map and nearby point readings fit together',()=>{
 const r=setup({width:360});r.e('route-main').click();assert.equal(r.e('route-metric').focused,true,'mobile result focus must be on the visible computed metric');
 assert.equal(r.e('route-metric').scrolled,true,'mobile observation starts at the result, not a tall title block');
});
test('a short landscape uses the same compact result anchor rather than clipping the watched point',()=>{
 const r=setup({width:844,height:390});r.e('route-main').click();assert.equal(r.e('route-metric').focused,true);assert.equal(r.e('route-metric').scrolled,true);
});
