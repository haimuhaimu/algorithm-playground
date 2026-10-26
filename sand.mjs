import {EMPTY,SAND,WATER,WALL,createWorld,stepWorld,paintStroke,countMaterials} from './sand-core.mjs?v=edit-history-1';
import {createHistory,snapshot,recordChange,undoChange,redoChange,discardFuture} from './sand-history.mjs?v=edit-history-1';
const $=id=>document.getElementById(id),canvas=$('sandbox'),ctx=canvas.getContext('2d');
const names=['橡皮','沙子','水','墙'],sizes=['细','小','中','大','很大'];
const tips={splitter:'往屋顶尖端倒水，再擦掉一小段斜坡。两边的去向会怎么变？',hourglass:'在沙漏的细口补一堵墙，让时间停住；再挖开它，让沙继续走。',empty:'造一只杯子，装点水，再撒一把沙。也可以在杯底开一道口。'};
let scene='splitter',world=createWorld(scene),material=SAND,radius=2,stroke=null,cursor={x:36,y:5},showCursor=false;
let playing=!matchMedia('(prefers-reduced-motion:reduce)').matches,raf=null,lastTick=performance.now(),lastPour=0;
let history=createHistory(),pendingEdit=null,frameToken=0,activePaintKey=null;
const sceneNames={splitter:'分流器',hourglass:'沙漏',empty:'空白'},editNames=['擦除','倒沙','倒水','筑墙'];
const unit=canvas.width/world.width;
const currentState=()=>snapshot(scene,world);
function renderHistory(){
 const pending=pendingEdit?.changed,previous=pending?{label:pendingEdit.label,state:pendingEdit.before}:history.past.at(-1),next=history.future.at(-1);
 $('history-undo').disabled=!previous;$('history-redo').disabled=!next||Boolean(pending);
 $('history-undo').setAttribute('aria-label',previous?`退回${previous.label}，回到第 ${previous.state.world.tick} 拍`:'退回修改，没有可退回的记录');
 $('history-redo').setAttribute('aria-label',next?`恢复${next.label}，回到第 ${next.state.world.tick} 拍`:'恢复修改，没有可恢复的记录');
 const undoText=previous?`可退回 ${Math.min(history.limit,history.past.length+(pending?1:0))} 次 · ${previous.label} → 第 ${previous.state.world.tick} 拍`:next?'已回到最早记录。':'还没有修改，放心画一笔。';
 const text=undoText+(next&&!pending?`；恢复：${next.label} → 第 ${next.state.world.tick} 拍`:'');
 if($('history-summary').textContent!==text)$('history-summary').textContent=text;
}
function beginEdit(kind){if(!pendingEdit)pendingEdit={kind,before:currentState(),label:editNames[material],changed:false};}
function finishEdit(){
 if(pendingEdit?.changed)history=recordChange(history,pendingEdit.before,currentState(),pendingEdit.label);
 pendingEdit=null;renderHistory();
}
function applyPaint(from,to){
 const before=world;world=paintStroke(world,from,to,material,radius);
 const changed=world.cells.some((value,i)=>value!==before.cells[i]);
 if(changed){if(pendingEdit)pendingEdit.changed=true;history=discardFuture(history);}
}
function simulate(){history=discardFuture(history);world=stepWorld(world);}
function render(){
 const brushHint=names[material]+' · '+sizes[radius]+'笔刷'+(material===EMPTY?'，拖动擦除':material===WALL?'，拖动筑墙':'，按住持续倒下');
 if($('brush-preview').textContent!==brushHint)$('brush-preview').textContent=brushHint;
 ctx.fillStyle='#152023';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.strokeStyle='#243236';ctx.lineWidth=1;ctx.beginPath();
 for(let x=0;x<=world.width;x+=6){ctx.moveTo(x*unit,0);ctx.lineTo(x*unit,canvas.height);}
 for(let y=0;y<=world.height;y+=6){ctx.moveTo(0,y*unit);ctx.lineTo(canvas.width,y*unit);}
 ctx.stroke();
 const palette={1:['#e4b45b','#efc978','#d8a04a'],2:['#64bacb','#6dc7d5','#5eb2c4'],3:['#88979b','#93a1a4','#819195']};
 world.cells.forEach((cell,i)=>{
  if(!cell)return;const x=i%world.width,y=Math.floor(i/world.width);
  ctx.fillStyle=palette[cell][(x*7+y*11)%3];ctx.fillRect(x*unit,y*unit,unit,unit);
  if(cell===SAND){ctx.fillStyle='#f8df9d88';ctx.fillRect(x*unit+2,y*unit+2,3,2);}
  if(cell===WALL){ctx.fillStyle='#b0babb66';ctx.fillRect(x*unit,y*unit,unit,2);}
 });
 if(showCursor){
  const x=(cursor.x+.5)*unit,y=(cursor.y+.5)*unit;
  ctx.strokeStyle='#f6f7da';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,(radius+.5)*unit,0,2*Math.PI);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);ctx.stroke();
 }
 const counts=countMaterials(world);
 for(const key of ['sand','water','wall'])$(key+'-count').textContent=counts[key];
 $('tick-count').textContent='第 '+world.tick+' 拍';
 renderHistory();
}
function announceCursor(){
 $('cursor-status').textContent='第 '+(cursor.x+1)+' 列，第 '+(cursor.y+1)+' 行，'+names[material]+'，笔刷'+sizes[radius];
}
function controls(message){
 $('play').innerHTML=playing?'暂停 <span aria-hidden="true">Ⅱ</span>':'继续 <span aria-hidden="true">▶</span>';
 $('play').setAttribute('aria-pressed',String(playing));
 document.querySelector('.sand-stage').dataset.paused=String(!playing);
 $('lab-status').textContent=message||(playing?'运行中 · 你可以直接画':'已暂停 · 仍可画，或走一拍');
 document.querySelectorAll('[data-material]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.material)===material)));
 document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===scene)));
}
function paint(from,to,moveCursor=true){
 applyPaint(from,to);if(moveCursor)cursor=to;render();
}
function schedule(){if(raf===null&&!document.hidden&&(playing||stroke)){const token=frameToken;raf=requestAnimationFrame(now=>{if(token!==frameToken||document.hidden)return;frame(now);});}}
function frame(now){
 raf=null;let dirty=false;
 if(stroke?.last&&(material===SAND||material===WATER)&&now-lastPour>=60){
  applyPaint(stroke.last,stroke.last);lastPour=now;dirty=true;
 }
 if(playing&&now-lastTick>=Number($('speed').value)){simulate();lastTick=now;dirty=true;}
 if(dirty)render();schedule();
}
function stop(){
 playing=false;frameToken++;if(raf!==null){cancelAnimationFrame(raf);raf=null;}controls();
}
function endStroke(){
 const old=stroke;stroke=null;activePaintKey=null;finishEdit();
 if(old&&canvas.hasPointerCapture(old.id))canvas.releasePointerCapture(old.id);
 if(!playing&&raf!==null){frameToken++;cancelAnimationFrame(raf);raf=null;}
}
function setMaterial(value){endStroke();material=value;controls();announceCursor();render();}
function point(event,allowOutside=false){
 const r=canvas.getBoundingClientRect();
 if(!allowOutside&&(event.clientX<r.left||event.clientX>=r.right||event.clientY<r.top||event.clientY>=r.bottom))return null;
 return {x:Math.floor((event.clientX-r.left)/r.width*world.width),y:Math.floor((event.clientY-r.top)/r.height*world.height)};
}
function extendStroke(event){
 const p=point(event);
 if(p){showCursor=true;paint(stroke.last||p,p);stroke.last=p;}
 else{
  showCursor=false;
  if(stroke.last)paint(stroke.last,point(event,true),false);
  stroke.last=null;
 }
}
canvas.addEventListener('pointerdown',event=>{
 if(event.button!==0||!event.isPrimary||stroke)return;
 const p=point(event);if(!p)return;event.preventDefault();canvas.focus({preventScroll:true});
 finishEdit();beginEdit('pointer');canvas.setPointerCapture(event.pointerId);stroke={id:event.pointerId,last:p};showCursor=true;paint(p,p);lastPour=performance.now();schedule();
});
canvas.addEventListener('pointermove',event=>{
 const p=point(event);
 if(stroke){
  if(event.pointerId!==stroke.id)return;
  extendStroke(event);
 }else if(p&&event.pointerType==='mouse'){cursor=p;showCursor=true;render();}
});
canvas.addEventListener('pointerup',event=>{
 if(!stroke||event.pointerId!==stroke.id)return;
 extendStroke(event);endStroke();announceCursor();
});
for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>{if(stroke?.id===event.pointerId)endStroke();});
canvas.addEventListener('pointerleave',()=>{if(!stroke){showCursor=false;render();}});
canvas.addEventListener('focus',()=>{showCursor=true;announceCursor();render();});
canvas.addEventListener('blur',()=>{endStroke();showCursor=false;render();});
canvas.addEventListener('keydown',event=>{
 const command=event.key.toLowerCase();
 if((event.ctrlKey||event.metaKey)&&!event.altKey&&!event.isComposing&&(command==='z'||command==='y')){
  event.preventDefault();moveHistory(command==='y'||event.shiftKey?'redo':'undo');return;
 }
 const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
 if(delta){event.preventDefault();cursor={x:Math.max(0,Math.min(world.width-1,cursor.x+delta[0])),y:Math.max(0,Math.min(world.height-1,cursor.y+delta[1]))};showCursor=true;announceCursor();render();}
 else if(event.key===' '||event.key==='Enter'){
  event.preventDefault();if(stroke||document.hidden||event.repeat&&activePaintKey!==event.key)return;
  if(!event.repeat){if(activePaintKey&&activePaintKey!==event.key)finishEdit();activePaintKey=event.key;}
  beginEdit('keyboard');paint(cursor,cursor);announceCursor();
 }
 else if(['1','2','3','4'].includes(event.key)){event.preventDefault();setMaterial([SAND,WATER,WALL,EMPTY][Number(event.key)-1]);}
});
canvas.addEventListener('keyup',event=>{if(event.key===activePaintKey){activePaintKey=null;if(pendingEdit?.kind==='keyboard')finishEdit();}});
document.querySelectorAll('[data-material]').forEach(b=>b.addEventListener('click',()=>setMaterial(Number(b.dataset.material))));
$('brush').addEventListener('input',()=>{endStroke();radius=Number($('brush').value);$('brush-size').textContent=sizes[radius];$('brush').setAttribute('aria-valuetext',sizes[radius]+'，半径 '+radius+' 格');announceCursor();render();});
function reset(nextScene){
 endStroke();const before=currentState(),label=nextScene===scene?`重置${sceneNames[scene]}`:`切换${sceneNames[nextScene]}`;
 scene=nextScene;world=createWorld(scene);history=recordChange(history,before,currentState(),label);lastTick=performance.now();showCursor=false;
 $('scene-tip').textContent=tips[scene];controls('场景已重置 · '+(playing?'正在演化':'已暂停'));render();schedule();
}
document.querySelectorAll('[data-scene]').forEach(b=>b.addEventListener('click',()=>reset(b.dataset.scene)));
$('reset').addEventListener('click',()=>reset(scene));
$('play').addEventListener('click',()=>{endStroke();if(playing)stop();else{playing=true;lastTick=performance.now();controls();schedule();}});
$('step').addEventListener('click',()=>{endStroke();stop();simulate();controls('已走一拍 · 第 '+world.tick+' 拍');render();});
function moveHistory(direction){
 endStroke();const result=(direction==='undo'?undoChange:redoChange)(history,currentState());
 if(!result)return;
 const focused=document.activeElement;stop();history=result.history;scene=result.state.scene;world=result.state.world;
 lastTick=performance.now();lastPour=lastTick;showCursor=false;$('scene-tip').textContent=tips[scene];
 controls(`已${direction==='undo'?'退回':'恢复'}「${result.label}」· 沙水和拍数一起回到第 ${world.tick} 拍，已暂停`);render();
 if(focused===$('history-undo')&&$('history-undo').disabled)$('history-redo').focus({preventScroll:true});
 else if(focused===$('history-redo')&&$('history-redo').disabled)$('history-undo').focus({preventScroll:true});
}
$('history-undo').addEventListener('click',()=>moveHistory('undo'));
$('history-redo').addEventListener('click',()=>moveHistory('redo'));
$('speed').addEventListener('change',()=>{lastTick=performance.now();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){endStroke();stop();controls('页面离开后已暂停 · 点继续恢复');}});
window.addEventListener('blur',endStroke);window.addEventListener('pagehide',()=>{endStroke();stop();});
document.addEventListener('sand-lesson-start',()=>{endStroke();stop();controls('观察一粒沙时已暂停 · 你的画布保留着');});
$('about').addEventListener('click',()=>{endStroke();stop();$('guide').showModal();});
const themeQuery=matchMedia('(prefers-color-scheme:dark)');let explicitTheme=false;
function setTheme(dark){document.documentElement.dataset.theme=dark?'dark':'light';$('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');}
setTheme(themeQuery.matches);themeQuery.addEventListener('change',e=>{if(!explicitTheme)setTheme(e.matches);});
$('theme').addEventListener('click',()=>{explicitTheme=true;setTheme(document.documentElement.dataset.theme!=='dark');});
controls();render();schedule();
