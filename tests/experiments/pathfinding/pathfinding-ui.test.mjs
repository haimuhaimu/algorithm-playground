import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {search,makeMap,decisionAt} from '../../../dist/pathfinding-core.mjs';

let serial=0;
// Run the real controller and search model. Only DOM and the clock are represented.
async function boot(){
 const html=await readFile(new URL('../../../dist/pathfinding.html',import.meta.url),'utf8');
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attributes=new Map();this.children=[];this.className='';this.textContent='';this.disabled=false;this.value='40';this.captures=new Set();
   this.classList={remove:name=>{this.className=this.className.split(' ').filter(v=>v!==name).join(' ');},toggle:(name,on)=>{this.classList.remove(name);if(on)this.className+=' '+name;}};
  }
  append(...children){for(const child of children){if(child.parent)child.parent.children=child.parent.children.filter(c=>c!==child);this.children.push(child);child.parent=this;}}
  replaceChildren(...children){this.children=[];this.append(...children);}
  set className(value){this.writes=(this.writes??0)+1;this._className=value;}get className(){return this._className;}
  set textContent(value){this.writes=(this.writes??0)+1;this._textContent=value;}get textContent(){return this._textContent;}
  setAttribute(k,v){this.writes=(this.writes??0)+1;this.attributes.set(k,v);}getAttribute(k){return this.attributes.get(k);}
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
  createElementNS:()=>new Element(),querySelectorAll:s=>s==='[data-map]'?presets:s==='[data-tool]'?tools:[],elementFromPoint:(x,y)=>hitGrid.children[Math.floor(y/20)*15+Math.floor(x/20)]});
 const timers=new Map();let nextTimer=0;
 const globals={document:doc,window:new EventTarget(),matchMedia:()=>Object.assign(new EventTarget(),{matches:false}),setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const restore=()=>{for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];};Object.assign(globalThis,globals);
 try{await import(new URL('../../../dist/pathfinding.mjs?history='+ ++serial,import.meta.url));}catch(e){restore();throw e;}
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

function gridSnapshot(u,names=['bfs','astar']){
 return names.flatMap(name=>u.els.get(name+'-grid').children.map(cell=>[
  cell.className,cell.textContent,cell.getAttribute('aria-label'),cell.getAttribute('aria-pressed')
 ]));
}
function gridWrites(u,names=['bfs','astar']){
 return names.flatMap(name=>u.els.get(name+'-grid').children).reduce((sum,cell)=>sum+cell.writes,0);
}

test('playback writes only grid properties that actually change on each search step',async()=>{
 const u=await boot();try{
  u.click('play');
  for(let step=1;step<=5;step++){
   const before=gridSnapshot(u),writes=gridWrites(u);
   const [id,tick]=u.timers.entries().next().value;u.timers.delete(id);tick();
   const after=gridSnapshot(u),changes=after.reduce((sum,cell,i)=>sum+cell.filter((value,j)=>value!==before[i][j]).length,0);
   assert.equal(u.els.get('bfs-explored').textContent,step);
   assert.equal(u.els.get('astar-explored').textContent,step);
   assert.ok(changes>0,'the visible search must advance');
   assert.equal(gridWrites(u)-writes,changes,'unchanged cells must not receive redundant writes');
  }
 }finally{u.restore();}
});

test('a completed A-star board receives no writes while BFS keeps exploring',async()=>{
 const u=await boot();try{
  for(let i=0;i<60;i++)u.click('step');
  assert.equal(u.els.get('astar-distance').textContent,20);
  const before=gridSnapshot(u,['astar']),writes=gridWrites(u,['astar']);
  u.click('step');
  assert.equal(u.els.get('bfs-explored').textContent,61);
  assert.deepEqual(gridSnapshot(u,['astar']),before);
  assert.equal(gridWrites(u,['astar']),writes);
 }finally{u.restore();}
});

test('leaving a revealed guess restores every normal grid property at the same step',async()=>{
 let expected;const normal=await boot();try{
  normal.click('step');normal.click('step');expected=gridSnapshot(normal);
 }finally{normal.restore();}
 const u=await boot();try{
  u.click('guess-toggle');
  const decision=decisionAt(search(makeMap(),'astar'),1);
  u.edit(decision.candidates.find(c=>c.index!==decision.current).index,'astar');
  u.click('guess-reveal');u.click('guess-toggle');
  assert.deepEqual(gridSnapshot(u),expected,'candidate numbers, classes, labels and selection must all be cleared');
 }finally{u.restore();}
});

