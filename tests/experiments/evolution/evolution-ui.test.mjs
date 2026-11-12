import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Run the real model/controller, replacing only browser I/O. Pixel and touch
// acceptance are checked separately in an actual browser.
const html=await readFile(new URL('../../../dist/evolution.html',import.meta.url),'utf8');
test('the timekeeping desk places Bobby beside the actual clock and outside the race canvas',()=>{
 const canvas=html.match(/<canvas\b[^>]*\bid="race"[^>]*>[\s\S]*?<\/canvas>/);
 const clockDesk=html.match(/<div\b[^>]*\bclass="race-timeline"[^>]*>[\s\S]*?\bid="race-state"[^>]*>[^<]*<\/span>\s*<\/div>/);
 assert.ok(clockDesk&&clockDesk[0].includes('id="race-clock"'));
 assert.match(clockDesk[0],/<img\b[^>]*src="\.\/studio-bobby-portrait\.png"/);
 assert.doesNotMatch(canvas[0],/studio-bobby|波比/);
});
let bootId=0;
async function boot({hidden=false,reduced=false}={}){
 const frames=new Map();let id=0;
 const ctx=new Proxy({},{get:(target,key)=>target[key]??(()=>{})});
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.style={};this.attributes=new Map();this.width=900;this.height=480;this.checked=false;this.value='';}
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
 try{await import(new URL(`../../../dist/evolution.mjs?ui=${++bootId}`,import.meta.url));}catch(e){restore();throw e;}
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
test('keyboard roadblocks re-score without resetting generation and a second finger cannot replace an active drawing',async()=>{
 const ui=await boot({reduced:true}),field=ui.elements.get('race');
 try{
  ui.click('next');ui.fire(ui.modes[2],'click');ui.fire(field,'keydown',{key:'Enter',repeat:false});
  assert.equal(ui.elements.get('generation').textContent,'2');assert.match(ui.elements.get('status').textContent,/路障/);
  ui.fire(ui.modes[1],'click');
  ui.fire(field,'pointerdown',{isPrimary:true,button:0,pointerId:1,clientX:80,clientY:100});
  ui.fire(field,'pointerdown',{isPrimary:false,button:0,pointerId:2,clientX:800,clientY:400});
  ui.fire(field,'pointerup',{isPrimary:false,pointerId:2,clientX:800,clientY:400});
  assert.equal(ui.elements.get('track-name').textContent,'大回环');
  ui.fire(field,'pointercancel',{pointerId:1});
 }finally{ui.restore();}
});

