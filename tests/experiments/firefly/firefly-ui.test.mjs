import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Execute the actual controller and model. Only browser I/O is represented here;
// this checks lifecycle state, not canvas pixels or real browser backgrounding.
const html=await readFile(new URL('../../../dist/firefly.html',import.meta.url),'utf8');
test('mobile reading order reaches scene settings before secondary observation charts',()=>{
 assert.ok(html.indexOf('class="chorus-controls"')<html.indexOf('class="chorus-observation"'),'settings must not sit beyond the observation charts');
 for(const id of ['fireflies','play','step','shuffle','reset','show-phase','coupling','radius','spread']){
  assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,id+' must not be duplicated for a responsive view');
 }
});
let bootNumber=0;
async function boot({hidden=false,reducedMotion=false,source=false}={}){
 const frames=new Map();let nextFrame=0;
 const paints={field:0,gradients:0};
 const arcs=[];
 const context={createRadialGradient:()=>{paints.gradients++;return {addColorStop(){}};}};
 for(const name of ['fillRect','beginPath','arc','fill','stroke','setLineDash','ellipse','moveTo','lineTo','clearRect','fillText'])context[name]=()=>{};
 context.fillRect=()=>{paints.field++;};
 context.setLineDash=values=>{context.dash=[...values];};
 context.arc=(...args)=>arcs.push({args,dash:[...(context.dash||[])]});
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attributes=new Map();this.width=960;this.height=600;this.checked=false;this.textWrites=0;}
  set textContent(value){this.text=value;this.textWrites++;}
  get textContent(){return this.text;}
  setAttribute(name,value){this.attributes.set(name,value);}
  getAttribute(name){return this.attributes.get(name);}
  getContext(){return context;}
  getBoundingClientRect(){return {left:0,top:0,width:this.width,height:this.height};}
  focus(){document.activeElement=this;}
 }
 const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const presets=['chorus','independent','islands'].map(preset=>Object.assign(new Element(),{dataset:{preset}}));
 const modes=['scatter','align'].map(mode=>Object.assign(new Element(),{dataset:{mode}}));
 const document=Object.assign(new EventTarget(),{hidden,documentElement:new Element(),
  getElementById:id=>elements.get(id),querySelectorAll:selector=>selector==='[data-preset]'?presets:modes});
 const globals={document,window:new EventTarget(),
  matchMedia:query=>Object.assign(new EventTarget(),{matches:query.includes('reduced-motion')&&reducedMotion}),
  getComputedStyle:()=>({getPropertyValue:()=>'#25271f'}),
  requestAnimationFrame:callback=>{const id=++nextFrame;frames.set(id,callback);return id;},
  cancelAnimationFrame:id=>frames.delete(id)};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const restore=()=>{for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];};
 Object.assign(globalThis,globals);
 try{await import(new URL(`../../../${source?'src/experiments/firefly':'dist'}/firefly.mjs?lifecycle-test=${++bootNumber}`,import.meta.url));}
 catch(error){restore();throw error;}
 return {document,frames,elements,arcs,paints,restore,
  frame(now){const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(now);},
  visible(value){document.hidden=!value;document.dispatchEvent(new Event('visibilitychange'));}};
}
const press=(field,key,repeat=false)=>field.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{key,repeat}));
function tap(field,x,y){
 for(const name of ['pointerdown','pointerup'])field.dispatchEvent(Object.assign(new Event(name),{pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y}));
}

test('high-refresh playback redraws the pond only after a real simulation step',async()=>{
 const ui=await boot({source:true});try{
  const initial={...ui.paints};
  ui.frame(0);ui.frame(1000/120);
  assert.equal(ui.paints.field-initial.field,0,'unchanged 120Hz frames must not rebuild the pond');
  assert.equal(ui.paints.gradients-initial.gradients,0);
  for(let i=2;i<720;i++)ui.frame(i*1000/120);
  ui.frame(6001);
  assert.equal(ui.paints.field-initial.field,360,'six simulated seconds still run 360 original steps');
  assert.equal(ui.paints.gradients-initial.gradients,360*81,'each changed frame keeps all 80 original fireflies and the backdrop');
  assert.equal(ui.elements.get('elapsed').textContent,'6.0 秒');
  assert.equal(ui.frames.size,1,'skipping a redraw must not stop the simulation clock');
 }finally{ui.restore();}
});

