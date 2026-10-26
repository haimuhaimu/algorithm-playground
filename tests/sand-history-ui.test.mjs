import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let serial=0;
async function boot({reduced=true}={}){
 const html=await readFile(new URL('../sand.html',import.meta.url),'utf8');let doc;
 const pixels=new Map();
 const ctx=new Proxy({fillRect(x,y,w,h){if(w===864&&h===576)pixels.clear();else if(w===12&&h===12)pixels.set(`${x},${y}`,this.fillStyle);}},{get:(o,k)=>o[k]??(()=>{})});
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attrs={};this.value='';this.width=864;this.height=576;this.disabled=false;this.captures=new Set();this.textContent='';}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}getContext(){return ctx;}
  getBoundingClientRect(){return {left:0,top:0,right:864,bottom:576,width:864,height:576};}
  setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);this.dispatchEvent(Object.assign(new Event('lostpointercapture'),{pointerId:id}));}
  focus(){doc.activeElement=this;}showModal(){}
 }
 const els=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 els.get('brush').value='2';els.get('speed').value='40';
 const materials=[1,2,3,0].map(v=>Object.assign(new Element(),{dataset:{material:String(v)}}));
 const scenes=['splitter','hourglass','empty'].map(v=>Object.assign(new Element(),{dataset:{scene:v}})),stage=new Element();
 doc=Object.assign(new EventTarget(),{hidden:false,documentElement:new Element(),getElementById:id=>els.get(id),querySelector:()=>stage,querySelectorAll:s=>s==='[data-material]'?materials:scenes});
 const frames=new Map(),win=new EventTarget();let seq=0;
 const globals={document:doc,window:win,matchMedia:q=>Object.assign(new EventTarget(),{matches:reduced&&q.includes('reduced-motion')}),requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;},cancelAnimationFrame:id=>frames.delete(id)};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 const restore=()=>{for(const[k,d]of old)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];};
 try{await import(new URL('../sand.mjs?history-test='+ ++serial,import.meta.url));}catch(e){restore();throw e;}
 const fire=(el,type,props={})=>{const e=Object.assign(new Event(type,{cancelable:true}),props);el.dispatchEvent(e);return e;};
 return {els,doc,frames,stage,win,restore,pixels:()=>new Map(pixels),
  click:id=>{const el=els.get(id);assert.ok(el,`missing control ${id}`);if(!el.disabled)fire(el,'click');},
  scene:name=>fire(scenes.find(e=>e.dataset.scene===name),'click'),
  material:value=>fire(materials.find(e=>e.dataset.material===String(value)),'click'),
  brush:value=>{els.get('brush').value=String(value);fire(els.get('brush'),'input');},
  pointer:(type,x=8,y=10,id=1)=>fire(els.get('sandbox'),type,{clientX:x*12+6,clientY:y*12+6,pointerId:id,isPrimary:true,button:0,pointerType:'mouse'}),
  key:(key,props={},type='keydown')=>fire(els.get('sandbox'),type,{key,...props}),
  selected:name=>scenes.find(e=>e.dataset.scene===name).getAttribute('aria-pressed'),
  tick(time){const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(time));},
  count:key=>Number(els.get(key+'-count').textContent),
  stamp(x=8,y=10){this.pointer('pointerdown',x,y);this.pointer('pointerup',x,y);}};
}

test('one full drag rewinds the exact world and tick, redo restores the evolved checkpoint, and restore pauses',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('history-undo'),'free drawing needs a reversible edit entry');
  u.scene('empty');u.brush(0);u.material(3);const before=u.pixels();
  u.pointer('pointerdown',8,10);u.pointer('pointermove',20,10);u.pointer('pointerup',20,10);
  assert.equal(u.count('wall'),13);
  u.click('step');u.click('step');u.click('step');const after=u.pixels();
  u.click('history-undo');assert.deepEqual(u.pixels(),before);assert.equal(u.els.get('tick-count').textContent,'第 0 拍');
  assert.equal(u.stage.dataset.paused,'true');assert.equal(u.frames.size,0);assert.equal(u.els.get('history-redo').disabled,false);
  u.click('history-redo');assert.deepEqual(u.pixels(),after);assert.equal(u.els.get('tick-count').textContent,'第 3 拍');
  assert.equal(u.stage.dataset.paused,'true');assert.equal(u.els.get('history-redo').disabled,true);
 }finally{u.restore();}
});

test('empty erasing does not consume the redo branch, but a different real stroke does',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('history-undo'));u.scene('empty');u.brush(0);u.material(3);u.stamp();
  u.click('history-undo');u.material(0);u.stamp();
  assert.equal(u.els.get('history-redo').disabled,false,'no-op brush must not destroy redo');
  u.click('history-redo');assert.equal(u.count('wall'),1);
  u.click('history-undo');u.material(3);u.stamp(12,14);
  assert.equal(u.els.get('history-redo').disabled,true);assert.equal(u.count('wall'),1);
  u.click('history-undo');assert.equal(u.count('wall'),0);
 }finally{u.restore();}
});

