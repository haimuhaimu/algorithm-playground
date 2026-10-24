import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let serial=0;
test('shared lesson reveals rules only after committing a choice, then records just one flight',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('shared-reveal'),'same-evidence lesson must be available before completing thirty flights');
  assert.equal(u.els.get('shared-reveal').disabled,true);
  assert.equal(u.els.get('shared-comparison').hidden,true);assert.equal(u.els.get('shared-result').hidden,true);
  u.click('shared-planet-1');assert.equal(u.els.get('shared-reveal').disabled,false);
  u.click('shared-reveal');assert.equal(u.els.get('shared-comparison').hidden,false);
  assert.match(u.els.get('shared-greedy').textContent,/苔原/);assert.match(u.els.get('shared-ucb').textContent,/珊瑚/);
  assert.equal(u.els.get('shared-result').hidden,true);
  u.click('shared-fly');u.click('shared-fly');u.click('shared-planet-0');
  assert.equal(u.frames.size,1);u.tick(0);u.tick(600);assert.equal(u.els.get('shared-result').hidden,true);
  u.tick(1300);assert.equal(u.els.get('shared-result').hidden,false);
  assert.match(u.els.get('shared-outcome').textContent,/珊瑚.*1 块/);
  assert.match(u.els.get('shared-change').textContent,/1.*2.*2.*3/);
  assert.equal(u.els.get('remaining').textContent,'30');assert.equal(u.els.get('minerals').textContent,'0');
  u.click('shared-answer-rules');assert.match(u.els.get('shared-learning').textContent,/同一份线索/);
  u.click('shared-retry');assert.match(u.els.get('shared-status').textContent,/结果已知/);
  assert.equal(u.els.get('shared-result').hidden,true);
 }finally{u.restore();}
});
test('shared lesson cancellation rejects stale arrivals and reduced motion resolves on explicit launch',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('shared-fly'));
  u.click('shared-planet-0');u.click('shared-reveal');u.click('shared-fly');u.tick(0);
  const stale=[...u.frames.values()][0];u.hide();stale(9000);u.show();
  assert.equal(u.frames.size,0);assert.equal(u.els.get('shared-result').hidden,true);
  assert.equal(u.els.get('shared-fly').disabled,false);
  u.click('shared-fly');u.tick(0);u.click('about');assert.equal(u.frames.size,0);
  u.els.get('guide').close();u.media.matches=true;u.fire(u.media,'change');u.click('shared-fly');
  assert.equal(u.frames.size,0);assert.equal(u.els.get('shared-result').hidden,false);
  assert.match(u.els.get('shared-outcome').textContent,/苔原.*空手/);
 }finally{u.restore();}
});
test('number shortcuts inside shared lesson never launch the unrelated thirty-flight game',async()=>{
 const u=await boot({reduced:true});try{
  assert.ok(u.els.has('shared-planet-0'));
  u.doc.activeElement=u.els.get('shared-planet-0');
  u.key('2');assert.equal(u.els.get('remaining').textContent,'30');
  u.doc.activeElement=u.els.get('shared-fly');u.key('3');assert.equal(u.els.get('remaining').textContent,'30');
 }finally{u.restore();}
});
async function boot({reduced=false,seed}={}){
 const html=await readFile(new URL('../mining.html',import.meta.url),'utf8').catch(()=>'');
 assert.ok(html.includes('id="planet-0"'),'playable mining page must exist');
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.style={setProperty(){}};this.attributes=new Map();this.hidden=false;this.disabled=false;this.open=false;this.textContent='';this.children=[];}
  setAttribute(k,v){this.attributes.set(k,v);}getAttribute(k){return this.attributes.get(k);}
  getBoundingClientRect(){return {left:0,top:0,width:900,height:400};}
  scrollIntoView(){this.scrolls=(this.scrolls||0)+1;}
  replaceChildren(...children){this.children=children;}append(...children){this.children.push(...children);}focus(){}
  showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent(new Event('close'));}
 }
 const els=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const doc=Object.assign(new EventTarget(),{hidden:false,documentElement:new Element(),getElementById:id=>els.get(id),createElement:()=>new Element()});
 const frames=new Map();let seq=0;
 const media=Object.assign(new EventTarget(),{matches:reduced});
 const globals={document:doc,window:Object.assign(new EventTarget(),{innerHeight:844}),matchMedia:()=>media,requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;},cancelAnimationFrame:id=>frames.delete(id)};
 if(seed!==undefined)globals.crypto={getRandomValues(array){array[0]=seed;return array;}};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const restore=()=>{for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];};
 for(const[k,value]of Object.entries(globals))Object.defineProperty(globalThis,k,{value,writable:true,configurable:true});
 try{await import(new URL('../mining.mjs?t='+ ++serial,import.meta.url));}catch(e){restore();throw e;}
 const fire=(el,type,props={})=>el.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),props));
 return {els,frames,doc,win:globals.window,media,restore,fire,click:id=>fire(els.get(id),'click'),
  tick(time){const queue=[...frames];frames.clear();for(const[,fn]of queue)fn(time);},
  finish(){for(const t of [0,500]){const queue=[...frames];frames.clear();for(const[,fn]of queue)fn(t);}},
  hide(){doc.hidden=true;fire(doc,'visibilitychange');},show(){doc.hidden=false;fire(doc,'visibilitychange');},
  key(key,props={}){return fire(doc,'keydown',{key,...props});}};
}
test('one flight commits only on arrival, ignores rapid extra choices, and preserves hidden truth',async()=>{
 const u=await boot();try{u.click('planet-0');u.click('planet-1');assert.equal(u.frames.size,1);assert.equal(u.els.get('remaining').textContent,'30');
  assert.equal(u.els.get('planet-0').disabled,false,'pending flight must keep native keyboard focus');
  assert.equal(u.els.get('planet-0').getAttribute('aria-disabled'),'true');
  assert.equal(u.els.get('results').hidden,true);assert.equal(u.els.get('truth-0').textContent,'产量未知');u.finish();
  assert.equal(u.els.get('remaining').textContent,'29');assert.match(u.els.get('sample-0').textContent,/1 次/);assert.match(u.els.get('sample-1').textContent,/未探测/);
 }finally{u.restore();}
});

