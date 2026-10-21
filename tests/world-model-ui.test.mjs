import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let serial=0;
async function boot({reduced=false}={}){
 const html=await readFile(new URL('../world-model.html',import.meta.url),'utf8');
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attrs={};this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.style={setProperty(){}};}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}scrollIntoView(){}focus(){doc.activeElement=this;}
 }
 const els=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const doc=Object.assign(new EventTarget(),{hidden:false,documentElement:new Element(),getElementById:id=>els.get(id)});
 const media=Object.assign(new EventTarget(),{matches:reduced}),frames=new Map();let seq=0;
 const win=new EventTarget();const globals={document:doc,window:win,matchMedia:()=>media,requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;},cancelAnimationFrame:id=>frames.delete(id)};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const restore=()=>{for(const[k,d]of old)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];};
 for(const[k,value]of Object.entries(globals))Object.defineProperty(globalThis,k,{value,writable:true,configurable:true});
 try{await import(new URL('../world-model.mjs?t='+ ++serial,import.meta.url));}catch(e){restore();throw e;}
 const fire=(node,type)=>node.dispatchEvent(new Event(type));
 return {els,frames,doc,media,win,restore,click:id=>{const e=els.get(id);if(!e.disabled&&!e.hidden)fire(e,'click');},
  input:(id,value)=>{els.get(id).value=String(value);fire(els.get(id),'input');},
  tick(time){const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(time));},
  finish(){for(let i=0;i<=65;i++)this.tick(i*100);},
  hide(){doc.hidden=true;fire(doc,'visibilitychange');},show(){doc.hidden=false;fire(doc,'visibilitychange');}};
}
test('flight has visible progress, immutable prediction and results before explicit learning',async()=>{
 const u=await boot();try{
  assert.equal(u.els.get('learn').disabled,true);assert.match(u.els.get('model-label').textContent,/M0/);
  u.click('fly');const route=u.els.get('prediction-path').getAttribute('points');
  u.tick(0);u.tick(1000);assert.match(u.els.get('progress').textContent,/10 \/ 60/);
  assert.equal(u.els.get('learn').disabled,true);assert.equal(u.els.get('prediction-path').getAttribute('points'),route);
  u.tick(6000);assert.equal(u.els.get('results').hidden,false);assert.equal(u.els.get('learn').disabled,false);
  const error=u.els.get('prediction-error').textContent;
  u.click('learn');assert.match(u.els.get('model-label').textContent,/M1/);assert.equal(u.els.get('learn').disabled,true);
  assert.equal(u.els.get('prediction-error').textContent,error,'training cannot rewrite old prediction accuracy');
  u.click('plan');assert.match(u.els.get('plan-note').textContent,/2009/);assert.match(u.els.get('scene-label').textContent,/未试飞/);
  assert.equal(u.els.get('actual-path').getAttribute('points'),'');
 }finally{u.restore();}
});
test('pause, background and reset invalidate stale animation without auto-resume',async()=>{
 const u=await boot();try{
  u.click('fly');u.tick(0);u.tick(400);const stale=[...u.frames.values()][0];
  u.click('pause');const points=u.els.get('actual-path').getAttribute('points');stale(9999);
  assert.equal(u.frames.size,0);assert.equal(u.els.get('actual-path').getAttribute('points'),points);
  u.click('step');assert.match(u.els.get('progress').textContent,/5 \/ 60/);
  u.click('next');assert.match(u.els.get('status').textContent,/继续试飞/);u.tick(5000);u.hide();u.show();assert.equal(u.frames.size,0);
  u.click('next');const old=[...u.frames.values()][0];u.click('reset');old(15000);
  assert.equal(u.frames.size,0);assert.match(u.els.get('model-label').textContent,/M0/);assert.equal(u.els.get('results').hidden,true);
 }finally{u.restore();}
});
test('wind change preserves model, marks old evidence, cancels partial observations',async()=>{
 const u=await boot({reduced:true});try{
  u.click('fly');assert.equal(u.frames.size,0);u.click('learn');const model=u.els.get('model-label').textContent;
  u.click('wind-flip');assert.equal(u.els.get('model-label').textContent,model);assert.match(u.els.get('history').textContent,/旧风况/);
  assert.equal(u.els.get('learn').disabled,true);assert.match(u.els.get('status').textContent,/模型没有/);
  u.media.matches=false;u.media.dispatchEvent(new Event('change'));u.click('fly');u.tick(0);u.tick(500);
  const stale=[...u.frames.values()][0];u.click('wind-flip');stale(9000);
  assert.equal(u.frames.size,0);assert.equal(u.els.get('learn').disabled,true);
 }finally{u.restore();}
});
test('reduced motion completes without a moving animation and manual controls invalidate a plan',async()=>{
 const u=await boot({reduced:true});try{
  u.click('plan');assert.match(u.els.get('plan-note').textContent,/2009/);
  u.input('angle',12);assert.match(u.els.get('plan-note').textContent,/手动/);
  u.click('fly');assert.equal(u.frames.size,0);assert.match(u.els.get('progress').textContent,/60 \/ 60/);
  assert.equal(u.els.get('results').hidden,false);
 }finally{u.restore();}
});