test('held pouring is one edit and cancellation seals it; foreign pointer cancellation is ignored',async()=>{
 const u=await boot({reduced:false});try{
  assert.ok(u.els.has('history-undo'));u.scene('empty');u.material(2);u.brush(0);
  u.pointer('pointerdown',8,10);u.tick(1000);u.pointer('pointercancel',8,10,2);u.tick(1100);u.tick(1200);
  assert.ok(u.count('water')>=2,'the active pointer must survive another pointer cancellation');
  u.pointer('pointercancel',8,10);const after=u.count('water');u.tick(1300);assert.equal(u.count('water'),after);
  const stale=[...u.frames.values()][0];u.click('history-undo');assert.equal(u.count('water'),0);const pixels=u.pixels();
  stale?.(20000);assert.deepEqual(u.pixels(),pixels);assert.equal(u.frames.size,0,'late animation must not reschedule after rewind');
  u.click('history-redo');assert.equal(u.count('water'),after);
 }finally{u.restore();}
});

test('keyboard hold is grouped; canvas shortcuts undo/redo and a new simulation branch clears redo',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('history-undo'));u.scene('empty');u.material(3);u.brush(0);
  u.key('Enter');u.key('ArrowRight');u.key('Enter',{repeat:true});u.key('Enter',{},'keyup');assert.equal(u.count('wall'),2);
  assert.equal(u.key('z',{ctrlKey:true}).defaultPrevented,true);assert.equal(u.count('wall'),0);
  u.key('z',{metaKey:true,shiftKey:true});assert.equal(u.count('wall'),2);
  u.key('z',{metaKey:true});assert.equal(u.count('wall'),0);u.key('y',{ctrlKey:true});assert.equal(u.count('wall'),2);
  u.click('history-undo');u.click('step');assert.equal(u.els.get('history-redo').disabled,true);
 }finally{u.restore();}
});

test('scene switching and reset restore the actual preset, custom cells and its simulation tick',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('history-undo'));u.material(3);u.brush(0);u.stamp(2,2);u.click('step');
  const custom=u.pixels();u.scene('hourglass');assert.equal(u.selected('hourglass'),'true');
  u.click('history-undo');assert.equal(u.selected('splitter'),'true');assert.deepEqual(u.pixels(),custom);assert.equal(u.els.get('tick-count').textContent,'第 1 拍');
  u.click('reset');assert.notDeepEqual(u.pixels(),custom);u.click('history-undo');assert.deepEqual(u.pixels(),custom);
 }finally{u.restore();}
});

test('simulation-only changes under a no-op eraser do not create an edit',async()=>{
 const u=await boot({reduced:false});try{
  assert.ok(u.els.has('history-undo'));u.material(0);u.brush(0);u.pointer('pointerdown',0,0);
  u.tick(1000);u.tick(1100);u.tick(1200);u.pointer('pointerup',0,0);
  assert.equal(u.els.get('history-undo').disabled,true);assert.match(u.els.get('tick-count').textContent,/第 3 拍/);
 }finally{u.restore();}
});

test('undo during a gesture seals and rewinds once, with late pointer release unable to change restored cells',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('history-undo'));u.scene('empty');u.material(3);u.brush(0);
  u.pointer('pointerdown',8,10);u.pointer('pointermove',20,10);u.key('z',{ctrlKey:true});
  assert.equal(u.count('wall'),0);u.pointer('pointerup',25,10);assert.equal(u.count('wall'),0);
  u.click('history-redo');assert.equal(u.count('wall'),13);
 }finally{u.restore();}
});

test('undo cancels a held painting key so orphan repeats cannot repaint or destroy redo',async()=>{
 const u=await boot();try{
  u.scene('empty');u.material(3);u.brush(0);u.key('Enter');assert.equal(u.count('wall'),1);
  u.key('z',{ctrlKey:true});assert.equal(u.count('wall'),0);assert.equal(u.els.get('history-redo').disabled,false);
  u.key('Enter',{repeat:true});assert.equal(u.count('wall'),0,'undo must suppress the old held-key continuation');
  assert.equal(u.els.get('history-redo').disabled,false);u.key('Enter',{},'keyup');
  u.key('z',{ctrlKey:true,shiftKey:true});assert.equal(u.count('wall'),1);
  u.key('ArrowRight');u.key('Enter');u.key('Enter',{},'keyup');assert.equal(u.count('wall'),2,'a fresh intentional keypress can paint again');
 }finally{u.restore();}
});

test('visible history describes both destination ticks before the user chooses undo or redo',async()=>{
 const u=await boot();try{
  u.scene('empty');u.material(3);u.brush(0);u.stamp();u.click('step');u.click('step');u.click('step');
  assert.match(u.els.get('history-summary').textContent,/筑墙.*第 0 拍/,'the visible undo destination must not hide only in an accessible name');
  u.click('history-undo');assert.match(u.els.get('history-summary').textContent,/恢复.*筑墙.*第 3 拍/);
  u.click('history-redo');assert.match(u.els.get('history-summary').textContent,/筑墙.*第 0 拍/);
 }finally{u.restore();}
});