test('first-run guidance waits for a complete real baseline before inviting a map edit',async()=>{
 const u=await boot();try{
  assert.match(u.els.get('play-status').textContent,/先.*跑.*对照/);
  assert.match(u.els.get('challenge-status').textContent,/先.*跑.*对照/);
  u.click('step');
  assert.equal(u.els.get('compare-empty').hidden,false,'one search step is not saved evidence');
  assert.match(u.els.get('play-status').textContent,/暂停/);
  assert.match(u.els.get('challenge-status').textContent,/跑完.*对照/);
  u.click('finish');
  assert.equal(u.els.get('compare-before-distance').textContent,'20');
  assert.match(u.els.get('play-status').textContent,/改一格/);
  assert.match(u.els.get('path-intro-copy').textContent,/已.*保留.*改一格/);
 }finally{u.restore();}
});

test('guidance follows baseline geometry through an edit, real comparison and undo',async()=>{
 const u=await boot();try{
  u.click('finish');u.tool('erase');u.edit(82);
  assert.match(u.els.get('play-status').textContent,/原对照.*再跑/);
  assert.match(u.els.get('challenge-status').textContent,/跑.*这张图/);
  assert.equal(u.els.get('compare-before-distance').textContent,'20');
  assert.equal(u.els.get('compare-after-distance').textContent,'待运行');
  u.click('finish');
  assert.equal(u.els.get('compare-after-distance').textContent,'12');
  assert.match(u.els.get('path-intro-copy').textContent,/前后.*对照/);
  u.click('undo-map');
  assert.match(u.els.get('play-status').textContent,/与对照相同/);
  assert.match(u.els.get('path-intro-copy').textContent,/改一格/);
  u.preset('empty');
  assert.match(u.els.get('play-status').textContent,/原对照.*再跑/,'a different preset is also a changed map');
 }finally{u.restore();}
});

test('editing first acknowledges missing evidence and undo can recover the unplayed map',async()=>{
 const u=await boot();try{
  u.tool('erase');u.edit(82);
  assert.equal(u.els.get('compare-empty').hidden,false);
  assert.match(u.els.get('play-status').textContent,/还没有.*对照/);
  assert.match(u.els.get('path-intro-copy').textContent,/撤销.*再跑/);
  assert.equal(u.els.get('undo-map').disabled,false);
  u.click('undo-map');u.click('finish');
  assert.equal(u.els.get('compare-before-distance').textContent,'20');
  u.tool('erase');u.edit(82);u.click('finish');
  assert.equal(u.els.get('compare-after-distance').textContent,'12');
  assert.equal(u.els.get('compare-distance-delta').textContent,'少 8 步');
 }finally{u.restore();}
});

test('running an edited-first map only saves that actual run and rebasing returns to the edit invitation',async()=>{
 const u=await boot();try{
  u.tool('erase');u.edit(82);u.click('finish');
  assert.equal(u.els.get('compare-before-distance').textContent,'12','no unplayed original run is fabricated');
  assert.match(u.els.get('play-status').textContent,/改一格/);
  assert.match(u.els.get('path-intro-copy').textContent,/已.*保留.*改一格/);
  u.tool('wall');u.edit(82);u.click('finish');u.click('compare-rebase');
  assert.equal(u.els.get('compare-before-distance').textContent,'20');
  assert.match(u.els.get('play-status').textContent,/改一格/);
 }finally{u.restore();}
});

