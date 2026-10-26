import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../neural.html',import.meta.url),'utf8'),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const api=await import('../neural-generalization-ui.mjs').catch(()=>({}));
function setup({hash='',noCanvas=false}={}){
 assert.equal(typeof api.mountGeneralizationLesson,'function','generalization controller must exist');
 class Element extends EventTarget{
  constructor(){super();this.hidden=false;this.disabled=false;this.attributes={};this.width=800;this.height=600;this.textContent='';}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k];}
  click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}
  getBoundingClientRect(){return {left:10,top:20,width:400,height:300};}
  getContext(){return noCanvas?null:new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}
 }
 const elements=new Map([...ids].map(id=>[id,new Element()])),links=[...html.matchAll(/<a\b[^>]*href="#generalization-lesson"[^>]*>/g)].map(()=>new Element());
 const doc=Object.assign(new EventTarget(),{hidden:false,documentElement:{dataset:{}},querySelectorAll:selector=>{assert.equal(selector,'a[href="#generalization-lesson"]');return links;},getElementById:id=>{assert.ok(ids.has(id),'missing real HTML target '+id);return elements.get(id);}});
 const win=Object.assign(new EventTarget(),{location:{hash}});Object.defineProperty(win,'localStorage',{get(){throw Error('must not access drafts');}});
 let pauses=0;win.addEventListener('neural-guide-pause',()=>pauses++);
 const c=api.mountGeneralizationLesson({document:doc,window:win});
 return {c,e:id=>elements.get(id),win,doc,links,pauses:()=>pauses};
}
const play=fixture=>{fixture.e('generalization-train').click();fixture.e('generalization-guess-all').click();};
test('player freezes a real rule, guesses, inspects a wrong new point and completes an honest reflection',()=>{
 const {c,e}=setup();assert.equal(e('generalization-lesson').hidden,true);e('generalization-train').click();assert.equal(c.snapshot().model.epoch,0);
 e('residual-open-generalization').click();e('generalization-train').click();assert.equal(c.snapshot().phase,'guess');
 assert.equal(e('generalization-result').hidden,true);assert.equal(e('generalization-guess').hidden,false);assert.match(e('generalization-practice-score').textContent,/6.*6/);
 e('generalization-guess-all').click();const frozen=c.snapshot().model;assert.equal(e('generalization-result').hidden,false);assert.match(e('generalization-test-score').textContent,/13.*16/);
 assert.match(e('generalization-point-detail').textContent,/4.*圆.*方/);e('generalization-error-2').click();assert.equal(c.snapshot().selected,13);
 e('generalization-training').click();assert.equal(c.snapshot().view,'training');e('generalization-test').click();e('generalization-rule').click();
 e('generalization-answer-practice').click();assert.equal(e('generalization-takeaway').hidden,true);
 e('generalization-answer-unseen').click();assert.equal(e('generalization-takeaway').hidden,false);assert.deepEqual(c.snapshot().model,frozen);
 e('generalization-reset').click();assert.equal(c.snapshot().phase,'intro');assert.equal(e('generalization-result').hidden,true);assert.equal(e('generalization-point-detail').textContent,'');
});
test('direct, changed-hash and same-hash routes checkpoint old training and preserve this lesson',()=>{
 const f=setup({hash:'#generalization-lesson'});assert.equal(f.e('generalization-lesson').hidden,false);play(f);const model=f.c.snapshot().model;
 const before=f.pauses();assert.ok(f.links.length>0);f.links[0].click();assert.ok(f.pauses()>before);assert.deepEqual(f.c.snapshot().model,model);
 const g=setup();g.win.location.hash='#generalization-lesson';g.win.dispatchEvent(new Event('hashchange'));assert.equal(g.e('generalization-lesson').hidden,false);
});
test('keyboard and real point taps select the same evidence; dragging, cancellation and hidden input are inert',()=>{
 const f=setup({hash:'#generalization-lesson'});play(f);const {c,e,doc}=f,canvas=e('generalization-map'),model=c.snapshot().model;
 e('generalization-next').click();assert.equal(c.snapshot().selected,4);e('generalization-previous').click();assert.equal(c.snapshot().selected,3);
 canvas.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{key:'ArrowRight'}));assert.equal(c.snapshot().selected,4);
 const emit=(type,x,y,id=1)=>canvas.dispatchEvent(Object.assign(new Event(type),{clientX:x,clientY:y,pointerId:id,button:0,isPrimary:true}));
 emit('pointerdown',78,277.1);emit('pointerup',78,277.1);assert.equal(c.snapshot().selected,0);
 emit('pointerdown',78,277.1);emit('pointermove',150,277.1);emit('pointerup',78,277.1);assert.equal(c.snapshot().selected,0);
 emit('pointerdown',78,277.1);emit('pointercancel',78,277.1);emit('pointerup',254,277.1);assert.equal(c.snapshot().selected,0);
 doc.hidden=true;e('generalization-reset').click();e('generalization-next').click();assert.equal(c.snapshot().selected,0);assert.deepEqual(c.snapshot().model,model);
});
test('missing Canvas disables this visual exercise without touching other course links or drafts',()=>{
 const f=setup({hash:'#generalization-lesson',noCanvas:true});assert.equal(f.e('generalization-train').disabled,true);
 assert.match(f.e('generalization-status').textContent,/Canvas/);assert.equal(f.c.snapshot().model.epoch,0);
});
