import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Run the real model/controller, replacing only browser I/O. Pixel and touch
// acceptance are checked separately in an actual browser.
const html=await readFile(new URL('../evolution.html',import.meta.url),'utf8');
let bootId=0;
async function boot({hidden=false,reduced=false}={}){
 const frames=new Map();let id=0;
 const ctx=new Proxy({},{get:(target,key)=>target[key]??(()=>{})});
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attributes=new Map();this.width=900;this.height=480;this.checked=false;this.value='';}
  setAttribute(k,v){this.attributes.set(k,v);}getAttribute(k){return this.attributes.get(k);}
  getContext(){return ctx;}getBoundingClientRect(){return {left:0,top:0,width:900,height:480};}
  setPointerCapture(){}releasePointerCapture(){}focus(){}showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent(new Event('close'));}
 }
 const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,key])=>[key,new Element()]));
 const modes=['watch','draw','obstacle'].map(mode=>Object.assign(new Element(),{dataset:{mode}}));
 const presets=['sweep','hairpin','slalom'].map(preset=>Object.assign(new Element(),{dataset:{preset}}));
 const document=Object.assign(new EventTarget(),{hidden,documentElement:new Element(),getElementById:k=>elements.get(k),querySelectorAll:s=>{
  if(s==='button[data-mode]')return modes;
  if(s==='[data-mode]')return [...modes,...(elements.get('race').dataset.mode?[elements.get('race')]:[])];
  return presets;
 }});
 const globals={document,window:new EventTarget(),matchMedia:q=>Object.assign(new EventTarget(),{matches:q.includes('reduced-motion')&&reduced}),
  getComputedStyle:()=>({getPropertyValue:()=>'#25271f'}),requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:i=>frames.delete(i)};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const restore=()=>{for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];};
 Object.assign(globalThis,globals);
 try{await import(new URL(`../evolution.mjs?ui=${++bootId}`,import.meta.url));}catch(e){restore();throw e;}
 const fire=(el,type,props={})=>el.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),props));
 return {elements,frames,modes,presets,restore,fire,click:k=>fire(elements.get(k),'click'),frame(t=100){const first=frames.entries().next().value;if(first){frames.delete(first[0]);first[1](t);}},hide(){document.hidden=true;fire(document,'visibilitychange');},show(){document.hidden=false;fire(document,'visibilitychange');}};
}
test('hidden and reduced-motion boots stay paused with no invented race results',async()=>{
 for(const options of [{hidden:true},{reduced:true}]){
  const ui=await boot(options);
  try{assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'false');assert.equal(ui.elements.get('finish-count').textContent,'0 / 48');assert.equal(ui.elements.get('best-time').textContent,'未到终点');ui.show();assert.equal(ui.frames.size,0);}
  finally{ui.restore();}
 }
});
test('mode state belongs to buttons and never assigns aria-pressed to the application canvas',async()=>{
 const ui=await boot({reduced:true});
 try{ui.fire(ui.modes[2],'click');assert.equal(ui.elements.get('race').getAttribute('aria-pressed'),undefined);assert.equal(ui.modes[2].getAttribute('aria-pressed'),'true');}
 finally{ui.restore();}
});
test('pause and backgrounding cancel racing and fast-forward without automatic resume',async()=>{
 const ui=await boot();
 try{
  assert.equal(ui.frames.size,1);ui.click('play');assert.equal(ui.frames.size,0);
  ui.click('evolve');ui.frame();assert.equal(ui.elements.get('generation').textContent,'2');
  const pending=[...ui.frames.values()][0];ui.hide();assert.equal(ui.frames.size,0);ui.show();pending(300);
  assert.equal(ui.elements.get('generation').textContent,'2');assert.equal(ui.frames.size,0);
 }finally{ui.restore();}
});
test('fast-forward replaces the paused status immediately, reports progress and cannot overwrite a later pause',async()=>{
 const u=await boot();try{
  u.click('play');assert.match(u.elements.get('status').textContent,/已暂停/);u.click('evolve');
  assert.match(u.elements.get('status').textContent,/正在快进/);assert.doesNotMatch(u.elements.get('status').textContent,/已暂停/);
  u.frame();assert.match(u.elements.get('status').textContent,/1.*10/);const stale=[...u.frames.values()][0];
  u.click('play');const paused=u.elements.get('status').textContent;stale(1000);assert.equal(u.elements.get('status').textContent,paused);
  u.click('evolve');for(let i=0;i<10;i++)u.frame();assert.match(u.elements.get('status').textContent,/完成.*10|10.*完成/);assert.equal(u.frames.size,0);
 }finally{u.restore();}
});
test('resuming a paused race reports playing before the next generation finishes',async()=>{
 const u=await boot();try{u.click('play');u.click('play');assert.match(u.elements.get('status').textContent,/正在比赛/);assert.equal(u.frames.size,1);}finally{u.restore();}
});
test('editing a track cancels a queued fast-forward generation and resets evidence',async()=>{
 const ui=await boot({reduced:true});
 try{
  ui.click('evolve');ui.frame();const pending=[...ui.frames.values()][0];
  ui.fire(ui.presets[1],'click');assert.equal(ui.elements.get('generation').textContent,'1');
  pending(400);assert.equal(ui.elements.get('generation').textContent,'1');assert.equal(ui.frames.size,0);
  assert.equal(ui.elements.get('track-name').textContent,'发卡弯');assert.equal(ui.elements.get('best-time').textContent,'未到终点');
 }finally{ui.restore();}
});
test('cancelled and invalid freehand gestures retain the last valid course and generation',async()=>{
 const ui=await boot({reduced:true}),field=ui.elements.get('race');
 const pointer=(type,x,y,extra={})=>ui.fire(field,type,{isPrimary:true,button:0,pointerId:7,clientX:x,clientY:y,pointerType:'mouse',...extra});
 try{
  ui.click('next');assert.equal(ui.elements.get('generation').textContent,'2');ui.fire(ui.modes[1],'click');
  pointer('pointerdown',80,100);pointer('pointermove',800,360);pointer('pointercancel',800,360);pointer('pointerup',800,360);
  assert.equal(ui.elements.get('generation').textContent,'2');assert.equal(ui.elements.get('track-name').textContent,'大回环');
  pointer('pointerdown',80,100);pointer('pointerup',81,101);
  assert.equal(ui.elements.get('generation').textContent,'2');assert.match(ui.elements.get('status').textContent,/太短|250/);
  pointer('pointerdown',80,100);pointer('pointermove',400,240);pointer('pointerup',800,360);
  assert.equal(ui.elements.get('generation').textContent,'1');assert.equal(ui.elements.get('track-name').textContent,'我的赛道');
 }finally{ui.restore();}
});
test('a long back-and-forth scribble cannot replace a valid race with instant finishes',async()=>{
 const ui=await boot({reduced:true}),field=ui.elements.get('race');
 const pointer=(type,x,y)=>ui.fire(field,type,{isPrimary:true,button:0,pointerId:7,clientX:x,clientY:y,pointerType:'mouse'});
 try{
  ui.click('next');ui.fire(ui.modes[1],'click');
  pointer('pointerdown',100,200);
  for(let i=1;i<51;i++)pointer('pointermove',100+(i%2)*10,200);
  pointer('pointerup',100,200);
  assert.equal(ui.elements.get('generation').textContent,'2');
  assert.equal(ui.elements.get('track-name').textContent,'大回环');
  assert.equal(ui.elements.get('finish-count').textContent,'0 / 48');
  assert.equal(ui.elements.get('best-time').textContent,'未到终点');
  assert.match(ui.elements.get('status').textContent,/原赛道已保留/);
 }finally{ui.restore();}
});
test('keyboard roadblocks reset scores and a second finger cannot replace an active drawing',async()=>{
 const ui=await boot({reduced:true}),field=ui.elements.get('race');
 try{
  ui.click('next');ui.fire(ui.modes[2],'click');ui.fire(field,'keydown',{key:'Enter',repeat:false});
  assert.equal(ui.elements.get('generation').textContent,'1');assert.match(ui.elements.get('status').textContent,/路障/);
  ui.fire(ui.modes[1],'click');
  ui.fire(field,'pointerdown',{isPrimary:true,button:0,pointerId:1,clientX:80,clientY:100});
  ui.fire(field,'pointerdown',{isPrimary:false,button:0,pointerId:2,clientX:800,clientY:400});
  ui.fire(field,'pointerup',{isPrimary:false,pointerId:2,clientX:800,clientY:400});
  assert.equal(ui.elements.get('track-name').textContent,'大回环');
  ui.fire(field,'pointercancel',{pointerId:1});
 }finally{ui.restore();}
});
test('touch scrolling in roadblock mode neither edits the track nor reports a cancelled drawing',async()=>{
 const ui=await boot({reduced:true}),field=ui.elements.get('race');
 try{
  ui.click('next');ui.fire(ui.modes[2],'click');const status=ui.elements.get('status').textContent;
  ui.fire(field,'pointerdown',{isPrimary:true,button:0,pointerId:4,clientX:300,clientY:200});
  ui.fire(field,'pointermove',{pointerId:4,clientX:300,clientY:100,pointerType:'touch'});
  ui.fire(field,'pointercancel',{pointerId:4});
  assert.equal(ui.elements.get('generation').textContent,'2');assert.equal(ui.elements.get('status').textContent,status);
 }finally{ui.restore();}
});