test('the cat case keeps only one edit and never rewrites the original arena or its undo history',async()=>{
 const u=await boot();try{
  u.edit(0);u.click('finish');
  const arena=u.map(),beforeStatus=u.els.get('bfs-distance').textContent;
  assert.ok(u.els.has('cat-route-lab'),'the standalone experiment is on the actual pathfinding page');
  const {mountCatRoutes}=await import('../../../dist/pathfinding-cats-ui.mjs');mountCatRoutes(u.doc);
  const get=id=>u.els.get(id),grid=get('cat-route-after'),cell=index=>grid.children[index];
  assert.equal(cell(0).tabIndex,0,'the keyboard entry does not identify a winning edit');
  assert.ok([...grid.children].every(el=>!el.className.includes('suggested')),'free play must not disclose the optional challenge answer in advance');
  assert.equal(cell(28).getAttribute('aria-disabled'),'true','Bobby’s start is protected');
  u.fire(cell(31),'click');
  assert.match(get('cat-route-winner').textContent,/波比.*7/);
  assert.equal(cell(31).getAttribute('aria-pressed'),'true');
  u.fire(cell(31),'keydown',{key:'ArrowUp'});assert.equal(u.doc.activeElement,cell(22));
  u.click('cat-route-heim');assert.equal(get('cat-route-heim').getAttribute('aria-pressed'),'true');
  assert.match(get('cat-route-winner').textContent,/波比.*7/,'changing the visible route is not an edit');
  u.fire(cell(13),'click');assert.equal(cell(31).getAttribute('aria-pressed'),'false');
  assert.match(get('cat-route-winner').textContent,/臭臭.*9/);
  u.fire(cell(28),'click');assert.match(get('cat-route-winner').textContent,/臭臭.*9/);
  u.click('cat-route-reset');assert.match(get('cat-route-winner').textContent,/嘿姆.*臭臭.*9/);
  assert.equal(u.doc.activeElement,cell(0));
  assert.deepEqual(u.map(),arena);assert.equal(get('bfs-distance').textContent,beforeStatus);
  u.click('undo-map');assert.equal(u.map()[0],'空地');
 }finally{u.restore();}
});

test('the status above the cat map reports actual route effects, even for an unselected cat',async()=>{
 const u=await boot();try{
  const {mountCatRoutes}=await import('../../../dist/pathfinding-cats-ui.mjs');mountCatRoutes(u.doc);
  const grid=u.els.get('cat-route-after'),notice=u.els.get('cat-route-edit');
  const position=u.els.get('cat-route-edit-position');
  const edit=index=>u.fire(grid.children[index],'click');
  assert.match(notice.textContent,/点.*一格/);
  edit(31);
  assert.match(notice.textContent,/拆墙.*波比.*11.*7.*少走 4 步/);
  assert.match(position.textContent,/第 4 行第 5 列/);
  edit(11);
  assert.match(notice.textContent,/加墙.*嘿姆.*9.*11.*多走 2 步/);
  assert.equal(u.els.get('cat-route-bobby').getAttribute('aria-pressed'),'true');
  assert.doesNotMatch(notice.textContent,/少走 4 步/);
  edit(44);
  assert.match(notice.textContent,/波比.*仍走 11 步.*臭臭.*仍走 9 步/);
  edit(0);
  assert.match(notice.textContent,/路线和步数都没变/);
  edit(0);
  assert.match(notice.textContent,/已恢复原图/);
  assert.equal(position.textContent,'');
  edit(31);u.click('cat-route-reset');
  assert.match(notice.textContent,/已恢复原图/);
  assert.doesNotMatch(notice.textContent,/少走 4 步/);
 }finally{u.restore();}
});

test('a short-screen cat edit reveals the clipped receipt without losing the edited square',async()=>{
 const u=await boot();try{
  const {mountCatRoutes}=await import('../../../dist/pathfinding-cats-ui.mjs');mountCatRoutes(u.doc);
  const receipt=u.els.get('cat-route-edit');
  let scroll=0;
  const notice=u.els.get('cat-route-notice');
  notice.getBoundingClientRect=()=>({top:-28-scroll,bottom:14-scroll});
  u.doc.defaultView={innerHeight:375,scrollBy:({top})=>{scroll+=top;}};
  const cell=u.els.get('cat-route-after').children[31];
  cell.getBoundingClientRect=()=>({top:169-scroll,bottom:207-scroll});
  cell.focus();u.fire(cell,'click');
  assert.match(receipt.textContent,/波比.*11.*7/);
  assert.ok(notice.getBoundingClientRect().top>=0,'the complete receipt must be visible');
  assert.ok(cell.getBoundingClientRect().bottom<=375,'keep the edited square on screen');
  assert.equal(u.doc.activeElement,cell);
  const settled=scroll;u.fire(cell,'click');
  assert.equal(scroll,settled,'do not scroll again when both are already visible');
 }finally{u.restore();}
});