async function simulationFixture(options={}){
 const u=await boot({seed:42,...options});
 for(let i=0;i<30;i++){u.click('planet-'+i%5);u.finish();}
 return u;
}
test('algorithm flight uses recorded choice and updates samples only after returning, without changing human score',async()=>{
 const u=await simulationFixture();try{
  assert.ok(u.els.has('sim-play'),'algorithm choices need a playable flight simulation');
  const human=u.els.get('minerals').textContent;
  assert.equal(u.els.get('sim-total').textContent,'2');
  u.click('sim-step');u.tick(0);u.tick(1000);
  assert.equal(u.els.get('sim-planet-1').dataset.target,'true');
  assert.equal(u.els.get('sim-probe').hidden,false);
  assert.equal(u.els.get('sim-sample-1').textContent,'1 矿 / 1 次');
  assert.equal(u.els.get('sim-total').textContent,'2');
  u.tick(2700);
  assert.equal(u.els.get('sim-total').textContent,'3');
  assert.equal(u.els.get('sim-sample-1').textContent,'2 矿 / 2 次');
  assert.match(u.els.get('sim-feedback').textContent,/1.*矿/);
  u.tick(4000);assert.equal(u.frames.size,0);
  assert.equal(u.els.get('replay-round').value,'6');
  assert.equal(u.els.get('minerals').textContent,human);
  assert.equal(u.els.get('remaining').textContent,'0');
 }finally{u.restore();}
});
test('pausing preserves a flight and background/help do not resume it or accept stale frames',async()=>{
 const u=await simulationFixture();try{
  assert.ok(u.els.has('sim-play'));
  u.click('sim-play');u.tick(0);u.tick(1100);
  const position=u.els.get('sim-probe').style.transform,stale=[...u.frames.values()][0];
  u.click('sim-play');stale(9000);
  assert.equal(u.frames.size,0);assert.equal(u.els.get('sim-probe').style.transform,position);
  assert.equal(u.els.get('sim-total').textContent,'2');
  u.click('sim-play');u.tick(10000);assert.equal(u.els.get('sim-probe').style.transform,position);
  u.hide();u.show();assert.equal(u.frames.size,0);
  u.click('sim-play');u.tick(20000);u.click('about');assert.equal(u.frames.size,0);
  u.els.get('guide').close();assert.equal(u.frames.size,0);
 }finally{u.restore();}
});
test('switching actor or round cancels in-flight replay and reset invalidates old callbacks',async()=>{
 const u=await simulationFixture();try{
  assert.ok(u.els.has('sim-play'));
  u.click('sim-play');u.tick(0);u.tick(1000);const stale=[...u.frames.values()][0];
  u.els.get('replay-actor').value='greedy';u.fire(u.els.get('replay-actor'),'change');stale(8000);
  assert.equal(u.frames.size,0);assert.equal(u.els.get('sim-probe').hidden,true);
  assert.equal(u.els.get('replay-round').value,'6');
  assert.match(u.els.get('sim-choice').textContent,/守成派/);
  u.click('sim-restart');assert.equal(u.els.get('replay-round').value,'1');assert.equal(u.els.get('sim-total').textContent,'0');
  u.click('sim-play');u.tick(0);const old=[...u.frames.values()][0];u.click('new');old(9000);
  assert.equal(u.frames.size,0);assert.equal(u.els.get('decision-replay').hidden,true);
  assert.equal(u.els.get('remaining').textContent,'30');
 }finally{u.restore();}
});
test('continuous playback ends with the same UCB outcome and stops at round thirty',async()=>{
 const u=await simulationFixture();try{
  assert.ok(u.els.has('sim-play'));
  u.click('sim-restart');u.click('sim-play');let time=0;u.tick(time);
  for(let i=0;i<30;i++){time+=4000;u.tick(time);}
  assert.equal(u.els.get('replay-round').value,'30');
  assert.equal(u.els.get('sim-total').textContent,'17');
  assert.equal(u.els.get('score-ucb').textContent,'17 块');
  assert.equal(u.frames.size,0);assert.match(u.els.get('sim-phase').textContent,/完成/);
 }finally{u.restore();}
});
test('reduced-motion demonstration preserves readable phases without moving a probe',async()=>{
 const u=await simulationFixture({reduced:true});try{
  assert.ok(u.els.has('sim-play'));u.click('sim-step');u.tick(0);u.tick(1000);
  assert.equal(u.els.get('sim-probe').hidden,true);assert.equal(u.els.get('sim-total').textContent,'2');
  u.tick(2700);assert.equal(u.els.get('sim-total').textContent,'3');
  u.tick(4000);assert.equal(u.frames.size,0);
 }finally{u.restore();}
});
test('starting playback brings an offscreen stage into view so controls do not hide the flight',async()=>{
 const u=await simulationFixture();try{
  const theater=u.els.get('policy-theater');theater.getBoundingClientRect=()=>({top:-200,bottom:500});
  u.click('sim-play');assert.equal(theater.scrolls,1);
  u.click('sim-play');assert.equal(theater.scrolls,1,'pausing must not move the reading position');
 }finally{u.restore();}
});
test('two-times playback keeps the same decisions and changing rounds or motion preference stops it',async()=>{
 const u=await simulationFixture();try{
  u.els.get('sim-speed').value='2';u.fire(u.els.get('sim-speed'),'change');u.click('sim-step');u.tick(0);u.tick(1400);
  assert.equal(u.els.get('sim-total').textContent,'3');u.tick(2000);assert.equal(u.frames.size,0);
  u.click('sim-play');u.tick(3000);u.tick(3500);const stale=[...u.frames.values()][0];
  u.els.get('replay-round').value='20';u.fire(u.els.get('replay-round'),'input');stale(5000);
  assert.equal(u.frames.size,0);assert.equal(u.els.get('replay-round').value,'20');
  u.click('sim-play');u.tick(6000);u.tick(6500);u.media.matches=true;u.fire(u.media,'change');
  assert.equal(u.frames.size,0);assert.equal(u.els.get('sim-probe').hidden,true);
 }finally{u.restore();}
});
test('expanded decision evidence does not spoil an active or paused flight before its return',async()=>{
 const u=await simulationFixture();try{
  u.click('sim-play');u.tick(0);u.tick(1100);
  assert.doesNotMatch(u.els.get('replay-outcome').textContent,/2 → 3/);
  assert.match(u.els.get('replay-outcome').textContent,/尚未返回/);
  u.click('sim-play');assert.match(u.els.get('replay-outcome').textContent,/尚未返回/);
  u.click('sim-play');u.tick(5000);u.tick(6600);
  assert.match(u.els.get('replay-outcome').textContent,/2 → 3/);
  u.tick(8000);assert.match(u.els.get('replay-outcome').textContent,/尚未返回/,'the next round is masked again');
 }finally{u.restore();}
});
test('pagehide invalidates the simulation callback without changing the human record',async()=>{
 const u=await simulationFixture();try{
  const human=u.els.get('minerals').textContent;u.click('sim-play');u.tick(0);u.tick(1100);
  const stale=[...u.frames.values()][0];u.fire(u.win,'pagehide');stale(9000);
  assert.equal(u.frames.size,0);assert.equal(u.els.get('sim-total').textContent,'2');
  assert.equal(u.els.get('minerals').textContent,human);
 }finally{u.restore();}
});
test('resizing a paused flight follows its new planet position without advancing the round',async()=>{
 const u=await simulationFixture();try{
  u.click('sim-play');u.tick(0);u.tick(1200);u.click('sim-play');
  const before=u.els.get('sim-probe').style.transform;
  u.els.get('sim-planet-1').getBoundingClientRect=()=>({left:200,top:60,width:100,height:100});u.fire(u.win,'resize');
  assert.notEqual(u.els.get('sim-probe').style.transform,before);assert.equal(u.frames.size,0);
  assert.equal(u.els.get('replay-round').value,'6');assert.equal(u.els.get('sim-total').textContent,'2');
 }finally{u.restore();}
});
test('hiding and help cancel without spending a probe; stale callbacks never commit',async()=>{
 const u=await boot();try{u.click('planet-0');const stale=[...u.frames.values()][0];u.hide();u.show();stale(999);assert.equal(u.frames.size,0);assert.equal(u.els.get('remaining').textContent,'30');
  u.click('planet-1');const stale2=[...u.frames.values()][0];u.click('about');stale2(999);assert.equal(u.frames.size,0);u.click('planet-2');assert.equal(u.frames.size,0);
  u.els.get('guide').close();u.click('planet-2');u.finish();assert.equal(u.els.get('remaining').textContent,'29');
 }finally{u.restore();}
});
test('new region and replay invalidate flights, reset scores and identify practice',async()=>{
 const u=await boot();try{u.click('planet-0');const stale=[...u.frames.values()][0];u.click('new');stale(999);assert.equal(u.els.get('remaining').textContent,'30');assert.equal(u.frames.size,0);
  u.click('planet-1');u.finish();const samples=u.els.get('sample-1').textContent;u.click('replay');assert.match(u.els.get('round-mode').textContent,/复盘/);u.click('planet-1');u.finish();assert.equal(u.els.get('sample-1').textContent,samples);
 }finally{u.restore();}
});
test('thirty reduced-motion probes reveal actual results and cap further play',async()=>{
 const u=await boot({reduced:true});try{for(let i=0;i<29;i++)u.click('planet-'+i%5);
  assert.equal(u.frames.size,0);assert.equal(u.els.get('results').hidden,true);u.click('planet-4');
  assert.equal(u.els.get('remaining').textContent,'0');assert.equal(u.els.get('results').hidden,false);
  assert.match(u.els.get('truth-0').textContent,/%/);assert.equal(u.els.get('score-you').textContent,u.els.get('minerals').textContent+' 块');
  assert.match(u.els.get('score-ucb').textContent,/\d+ 块/);u.click('planet-0');assert.equal(u.els.get('remaining').textContent,'0');
  u.click('replay');assert.equal(u.els.get('results').hidden,true);assert.equal(u.els.get('truth-0').textContent,'产量未知');
 }finally{u.restore();}
});
test('keyboard choices ignore repeats, modifiers, hidden page and help',async()=>{
 const u=await boot({reduced:true});try{u.key('1',{repeat:true});u.key('1',{ctrlKey:true});u.hide();u.key('1');u.show();u.click('about');u.key('1');assert.equal(u.els.get('remaining').textContent,'30');
  u.els.get('guide').close();u.key('3');assert.equal(u.els.get('remaining').textContent,'29');assert.match(u.els.get('sample-2').textContent,/1 次/);
 }finally{u.restore();}
});