test('range legend distinguishes the adjustable neighbor radius from the fixed direct intervention',async()=>{
 const ui=await boot({reducedMotion:true});
 try{
  const el=id=>ui.elements.get(id),field=el('fireflies');
  assert.ok(el('scope-legend'),'the two drawn ranges need an in-place legend');
  for(const [radius,display] of [[.15,'0.15'],[2,'整片']]){
   el('radius').value=radius;el('radius').dispatchEvent(new Event('input'));
   assert.equal(el('scope-radius').textContent,display);
   ui.arcs.length=0;field.dispatchEvent(new Event('focus'));
   assert.equal(ui.arcs[0].args[2],radius*600,'solid circle must match the real neighbor radius');
   assert.deepEqual(ui.arcs[0].dash,[]);
   assert.equal(ui.arcs[1].args[2],132,'dashed circle must stay at the real .22 brush radius');
   assert.deepEqual(ui.arcs[1].dash,[4,5]);
   for(const key of ['2','Enter']){const event=new Event('keydown');Object.defineProperty(event,'key',{value:key});field.dispatchEvent(event);}
   assert.match(el('interaction-status').textContent,/波比拍了一下.*圈内 12 只.*圈外 68 只/,'widening neighbor hearing must not directly light the whole field');
   assert.equal(ui.frames.size,0,'an input must not resume a paused world');
  }
 }finally{ui.restore();}
});
test('Bobby makes one local tap and the marked radius stays at its position while paused',async()=>{
 const ui=await boot({reducedMotion:true});try{
  const el=id=>ui.elements.get(id),field=el('fireflies'),status=el('interaction-status');
  press(field,'2');assert.match(status.textContent,/再点池塘/);
  assert.doesNotMatch(status.textContent,/拍了一下/,'choosing a tool does not intervene');
  tap(field,480,300);
  assert.match(status.textContent,/波比拍了一下.*圈内 12 只.*圈外 68 只/);
  assert.equal(el('elapsed').textContent,'0.0 秒');assert.equal(ui.frames.size,0);
  const writes=status.textWrites;
  press(field,'Enter',true);assert.equal(status.textWrites,writes,'a held key cannot keep clapping');
  ui.arcs.length=0;press(field,'ArrowRight');
  const lastClap=ui.arcs.find(a=>a.dash[0]===7&&a.args[2]===132);
  assert.deepEqual(lastClap?.args.slice(0,3),[480,300,132],'the result marks the tap, not the later cursor');
  tap(field,950,590);assert.match(status.textContent,/圈内 0 只.*没有节拍被直接拨动/);
  ui.arcs.length=0;el('reset').dispatchEvent(new Event('click'));
  assert.ok(!ui.arcs.some(a=>a.dash[0]===7),'reset clears the last clap marker');
 }finally{ui.restore();}
});
test('guided comparison hides the free-intervention legend and restores it on exit',async()=>{
 const ui=await boot({reducedMotion:true});
 try{
  const el=id=>ui.elements.get(id),click=id=>el(id).dispatchEvent(new Event('click'));
  assert.equal(el('scope-legend')?.hidden,false);
  click('listening-start');assert.equal(el('scope-legend').hidden,true);
  assert.match(el('scope-description').textContent,/锁定/);
  press(el('fireflies'),'2');press(el('fireflies'),'Enter');
  assert.match(el('interaction-status').textContent,/引导/);
  assert.doesNotMatch(el('interaction-status').textContent,/波比拍了一下/);
  click('listening-fast');click('listening-wide');click('listening-fast');
  assert.equal(el('scope-legend').hidden,true);
  click('listening-exit');assert.equal(el('scope-legend').hidden,false);
  assert.equal(el('scope-radius').textContent,'整片');
  assert.doesNotMatch(el('scope-description').textContent,/锁定/);
 }finally{ui.restore();}
});

test('a hidden initial load stays truthfully paused after foregrounding until Continue',async()=>{
 const ui=await boot({hidden:true});
 try{
  assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'false');
  assert.match(ui.elements.get('play-status').textContent,/已暂停/);assert.equal(ui.frames.size,0);
  ui.visible(true);assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('play').textContent,'继续');
  ui.elements.get('play').dispatchEvent(new Event('click'));
  assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'true');assert.equal(ui.frames.size,1);
 }finally{ui.restore();}
});
test('hiding a running experiment cancels its frame and foregrounding does not resume',async()=>{
 const ui=await boot();
 try{
  assert.equal(ui.frames.size,1);assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'true');
  ui.visible(false);assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'false');
  ui.visible(true);assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('play').textContent,'继续');
 }finally{ui.restore();}
});
test('reduced motion starts paused even when the document is visible',async()=>{
 const ui=await boot({reducedMotion:true});
 try{assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'false');}
 finally{ui.restore();}
});