test('new observations do not mislabel an older learned model as having learned the latest flight',async()=>{
 const u=await boot({reduced:true});try{
  u.click('fly');u.click('learn');assert.match(u.els.get('sample-label').textContent,/第 1 趟.*下吹 0.6/);
  u.click('wind-flip');u.click('fly');
  assert.match(u.els.get('sample-label').textContent,/第 1 趟.*下吹 0.6.*旧风况/);
  assert.equal(u.els.get('learn').disabled,false);
  u.click('learn');assert.match(u.els.get('sample-label').textContent,/第 2 趟.*上吹 1.0/);
  assert.doesNotMatch(u.els.get('sample-label').textContent,/旧风况/);
 }finally{u.restore();}
});

test('guided learning preserves the same real route before a separate plan and a separately confirmed successful flight',async()=>{
 const u=await boot({reduced:true});try{
  assert.ok(u.els.has('next'),'the experiment needs a single guided next action');
  u.click('next');
  assert.equal(u.els.get('results').hidden,false);
  assert.ok(parseFloat(u.els.get('target-distance').textContent)>5);
  const firstError=u.els.get('prediction-error').textContent;
  const originalRoute=u.els.get('actual-path').getAttribute('points');
  u.click('next');
  assert.match(u.els.get('model-label').textContent,/M1/);
  assert.equal(u.els.get('actual-path').getAttribute('points'),originalRoute,'learning keeps the actual flight visible');
  assert.equal(u.els.get('angle').value,'0');assert.equal(u.els.get('power').value,'1');
  assert.equal(u.els.get('prediction-error').textContent,firstError,'the original evidence stays intact');
  u.click('next');
  assert.equal(u.els.get('actual-path').getAttribute('points'),'','only planning previews a new route');
  assert.equal(u.els.get('prediction-error').textContent,firstError,'planning has not flown');
  assert.match(u.els.get('model-label').textContent,/M1/);
  u.click('next');
  assert.ok(parseFloat(u.els.get('target-distance').textContent)<=5);
  assert.match(u.els.get('guide-title').textContent,/进圈/);
  u.click('next');
  assert.match(u.els.get('model-label').textContent,/M1/,'changing wind does not retrain');
  assert.equal(u.els.get('results').hidden,true);
  u.click('next');assert.ok(parseFloat(u.els.get('target-distance').textContent)>5);
  u.click('next');assert.match(u.els.get('model-label').textContent,/M2/);
  u.click('next');assert.match(u.els.get('model-label').textContent,/M2/);
  u.click('next');assert.ok(parseFloat(u.els.get('target-distance').textContent)<=5);
  u.click('reset');assert.match(u.els.get('model-label').textContent,/M0/);
  u.click('next');assert.ok(parseFloat(u.els.get('target-distance').textContent)>5);
 }finally{u.restore();}
});

test('guided action cannot double launch and resumes a paused flight without replacing its evidence',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('next'),'a visible next action should follow the flight state');
  u.click('next');u.tick(0);u.tick(500);
  assert.equal(u.els.get('next').getAttribute('aria-disabled'),'true');
  const route=u.els.get('actual-path').getAttribute('points');
  u.click('next');assert.equal(u.els.get('actual-path').getAttribute('points'),route);
  u.hide();assert.equal(u.els.get('next').getAttribute('aria-disabled'),'false');
  u.show();u.click('next');
  assert.equal(u.els.get('actual-path').getAttribute('points'),route);
  u.tick(0);u.tick(6000);assert.equal(u.els.get('results').hidden,false);
 }finally{u.restore();}
});