test('cat challenge stages the spatial prediction without leaking paths, distances or the suggested answer',async()=>{
 const u=await boot();try{
  const {mountCatRoutes}=await import('../../../dist/pathfinding-cats-ui.mjs');mountCatRoutes(u.doc);
  const get=id=>u.els.get(id),cell=index=>get('cat-route-after').children[index];
  u.click('cat-route-challenge');
  assert.equal(get('cat-route-run').disabled,true);
  assert.equal(cell(0).tabIndex,0,'challenge entry must not focus the winning wall');
  assert.ok([...get('cat-route-after').children].every(el=>!el.className.includes('suggested')));
  u.fire(cell(28),'click');assert.equal(get('cat-route-run').disabled,true);
  u.fire(cell(31),'click');
  assert.equal(get('cat-route-run').disabled,false);
  assert.equal(cell(31).getAttribute('aria-pressed'),'true');
  assert.doesNotMatch(cell(31).className,/wall/,'the proposed wall removal is visible');
  assert.equal(get('cat-route-after-track').children[0].children.length,0);
  assert.ok([...get('cat-route-after').children].every(el=>!el.getAttribute('aria-label').includes('路线经过')));
  for(const row of get('cat-route-results').children)assert.equal(row.children[2].textContent,'待检验');
  assert.doesNotMatch(get('cat-route-edit').textContent,/7 步|少走 4|近路/);
  u.click('cat-route-heim');
  assert.equal(get('cat-route-after-track').children[0].children.length,0,'observing another cat must not reveal the trial');
  u.click('cat-route-run');
  assert.equal(get('cat-route-run').disabled,true,'testing the same edit again is not another trial');
  assert.equal(get('cat-route-after-track').children[0].children.length,1);
  assert.match(get('cat-route-trial-status').textContent,/做到了.*波比.*11.*7/);
  assert.deepEqual(get('cat-route-results').children.map(row=>row.children[2].textContent),['9 步','7 步','9 步']);
 }finally{u.restore();}
});

test('cat challenge distinguishes a tie, a shorter unique route and an irrelevant edit using actual routes',async()=>{
 const u=await boot();try{
  const {mountCatRoutes}=await import('../../../dist/pathfinding-cats-ui.mjs');mountCatRoutes(u.doc);
  const get=id=>u.els.get(id),cell=index=>get('cat-route-after').children[index];
  u.click('cat-route-challenge');
  u.fire(cell(22),'click');u.click('cat-route-run');
  assert.match(get('cat-route-trial-status').textContent,/并列.*9/);
  assert.doesNotMatch(get('cat-route-trial-status').textContent,/做到了/);
  u.fire(cell(31),'click');
  assert.match(cell(22).className,/wall/,'each trial starts from the same original map');
  assert.doesNotMatch(get('cat-route-trial-status').textContent,/并列|做到了/,'old verdict is not the new edit’s result');
  assert.equal(get('cat-route-after-track').children[0].children.length,0);
  u.click('cat-route-run');assert.match(get('cat-route-trial-status').textContent,/做到了/);
  u.fire(cell(4),'click');u.click('cat-route-run');
  assert.match(get('cat-route-trial-status').textContent,/仍.*11.*没.*缩短/);
  u.fire(cell(4),'click');assert.equal(get('cat-route-run').disabled,true,'deselect returns to an unchosen trial');
  u.fire(cell(22),'click');u.click('cat-route-reset');
  assert.equal(get('cat-route-run').disabled,true);assert.equal(u.doc.activeElement,cell(0));
 }finally{u.restore();}
});