test('results shortcut appears only after the final arrival and resets for a new attempt',async()=>{
 const u=await boot();try{
  assert.equal(u.els.get('view-results')?.hidden,true);
  for(let i=0;i<29;i++){u.click('planet-'+i%5);u.finish();}
  u.click('planet-0');assert.equal(u.els.get('view-results').hidden,true);
  u.finish();assert.equal(u.els.get('view-results').hidden,false);
  u.click('replay');assert.equal(u.els.get('view-results').hidden,true);
  for(let i=0;i<30;i++){u.click('planet-0');u.finish();}
  u.click('new');assert.equal(u.els.get('view-results').hidden,true);
 }finally{u.restore();}
});

test('decision replay stays hidden until arrival thirty and never spends another probe',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('decision-replay'),'a post-game decision replay must exist');
  assert.equal(u.els.get('decision-replay').hidden,true);
  for(let i=0;i<29;i++){u.click('planet-'+i%5);u.finish();}
  u.click('planet-4');assert.equal(u.els.get('decision-replay').hidden,true);u.finish();
  assert.equal(u.els.get('decision-replay').hidden,false);
  assert.equal(u.els.get('replay-round').value,'6');
  assert.equal(u.els.get('replay-observations').children.length,5);
  const score=u.els.get('minerals').textContent;
  u.click('replay-next');assert.equal(u.els.get('replay-round').value,'7');
  u.click('replay-prev');assert.equal(u.els.get('replay-round').value,'6');
  assert.equal(u.els.get('remaining').textContent,'0');assert.equal(u.els.get('minerals').textContent,score);assert.equal(u.frames.size,0);
 }finally{u.restore();}
});
test('decision replay switches actor at the same round and does not invent human motives',async()=>{
 const u=await boot({reduced:true});try{
  assert.ok(u.els.has('decision-replay'));
  for(let i=0;i<30;i++)u.click('planet-'+i%5);
  const select=u.els.get('replay-actor');select.value='you';u.fire(select,'change');
  assert.equal(u.els.get('replay-round').value,'6');
  assert.match(u.els.get('replay-reason').textContent,/不.*推测|不.*猜/);
  assert.match(u.els.get('replay-choice').textContent,/苔原/);
  assert.deepEqual(u.els.get('replay-observations').children.map(row=>row.children[1].textContent.split(' / ')[1]),['1','1','1','1','1']);
  const slider=u.els.get('replay-round');slider.value='1';u.fire(slider,'input');
  assert.equal(u.els.get('replay-prev').disabled,true);
  assert.deepEqual(u.els.get('replay-observations').children.map(row=>row.children[1].textContent.split(' / ')[1]),['0','0','0','0','0']);
  slider.value='30';u.fire(slider,'input');assert.equal(u.els.get('replay-next').disabled,true);
  select.value='epsilon';u.fire(select,'change');assert.equal(slider.value,'30');
 }finally{u.restore();}
});
test('replaying or changing region clears old decision evidence until a new complete round',async()=>{
 const u=await boot({reduced:true});try{
  assert.ok(u.els.has('decision-replay'));
  for(const reset of ['replay','new']){
   for(let i=0;i<30;i++)u.click('planet-0');
   assert.equal(u.els.get('decision-replay').hidden,false);u.click(reset);
   assert.equal(u.els.get('decision-replay').hidden,true);
   assert.equal(u.els.get('replay-observations').children.length,0);
   u.click('replay-next');assert.equal(u.els.get('remaining').textContent,'30');
  }
 }finally{u.restore();}
});

