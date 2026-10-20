import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

let serial=0;
// Run the real controller and search model. Only DOM and the clock are represented.
async function boot(){
 const html=await readFile(new URL('../pathfinding.html',import.meta.url),'utf8');
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attributes=new Map();this.children=[];this.className='';this.textContent='';this.disabled=false;this.value='40';this.captures=new Set();
   this.classList={remove:name=>{this.className=this.className.split(' ').filter(v=>v!==name).join(' ');},toggle:(name,on)=>{this.classList.remove(name);if(on)this.className+=' '+name;}};
  }
  append(...children){for(const child of children){this.children.push(child);child.parent=this;}}
  replaceChildren(...children){this.children=[];this.append(...children);}
  setAttribute(k,v){this.attributes.set(k,v);}getAttribute(k){return this.attributes.get(k);}
  closest(selector){return selector==='.cell'&&this.className.split(' ').includes('cell')?this:null;}
  contains(child){return this.children.includes(child);}
  getBoundingClientRect(){return {left:0,top:0,right:300,bottom:220,width:300,height:220};}
  focus(){doc.activeElement=this;}scrollIntoView(){}
  setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);}
  showModal(){this.open=true;}
 }
 const els=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const presets=['empty','detour','maze'].map(map=>Object.assign(new Element(),{dataset:{map}}));
 const tools=['wall','erase','start','goal'].map(tool=>Object.assign(new Element(),{dataset:{tool}}));
 let hitGrid=els.get('bfs-grid');
 const doc=Object.assign(new EventTarget(),{hidden:false,documentElement:new Element(),getElementById:id=>els.get(id),createElement:()=>new Element(),
  querySelectorAll:s=>s==='[data-map]'?presets:s==='[data-tool]'?tools:[],elementFromPoint:(x,y)=>hitGrid.children[Math.floor(y/20)*15+Math.floor(x/20)]});
 const timers=new Map();let nextTimer=0;
 const globals={document:doc,window:new EventTarget(),matchMedia:()=>Object.assign(new EventTarget(),{matches:false}),setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const restore=()=>{for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];};Object.assign(globalThis,globals);
 try{await import(new URL('../pathfinding.mjs?history='+ ++serial,import.meta.url));}catch(e){restore();throw e;}
 const fire=(el,type,props={})=>{const event=new Event(type,{cancelable:true});for(const[k,v]of Object.entries(props))Object.defineProperty(event,k,{value:v});el.dispatchEvent(event);return event;};
 return {els,doc,timers,restore,fire,
  click(id){assert.ok(els.has(id),`the ${id} action must be available`);fire(els.get(id),'click');},
  preset(name){fire(presets.find(b=>b.dataset.map===name),'click');},
  tool(name){fire(tools.find(b=>b.dataset.tool===name),'click');},
  edit(index,name='bfs'){const grid=els.get(name+'-grid');fire(grid,'click',{detail:0,target:grid.children[index]});},
  pointer(type,index,{id=1,name='bfs'}={}){hitGrid=els.get(name+'-grid');fire(hitGrid,type,{pointerId:id,button:0,isPrimary:true,clientX:index%15*20+10,clientY:Math.floor(index/15)*20+10});},
  map(name='bfs'){return els.get(name+'-grid').children.map(b=>b.getAttribute('aria-label').split('，').at(-1));},
  key(key,props={}){return fire(doc,'keydown',{key,target:els.get('bfs-grid').children[0],...props});},
  selected(){return presets.find(b=>b.getAttribute('aria-pressed')==='true')?.dataset.map;}};
}

test('a complete wall stroke undoes and redoes as one edit on both maps',async()=>{
 const u=await boot();try{
  const before=u.map();u.pointer('pointerdown',0);u.pointer('pointermove',4);u.pointer('pointerup',6);
  assert.deepEqual(u.map().slice(0,7),Array(7).fill('墙'));
  u.click('undo-map');assert.deepEqual(u.map(),before);assert.deepEqual(u.map('astar'),before);assert.equal(u.selected(),'detour');
  assert.equal(u.els.get('undo-map').disabled,true);u.click('redo-map');
  assert.deepEqual(u.map().slice(0,7),Array(7).fill('墙'));assert.deepEqual(u.map('astar'),u.map());
 }finally{u.restore();}
});

test('clearing walls and replacing a preset can restore custom endpoints and walls',async()=>{
 const u=await boot();try{
  u.edit(0);u.tool('start');u.edit(1);u.tool('goal');u.edit(10);const custom=u.map();
  u.click('clear-walls');assert.equal(u.els.get('wall-count').textContent,'0 格墙');
  u.click('undo-map');assert.deepEqual(u.map(),custom);
  u.preset('maze');u.click('undo-map');assert.deepEqual(u.map(),custom);assert.equal(u.selected(),undefined);
  u.click('redo-map');assert.equal(u.selected(),'maze');assert.equal(u.map()[76],'起点');
 }finally{u.restore();}
});

