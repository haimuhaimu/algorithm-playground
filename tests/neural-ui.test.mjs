import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let serial=0;
async function boot({noCanvas=false,hidden=false}={}){
 const html=await readFile(new URL('../neural.html',import.meta.url),'utf8').catch(()=>'');
 assert.ok(html.includes('id="field"'),'new playable page must exist');
 const frames=new Map();let next=0;
 const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{})});
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attributes=new Map();this.width=900;this.height=560;this.value='';this.checked=false;}
  set value(v){this._value=this.options&&!this.options.includes(v)?'':v;}get value(){return this._value;}
  setAttribute(k,v){this.attributes.set(k,v);}getAttribute(k){return this.attributes.get(k);}
  getContext(){return noCanvas?null:ctx;}getBoundingClientRect(){return {left:0,top:0,width:900,height:560};}
  setPointerCapture(){}releasePointerCapture(){}focus(){}showModal(){}close(){}
 }
 const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 for(const [,id,options]of html.matchAll(/<select id="([^"]+)">([\s\S]*?)<\/select>/g))elements.get(id).options=[...options.matchAll(/value="([^"]+)"/g)].map(([,v])=>v);
 const groups={};
 for(const key of ['tool','preset','guess'])groups[key]=[...html.matchAll(new RegExp('data-'+key+'="([^"]+)"','g'))].map(([,v])=>Object.assign(new Element(),{dataset:{[key]:v}}));
 const doc=Object.assign(new EventTarget(),{hidden,documentElement:new Element(),getElementById:id=>elements.get(id),querySelectorAll:s=>groups[s.match(/data-(\w+)/)?.[1]]??[]});
 const globals={document:doc,window:new EventTarget(),matchMedia:()=>Object.assign(new EventTarget(),{matches:false}),getComputedStyle:()=>({getPropertyValue:()=>'#25271f'}),requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const restore=()=>{for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];};
 Object.assign(globalThis,globals);
 try{await import(new URL('../neural.mjs?test='+ ++serial,import.meta.url));}catch(e){restore();throw e;}
 const fire=(el,type,props={})=>el.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),props));
 return {elements,frames,restore,fire,click:id=>fire(elements.get(id),'click'),choose:(key,value)=>fire(groups[key].find(e=>e.dataset[key]===value),'click'),
  change(id,value){elements.get(id).value=value;fire(elements.get(id),'change');},
  pointer(type,x=450,y=280,extra={}){fire(elements.get('field'),type,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,...extra});},
  frame(){const first=frames.entries().next().value;if(first){frames.delete(first[0]);first[1](100);}},
  hide(){doc.hidden=true;fire(doc,'visibilitychange');},show(){doc.hidden=false;fire(doc,'visibilitychange');}};
}
test('starts paused, trains by real model steps, and pauses without an extra loop',async()=>{
 const ui=await boot();try{
  assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('epoch').textContent,'0');
  ui.click('step');assert.equal(ui.elements.get('epoch').textContent,'1');
  ui.click('play');ui.frame();assert.equal(ui.elements.get('epoch').textContent,'9');
  ui.click('play');assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'false');
 }finally{ui.restore();}
});
test('fast-forward is exactly 500 real epochs and repeated clicks do not queue duplicate work',async()=>{
 const ui=await boot();try{ui.click('fast');ui.click('fast');assert.equal(ui.frames.size,1);
  for(let i=0;i<25;i++)ui.frame();assert.equal(ui.elements.get('epoch').textContent,'500');assert.equal(ui.frames.size,0);
 }finally{ui.restore();}
});
test('backgrounding, help and resetting invalidate stale callbacks',async()=>{
 const ui=await boot();try{
  ui.click('fast');const stale=[...ui.frames.values()][0];ui.hide();ui.show();stale(100);
  assert.equal(ui.elements.get('epoch').textContent,'0');assert.equal(ui.frames.size,0);
  ui.click('play');ui.click('about');assert.equal(ui.frames.size,0);
  ui.click('fast');const stale2=[...ui.frames.values()][0];ui.choose('preset','ring');stale2(200);
  assert.equal(ui.elements.get('epoch').textContent,'0');assert.equal(ui.frames.size,0);
 }finally{ui.restore();}
});
test('committed painting resets training and removes unsupported held-out scores; undo restores preset',async()=>{
 const ui=await boot();try{
  ui.click('step');const oldCount=ui.elements.get('point-count').textContent;
  ui.choose('tool','0');ui.pointer('pointerdown',450,280);ui.pointer('pointerup',450,280);
  assert.equal(ui.elements.get('epoch').textContent,'0');
  assert.equal(ui.elements.get('test-accuracy').textContent,'未设答案');
  assert.notEqual(ui.elements.get('point-count').textContent,oldCount);
  ui.click('undo');assert.equal(ui.elements.get('point-count').textContent,oldCount);
  assert.notEqual(ui.elements.get('test-accuracy').textContent,'未设答案');
 }finally{ui.restore();}
});
test('cancelled drawing and extra pointers preserve the last successful data and evidence',async()=>{
 const ui=await boot();try{
  ui.click('step');const score=ui.elements.get('test-accuracy').textContent,count=ui.elements.get('point-count').textContent;
  ui.choose('tool','1');ui.pointer('pointerdown',450,280);ui.pointer('pointermove',500,300);
  ui.pointer('pointerup',600,400,{pointerId:2,isPrimary:false});ui.pointer('pointercancel');
  assert.equal(ui.elements.get('epoch').textContent,'1');assert.equal(ui.elements.get('point-count').textContent,count);
  assert.equal(ui.elements.get('test-accuracy').textContent,score);
 }finally{ui.restore();}
});
test('empty and single-class drawings explain limits; keyboard can add both classes',async()=>{
 const ui=await boot();try{
  ui.click('clear');ui.click('play');assert.equal(ui.frames.size,0);
  assert.equal(ui.elements.get('accuracy').textContent,'无样本');
  const field=ui.elements.get('field');ui.choose('tool','0');ui.fire(field,'keydown',{key:'Enter'});
  ui.click('step');assert.equal(ui.elements.get('epoch').textContent,'0');assert.match(ui.elements.get('status').textContent,/两类/);
  ui.choose('tool','1');ui.fire(field,'keydown',{key:'ArrowRight'});ui.fire(field,'keydown',{key:'Enter'});
  ui.click('step');assert.equal(ui.elements.get('epoch').textContent,'1');
 }finally{ui.restore();}
});
test('model changes reset the evidence but learning-rate changes preserve it',async()=>{
 const ui=await boot();try{
  ui.click('step');ui.change('rate','.6');assert.equal(ui.elements.get('epoch').textContent,'1');
  ui.change('model','linear');assert.equal(ui.elements.get('epoch').textContent,'0');
  ui.choose('guess','no');ui.click('step');assert.match(ui.elements.get('prediction-result').textContent,/分不开/);
 }finally{ui.restore();}
});
test('missing Canvas gives a readable fallback and disables training',async()=>{
 const ui=await boot({noCanvas:true});try{
  assert.match(ui.elements.get('status').textContent,/Canvas/);
  assert.equal(ui.elements.get('play').disabled,true);assert.equal(ui.frames.size,0);
 }finally{ui.restore();}
});
test('the learning-rate control always has an actual selected option after rendering',async()=>{
 const ui=await boot();try{
  assert.notEqual(ui.elements.get('rate').value,'');
  ui.change('rate','0.6');ui.click('step');
  assert.equal(ui.elements.get('rate').value,'0.6');
 }finally{ui.restore();}
});
test('clearing after a prediction and training resets both evidence and the previous guess',async()=>{
 const ui=await boot();try{
  ui.choose('guess','yes');ui.click('step');ui.click('clear');
  assert.equal(ui.elements.get('epoch').textContent,'0');
  assert.equal(ui.elements.get('accuracy').textContent,'无样本');
  assert.doesNotMatch(ui.elements.get('prediction-result').textContent,/你猜/);
 }finally{ui.restore();}
});
test('an active probe follows the current trained model without a second click',async()=>{
 const ui=await boot();try{
  ui.choose('tool','probe');ui.pointer('pointerdown',675,140);
  const before=ui.elements.get('probe-result').textContent;assert.match(before,/59%/);
  ui.click('fast');for(let i=0;i<20;i++)ui.frame();
  const after=ui.elements.get('probe-result').textContent;
  assert.notEqual(after,before);assert.match(after,/98%/);
  ui.pointer('pointerdown',675,140);assert.equal(ui.elements.get('probe-result').textContent,after);
  ui.choose('tool','0');ui.pointer('pointerdown',450,280);ui.pointer('pointercancel');
  assert.equal(ui.elements.get('probe-result').textContent,after);
  ui.click('reset');assert.doesNotMatch(ui.elements.get('probe-result').textContent,/98%/);
 }finally{ui.restore();}
});