test('birth inspection pauses the race, uses the actual next generation and gates child results until simulated',async()=>{
 const ui=await boot({reduced:true});try{
  assert.ok(ui.elements.has('inspect-birth'),'race must have a birth entry point');
  ui.click('inspect-birth');assert.equal(ui.elements.get('generation').textContent,'2');
  assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('birth-dialog').open,true);
  assert.equal(ui.elements.get('birth-results').hidden,true);
  assert.match(ui.elements.get('birth-parent-a').textContent,/父代 A/);
  ui.click('birth-stage-1');assert.match(ui.elements.get('birth-explanation').textContent,/继承/);
  ui.click('birth-stage-2');assert.match(ui.elements.get('birth-explanation').textContent,/变异/);
  ui.click('birth-stage-3');assert.equal(ui.elements.get('birth-results').hidden,true);
  ui.click('birth-run');assert.equal(ui.elements.get('birth-results').hidden,false);
  assert.match(ui.elements.get('birth-child-result').textContent,/26\.74/);
  ui.click('birth-close');assert.equal(ui.elements.get('birth-dialog').open,false);assert.equal(ui.frames.size,0);
 }finally{ui.restore();}
});

test('birth playback pauses on hide and stale frames cannot revive it after selecting another child',async()=>{
 const ui=await boot();try{
  assert.ok(ui.elements.has('inspect-birth'));
  ui.click('inspect-birth');ui.click('birth-stage-3');ui.click('birth-run');
  assert.equal(ui.frames.size,1);ui.frame(0);ui.frame(100);const pending=[...ui.frames.values()][0];
  ui.hide();assert.equal(ui.frames.size,0);ui.show();pending(10000);assert.equal(ui.frames.size,0);
  ui.elements.get('birth-child').value='3';ui.fire(ui.elements.get('birth-child'),'change');
  assert.equal(ui.elements.get('birth-results').hidden,true);assert.equal(ui.elements.get('birth-time').value,'0');
  ui.click('birth-stage-3');ui.click('birth-finish');assert.equal(ui.elements.get('birth-results').hidden,false);
 }finally{ui.restore();}
});

