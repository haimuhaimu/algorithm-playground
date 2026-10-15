import {search,makeMap,editMap,lineCells,frameAt} from './pathfinding-core.mjs';
const $=id=>document.getElementById(id),names=['bfs','astar'];
let map=makeMap(),preset='detour',tool='wall',traces=null,step=0,playing=false,timer=null,edited=false,stroke=null;
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const cells={};
for(const name of names){
 cells[name]=Array.from({length:map.cols*map.rows},(_,index)=>{
  const button=document.createElement('button');button.className='cell';button.dataset.index=index;button.tabIndex=index===map.start?0:-1;
  $(name+'-grid').append(button);return button;
 });
}
function stop(){clearTimeout(timer);timer=null;playing=false;}
function invalidate(){stop();traces=null;step=0;}
function prepare(){if(!traces)traces=Object.fromEntries(names.map(name=>[name,search(map,name)]));}
function duration(){return traces?Math.max(...names.map(name=>traces[name].visited.length)):0;}
function complete(){return !!traces&&step>=duration();}
function render(){
 const walls=new Set(map.walls),done=complete();
 for(const name of names){
  const frame=traces?frameAt(traces[name],step):{visited:[],frontier:[],path:[],current:null,done:false};
  const visited=new Set(frame.visited),frontier=new Set(frame.frontier),path=new Set(frame.path);
  cells[name].forEach((cell,index)=>{
   const state=index===map.start?'start':index===map.goal?'goal':walls.has(index)?'wall':path.has(index)?'path':visited.has(index)?'visited':frontier.has(index)?'frontier':'';
   cell.className=`cell ${state}${index===frame.current&&!frame.done?' current':''}`;
   cell.textContent=index===map.start?'S':index===map.goal?'G':'';
   const label={start:'起点',goal:'终点',wall:'墙',path:'最终路径',visited:'已探索',frontier:'待探索','':'空地'}[state];
   cell.setAttribute('aria-label',`第 ${Math.floor(index/map.cols)+1} 行，第 ${index%map.cols+1} 列，${label}`);
  });
  $(name+'-explored').textContent=frame.visited.length;
  $(name+'-distance').textContent=frame.done?(frame.found?frame.distance:'无通路'):'待揭晓';
  $(name+'-distance').classList.toggle('waiting',!frame.done||!frame.found);
  $(name+'-status').textContent=frame.done?(frame.found?'已找到出口':'出口不可达'):traces?(playing?'探索中':'已暂停'):'等待出发';
 }
 $('play').innerHTML=playing?'暂停 <span aria-hidden="true">Ⅱ</span>':done?'重放这张图 <span aria-hidden="true">↻</span>':step>0?'继续找路 <span aria-hidden="true">▶</span>':'开始找路 <span aria-hidden="true">▶</span>';
 $('play').dataset.playing=playing;$('step').disabled=playing;
 $('wall-count').textContent=`${map.walls.length} 格墙`;
 $('play-status').textContent=done?'本轮完成，可以改图再试。':playing?`正在展开第 ${step} 步`:
  traces?`已暂停在第 ${step} 步`:edited?'地图已改变，上轮结果已清除。':'地图就绪，等你出题。';
 document.querySelectorAll('[data-map]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.map===preset)));
 document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
 const status=$('challenge-status');status.classList.remove('won');
 if(!done){$('summary-title').textContent='最短的路，不止一种找法。';$('result-copy').textContent=traces?'让这一轮跑完，再比较探索数量与路径长度。':'先跑一轮，再挪动一块墙。地图里的一个小改变，就可能让算法换一种走法。';status.textContent=edited?'地图改好了，跑一轮看看。':'先改一笔，再试试。';return;}
 const b=traces.bfs,a=traces.astar;
 if(!b.found){$('summary-title').textContent='这次，不是谁慢，是无路可走。';$('result-copy').textContent=`两边都已找遍可达区域，各探索了 ${b.visited.length} 格。用橡皮打开一道缺口，再试一次。`;status.textContent='需要留一条通往出口的路。';return;}
 const difference=b.visited.length-a.visited.length,percent=Math.round(Math.abs(difference)/b.visited.length*100);
 $('summary-title').textContent=difference>0?`同样走 ${b.distance} 步，A* 少找了 ${difference} 格。`:difference===0?'这张地图，两种算法探索一样多。':`这张地图，BFS 少探索了 ${-difference} 格。`;
 $('result-copy').textContent=`BFS 探索 ${b.visited.length} 格，A* 探索 ${a.visited.length} 格。${difference>0?`A* 的探索量少了约 ${percent}%。`:''}两条路线长度都是 ${b.distance} 步。${difference>0?'方向信息在这次帮上了忙；换张地图，优势也会改变。':'这就是试地图的意义：有方向感，也不是每次都能少绕弯。'}`;
 const won=edited&&a.visited.length<=b.visited.length/2;status.classList.toggle('won',won);
 status.textContent=won?'挑战达成！这是你出的好题。':!edited?'预设只是热身，自己改一笔再挑战。':'有路了！再改改墙，让探索差距更大一点。';
}
function schedule(){
 timer=setTimeout(()=>{if(!playing)return;step++;if(complete())stop();render();if(playing)schedule();},Number($('speed').value));
}
$('play').addEventListener('click',()=>{
 if(playing){stop();render();return;}
 prepare();if(complete())step=0;
 if(reduced.matches){step=duration();render();return;}
 playing=true;render();schedule();
});
$('step').addEventListener('click',()=>{stop();prepare();if(complete())step=0;step++;render();});
$('finish').addEventListener('click',()=>{stop();prepare();step=duration();render();});
$('speed').addEventListener('change',()=>{if(playing){clearTimeout(timer);schedule();}});
function endStroke(){
 if(!stroke)return;const {grid,id}=stroke;stroke=null;
 if(grid.hasPointerCapture(id))grid.releasePointerCapture(id);
}
function applyCells(indices){
 let next=map;for(const index of indices)next=editMap(next,index,tool);
 if(next===map)return;map=next;edited=true;preset=null;invalidate();render();
}
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{endStroke();tool=b.dataset.tool;render();}));
document.querySelectorAll('[data-map]').forEach(b=>b.addEventListener('click',()=>{endStroke();invalidate();preset=b.dataset.map;map=makeMap(preset);edited=false;render();}));
$('clear-walls').addEventListener('click',()=>{endStroke();if(!map.walls.length)return;map={...map,walls:[]};preset=null;edited=true;invalidate();render();});
function cellAt(event,grid){
 const rect=grid.getBoundingClientRect();
 if(event.clientX<rect.left||event.clientX>=rect.right||event.clientY<rect.top||event.clientY>=rect.bottom)return null;
 const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('.cell');
 return cell&&grid.contains(cell)?Number(cell.dataset.index):null;
}
function focusCell(name,index,reveal=false){
 cells[name].forEach(b=>b.tabIndex=Number(b.dataset.index)===index?0:-1);cells[name][index].focus({preventScroll:true});
 if(reveal)cells[name][index].scrollIntoView({block:'nearest',inline:'nearest'});
}
for(const name of names){
 const grid=$(name+'-grid');
 grid.addEventListener('pointerdown',event=>{
  if(event.button!==0||!event.isPrimary||stroke)return;
  const index=cellAt(event,grid);if(index===null)return;
  event.preventDefault();focusCell(name,index);grid.setPointerCapture(event.pointerId);stroke={id:event.pointerId,grid,last:index};applyCells([index]);
 });
 grid.addEventListener('pointermove',event=>{
  if(!stroke||stroke.id!==event.pointerId||stroke.grid!==grid)return;
  const index=cellAt(event,grid);if(index===null){stroke.last=null;return;}
  const indices=stroke.last===null?[index]:lineCells(stroke.last,index,map.cols);
  stroke.last=index;applyCells(tool==='wall'||tool==='erase'?indices:[index]);
 });
 grid.addEventListener('pointerup',event=>{
  if(!stroke||stroke.id!==event.pointerId||stroke.grid!==grid)return;
  const index=cellAt(event,grid);if(index!==null)applyCells(tool==='wall'||tool==='erase'?(stroke.last===null?[index]:lineCells(stroke.last,index,map.cols)):[index]);endStroke();
 });
 grid.addEventListener('pointercancel',endStroke);grid.addEventListener('lostpointercapture',endStroke);
 grid.addEventListener('click',event=>{if(event.detail===0){const cell=event.target.closest('.cell');if(cell)applyCells([Number(cell.dataset.index)]);}});
 grid.addEventListener('keydown',event=>{
  const cell=event.target.closest('.cell');if(!cell)return;const index=Number(cell.dataset.index),x=index%map.cols,y=Math.floor(index/map.cols);
  const moves={ArrowRight:[Math.min(x+1,map.cols-1),y],ArrowLeft:[Math.max(x-1,0),y],ArrowDown:[x,Math.min(y+1,map.rows-1)],ArrowUp:[x,Math.max(y-1,0)]};
  if(moves[event.key]){event.preventDefault();const [a,b]=moves[event.key];focusCell(name,b*map.cols+a,true);}
 });
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){endStroke();if(playing){stop();render();}}});
window.addEventListener('pagehide',()=>{endStroke();stop();});
window.addEventListener('blur',endStroke);
const themeQuery=matchMedia('(prefers-color-scheme:dark)');let explicitTheme=false;
function setTheme(dark){document.documentElement.dataset.theme=dark?'dark':'light';$('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');}
setTheme(themeQuery.matches);themeQuery.addEventListener('change',event=>{if(!explicitTheme)setTheme(event.matches);});
$('theme').addEventListener('click',()=>{explicitTheme=true;setTheme(document.documentElement.dataset.theme!=='dark');});
$('about').addEventListener('click',()=>{endStroke();stop();render();$('guide').showModal();});
render();