test('cancelled or escaped gestures restore the pre-stroke map without consuming redo',async()=>{
 const u=await boot();try{
  const initial=u.map();u.edit(0);u.click('undo-map');
  u.pointer('pointerdown',1);u.pointer('pointermove',5);u.pointer('pointercancel',5);
  assert.deepEqual(u.map(),initial);assert.equal(u.els.get('undo-map').disabled,true);assert.equal(u.els.get('redo-map').disabled,false);
  u.pointer('pointerdown',2);u.key('Escape');assert.deepEqual(u.map(),initial);
  u.click('redo-map');assert.equal(u.map()[0],'墙');
 }finally{u.restore();}
});

test('no-op edits preserve redo while a new effective edit discards the old future',async()=>{
 const u=await boot();try{
  u.edit(0);u.click('undo-map');u.edit(76);u.preset('detour');
  assert.equal(u.els.get('redo-map').disabled,false);u.edit(1);
  assert.equal(u.els.get('redo-map').disabled,true);u.click('redo-map');assert.equal(u.map()[0],'空地');assert.equal(u.map()[1],'墙');
 }finally{u.restore();}
});

test('a preset matching custom geometry preserves the redo branch and history count',async()=>{
 const u=await boot();try{
  u.edit(0);u.tool('erase');u.edit(0);u.tool('wall');u.edit(1);u.click('undo-map');
  const before=u.map(),history=u.els.get('history-status').textContent;
  assert.equal(u.selected(),undefined);assert.equal(u.els.get('redo-map').disabled,false);
  u.preset('detour');assert.deepEqual(u.map(),before);
  assert.equal(u.els.get('history-status').textContent,history);assert.equal(u.els.get('redo-map').disabled,false);
  u.click('redo-map');assert.equal(u.map()[1],'墙');
 }finally{u.restore();}
});

test('undo during playback stops the clock and discards obsolete search results',async()=>{
 const u=await boot();try{
  u.edit(0);u.click('finish');assert.notEqual(u.els.get('bfs-distance').textContent,'待揭晓');u.click('play');assert.equal(u.timers.size,1);
  u.click('undo-map');assert.equal(u.timers.size,0);assert.equal(u.els.get('bfs-distance').textContent,'待揭晓');assert.equal(u.els.get('bfs-explored').textContent,0);
  assert.equal(u.els.get('astar-explored').textContent,0);u.click('finish');assert.equal(u.els.get('bfs-distance').textContent,u.els.get('astar-distance').textContent);
 }finally{u.restore();}
});

test('keyboard history respects form fields, modifiers, repeats, and help',async()=>{
 const u=await boot();try{
  u.edit(0);u.key('z',{ctrlKey:true,target:{tagName:'SELECT'}});u.key('z',{metaKey:true,target:{isContentEditable:true}});u.key('z',{ctrlKey:true,repeat:true});
  assert.equal(u.map()[0],'墙');u.click('about');u.key('z',{ctrlKey:true});assert.equal(u.map()[0],'墙');u.els.get('guide').open=false;
  const event=u.key('z',{metaKey:true});assert.equal(event.defaultPrevented,true);assert.equal(u.map()[0],'空地');
  u.key('Z',{metaKey:true,shiftKey:true});assert.equal(u.map()[0],'墙');u.key('z',{ctrlKey:true});u.key('y',{ctrlKey:true});assert.equal(u.map()[0],'墙');
 }finally{u.restore();}
});

test('history keeps the latest thirty edits and does not count a same-map preset',async()=>{
 const u=await boot();try{
  for(let i=0;i<35;i++)u.edit(i);
  for(let i=0;i<30;i++)u.click('undo-map');
  assert.deepEqual(u.map().slice(0,5),Array(5).fill('墙'));assert.equal(u.map()[5],'空地');assert.equal(u.els.get('undo-map').disabled,true);
 }finally{u.restore();}
});

test('a second pointer cancellation does not cancel the active drawing gesture',async()=>{
 const u=await boot();try{
  u.pointer('pointerdown',0);u.pointer('pointermove',2);u.pointer('pointercancel',2,{id:2});u.pointer('pointerup',4);
  assert.deepEqual(u.map().slice(0,5),Array(5).fill('墙'));u.click('undo-map');assert.equal(u.map()[0],'空地');
 }finally{u.restore();}
});

test('moving an endpoint away and back is a no-op and preserves the preset and redo',async()=>{
 const u=await boot();try{
  u.edit(0);u.click('undo-map');u.tool('start');
  u.pointer('pointerdown',75);u.pointer('pointermove',76);u.pointer('pointerup',76);
  assert.equal(u.selected(),'detour');assert.equal(u.els.get('undo-map').disabled,true);assert.equal(u.els.get('redo-map').disabled,false);
  u.click('redo-map');assert.equal(u.map()[0],'墙');assert.equal(u.map()[76],'起点');
 }finally{u.restore();}
});