test('guided controls retain keyboard focus when starting, pausing and completing a flight',async()=>{
 const u=await boot();try{
  const next=u.els.get('next');next.focus();u.click('next');
  assert.equal(next.disabled,false,'keep the running primary action focusable');
  assert.equal(next.getAttribute('aria-disabled'),'true');
  u.els.get('pause').focus();u.click('pause');
  assert.equal(u.doc.activeElement,next,'a disappearing pause button hands focus to Continue');
  u.click('next');u.els.get('pause').focus();u.finish();
  assert.equal(u.doc.activeElement,next,'completion does not strand focus on hidden Pause');
 }finally{u.restore();}
});

test('free planning before any observation never claims that learning already happened',async()=>{
 const u=await boot({reduced:true});try{
  u.click('plan');
  assert.doesNotMatch(u.els.get('guide-stage').textContent,/学完/);
  assert.match(u.els.get('guide-copy').textContent,/还没.*学习/);
  u.input('angle',12);u.click('next');
  assert.match(u.els.get('model-label').textContent,/M0/);
  assert.equal(u.els.get('results').hidden,false);
  u.click('next');assert.match(u.els.get('model-label').textContent,/M1/);
 }finally{u.restore();}
});

function reachDecision(u){for(let i=0;i<10;i++)u.click('next');}
test('independent choice executes a real route, explains its result, and finishes with evidence rather than another wind loop',async()=>{
 const u=await boot({reduced:true});try{
  reachDecision(u);
  assert.equal(u.els.get('choices').hidden,false);
  assert.equal(u.els.get('next').hidden,true);
  assert.equal(u.els.get('target-marker').getAttribute('transform'),'translate(24 18)');
  assert.equal(u.doc.activeElement,u.els.get('choice-reuse'),'entering the decision has a visible focus target');
  u.click('choice-reuse');
  assert.ok(parseFloat(u.els.get('target-distance').textContent)>5);
  assert.match(u.els.get('guide-copy').textContent,/原路线/);
  assert.equal(u.els.get('finish-lesson').hidden,false,'a failed method can still reach the recap');
  u.click('next');assert.equal(u.els.get('choices').hidden,false);
  u.click('choice-plan');
  assert.ok(parseFloat(u.els.get('target-distance').textContent)<=5);
  assert.match(u.els.get('model-label').textContent,/M2/,'replanning never retrains the model');
  u.click('next');assert.equal(u.els.get('lesson-ending').hidden,false);
  assert.match(u.els.get('recap-decision').textContent,/2.*重新规划路线/);
  assert.match(u.els.get('recap-learning').textContent,/\d+\.\d/);
  assert.equal(u.els.get('recap-choice-actual').getAttribute('points'),u.els.get('actual-path').getAttribute('points'));
  u.click('next');assert.equal(u.els.get('lesson-ending').hidden,true);
  assert.match(u.els.get('guide-stage').textContent,/自由/);
 }finally{u.restore();}
});
test('learning-only choice keeps the route, allows an honest ending, and reset removes the decision and its old callbacks',async()=>{
 const u=await boot({reduced:true});try{
  reachDecision(u);const oldRoute=u.els.get('prediction-path').getAttribute('points');
  u.click('choice-learn');assert.match(u.els.get('model-label').textContent,/M3/);
  assert.ok(parseFloat(u.els.get('target-distance').textContent)>5);
  assert.match(u.els.get('guide-copy').textContent,/学习.*不.*路线/);
  u.click('finish-lesson');assert.equal(u.els.get('lesson-ending').hidden,false);
  assert.match(u.els.get('recap-decision').textContent,/只重新学习/);
  u.click('free-experiment');u.click('next');
  assert.match(u.els.get('model-label').textContent,/M3/,'an accurate model needs replanning, not another automatic learning step');
  assert.match(u.els.get('scene-label').textContent,/未试飞/);
  u.click('reset');assert.equal(u.els.get('lesson-ending').hidden,true);
  reachDecision(u);u.media.matches=false;u.click('choice-plan');u.tick(0);u.tick(700);
  const stale=[...u.frames.values()][0],route=u.els.get('actual-path').getAttribute('points');
  u.click('choice-reuse');assert.equal(u.els.get('actual-path').getAttribute('points'),route);
  u.hide();u.show();assert.equal(u.frames.size,0);u.click('next');
  u.click('reset');stale(10000);
  assert.equal(u.els.get('choices').hidden,true);assert.equal(u.els.get('lesson-ending').hidden,true);
  assert.equal(u.els.get('target-marker').getAttribute('transform'),'translate(0 0)');
  assert.equal(u.els.get('results').hidden,true);assert.match(u.els.get('model-label').textContent,/M0/);
  assert.notEqual(u.els.get('prediction-path').getAttribute('points'),oldRoute);
 }finally{u.restore();}
});
test('manual controls leave the guided lesson instead of earning a fabricated completion',async()=>{
 const u=await boot({reduced:true});try{
  reachDecision(u);u.input('angle',10);
  assert.equal(u.els.get('choices').hidden,true);assert.equal(u.els.get('next').hidden,false);
  assert.match(u.els.get('guide-stage').textContent,/自由/);
  u.click('next');assert.equal(u.els.get('lesson-ending').hidden,true);
  u.click('reset');assert.doesNotMatch(u.els.get('guide-stage').textContent,/自由/);
 }finally{u.restore();}
});

