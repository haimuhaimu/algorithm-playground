import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let serial=0;
async function boot({reduced=false}={}){
 const html=await readFile(new URL('../mining.html',import.meta.url),'utf8').catch(()=>'');
 assert.ok(html.includes('id="planet-0"'),'playable mining page must exist');
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.style={setProperty(){}};this.attributes=new Map();this.hidden=false;this.disabled=false;this.open=false;this.textContent='';this.children=[];}
  setAttribute(k,v){this.attributes.set(k,v);}getAttribute(k){return this.attributes.get(k);}
  getBoundingClientRect(){return {left:0,top:0,width:900,height:400};}
  replaceChildren(...children){this.children=children;}append(...children){this.children.push(...children);}focus(){}
  showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent(new Event('close'));}
 }
 const els=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const doc=Object.assign(new EventTarget(),{hidden:false,documentElement:new Element(),getElementById:id=>els.get(id),createElement:()=>new Element()});
 const frames=new Map();let seq=0;
 const media=Object.assign(new EventTarget(),{matches:reduced});
 const globals={document:doc,window:new EventTarget(),matchMedia:()=>media,requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;},cancelAnimationFrame:id=>frames.delete(id)};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const restore=()=>{for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];};Object.assign(globalThis,globals);
 try{await import(new URL('../mining.mjs?t='+ ++serial,import.meta.url));}catch(e){restore();throw e;}
 const fire=(el,type,props={})=>el.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),props));
 return {els,frames,doc,restore,fire,click:id=>fire(els.get(id),'click'),
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
