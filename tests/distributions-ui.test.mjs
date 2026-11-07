import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let serial=0;

test('entry names the generators and offers one next action beside the thirty-draw evidence',async()=>{
 const u=await boot();try{
  assert.equal(u.get('sample-count').textContent,'30');
  assert.match(u.get('chart-normal').innerHTML,/<rect/);
  assert.match(u.get('model-normal').textContent,/正态/);assert.match(u.get('model-exponential').textContent,/指数/);
  assert.equal(u.get('next-step').hidden,false);assert.equal(u.get('answer-panel').hidden,true);assert.equal(u.get('ending').hidden,true);assert.equal(u.get('optional-exploration').hidden,true);
  for(const id of ['normal','exponential','pareto'])assert.equal(u.get('comparison-'+id).hidden,true);
  assert.match(u.get('threshold-note').textContent,/4/);assert.equal(u.get('step-1').getAttribute('aria-current'),'step');
 }finally{u.restore();}
});
test('first action appends one equal batch and retains the initial thirty-draw evidence',async()=>{
 const u=await boot();try{
  const initial=u.get('before-pareto').textContent;
  u.get('next-step').focus();u.click('next-step',0);assert.equal(u.get('sample-count').textContent,'3030');
  for(const [id,want]of [['normal',11],['exponential',166],['pareto',352]])assert.equal(u.get('tail-'+id).textContent,`${want} 次`);
  for(const [id,want]of [['normal',0],['exponential',2],['pareto',4]]){
   assert.equal(u.get('comparison-'+id).hidden,false);assert.equal(u.get('previous-'+id).textContent,String(want));
   assert.equal(u.get('previous-label-'+id).textContent,'最初 30 次');assert.equal(u.get('current-label-'+id).textContent,'现在 3,030 次');
  }
  for(const [id,want]of [['normal',11],['exponential',166],['pareto',352]])assert.equal(u.get('current-'+id).textContent,String(want));
  assert.equal(u.get('before-pareto').textContent,initial);
  assert.equal(u.get('step-2').getAttribute('aria-current'),'step');assert.equal(u.get('answer-panel').hidden,true);
  assert.match(u.get('step-copy').textContent,/3,030/);
  assert.equal(u.doc.activeElement,u.get('step-title'),'new step focus must not remain on a retargeted action button');
 }finally{u.restore();}
});
test('zero observed exceedances remain a zero sample frequency, not a numerical-underflow explanation',async()=>{
 const u=await boot();try{
  assert.equal(u.get('tail-normal').textContent,'0 次');
  assert.match(u.get('rate-normal').textContent,/0(?:\.0+)?%/);
  assert.doesNotMatch(u.get('rate-normal').textContent,/精度/);
  assert.doesNotMatch(u.get('probability-normal').textContent,/概率：0%/);
 }finally{u.restore();}
});
test('second action moves only the line and shows frozen same-sample before and after counts',async()=>{
 const u=await boot();try{
  u.click('next-step');const max=u.get('max-pareto').textContent,initial=u.get('before-pareto').textContent;
  u.click('next-step');
  assert.equal(u.get('max-pareto').textContent,max);assert.equal(u.get('sample-count').textContent,'3030');
  for(const [id,low,high]of [['normal',11,0],['exponential',166,0],['pareto',352,88]]){
   assert.equal(u.get('tail-'+id).textContent,`${high} 次`);
   assert.equal(u.get('comparison-'+id).hidden,false);
   assert.equal(u.get('previous-'+id).textContent,String(low));assert.equal(u.get('current-'+id).textContent,String(high));
   assert.equal(u.get('previous-label-'+id).textContent,'红线 +4');assert.equal(u.get('current-label-'+id).textContent,'红线 +16');
  }
  assert.equal(u.get('before-pareto').textContent,initial);assert.match(u.get('threshold-note').textContent,/16/);
  assert.match(u.get('probability-normal').textContent,/e−|e-|×|小于|万|0\.000/);
  assert.equal(u.get('next-step').hidden,true);assert.equal(u.get('answer-panel').hidden,false);assert.equal(u.get('step-3').getAttribute('aria-current'),'step');
 }finally{u.restore();}
});
test('wrong zero-probability answer can be corrected and optional lognormal appears only after the ending',async()=>{
 const u=await boot();try{
  u.click('inspect-transfer');u.click('answer-sample');assert.equal(u.get('transfer-lab').hidden,true);assert.equal(u.get('ending').hidden,true);
  u.click('next-step');u.click('next-step');u.click('answer-zero');
  assert.equal(u.get('ending').hidden,true);assert.ok(u.get('answer-feedback').textContent.length>0);
  assert.equal(u.get('optional-exploration').hidden,true);
  u.click('answer-sample');assert.equal(u.get('ending').hidden,false);
  assert.match(u.get('answer-history').textContent,/一开始.*没抽到.*不可能/);assert.match(u.get('answer-history').textContent,/后来.*改选/);
  assert.doesNotMatch(u.get('ending-summary').textContent,/已经掌握|已通过考试/);
  assert.equal(u.get('optional-exploration').hidden,false);assert.equal(u.get('transfer-lab').hidden,true);
  u.click('inspect-transfer');assert.equal(u.get('transfer-lab').hidden,false);
  assert.match(u.get('transfer-model').textContent,/对数正态/);assert.match(u.get('chart-lognormal').innerHTML,/<rect/);
  assert.match(u.get('transfer-tail').textContent,/3,030/);
 }finally{u.restore();}
});
test('same-seed restart exactly restores the initial data, while new seed starts a clean lesson',async()=>{
 const u=await boot();try{
  const max=u.get('max-pareto').textContent,seed=u.get('seed-value').textContent;
  u.click('next-step');u.click('next-step');u.click('answer-sample');u.click('inspect-transfer');u.click('reset-sample');
  assert.equal(u.get('sample-count').textContent,'30');assert.equal(u.get('max-pareto').textContent,max);
  assert.equal(u.get('seed-value').textContent,seed);assert.equal(u.get('next-step').hidden,false);assert.equal(u.get('comparison-pareto').hidden,true);
  u.click('new-sample');assert.notEqual(u.get('seed-value').textContent,seed);assert.equal(u.get('sample-count').textContent,'30');assert.equal(u.get('transfer-lab').hidden,true);
 }finally{u.restore();}
});
test('hidden page or help cannot sample, answer, reset or change thresholds',async()=>{
 const u=await boot();try{
  u.doc.hidden=true;u.click('next-step');u.click('new-sample');assert.equal(u.get('sample-count').textContent,'30');
  u.doc.hidden=false;u.click('about');assert.equal(u.get('guide').open,true);u.click('next-step');assert.equal(u.get('sample-count').textContent,'30');
  u.click('close-guide');u.click('next-step');assert.equal(u.get('sample-count').textContent,'3030');
  u.click('about');u.click('next-step');u.click('reset-sample');assert.equal(u.get('sample-count').textContent,'3030');assert.match(u.get('threshold-note').textContent,/4/);
 }finally{u.restore();}
});
test('completed main action cannot accidentally append again and writes no learning record',async()=>{
 const u=await boot();try{
  for(let i=0;i<5;i++)u.click('next-step');
  assert.equal(u.get('sample-count').textContent,'3030');assert.match(u.get('threshold-note').textContent,/16/);
  assert.equal(u.get('ending').hidden,true);assert.equal(u.get('answer-panel').hidden,false);
  assert.equal(u.frames.size,0);assert.equal(u.writes.length,0);
 }finally{u.restore();}
});
test('a double click cannot skip the just-revealed threshold step',async()=>{
 const u=await boot();try{
  u.click('next-step',1);u.click('next-step',2);
  assert.equal(u.get('sample-count').textContent,'3030');assert.match(u.get('threshold-note').textContent,/4/);
  assert.equal(u.get('answer-panel').hidden,true);
  u.click('next-step',1);assert.match(u.get('threshold-note').textContent,/16/);
 }finally{u.restore();}
});

