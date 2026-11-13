import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let serial=0;
async function boot({reduced=true,hidden=false}={}){
 const html=await readFile(new URL('../../../dist/sand.html',import.meta.url),'utf8');let doc;
 const pixels=new Map(),drawing={worlds:0,fills:0,cursor:null};
 const ctx=new Proxy({
  fillRect(x,y,w,h){drawing.fills++;if(w===864&&h===576){drawing.worlds++;drawing.cursor=null;pixels.clear();}else if(w===12&&h===12)pixels.set(`${x},${y}`,this.fillStyle);},
  arc(x,y,r){drawing.cursor={x,y,r};}
 },{get:(o,k)=>o[k]??(()=>{})});
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attrs={};this.value='';this.width=864;this.height=576;this.disabled=false;this.captures=new Set();this.textContent='';}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}getContext(){return ctx;}
  getBoundingClientRect(){return {left:0,top:0,right:864,bottom:576,width:864,height:576};}
  setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);this.dispatchEvent(Object.assign(new Event('lostpointercapture'),{pointerId:id}));}
  focus(){doc.activeElement=this;}scrollIntoView(){this.scrolled=true;}showModal(){}
 }
 const els=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 els.get('brush').value='2';els.get('speed').value='40';
 const materials=[1,2,3,0].map(v=>Object.assign(new Element(),{dataset:{material:String(v)}}));
 const scenes=[...new Set([...html.matchAll(/data-scene="([^"]+)"/g)].map(([,name])=>name))].map(v=>Object.assign(new Element(),{dataset:{scene:v}})),stage=new Element();
 doc=Object.assign(new EventTarget(),{hidden,documentElement:new Element(),getElementById:id=>els.get(id),querySelector:()=>stage,querySelectorAll:s=>s==='[data-material]'?materials:scenes});
 const frames=new Map(),win=new EventTarget();let seq=0;
 const globals={document:doc,window:win,matchMedia:q=>Object.assign(new EventTarget(),{matches:reduced&&q.includes('reduced-motion')}),requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;},cancelAnimationFrame:id=>frames.delete(id)};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 const restore=()=>{for(const[k,d]of old)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];};
 try{await import(new URL('../../../dist/sand.mjs?history-test='+ ++serial,import.meta.url));}catch(e){restore();throw e;}
 const fire=(el,type,props={})=>{const e=Object.assign(new Event(type,{cancelable:true}),props);el.dispatchEvent(e);return e;};
 return {els,doc,frames,stage,win,restore,drawing,pixels:()=>new Map(pixels),
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

test('mouse preview merges a burst into one frame at the final cell without changing the world',async()=>{
 const u=await boot();try{
  const before=u.pixels(),draws=u.drawing.worlds,counts=['sand','water','wall'].map(u.count);
  for(let i=0;i<120;i++)u.pointer('pointermove',i%60,10);
  assert.equal(u.drawing.worlds,draws,'hover should not synchronously redraw the whole world for every event');
  assert.equal(u.frames.size,1,'a paused world only needs one pending preview frame');
  u.tick(1000);
  assert.equal(u.drawing.worlds,draws+1);assert.deepEqual(u.drawing.cursor,{x:714,y:126,r:30});
  assert.deepEqual(u.pixels(),before);assert.deepEqual(['sand','water','wall'].map(u.count),counts);
  assert.equal(u.els.get('tick-count').textContent,'第 0 拍');assert.equal(u.els.get('history-undo').disabled,true);
  assert.equal(u.frames.size,0,'hover must not start a permanent loop or simulation');
 }finally{u.restore();}
});

test('same-cell hover does no new painting, while leaving and returning restores the preview',async()=>{
 const u=await boot();try{
  u.pointer('pointermove');u.tick(1000);const draws=u.drawing.worlds,fills=u.drawing.fills;
  for(let i=0;i<120;i++)u.pointer('pointermove');
  assert.equal(u.frames.size,0);assert.equal(u.drawing.worlds,draws);assert.equal(u.drawing.fills,fills);
  u.pointer('pointerleave');assert.equal(u.drawing.cursor,null);
  u.pointer('pointermove');assert.equal(u.frames.size,1);u.tick(1100);
  assert.deepEqual(u.drawing.cursor,{x:102,y:126,r:30});assert.equal(u.frames.size,0);
 }finally{u.restore();}
});

test('a real stroke supersedes pending hover and preserves every painted segment and undo checkpoint',async()=>{
 const u=await boot();try{
  u.scene('empty');u.material(3);u.brush(0);const before=u.pixels();
  u.pointer('pointermove',2,2);const stale=[...u.frames.values()];
  assert.equal(stale.length,1);
  u.pointer('pointerdown',8,10);u.pointer('pointermove',20,10);u.pointer('pointerup',25,10);
  assert.equal(u.count('wall'),18,'paint and the final pointerup segment stay synchronous');
  assert.deepEqual(u.drawing.cursor,{x:306,y:126,r:6});assert.equal(u.frames.size,0);
  const after=u.pixels(),draws=u.drawing.worlds;stale.forEach(fn=>fn(1000));
  assert.equal(u.drawing.worlds,draws);assert.deepEqual(u.pixels(),after);
  u.click('history-undo');assert.deepEqual(u.pixels(),before);assert.equal(u.count('wall'),0);
  u.click('history-redo');assert.deepEqual(u.pixels(),after);assert.equal(u.count('wall'),18);
 }finally{u.restore();}
});

test('simulation render absorbs queued hover without an extra world redraw or simulation tick',async()=>{
 const u=await boot({reduced:false});try{
  const draws=u.drawing.worlds;u.pointer('pointermove',20,10);u.tick(10000);
  assert.equal(u.drawing.worlds,draws+1);assert.equal(u.els.get('tick-count').textContent,'第 1 拍');
  assert.deepEqual(u.drawing.cursor,{x:246,y:126,r:30});assert.equal(u.frames.size,1);
  u.click('play');assert.equal(u.frames.size,0);
 }finally{u.restore();}
});

test('hidden pages and pagehide cancel hover, including an already-dispatched stale callback',async()=>{
 for(const event of ['visibilitychange','pagehide']){
  const u=await boot();try{
   u.pointer('pointermove',12,10);const stale=[...u.frames.values()],draws=u.drawing.worlds,before=u.pixels();
   assert.equal(stale.length,1);
   if(event==='visibilitychange'){u.doc.hidden=true;u.doc.dispatchEvent(new Event(event));}
   else u.win.dispatchEvent(new Event(event));
   assert.equal(u.frames.size,0);stale.forEach(fn=>fn(1000));
   assert.equal(u.drawing.worlds,draws);assert.deepEqual(u.pixels(),before);
   assert.equal(u.els.get('tick-count').textContent,'第 0 拍');assert.equal(u.els.get('history-undo').disabled,true);
   u.doc.hidden=false;u.pointer('pointermove',12,10);assert.equal(u.frames.size,1,'the cancelled cursor has not actually been drawn, even in the same cell');u.tick(1100);
   assert.deepEqual(u.drawing.cursor,{x:150,y:126,r:30});
  }finally{u.restore();}
 }
});

test('pausing before hover is drawn still allows the same-cell preview to appear',async()=>{
 const u=await boot({reduced:false});try{
  u.pointer('pointermove',12,10);u.click('play');assert.equal(u.frames.size,0);
  u.pointer('pointermove',12,10);assert.equal(u.frames.size,1);u.tick(1000);
  assert.deepEqual(u.drawing.cursor,{x:150,y:126,r:30});assert.equal(u.els.get('tick-count').textContent,'第 0 拍');
 }finally{u.restore();}
});

test('keyboard preview updates immediately and invalidates pending mouse preview',async()=>{
 const u=await boot();try{
  u.pointer('pointermove',12,10);const stale=[...u.frames.values()];assert.equal(stale.length,1);u.key('ArrowRight');
  assert.deepEqual(u.drawing.cursor,{x:162,y:126,r:30});assert.equal(u.frames.size,0);
  const draws=u.drawing.worlds;stale.forEach(fn=>fn(1000));assert.equal(u.drawing.worlds,draws);
  u.key('Enter');u.key('Enter',{},'keyup');assert.ok(u.count('sand')>0);
 }finally{u.restore();}
});

test('a background initial load stays paused and starts with one Continue without losing its world',async()=>{
 const u=await boot({reduced:false,hidden:true});try{
  const initial=u.pixels();
  assert.equal(u.els.get('play').getAttribute('aria-pressed'),'false','a world without a scheduled frame must not claim to be playing');
  assert.equal(u.stage.dataset.paused,'true');assert.match(u.els.get('lab-status').textContent,/已暂停/);
  assert.equal(u.frames.size,0);assert.equal(u.els.get('tick-count').textContent,'第 0 拍');
  u.doc.hidden=false;u.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(u.frames.size,0,'returning to the page must not silently advance the simulation');
  assert.deepEqual(u.pixels(),initial);assert.equal(u.els.get('history-undo').disabled,true);
  u.click('play');
  assert.equal(u.els.get('play').getAttribute('aria-pressed'),'true');assert.equal(u.frames.size,1);
  u.tick(10000);assert.equal(u.els.get('tick-count').textContent,'第 1 拍','time spent in the background must not be replayed');
  u.click('play');assert.equal(u.frames.size,0);assert.equal(u.stage.dataset.paused,'true');
 }finally{u.restore();}
});

test('backgrounding a running cat bowl freezes the world and keeps its undo and redo checkpoints',async()=>{
 const u=await boot({reduced:false});try{
  assert.equal(u.frames.size,1,'a visible page still starts normally');
  u.scene('cat-bowl');u.material(0);u.brush(0);u.stamp(36,42);u.tick(1000);
  const before=u.pixels(),tick=u.els.get('tick-count').textContent,stale=[...u.frames.values()];
  u.doc.hidden=true;u.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(u.frames.size,0);assert.equal(u.stage.dataset.paused,'true');
  stale.forEach(fn=>fn(20000));
  u.doc.hidden=false;u.doc.dispatchEvent(new Event('visibilitychange'));
  assert.deepEqual(u.pixels(),before);assert.equal(u.els.get('tick-count').textContent,tick);
  assert.equal(u.selected('cat-bowl'),'true');assert.equal(u.frames.size,0);
  u.click('history-undo');assert.equal(u.els.get('tick-count').textContent,'第 0 拍');
  u.click('history-redo');assert.deepEqual(u.pixels(),before);assert.equal(u.els.get('tick-count').textContent,tick);
  u.click('play');assert.equal(u.frames.size,1);u.tick(30000);
  assert.equal(u.els.get('tick-count').textContent,'第 2 拍');
 }finally{u.restore();}
});

test('Chouchou observes real water below the outlet, and history restores the observation',async()=>{
 const u=await boot();try{
  u.scene('cat-bowl');
  const report=()=>u.els.get('bowl-report')?.textContent??'';
  const amount=()=>u.els.get('bowl-status').textContent;
  assert.match(report(),/先.*开个口/);
  assert.equal(u.doc.activeElement,u.els.get('bowl-open'));
  const before=u.pixels();
  u.click('bowl-open');
  assert.equal(u.doc.activeElement,u.els.get('step'));
  assert.match(report(),/擦开.*还没.*水/);
  assert.equal(u.els.get('tick-count').textContent,'第 0 拍');
  assert.equal(u.count('water'),140);
  window.innerHeight=568;
  u.els.get('bowl-tools').getBoundingClientRect=()=>({top:-60});
  u.els.get('step').getBoundingClientRect=()=>({bottom:306});
  for(let i=0;i<3;i++){u.click('step');assert.match(report(),/还没.*水/);assert.match(amount(),/碗底下 0 格水/);}
  assert.equal(u.els.get('bowl-tools').scrolled,true,'a step keeps the observation in view when it has scrolled above the canvas');
  u.click('step');assert.match(report(),/碗下.*有水/);assert.match(amount(),/碗底下 1 格水/);
  const after=u.pixels();
  u.click('history-undo');assert.deepEqual(u.pixels(),before);assert.match(report(),/先.*开个口/);
  u.click('history-redo');assert.deepEqual(u.pixels(),after);assert.match(report(),/碗下.*有水/);assert.match(amount(),/碗底下 1 格水/);
  u.scene('splitter');assert.equal(u.els.get('bowl-tools').hidden,true);
 }finally{u.restore();}
});

test('water painted under an unopened bowl is counted without calling it leakage',async()=>{
 const u=await boot();try{
  u.scene('cat-bowl');u.material(2);u.brush(0);u.stamp(8,46);
  assert.match(u.els.get('bowl-status').textContent,/碗底下 1 格水/);
  assert.match(u.els.get('bowl-report')?.textContent??'',/碗底还有墙.*碗下.*有水/);
  assert.equal(u.els.get('bowl-open').disabled,false);
  u.click('bowl-open');
  assert.equal(u.els.get('tick-count').textContent,'第 0 拍');
  assert.match(u.els.get('bowl-report').textContent,/碗下.*有水/);
  assert.doesNotMatch(u.els.get('bowl-report').textContent,/漏出|流出/);
 }finally{u.restore();}
});

test('opening the bowl in a short viewport reveals the focused step and keeps the water result by it',async()=>{
 const u=await boot();try{
  const el=id=>u.els.get(id);
  u.win.innerHeight=320;
  let offset=0;
  for(const [id,top,bottom] of [['bowl-tools',12,147],['bowl-open',94,138],['step',381,425],['lab-status',438,465]]){
   el(id).getBoundingClientRect=()=>({top:top-offset,bottom:bottom-offset});
   el(id).scrollIntoView=({block})=>{offset=block==='center'?(top+bottom-u.win.innerHeight)/2:top-12;};
  }
  const visible=id=>{const r=el(id).getBoundingClientRect();return r.top>=0&&r.bottom<=u.win.innerHeight;};
  u.scene('cat-bowl');
  assert.ok(visible('bowl-open'));
  u.click('bowl-open');
  assert.equal(u.doc.activeElement,el('step'));
  assert.ok(visible('step'),'the newly focused next action must not be below the viewport');
  assert.equal(el('tick-count').textContent,'第 0 拍','opening alone does not advance the world');
  for(let i=0;i<4;i++)u.click('step');
  assert.ok(visible('step')&&visible('lab-status'),'the next action and its latest result remain together');
  assert.match(el('lab-status').textContent,/第 4 拍.*碗底下 1 格水/);
  assert.equal(u.count('water'),140);
 }finally{u.restore();}
});

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

test('the current cat bowl scene keeps its identity, complete evolved world and named reset/switch history',async()=>{
 const u=await boot();try{
  u.scene('cat-bowl');
  assert.match(u.els.get('history-summary').textContent,/切换臭臭的水碗/);
  assert.equal(u.selected('cat-bowl'),'true');
  assert.match(u.els.get('scene-tip').textContent,/臭臭的碗里有水/);
  const fullBowl=u.pixels(),water=u.count('water'),wall=u.count('wall');
  u.material(0);u.brush(0);u.stamp(36,42);
  for(let i=0;i<9;i++)u.click('step');
  const altered=u.pixels();
  assert.notDeepEqual(altered,fullBowl);assert.equal(u.count('water'),water);assert.equal(u.count('wall'),wall-1);
  u.click('reset');
  assert.match(u.els.get('history-summary').textContent,/重置臭臭的水碗/);
  u.click('history-undo');
  assert.deepEqual(u.pixels(),altered);assert.equal(u.els.get('tick-count').textContent,'第 9 拍');
  assert.equal(u.selected('cat-bowl'),'true');assert.equal(u.stage.dataset.paused,'true');assert.equal(u.frames.size,0);
  u.click('history-redo');assert.deepEqual(u.pixels(),fullBowl);assert.equal(u.els.get('tick-count').textContent,'第 0 拍');
  u.click('history-undo');u.scene('empty');u.click('history-undo');
  assert.deepEqual(u.pixels(),altered);assert.equal(u.selected('cat-bowl'),'true');
  assert.match(u.els.get('scene-tip').textContent,/臭臭的碗里有水/);
  u.click('history-redo');assert.equal(u.selected('empty'),'true');assert.equal(u.count('water'),0);
 }finally{u.restore();}
});

test('entering the observation lesson closes held paint and leaves a stable undo/redo checkpoint',async()=>{
 const u=await boot({reduced:false});try{
  u.scene('empty');u.material(2);u.brush(0);
  u.pointer('pointerdown',8,10);u.tick(1000);u.tick(1100);
  const water=u.count('water'),beforePause=u.pixels(),stale=[...u.frames.values()];
  u.doc.dispatchEvent(new Event('sand-lesson-start'));
  assert.equal(u.stage.dataset.paused,'true');assert.equal(u.frames.size,0);
  stale.forEach(fn=>fn(20000));u.pointer('pointerup',20,10);
  assert.deepEqual(u.pixels(),beforePause);
  u.click('history-undo');assert.equal(u.count('water'),0);
  u.click('history-redo');assert.equal(u.count('water'),water);assert.deepEqual(u.pixels(),beforePause);
  u.key('ArrowRight');u.key('Enter');
  u.doc.dispatchEvent(new Event('sand-lesson-start'));u.key('Enter',{repeat:true});
  const fixed=u.pixels();u.tick(40000);assert.deepEqual(u.pixels(),fixed);
 }finally{u.restore();}
});