test('zero mutation is shown honestly and closing inspection never resumes the main race',async()=>{
 const ui=await boot({reduced:true});try{
  assert.ok(ui.elements.has('inspect-birth'));
  ui.elements.get('mutation').value='0';ui.fire(ui.elements.get('mutation'),'input');
  ui.click('inspect-birth');ui.click('birth-stage-2');
  assert.match(ui.elements.get('birth-explanation').textContent,/没有.*变异|没有.*改变/);
  ui.click('birth-stage-3');ui.click('birth-finish');assert.match(ui.elements.get('birth-mutation-result').textContent,/相同/);
  ui.fire(ui.elements.get('birth-dialog'),'cancel');assert.equal(ui.elements.get('birth-dialog').open,false);
  assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'false');
  ui.fire(ui.presets[1],'click');ui.click('inspect-birth');assert.equal(ui.elements.get('generation').textContent,'2');
 }finally{ui.restore();}
});

test('birth timeline reaches completion at its selectable endpoint and closing clears inspection status',async()=>{
 const ui=await boot({reduced:true});try{
  ui.click('inspect-birth');ui.click('birth-stage-3');const slider=ui.elements.get('birth-time');
  const reachable=Math.floor(Number(slider.max)*10)/10;
  slider.value=String(reachable);ui.fire(slider,'input');
  assert.equal(ui.elements.get('birth-results').hidden,false);
  ui.click('birth-close');assert.match(ui.elements.get('status').textContent,/已返回.*暂停/);
  assert.doesNotMatch(ui.elements.get('status').textContent,/观察中/);
 }finally{ui.restore();}
});

test('birth selection shows each recorded draw, not merely the generic tournament rule',async()=>{
 const {createRace,nextGeneration}=await import('../evolution-core.mjs');
 const expected=nextGeneration(createRace()).births[2];
 const ui=await boot({reduced:true});try{
  ui.click('inspect-birth');const note=ui.elements.get('birth-selection-note').textContent;
  for(const parent of expected.parents)assert.ok(note.includes(parent.candidates.map(i=>'#'+(i+1)).join('、')));
  ui.click('birth-stage-1');assert.match(ui.elements.get('birth-explanation').textContent,/路标/);
  assert.doesNotMatch(ui.elements.get('birth-segment-detail').textContent,/变异/);
  assert.doesNotMatch(ui.elements.get('birth-genome').innerHTML,/gene-mutated/);
  ui.click('birth-stage-0');ui.click('birth-parent-a');assert.match(ui.elements.get('birth-segment-detail').textContent,/父代 A/);
  ui.click('birth-parent-b');assert.match(ui.elements.get('birth-segment-detail').textContent,/父代 B/);
 }finally{ui.restore();}
});