test('leaving the optional cat challenge restores free-play edit and keeps the main arena history intact',async()=>{
 const u=await boot();try{
  u.edit(0);u.click('finish');const arena=u.map();
  const {mountCatRoutes}=await import('../../../dist/pathfinding-cats-ui.mjs');mountCatRoutes(u.doc);
  const get=id=>u.els.get(id),cell=index=>get('cat-route-after').children[index];
  u.fire(cell(13),'click');u.click('cat-route-challenge');
  u.fire(cell(31),'click');u.click('cat-route-run');u.click('cat-route-challenge');
  assert.equal(cell(13).getAttribute('aria-pressed'),'true');
  assert.equal(cell(31).getAttribute('aria-pressed'),'false');
  assert.deepEqual(get('cat-route-results').children.map(row=>row.children[2].textContent),['13 步','11 步','9 步']);
  assert.equal(get('cat-route-trial').hidden,true);
  assert.deepEqual(u.map(),arena);u.click('undo-map');assert.equal(u.map()[0],'空地');
  u.click('cat-route-challenge');assert.equal(get('cat-route-run').disabled,true,'a fresh challenge has no stale submitted result');
  u.fire(cell(0),'keydown',{key:'ArrowRight'});assert.equal(u.doc.activeElement,cell(1));
 }finally{u.restore();}
});

test('no-change feedback identifies Bobby’s route when another cat is being observed',async()=>{
 const u=await boot();try{
  const {mountCatRoutes}=await import('../../../dist/pathfinding-cats-ui.mjs');mountCatRoutes(u.doc);
  u.click('cat-route-challenge');u.click('cat-route-heim');
  u.fire(u.els.get('cat-route-after').children[4],'click');u.click('cat-route-run');
  assert.match(u.els.get('cat-route-trial-status').textContent,/切到波比/,'do not suggest the currently displayed Heim path is Bobby’s explanation');
  assert.match(u.els.get('cat-route-reason').textContent,/嘿姆/);
 }finally{u.restore();}
});

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

for(const interruption of ['pointercancel','lostpointercapture','Escape','blur','hidden','pagehide'])test(`cancelled map edits retain the completed current result immediately after ${interruption}`,async()=>{
 const u=await boot();try{
  u.click('finish');u.tool('erase');u.edit(82);u.click('finish');u.tool('wall');
  const before=u.map(),metrics=Object.fromEntries(['bfs-explored','astar-explored','compare-after-bfs','compare-after-astar','compare-bfs-delta','compare-astar-delta'].map(id=>[id,u.els.get(id).textContent]));
  assert.equal(u.els.get('compare-before-distance').textContent,'20');
  assert.equal(u.els.get('compare-after-distance').textContent,'12');
  const history=u.els.get('history-status').textContent;
  u.pointer('pointerdown',0);assert.equal(u.map()[0],'墙');
  if(interruption==='Escape')u.key('Escape');
  else if(interruption==='hidden'){u.doc.hidden=true;u.fire(u.doc,'visibilitychange');}
  else if(['blur','pagehide'].includes(interruption))u.fire(window,interruption);
  else u.pointer(interruption,0);
  assert.equal(Number(u.els.get('bfs-distance').textContent),12,'cancelling does not require another search');
  assert.equal(Number(u.els.get('astar-distance').textContent),12);
  assert.equal(u.els.get('compare-after-distance').textContent,'12');
  assert.equal(u.els.get('compare-distance-delta').textContent,'少 8 步');
  assert.deepEqual(u.map(),before,'both the geometry and its displayed search trace survive');
  for(const [id,value]of Object.entries(metrics))assert.equal(u.els.get(id).textContent,value,id);
  assert.equal(u.els.get('history-status').textContent,history,'cancel does not become an undo entry');
  assert.equal(u.timers.size,0);
 }finally{u.restore();}
});

test('cancelling a gesture restores the paused search playhead without making a partial run complete',async()=>{
 const u=await boot();try{
  u.click('finish');u.tool('erase');u.edit(82);u.click('step');u.click('step');u.click('step');
  const before=u.map();assert.equal(u.els.get('bfs-explored').textContent,3);
  u.tool('wall');u.pointer('pointerdown',0);u.key('Escape');
  assert.deepEqual(u.map(),before);
  assert.equal(u.els.get('bfs-explored').textContent,3);
  assert.equal(u.els.get('bfs-distance').textContent,'待揭晓');
  assert.equal(u.els.get('compare-after-distance').textContent,'待运行');
  assert.equal(u.els.get('compare-before-distance').textContent,'20');
  u.click('step');assert.equal(u.els.get('bfs-explored').textContent,4,'the next step continues, rather than restarting');
 }finally{u.restore();}
});

