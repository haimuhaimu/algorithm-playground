import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
async function boot({reduced=false}={}){
 const html=await readFile(new URL('../firefly.html',import.meta.url),'utf8');
 assert.match(html,/id="beat-open"/,'the microscope needs a real user entry point');
 const file=new URL('../firefly-beat-ui.mjs',import.meta.url);assert.ok(await access(file).then(()=>true,()=>false));
 let doc,pauses=0,seq=0;
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attrs={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.innerHTML='';}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}
  focus(){doc.activeElement=this;}scrollIntoView(options){doc.scrollTarget=this;doc.scrollOptions=options;}
 }
 const els=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 doc=Object.assign(new EventTarget(),{hidden:false,getElementById:id=>els.get(id)});
 const frames=new Map(),media=Object.assign(new EventTarget(),{matches:reduced}),win=new EventTarget();
 const globals={window:win,requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>media};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 const restore=()=>{for(const[k,d]of old)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];};
 try{(await import(file)).mountBeatLesson({document:doc,onStart:()=>pauses++});}catch(e){restore();throw e;}
 return {els,doc,win,frames,restore,pauses:()=>pauses,
  click:id=>{const el=els.get(id);if(!el.disabled&&!el.hidden)el.dispatchEvent(new Event('click'));},
  scrub:value=>{els.get('beat-scrub').value=String(value);els.get('beat-scrub').dispatchEvent(new Event('input'));},
  frame(now){const entry=frames.entries().next().value;assert.ok(entry,'expected replay frame');frames.delete(entry[0]);entry[1](now);},
  visible(value){doc.hidden=!value;doc.dispatchEvent(new Event('visibilitychange'));},
  reduce(value){media.matches=value;media.dispatchEvent(Object.assign(new Event('change'),{matches:value}));}};
}
test('explicit start and guess gate real simulation; sealed before/after evidence explains a wrong prediction',async()=>{
 const u=await boot();try{
  const e=id=>u.els.get(id);assert.equal(e('beat-body').hidden,true);assert.equal(u.frames.size,0);assert.equal(u.pauses(),0);
  u.click('beat-open');assert.equal(e('beat-body').hidden,false);assert.equal(e('beat-run').disabled,true);assert.equal(u.pauses(),1);
  assert.equal(u.doc.scrollTarget,e('beat-body'),'opening must keep the clocks and decision controls in view');
  u.click('beat-run');assert.equal(e('beat-result').hidden,true);
  u.click('beat-slower');assert.equal(e('beat-run').disabled,false);u.click('beat-run');
  assert.equal(e('beat-panel').dataset.stage,'result');assert.equal(e('beat-result').dataset.correct,'false');
  assert.match(e('beat-explanation').textContent,/加快/);assert.match(e('beat-numbers').textContent,/98\.9/);assert.match(e('beat-numbers').textContent,/56\.3/);
  assert.equal(Number(e('beat-scrub').value),30);assert.equal(u.frames.size,0,'computing result does not auto-run an animation');
  assert.match(e('beat-after').innerHTML,/beat-solo/);assert.equal(u.doc.activeElement,e('beat-result-title'));
  assert.equal(u.doc.scrollTarget,e('beat-body'),'showing the result must not leave its two clocks above the viewport');
 }finally{u.restore();}
});
test('case round trips preserve evidence while retry clears only the current guess and its result',async()=>{
 const u=await boot();try{
  const e=id=>u.els.get(id);u.click('beat-open');u.click('beat-faster');u.click('beat-run');const first=e('beat-numbers').textContent;
  u.click('beat-behind');assert.equal(e('beat-result').hidden,true);assert.equal(e('beat-run').disabled,true);
  u.click('beat-slower');u.click('beat-run');assert.match(e('beat-explanation').textContent,/放慢/);
  u.click('beat-ahead');assert.equal(e('beat-numbers').textContent,first);assert.match(e('beat-progress').textContent,/2/);
  u.click('beat-retry');assert.equal(e('beat-result').hidden,true);assert.equal(e('beat-run').disabled,true);assert.match(e('beat-progress').textContent,/1/);
  u.click('beat-out');u.click('beat-same');u.click('beat-run');assert.match(e('beat-explanation').textContent,/听不见/);assert.equal(e('beat-result').dataset.correct,'true');
 }finally{u.restore();}
});
test('scrubbing, backgrounding, sibling play and case changes invalidate stale replay without rewriting evidence',async()=>{
 const u=await boot();try{
  const e=id=>u.els.get(id);u.click('beat-open');u.click('beat-faster');u.click('beat-run');const numbers=e('beat-numbers').textContent;
  u.click('beat-replay');assert.equal(u.frames.size,1);u.frame(0);u.frame(1000);assert.equal(Number(e('beat-scrub').value),15);
  const stale=[...u.frames.values()][0];u.scrub(7);assert.equal(u.frames.size,0);stale(4000);assert.equal(Number(e('beat-scrub').value),7);
  assert.equal(e('beat-numbers').textContent,numbers);assert.match(e('beat-frame').textContent,/7/);
  u.click('beat-replay');u.visible(false);assert.equal(u.frames.size,0);u.visible(true);assert.equal(u.frames.size,0);
  u.click('beat-replay');u.doc.dispatchEvent(new Event('firefly-world-action'));assert.equal(u.frames.size,0);assert.equal(e('beat-numbers').textContent,numbers);
  u.click('beat-replay');const late=[...u.frames.values()][0];u.click('beat-behind');late(9000);
  assert.equal(e('beat-panel').dataset.scenario,'behind');assert.equal(e('beat-result').hidden,true);assert.equal(u.frames.size,0);
 }finally{u.restore();}
});
test('reduced motion retains static evidence and manual frame access, and preference changes stop replay',async()=>{
 const u=await boot({reduced:true});try{
  const e=id=>u.els.get(id);u.click('beat-open');u.click('beat-faster');u.click('beat-run');
  assert.equal(e('beat-replay').hidden,true);assert.equal(e('beat-scrub').disabled,false);u.scrub(12);assert.equal(Number(e('beat-scrub').value),12);
  u.reduce(false);assert.equal(e('beat-replay').hidden,false);u.click('beat-replay');assert.equal(u.frames.size,1);
  u.reduce(true);assert.equal(u.frames.size,0);assert.equal(e('beat-replay').hidden,true);assert.equal(e('beat-result').hidden,false);
 }finally{u.restore();}
});