test('a completed baseline survives editing, pending results, reruns and undo',async()=>{
 const u=await boot();try{
  u.click('finish');assert.ok(u.els.has('compare-before-distance'),'a completed baseline is visible');
  assert.equal(u.els.get('compare-before-distance').textContent,'20');
  u.tool('erase');u.edit(82);
  assert.equal(u.els.get('compare-before-distance').textContent,'20');
  assert.equal(u.els.get('compare-after-distance').textContent,'待运行');
  assert.equal(u.els.get('compare-rebase').disabled,true);
  u.click('finish');assert.equal(u.els.get('compare-after-distance').textContent,'12');
  assert.equal(u.els.get('compare-distance-delta').textContent,'少 8 步');
  assert.equal(u.els.get('compare-after-astar').textContent,'13');
  assert.match(u.els.get('compare-explanation').textContent,/直达/);
  u.click('finish');assert.equal(u.els.get('compare-before-distance').textContent,'20');
  u.click('undo-map');u.click('finish');
  assert.equal(u.els.get('compare-distance-delta').textContent,'不变');
 }finally{u.restore();}
});

test('only an explicitly requested completed round replaces the baseline',async()=>{
 const u=await boot();try{
  u.click('finish');u.tool('erase');u.edit(82);u.click('finish');
  u.click('compare-rebase');assert.equal(u.els.get('compare-before-distance').textContent,'12');
  assert.equal(u.els.get('compare-rebase').disabled,true);
  u.tool('wall');u.edit(82);u.click('finish');
  assert.equal(u.els.get('compare-before-distance').textContent,'12');
  assert.equal(u.els.get('compare-after-distance').textContent,'20');
  assert.equal(u.els.get('compare-distance-delta').textContent,'多 8 步');
 }finally{u.restore();}
});

test('partial playback is not recorded as a baseline and cancelled edits keep comparison evidence',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('compare-empty'),'first-run guidance is available');
  u.click('step');assert.equal(u.els.get('compare-empty').hidden,false);
  u.tool('erase');u.edit(82);u.click('finish');
  assert.equal(u.els.get('compare-before-distance').textContent,'12');
  u.tool('wall');u.pointer('pointerdown',82);u.pointer('pointercancel',82);u.click('finish');
  assert.equal(u.els.get('compare-distance-delta').textContent,'不变');
  assert.equal(u.els.get('compare-before-distance').textContent,'12');
 }finally{u.restore();}
});

test('comparison maps mark the edited cell and can display either real search trace',async()=>{
 const u=await boot();try{
  u.click('finish');u.tool('erase');u.edit(82);u.click('finish');
  const before=u.els.get('compare-before-map'),after=u.els.get('compare-after-map');
  assert.ok(before,'before map exists');assert.ok(after,'after map exists');
  assert.match(before.children[82].className,/changed/);assert.match(before.children[82].className,/wall/);
  assert.match(after.children[82].className,/changed/);assert.match(after.children[82].className,/path/);
  u.click('compare-bfs');assert.match(after.getAttribute('aria-label'),/BFS/);
  assert.equal(u.els.get('compare-bfs').getAttribute('aria-pressed'),'true');
  u.click('compare-astar');assert.match(after.getAttribute('aria-label'),/A\*/);
 }finally{u.restore();}
});

test('pending comparison can run in place without replacing its original baseline',async()=>{
 const u=await boot();try{
  u.click('finish');u.tool('erase');u.edit(82);
  u.click('compare-run');
  assert.equal(u.els.get('compare-after-distance').textContent,'12');
  assert.equal(u.els.get('compare-before-distance').textContent,'20');
  assert.equal(u.els.get('compare-run').hidden,true);
  u.tool('wall');u.edit(82);assert.equal(u.els.get('compare-run').hidden,false);
 }finally{u.restore();}
});

test('replaying a completed comparison hides future results until the round finishes again',async()=>{
 const u=await boot();try{
  u.click('finish');u.tool('erase');u.edit(82);u.click('finish');u.click('step');
  assert.equal(u.els.get('compare-before-distance').textContent,'20');
  assert.equal(u.els.get('compare-after-distance').textContent,'待运行');
  assert.equal(u.els.get('compare-rebase').disabled,true);
  assert.equal(u.els.get('compare-after-map').children.some(c=>c.className.split(' ').includes('path')),false);
  u.click('finish');assert.equal(u.els.get('compare-after-distance').textContent,'12');
 }finally{u.restore();}
});

test('multi-cell changes have a complete readable coordinate list, not only visual markers',async()=>{
 const u=await boot();try{
  u.click('finish');u.preset('maze');
  assert.ok(u.els.has('compare-all-changes'),'full textual change list is available');
  assert.equal(u.els.get('compare-change-details').hidden,false);
  assert.match(u.els.get('compare-all-changes').textContent,/第 1 行、第 5 列/);
  assert.match(u.els.get('compare-all-changes').textContent,/第 11 行、第 8 列/);
 }finally{u.restore();}
});

test('switching comparison view also switches the explanation to the visible old path',async()=>{
 const u=await boot();try{
  u.click('clear-walls');for(const i of [66,78,82,93])u.edit(i);u.click('finish');
  u.edit(62);u.click('finish');
  assert.match(u.els.get('compare-explanation').textContent,/同样短的其他/);
  u.click('compare-bfs');assert.match(u.els.get('compare-explanation').textContent,/没有挡住/);
 }finally{u.restore();}
});