test('UCB replay renders actual pre-choice scores and exact tied choices',async()=>{
 const u=await boot({reduced:true,seed:42});try{
  for(let i=0;i<30;i++)u.click('planet-'+i%5);
  const rows=u.els.get('replay-observations').children;
  assert.equal(rows[1].children[1].textContent,'1 / 1');assert.equal(rows[1].children[2].textContent,'1.00');
  assert.equal(rows[1].children[3].textContent,'2.79');assert.equal(rows[1].children[3].children[0].textContent,'1.00 + 1.79');
  assert.equal(rows[1].dataset.selected,'true');assert.equal(rows[4].dataset.selected,'false');
  assert.match(u.els.get('replay-reason').textContent,/珊瑚、月白并列最高/);
  assert.match(u.els.get('replay-outcome').textContent,/2 → 3/);
  assert.equal(u.els.get('replay-score-heading').hidden,false);
  u.els.get('replay-round').value='1';u.fire(u.els.get('replay-round'),'input');
  assert.match(u.els.get('replay-reason').textContent,/没有样本/);
  assert.ok(u.els.get('replay-observations').children.every(row=>row.children[3].textContent==='—'));
 }finally{u.restore();}
});
test('epsilon replay labels actual exploration even when it picks the current best',async()=>{
 const u=await boot({reduced:true,seed:42});try{
  for(let i=0;i<30;i++)u.click('planet-'+i%5);
  const actor=u.els.get('replay-actor'),round=u.els.get('replay-round');actor.value='epsilon';u.fire(actor,'change');
  assert.match(u.els.get('replay-reason').textContent,/没有触发随机探索/);
  assert.equal(u.els.get('replay-score-heading').hidden,true);
  assert.ok(u.els.get('replay-observations').children.every(row=>row.children[3].hidden));
  round.value='28';u.fire(round,'input');assert.match(u.els.get('replay-choice').textContent,/琥珀/);
  assert.match(u.els.get('replay-kind').textContent,/随机探索/);assert.match(u.els.get('replay-outcome').textContent,/19 → 20/);
  u.click('replay-next');assert.match(u.els.get('replay-choice').textContent,/珊瑚/);
  assert.match(u.els.get('replay-kind').textContent,/随机探索/);assert.match(u.els.get('replay-outcome').textContent,/20 → 21/);
 }finally{u.restore();}
});