test('comparison emphasis preserves both predictions, the actual route, fixed axes and historical score',async()=>{
 const u=await boot({reduced:true});try{
  u.click('next');const before=u.els.get('prediction-path').getAttribute('points'),actual=u.els.get('actual-path').getAttribute('points'),error=u.els.get('prediction-error').textContent;
  u.click('next');
  assert.ok(u.els.has('learning-comparison'),'comparison controls are part of the real page');
  assert.equal(u.els.get('learning-comparison').hidden,false);
  const after=u.els.get('learned-path').getAttribute('points'),axes=u.els.get('scene').getAttribute('viewBox');
  assert.notEqual(before,after);assert.notEqual(after,actual);
  assert.equal(u.els.get('prediction-path').getAttribute('points'),before);
  assert.match(u.els.get('comparison-after-error').textContent,/< 0.1/,'rounded tiny replay error is not claimed to be exact zero');
  for(const id of ['compare-before','compare-after']){
   u.click(id);assert.equal(u.els.get(id).getAttribute('aria-pressed'),'true');
   assert.equal(u.els.get('scene').getAttribute('viewBox'),axes);
   assert.equal(u.els.get('actual-path').getAttribute('points'),actual);
   assert.equal(u.els.get('learned-path').getAttribute('points'),after);
   assert.equal(u.els.get('prediction-error').textContent,error);
  }
  assert.equal(u.els.get('learning-record').hidden,false);
  const saved=u.els.get('record-after-predicted').getAttribute('points');
  u.click('next');assert.equal(u.els.get('learning-comparison').hidden,true);
  assert.equal(u.els.get('record-after-predicted').getAttribute('points'),saved);
  u.click('next');u.click('next');
  assert.equal(u.els.get('record-after-predicted').getAttribute('points'),saved,'new wind cannot rewrite the old replay');
  assert.match(u.els.get('record-context').textContent,/下吹 0.6/);
  u.click('reset');assert.equal(u.els.get('learning-record').hidden,true);
  assert.equal(u.els.get('learning-comparison').hidden,true);
  assert.equal(u.els.get('learned-path').getAttribute('points'),'');
 }finally{u.restore();}
});

test('ending reuses both same-flight comparisons even after an independent learning choice replaces the latest record',async()=>{
 const u=await boot({reduced:true});try{
  u.click('next');const firstActual=u.els.get('actual-path').getAttribute('points');
  u.click('next');const firstAfter=u.els.get('learned-path').getAttribute('points');
  for(let i=0;i<4;i++)u.click('next');
  const windActual=u.els.get('actual-path').getAttribute('points');
  u.click('next');const windAfter=u.els.get('learned-path').getAttribute('points');
  for(let i=0;i<3;i++)u.click('next');
  u.click('choice-learn');u.click('finish-lesson');
  assert.equal(u.els.get('lesson-ending').hidden,false);
  assert.equal(u.els.get('recap-learn-actual').getAttribute('points'),firstActual);
  assert.equal(u.els.get('recap-learn-predicted').getAttribute('points'),firstAfter);
  assert.equal(u.els.get('recap-wind-actual').getAttribute('points'),windActual);
  assert.equal(u.els.get('recap-wind-predicted').getAttribute('points'),windAfter);
  assert.match(u.els.get('recap-learning').textContent,/同一趟记录.*回看偏差/);
  assert.match(u.els.get('recap-decision').textContent,/没有改路线/);
 }finally{u.restore();}
});