async function boot(){
 const html=await readFile(new URL('../distributions.html',import.meta.url),'utf8').catch(()=>'');
 assert.ok(html.includes('id="distribution-app"'),'a standalone local distribution observatory must exist');
 class Element extends EventTarget{
  constructor(){super();this.attributes=new Map();this.dataset={};this.hidden=false;this.disabled=false;this.open=false;this.textContent='';this.innerHTML='';}
  setAttribute(k,v){this.attributes.set(k,String(v));}getAttribute(k){return this.attributes.get(k);}
  focus(){doc.activeElement=this;}scrollIntoView(){}showModal(){this.open=true;}close(){this.open=false;}
 }
 const els=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const doc=Object.assign(new EventTarget(),{hidden:false,documentElement:new Element(),getElementById:id=>els.get(id)});
 const media=Object.assign(new EventTarget(),{matches:false});const frames=new Map(),writes=[];let seq=0;
 const globals={document:doc,window:new EventTarget(),matchMedia:()=>media,crypto:{getRandomValues(a){a[0]=123456789;return a;}},requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;},cancelAnimationFrame:id=>frames.delete(id),localStorage:{setItem(...x){writes.push(x);},getItem(){return null;}}};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const restore=()=>{for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];};
 for(const[k,value]of Object.entries(globals))Object.defineProperty(globalThis,k,{value,writable:true,configurable:true});
 try{await import(new URL('../distributions.mjs?test='+ ++serial,import.meta.url));}catch(e){restore();throw e;}
 return {doc,get:id=>els.get(id),click:(id,detail=1)=>{const event=new Event('click');Object.defineProperty(event,'detail',{value:detail});els.get(id).dispatchEvent(event);},restore,frames,writes};
}