test('guided comparison runs the real model, preserves before evidence and lets the user test the opposite choice',async()=>{
 const ui=await boot();
 try{
  const el=id=>ui.elements.get(id),click=id=>el(id).dispatchEvent(new Event('click'));
  assert.ok(el('listening-start'),'a real entry point is required');
  click('listening-start');assert.equal(el('listening-lesson').dataset.stage,'observing');
  assert.equal(ui.document.activeElement,el('listening-fast'),'focus must move off the now-hidden start action');
  assert.doesNotMatch(el('play-status').textContent,/点按可以干预/,'locked guide must not advertise unavailable drawing');
  assert.doesNotMatch(el('field-caption').textContent,/点一下/);
  assert.doesNotMatch(el('scene-tip').textContent,/拉到整片/,'disabled slider must not be presented as the next action');
  assert.equal(el('radius').disabled,true);assert.equal(el('listening-wide').disabled,true);
  click('listening-fast');assert.equal(el('listening-lesson').dataset.stage,'before');
  assert.equal(ui.document.activeElement,el('listening-wide'));
  assert.equal(el('play').getAttribute('aria-pressed'),'false');assert.equal(ui.frames.size,0);
  const before=el('comparison-before').innerHTML;assert.match(before,/21%/);
  click('listening-wide');assert.equal(el('listening-lesson').dataset.stage,'comparing');
  assert.equal(el('radius').value,2);click('listening-fast');
  assert.equal(ui.document.activeElement,el('comparison-title'),'completion should bring keyboard users to the evidence');
  assert.equal(el('listening-lesson').dataset.stage,'after');assert.equal(el('comparison-before').innerHTML,before);
  assert.equal(el('listening-comparison').dataset.outcome,'joined');
  assert.equal(el('listening-quiz').hidden,false);
  click('answer-chaotic');assert.equal(el('listening-answer').dataset.correct,'false');
  click('answer-separate');assert.equal(el('listening-answer').dataset.correct,'true');
  click('listening-near');assert.equal(el('listening-answer').textContent,'');
  click('listening-fast');assert.equal(el('listening-comparison').dataset.outcome,'separate');
  assert.equal(el('comparison-before').innerHTML,before);
 }finally{ui.restore();}
});

test('guided playback pauses on hide and exiting clears evidence without stale frames completing a trial',async()=>{
 const ui=await boot();
 try{
  const el=id=>ui.elements.get(id),click=id=>el(id).dispatchEvent(new Event('click'));
  assert.ok(el('listening-start'));click('listening-start');
  ui.visible(false);assert.equal(ui.frames.size,0);ui.visible(true);assert.equal(ui.frames.size,0);
  assert.equal(el('listening-lesson').dataset.stage,'observing');
  click('listening-exit');assert.equal(el('radius').disabled,false);
  assert.equal(el('listening-lesson').dataset.stage,'idle');assert.equal(el('listening-comparison').hidden,true);
  assert.equal(el('listening-quiz').hidden,true);assert.equal(ui.frames.size,0);
  click('listening-fast');assert.equal(el('listening-lesson').dataset.stage,'idle');
 }finally{ui.restore();}
});

test('real frame playback announces whole seconds and stops automatically at both observation points',async()=>{
 const ui=await boot();
 try{
  const el=id=>ui.elements.get(id),click=id=>el(id).dispatchEvent(new Event('click'));
  let now=0;
  const frame=()=>{const [id,callback]=ui.frames.entries().next().value;ui.frames.delete(id);callback(now);now+=17;};
  const finish=()=>{let count=0;while(ui.frames.size&&count++<2000)frame();assert.ok(count<2000,'guide must stop on its own');};
  click('listening-start');
  const writes=el('listening-status').textWrites;
  for(let i=0;i<10;i++)frame();
  assert.equal(el('listening-status').textWrites,writes,'sub-second frames must not repeat live-region announcements');
  finish();
  assert.equal(el('listening-lesson').dataset.stage,'before');assert.equal(el('elapsed').textContent,'15.0 秒');
  assert.equal(el('play').getAttribute('aria-pressed'),'false');
  const before=el('comparison-before').innerHTML;
  click('listening-wide');finish();
  assert.equal(el('listening-lesson').dataset.stage,'after');assert.equal(el('elapsed').textContent,'25.0 秒');
  assert.equal(el('comparison-before').innerHTML,before);assert.equal(ui.frames.size,0);
  click('listening-exit');assert.equal(ui.frames.size,0);click('play');assert.equal(ui.frames.size,1);
 }finally{ui.restore();}
});

test('one-oscillator inspection pauses but preserves the two-group checkpoint, and the group can resume without concurrent replay',async()=>{
 const ui=await boot();try{
  const el=id=>ui.elements.get(id),click=id=>el(id).dispatchEvent(new Event('click'));
  click('listening-start');click('listening-fast');const evidence=el('comparison-before').innerHTML;
  click('beat-open');assert.equal(el('play').getAttribute('aria-pressed'),'false');assert.equal(ui.frames.size,0);
  assert.equal(el('listening-lesson').dataset.stage,'before');assert.equal(el('comparison-before').innerHTML,evidence);
  click('beat-faster');click('beat-run');click('beat-replay');const stale=[...ui.frames.values()][0];assert.equal(ui.frames.size,1);
  click('listening-wide');assert.equal(el('listening-lesson').dataset.stage,'comparing');assert.equal(ui.frames.size,1,'only the actual group playback is scheduled');
  stale(5000);assert.equal(el('beat-scrub').value,'0');assert.equal(el('comparison-before').innerHTML,evidence);
  click('listening-fast');assert.equal(el('listening-comparison').dataset.outcome,'joined');assert.equal(ui.frames.size,0);
 }finally{ui.restore();}
});