test('cancelling a gesture during playback preserves its playhead but never restarts the timer',async()=>{
 const u=await boot();try{
  u.click('play');const tick=[...u.timers.values()][0];u.timers.clear();tick();
  assert.equal(u.els.get('bfs-explored').textContent,1);
  const before=u.map();u.pointer('pointerdown',0);u.pointer('pointercancel',0);
  assert.deepEqual(u.map(),before);assert.equal(u.els.get('bfs-explored').textContent,1);
  assert.equal(u.els.get('play').dataset.playing,false);assert.equal(u.timers.size,0);
  tick();assert.equal(u.els.get('bfs-explored').textContent,1,'an already queued callback cannot advance the restored paused run');
  assert.equal(u.els.get('compare-empty').hidden,false,'a partial run is still not a baseline');
 }finally{u.restore();}
});

test('a drag that returns the start to its original cell retains the same completed comparison',async()=>{
 const u=await boot();try{
  u.click('finish');u.tool('erase');u.edit(82);u.click('finish');u.tool('start');
  const before=u.map(),history=u.els.get('history-status').textContent;
  u.pointer('pointerdown',75);u.pointer('pointermove',76);u.pointer('pointerup',76);
  assert.deepEqual(u.map(),before);
  assert.equal(u.els.get('compare-after-distance').textContent,'12');
  assert.equal(u.els.get('compare-distance-delta').textContent,'少 8 步');
  assert.equal(u.els.get('history-status').textContent,history);
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

test('guessing uses the next real frontier without editing and reveal advances exactly once',async()=>{
 const u=await boot();try{
  const trace=search(makeMap(),'astar'),d=decisionAt(trace,1);
  u.click('guess-toggle');
  assert.equal(u.els.get('astar-explored').textContent,1,'only the starting cell is expanded on entry');
  assert.equal(u.els.get('guess-reveal').disabled,true);
  assert.equal(u.els.get('step').disabled,true);
  assert.equal(u.els.get('guess-explanation').textContent,'','no answer before the guess');
  const wrong=d.candidates.find(c=>c.index!==d.current).index;
  u.pointer('pointerdown',wrong,{name:'astar'});u.pointer('pointermove',0,{name:'astar'});u.pointer('pointerup',0,{name:'astar'});
  assert.equal(u.els.get('wall-count').textContent,'9 格墙');
  assert.equal(u.els.get('undo-map').disabled,true);
  assert.match(u.els.get('guess-pick').textContent,/已走.*预计余程/);
  assert.equal(u.els.get('astar-explored').textContent,1);
  assert.equal(u.els.get('guess-explanation').textContent,'');
  u.click('step');
  assert.equal(u.els.get('astar-explored').textContent,2);assert.equal(u.els.get('bfs-explored').textContent,2);
  assert.match(u.els.get('guess-explanation').textContent,/实际展开/);
  assert.match(u.els.get('astar-grid').children[d.current].className,/guess-actual/);
  assert.match(u.els.get('astar-grid').children[wrong].className,/guess-picked/);
  assert.equal(u.els.get('astar-distance').textContent,'待揭晓');
  u.edit(0);assert.equal(u.els.get('wall-count').textContent,'9 格墙','even inactive board taps cannot edit while guessing');
  u.click('guess-reveal');assert.equal(u.els.get('astar-explored').textContent,2,'next question does not secretly advance');
  assert.equal(u.els.get('guess-explanation').textContent,'');
  u.edit(trace.visited[2],'astar');u.click('guess-reveal');
  assert.equal(u.els.get('astar-explored').textContent,3);assert.match(u.els.get('guess-explanation').textContent,/猜中了/);
 }finally{u.restore();}
});

test('switching to BFS keeps the current step and gives real FIFO evidence',async()=>{
 const u=await boot();try{
  u.click('guess-toggle');
  const select=u.els.get('guess-algorithm');select.value='bfs';u.fire(select,'change');
  assert.equal(u.els.get('guess-panel').parent,u.els.get('bfs-guess-slot'));
  assert.equal(u.els.get('bfs-explored').textContent,1);
  assert.match(u.els.get('guess-rule').textContent,/队列/);
  u.edit(91,'bfs');u.click('guess-reveal');
  assert.match(u.els.get('guess-explanation').textContent,/队列第 1.*第 2.*不按/);
  assert.equal(u.els.get('bfs-grid').children[91].getAttribute('aria-pressed'),'true');
 }finally{u.restore();}
});

test('map editing, undo and playback exit guessing without changing the completed baseline',async()=>{
 const u=await boot();try{
  u.click('finish');const baseline=u.els.get('compare-before-distance').textContent;
  u.click('guess-toggle');assert.match(u.els.get('guess-status').textContent,/结束/);
  u.click('guess-restart');assert.equal(u.els.get('astar-explored').textContent,1);
  u.tool('erase');assert.equal(u.els.get('guess-toggle').getAttribute('aria-pressed'),'false');
  u.edit(82);assert.equal(u.els.get('wall-count').textContent,'8 格墙');
  u.click('guess-toggle');u.click('undo-map');
  assert.equal(u.els.get('guess-panel').hidden,true);assert.equal(u.els.get('wall-count').textContent,'9 格墙');
  assert.equal(u.els.get('compare-before-distance').textContent,baseline);
  u.click('guess-toggle');u.click('play');assert.equal(u.els.get('guess-panel').hidden,true);assert.equal(u.timers.size,1);
  u.click('guess-toggle');assert.equal(u.timers.size,0);u.click('finish');
  assert.equal(u.els.get('guess-panel').hidden,true);assert.equal(u.els.get('compare-before-distance').textContent,baseline);
 }finally{u.restore();}
});

test('finished algorithms do not silently rewind; Escape and blocked cells do not mutate the map',async()=>{
 const u=await boot();try{
  for(let i=0;i<61;i++)u.click('step');
  u.click('guess-toggle');assert.equal(u.els.get('astar-explored').textContent,60);
  assert.match(u.els.get('guess-status').textContent,/结束/);assert.equal(u.els.get('guess-reveal').disabled,true);
  const select=u.els.get('guess-algorithm');select.value='bfs';u.fire(select,'change');
  assert.equal(u.els.get('bfs-explored').textContent,61);
  u.edit(82);assert.equal(u.els.get('guess-reveal').disabled,true);
  u.key('Escape');assert.equal(u.els.get('guess-toggle').getAttribute('aria-pressed'),'false');
  assert.equal(u.els.get('wall-count').textContent,'9 格墙');
  u.click('guess-toggle');u.preset('maze');assert.equal(u.els.get('guess-panel').hidden,true);
 }finally{u.restore();}
});

test('guessing does not leak future paths or replace before/after comparison on replay',async()=>{
 const u=await boot();try{
  u.click('finish');u.tool('erase');u.edit(82);u.click('finish');
  u.click('guess-toggle');u.click('guess-restart');
  assert.equal(u.els.get('compare-before-distance').textContent,'20');
  assert.equal(u.els.get('compare-after-distance').textContent,'待运行');
  assert.equal(u.els.get('compare-after-map').children.some(c=>c.className.split(' ').includes('path')),false);
  u.key('Escape');u.click('finish');assert.equal(u.els.get('compare-after-distance').textContent,'12');
 }finally{u.restore();}
});

test('the sole goal candidate remains discoverable and can be guessed before completion',async()=>{
 const u=await boot();try{
  u.preset('empty');for(const i of [61,75,91])u.edit(i);u.tool('goal');u.edit(77);
  u.click('guess-toggle');
  assert.match(u.els.get('guess-status').textContent,/只剩一个候选/);
  assert.equal(u.els.get('astar-grid').children[77].textContent,'G');
  assert.match(u.els.get('guess-entry-note').textContent,/终点 G/);
  assert.match(u.els.get('guess-pick').textContent,/终点 G/);
  u.edit(77,'astar');assert.equal(u.els.get('guess-explanation').textContent,'');
  u.click('guess-reveal');assert.equal(u.els.get('astar-distance').textContent,1);
  assert.match(u.els.get('guess-explanation').textContent,/猜中了/);
  u.click('guess-reveal');assert.match(u.els.get('guess-status').textContent,/结束/);
  assert.equal(u.els.get('guess-reveal').disabled,true);
 }finally{u.restore();}
});