test('guided obstacle retains the current generation and shows re-scoring separately from breeding',async()=>{
 const ui=await boot({reduced:true});try{
  assert.ok(ui.elements.has('challenge-obstacle'),'guided roadblock entry is available');
  assert.equal(ui.elements.get('adapt-cards').hidden,true);
  ui.click('evolve');for(let i=0;i<10;i++)ui.frame();
  assert.equal(ui.elements.get('generation').textContent,'11');
  ui.click('challenge-obstacle');
  assert.equal(ui.elements.get('generation').textContent,'11');assert.equal(ui.frames.size,0);
  assert.equal(ui.elements.get('adapt-cards').hidden,false);
  assert.match(ui.elements.get('adapt-old-result').textContent,/完成/);
  assert.match(ui.elements.get('adapt-impact-result').textContent,/未完成/);
  assert.match(ui.elements.get('adapt-population').textContent,/48.*保留/);
  assert.match(ui.elements.get('adapt-evolution-note').textContent,/还没有.*繁衍|尚未.*繁衍/);
 }finally{ui.restore();}
});
test('comparison shows only completed generations, keeps its old route fixed, and survives continued breeding',async()=>{
 const ui=await boot({reduced:true});try{
  assert.ok(ui.elements.has('challenge-obstacle'));
  ui.click('challenge-obstacle');const old=ui.elements.get('adapt-old-result').textContent;
  const current=ui.elements.get('adapt-current-result').textContent;
  ui.click('next');assert.equal(ui.elements.get('generation').textContent,'2');
  assert.equal(ui.elements.get('adapt-current-result').textContent,current);
  assert.match(ui.elements.get('adapt-current-generation').textContent,/第 1 代/);
  ui.click('adapt-evolve');for(let i=0;i<10;i++)ui.frame();
  assert.equal(ui.elements.get('generation').textContent,'12');
  assert.equal(ui.elements.get('adapt-old-result').textContent,old);
  assert.match(ui.elements.get('adapt-current-generation').textContent,/第 12 代/);
  assert.match(ui.elements.get('adapt-evolution-note').textContent,/11 代/);
 }finally{ui.restore();}
});
test('the pit report distinguishes a re-run, a re-rank, and a completed new generation',async()=>{
 const u=await boot({reduced:true});try{
  const e=id=>u.elements.get(id),value=id=>e(id)?.textContent??'';
  assert.equal(e('adapt-pit')?.hidden,true,'no pit report before changing the road');
  u.click('challenge-obstacle');
  assert.equal(e('adapt-pit').hidden,false);
  assert.match(value('adapt-pit-rerun'),/21\.09.*未完成.*48\.4%/);
  assert.match(value('adapt-pit-count'),/48.*5.*第 1 代/);
  assert.match(value('adapt-pit-verdict'),/还没繁衍/);
  assert.match(value('adapt-current-step'),/同批车重新排位/);
  assert.match(value('adapt-feedback'),/已放路障.*重新评分/);
  const verdict=value('adapt-pit-verdict');
  u.click('next');
  assert.equal(value('adapt-pit-verdict'),verdict,'an unrun generation cannot appear in the report');
  assert.match(value('adapt-current-step'),/同批车重新排位/);
  assert.match(value('adapt-pending'),/第 2 代尚未跑完/);
 }finally{u.restore();}
});
test('roadblock fast-forward reports local progress, pauses locally and compares against the first blocked ranking',async()=>{
 const u=await boot({reduced:true});try{
  const e=id=>u.elements.get(id),value=id=>e(id)?.textContent??'';
  u.click('challenge-obstacle');const rerun=value('adapt-pit-rerun');
  u.click('adapt-evolve');assert.match(value('adapt-feedback'),/正在快进.*0 \/ 10/);
  u.frame();assert.match(value('adapt-feedback'),/1 \/ 10/);
  const stale=[...u.frames.values()][0];
  u.click('adapt-evolve');stale(500);
  assert.match(value('adapt-feedback'),/已暂停.*1 \/ 10/);
  assert.match(value('adapt-pit-verdict'),/第 2 代.*24\.05/);
  assert.equal(u.frames.size,0);
  u.click('adapt-evolve');for(let i=0;i<10;i++)u.frame();
  assert.match(value('adapt-feedback'),/完成 10 代/);
  assert.equal(value('adapt-pit-rerun'),rerun);
  assert.match(value('adapt-pit-count'),/48.*5.*第 1 代/);
  assert.match(value('adapt-pit-verdict'),/第 12 代.*比刚重排时.*秒/);
  assert.match(value('adapt-current-step'),/继续繁衍后的本代最佳/);
  u.click('reset');assert.equal(e('adapt-pit').hidden,true);assert.equal(value('adapt-feedback'),'');
 }finally{u.restore();}
});
test('fast-forward completion describes the finished batch, not a later comparison',async()=>{
 const u=await boot({reduced:true});try{
  const value=id=>u.elements.get(id).textContent;
  u.click('challenge-obstacle');u.click('adapt-evolve');
  for(let i=0;i<10;i++)u.frame();
  const completed=value('adapt-feedback');
  assert.match(value('adapt-current-generation'),/第 11 代/);
  u.click('next');u.click('next');
  assert.match(value('adapt-current-generation'),/第 12 代/);
  assert.equal(value('adapt-feedback'),completed,'the note should refer to the completed fast-forward');
  assert.match(completed,/完成 10 代.*第 11 代/);
  assert.doesNotMatch(completed,/下方.*第 11 代/,'the later comparison is no longer from generation 11');
 }finally{u.restore();}
});
test('a rejected guided placement explains itself beside the control without changing the report',async()=>{
 const u=await boot({reduced:true});try{
  const value=id=>u.elements.get(id)?.textContent??'';
  for(let i=0;i<8;i++)u.click('challenge-obstacle');
  const saved=['adapt-pit-rerun','adapt-pit-count','adapt-pit-verdict','adapt-checkpoint'].map(value);
  assert.match(saved[3],/路况 8/);
  u.click('challenge-obstacle');
  assert.match(value('adapt-feedback'),/没找到.*位置/);
  assert.deepEqual(['adapt-pit-rerun','adapt-pit-count','adapt-pit-verdict','adapt-checkpoint'].map(value),saved);
 }finally{u.restore();}
});
test('roadblock edit cancels stale batches, repeat edits replace checkpoint, reset alone starts over',async()=>{
 const ui=await boot({reduced:true}),field=ui.elements.get('race');try{
  assert.ok(ui.elements.has('challenge-obstacle'));
  ui.click('evolve');ui.frame();const stale=[...ui.frames.values()][0];
  ui.fire(ui.modes[2],'click');ui.fire(field,'keydown',{key:'Enter',repeat:false});
  const status=ui.elements.get('status').textContent;stale(10000);
  assert.equal(ui.elements.get('generation').textContent,'2');assert.equal(ui.frames.size,0);
  assert.equal(ui.elements.get('status').textContent,status);
  ui.click('clear-obstacles');assert.equal(ui.elements.get('generation').textContent,'2');
  assert.match(ui.elements.get('adapt-checkpoint').textContent,/路况 2/);
  ui.click('clear-obstacles');assert.match(ui.elements.get('adapt-checkpoint').textContent,/路况 2/);
  ui.click('reset');assert.equal(ui.elements.get('generation').textContent,'1');
  assert.equal(ui.elements.get('adapt-cards').hidden,true);
 }finally{ui.restore();}
});
test('birth inspection after an environment change breeds using the re-scored population',async()=>{
 const ui=await boot({reduced:true});try{
  assert.ok(ui.elements.has('challenge-obstacle'));
  ui.click('next');ui.click('challenge-obstacle');
  ui.click('inspect-birth');assert.equal(ui.elements.get('generation').textContent,'3');
  assert.equal(ui.elements.get('birth-dialog').open,true);
  assert.match(ui.elements.get('status').textContent,/当前路况/);
  ui.click('birth-close');assert.equal(ui.frames.size,0);
  assert.equal(ui.elements.get('adapt-cards').hidden,false);
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
 const {createRace,nextGeneration}=await import('../../../dist/evolution-core.mjs');
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

test('a mutation prediction starts the same run without revealing its result, then checks the actual slower child',async()=>{
 const u=await boot({reduced:true});try{
  assert.ok(u.elements.has('birth-guess-better'),'the mutation stage offers a concrete optional prediction');
  u.click('inspect-birth');u.click('birth-stage-2');u.click('birth-guess-better');
  assert.equal(u.elements.get('birth-stage-3').getAttribute('aria-current'),'step');
  assert.equal(u.elements.get('birth-results').hidden,true);
  assert.match(u.elements.get('birth-guess-note').textContent,/你猜.*更好/);
  assert.equal(u.elements.get('birth-guess-result').textContent,'');
  u.click('birth-finish');
  assert.equal(u.elements.get('birth-results').hidden,false);
  assert.match(u.elements.get('birth-guess-result').textContent,/你猜.*更好.*实际.*更差/);
  // Fixed seed: this inherited child finishes in 26.65 s; mutation finishes in 26.74 s.
  assert.match(u.elements.get('birth-inherited-result').textContent,/26\.65/);
  assert.match(u.elements.get('birth-child-result').textContent,/26\.74/);
  assert.equal(u.elements.get('birth-guess-better').getAttribute('aria-pressed'),'true');
 }finally{u.restore();}
});

test('a different real child can improve, and choosing it clears the previous prediction',async()=>{
 const u=await boot({reduced:true});try{
  assert.ok(u.elements.has('birth-guess-worse'));
  u.click('inspect-birth');u.click('birth-stage-2');u.click('birth-guess-worse');u.click('birth-finish');
  assert.match(u.elements.get('birth-guess-result').textContent,/你猜.*更差.*实际.*更差/);
  u.elements.get('birth-child').value='5';u.fire(u.elements.get('birth-child'),'change');
  assert.equal(u.elements.get('birth-results').hidden,true);
  assert.equal(u.elements.get('birth-guess-better').getAttribute('aria-pressed'),'false');
  assert.equal(u.elements.get('birth-guess-worse').getAttribute('aria-pressed'),'false');
  assert.equal(u.elements.get('birth-guess-result').textContent,'');
  u.click('birth-stage-2');u.click('birth-guess-better');u.click('birth-finish');
  // Same fixed population, child #6: 25.71 s without mutation, 25.24 s after mutation.
  assert.match(u.elements.get('birth-guess-result').textContent,/你猜.*更好.*实际.*更好/);
  assert.match(u.elements.get('birth-inherited-result').textContent,/25\.71/);
  assert.match(u.elements.get('birth-child-result').textContent,/25\.24/);
 }finally{u.restore();}
});

test('zero mutation stays equal, and seeing the result locks the original guess throughout rewind and replay',async()=>{
 const u=await boot({reduced:true});try{
  assert.ok(u.elements.has('birth-guess-same'));
  u.elements.get('mutation').value='0';u.fire(u.elements.get('mutation'),'input');
  u.click('inspect-birth');u.click('birth-stage-2');u.click('birth-guess-same');
  u.click('birth-stage-1');u.click('birth-stage-3');
  assert.match(u.elements.get('birth-guess-note').textContent,/你猜.*一样/);
  u.click('birth-stage-2');assert.doesNotMatch(u.elements.get('birth-step-next').textContent,/不猜/);
  u.click('birth-step-next');
  u.click('birth-run');assert.match(u.elements.get('birth-guess-result').textContent,/你猜.*一样.*实际.*一样/);
  u.elements.get('birth-time').value='0';u.fire(u.elements.get('birth-time'),'input');
  u.click('birth-stage-2');
  assert.equal(u.elements.get('birth-guess-better').disabled,true);
  const revealed=u.elements.get('birth-guess-result').textContent;
  // Synthetic stale click also cannot overwrite the frozen pre-run choice.
  u.click('birth-guess-better');u.click('birth-stage-3');u.click('birth-run');
  assert.equal(u.elements.get('birth-guess-result').textContent,revealed);
  assert.equal(u.elements.get('birth-guess-same').getAttribute('aria-pressed'),'true');
 }finally{u.restore();}
});

test('skipping the prediction still permits direct results, without inventing a player answer',async()=>{
 const u=await boot({reduced:true});try{
  assert.ok(u.elements.has('birth-guess-note'));
  u.click('inspect-birth');u.click('birth-stage-3');
  assert.equal(u.elements.get('birth-guess-result').textContent,'');
  u.click('birth-finish');
  assert.match(u.elements.get('birth-guess-result').textContent,/未作预测.*实际.*更差/);
  for(const choice of ['better','same','worse'])assert.equal(u.elements.get('birth-guess-'+choice).getAttribute('aria-pressed'),'false');
  u.click('birth-close');u.click('inspect-birth');
  assert.equal(u.elements.get('birth-guess-result').textContent,'');
  assert.equal(u.elements.get('birth-guess-better').disabled,false);
 }finally{u.restore();}
});

test('Heim shares the actual selected-gene detail, while Bobby follows the simulated clock including rewind',async()=>{
 const u=await boot({reduced:true});try{
  assert.ok(u.elements.has('birth-assembly-desk'),'the assembly scene includes Heim beside the actual gene controls');
  u.click('inspect-birth');u.click('birth-stage-1');
  assert.equal(u.elements.get('birth-assembly-desk').hidden,false);
  const previous=u.elements.get('birth-segment-detail').textContent;
  u.elements.get('birth-segment').value='10';u.fire(u.elements.get('birth-segment'),'input');
  assert.notEqual(u.elements.get('birth-segment-detail').textContent,previous);
  assert.match(u.elements.get('birth-segment-detail').textContent,/第 11 个路标/);
  u.click('birth-stage-3');
  const driver=u.elements.get('birth-driver');
  assert.equal(driver.hidden,false);assert.equal(u.elements.get('birth-assembly-desk').hidden,true);
  assert.ok(Math.abs(parseFloat(driver.style.left)-8.8888889)<1e-6);
  assert.equal(driver.style.top,'50%');
  u.elements.get('birth-time').value='5';u.fire(u.elements.get('birth-time'),'input');
  // Hand-inspected fixed run at 5 s: (153.60155, 336.92039) on a 900×480 field.
  assert.ok(Math.abs(parseFloat(driver.style.left)-17.0668394)<1e-6);
  assert.ok(Math.abs(parseFloat(driver.style.top)-70.1917489)<1e-6);
  u.elements.get('birth-time').value='0';u.fire(u.elements.get('birth-time'),'input');
  assert.ok(Math.abs(parseFloat(driver.style.left)-8.8888889)<1e-6);
  assert.equal(driver.style.top,'50%');
 }finally{u.restore();}
});

test('Chouchou waits to reveal the actual score, keeps it identified during replay, and clears it for another child',async()=>{
 const u=await boot({reduced:true});try{
  assert.ok(u.elements.has('birth-finish-score'));
  u.click('inspect-birth');assert.equal(u.elements.get('birth-finish-desk').hidden,true);
  u.click('birth-stage-3');assert.equal(u.elements.get('birth-finish-desk').hidden,false);
  assert.doesNotMatch(u.elements.get('birth-finish-score').textContent,/26\.74|完赛/);
  assert.equal(u.elements.get('birth-finish-difference').textContent,'');
  u.click('birth-finish');
  assert.match(u.elements.get('birth-finish-score').textContent,/26\.74.*完赛/);
  assert.match(u.elements.get('birth-finish-difference').textContent,/未变异.*慢.*0\.09/);
  assert.equal(u.elements.get('birth-driver').dataset.motion,'finished');
  u.elements.get('birth-time').value='0';u.fire(u.elements.get('birth-time'),'input');
  assert.match(u.elements.get('birth-finish-label').textContent,/本轮.*成绩/);
  assert.match(u.elements.get('birth-finish-score').textContent,/26\.74/);
  u.elements.get('birth-child').value='5';u.fire(u.elements.get('birth-child'),'change');
  u.click('birth-stage-3');
  assert.doesNotMatch(u.elements.get('birth-finish-score').textContent,/26\.74|25\.24/);
  assert.equal(u.elements.get('birth-finish-difference').textContent,'');
 }finally{u.restore();}
});

test('a blocked Bobby car stays at the true stopped position instead of being sent to the finish',async()=>{
 const u=await boot({reduced:true});try{
  assert.ok(u.elements.has('birth-driver'));
  u.fire(u.modes[2],'click');
  // The UI deliberately refuses obstacles at the start/finish. A valid wall
  // across the middle produces a real stopped child instead of bypassing that rule.
  for(const y of [200,240,280])for(const type of ['pointerdown','pointerup'])u.fire(u.elements.get('race'),type,{isPrimary:true,button:0,pointerId:7,clientX:450,clientY:y,pointerType:'mouse'});
  u.click('inspect-birth');u.click('birth-stage-3');u.click('birth-finish');
  const driver=u.elements.get('birth-driver');
  assert.equal(driver.dataset.motion,'stopped');
  // Fixed stopped sample: (437.37018, 218.01457), not the finish at (820,240).
  assert.ok(Math.abs(parseFloat(driver.style.left)-48.5966871)<1e-6);
  assert.ok(Math.abs(parseFloat(driver.style.top)-45.4197030)<1e-6);
  assert.match(u.elements.get('birth-finish-score').textContent,/未完赛.*51%/);
  assert.doesNotMatch(u.elements.get('birth-finish-score').textContent,/秒.*完赛/);
 }finally{u.restore();}
});

test('missing cat artwork keeps the real car marker and all original run controls usable',async()=>{
 const u=await boot({reduced:true});try{
  assert.ok(u.elements.has('birth-bobby-art'));
  u.click('inspect-birth');
  for(const id of ['birth-bobby-art','birth-heim-art','birth-chouchou-art']){
   const art=u.elements.get(id);u.fire(art,'error');assert.equal(art.hidden,true);
  }
  u.click('birth-stage-3');u.click('birth-run');
  assert.equal(u.elements.get('birth-driver').hidden,false);
  assert.equal(u.elements.get('birth-results').hidden,false);
  assert.match(u.elements.get('birth-finish-score').textContent,/26\.74/);
  u.click('birth-close');assert.equal(u.frames.size,0);
 }finally{u.restore();}
});
