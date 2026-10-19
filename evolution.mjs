import {WIDTH,HEIGHT,POPULATION,ROAD_RADIUS,presetTrack,makeTrack,createRace,nextGeneration,positionAt} from './evolution-core.mjs';
import {createBirthView} from './evolution-birth.mjs';

const $=id=>document.getElementById(id),field=$('race'),ctx=field.getContext('2d');
const chart=$('history').getContext('2d'),geneCanvas=$('genes').getContext('2d');
const names={sweep:'大回环',hairpin:'发卡弯',slalom:'连续弯',custom:'我的赛道'};
let race=createRace(),preset='sweep',mode='watch',elapsed=0,playing=!document.hidden&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
let baseline=race.best,baselineKnown=false,gesture=null,cursor={x:450,y:240},showCursor=false;
let raf=null,last=null,token=0,batchLeft=0,ink,muted,line,paper,surface,accent,good;
const duration=()=>Math.max(...race.runs.map(r=>r.time));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

if(!ctx||!chart||!geneCanvas){
 document.querySelector('.raceboard').innerHTML='<p class="race-error" role="alert">这个浏览器暂时无法绘制赛道。请换用支持 Canvas 的浏览器，上方的其他实验仍可访问。</p>';
 document.querySelector('.race-controls').hidden=true;
 $('inspect-birth').disabled=true;
}else{
 function controls(){
  $('play').textContent=playing||batchLeft?'暂停':'继续';$('play').setAttribute('aria-pressed',String(playing||batchLeft>0));
  $('evolve').textContent=batchLeft?'快进中 '+batchLeft+' 代':'快进 10 代';
  $('track-name').textContent=names[preset];$('generation').textContent=String(race.generation);
  $('mutation').value=String(Math.round(race.mutation*100));$('mutation-value').textContent=Math.round(race.mutation*100)+'%';
  field.dataset.mode=mode;
  document.querySelectorAll('button[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===preset)));
 }
 function path(context,points){
  context.beginPath();points.forEach((p,i)=>i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));
 }
 function observed(run){
  if(elapsed>=run.time)return run.progress;
  let lo=0,hi=run.samples.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(run.samples[mid].t<=elapsed)lo=mid;else hi=mid;}
  const a=run.samples[lo],b=run.samples[hi];
  return a.progress+(b.progress-a.progress)*clamp((elapsed-a.t)/(b.t-a.t||1),0,1);
 }
 function draw(){
  ctx.fillStyle=paper;ctx.fillRect(0,0,WIDTH,HEIGHT);
  // The road and exact evaluated paths are the artwork, not a fake preview.
  ctx.lineJoin='round';ctx.lineCap='round';
  path(ctx,race.track.points);ctx.lineWidth=ROAD_RADIUS*2+6;ctx.strokeStyle=line;ctx.stroke();
  path(ctx,race.track.points);ctx.lineWidth=ROAD_RADIUS*2;ctx.strokeStyle=surface;ctx.stroke();
  path(ctx,race.track.points);ctx.lineWidth=1.4;ctx.strokeStyle=muted;ctx.globalAlpha=.35;ctx.setLineDash([7,12]);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  for(const [end,label] of [[0,'START'],[race.track.points.length-1,'FINISH']]){
   const p=race.track.points[end],near=race.track.points[end===0?1:end-1],angle=Math.atan2(p.y-near.y,p.x-near.x)+Math.PI/2;
   ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
   for(let row=0;row<2;row++)for(let col=0;col<8;col++){ctx.fillStyle=(row+col)%2?ink:surface;ctx.fillRect(-32+col*8,-7+row*7,8,7);}
   ctx.restore();ctx.font='bold 10px ui-monospace,monospace';ctx.fillStyle=muted;ctx.textAlign='center';ctx.fillText(label,p.x,p.y-54);
  }
  if($('ghost').checked&&baselineKnown){
   path(ctx,baseline.samples.filter((_,i)=>i%4===0));ctx.lineWidth=1.6;ctx.strokeStyle=muted;ctx.globalAlpha=.55;ctx.setLineDash([3,7]);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  }
  let leader=0,progress=-1;
  race.runs.forEach((run,i)=>{const p=observed(run);if(p>progress||(p===1&&run.time<race.runs[leader].time)){progress=p;leader=i;}});
  if(elapsed>=duration())leader=race.bestIndex;
  const lead=race.runs[leader];
  path(ctx,lead.samples.filter((p,i)=>p.t<=elapsed&&i%3===0));ctx.lineWidth=3;ctx.strokeStyle=good;ctx.globalAlpha=.65;ctx.stroke();ctx.globalAlpha=1;
  const order=race.runs.map((_,i)=>i).filter(i=>i!==leader).concat(leader);
  for(const i of order){
   const run=race.runs[i],p=positionAt(run,elapsed),before=positionAt(run,Math.max(0,Math.min(elapsed,run.time)-.04));
   const crashed=!run.finished&&elapsed>=run.time,angle=Math.atan2(p.y-before.y,p.x-before.x);
   ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
   ctx.globalAlpha=crashed?.28:i===leader?1:.42;ctx.fillStyle=i===leader?good:muted;
   ctx.fillRect(-7,-4,14,8);ctx.fillStyle=i===leader?accent:surface;ctx.fillRect(0,-3,4,6);
   ctx.fillStyle=ink;for(const x of [-4,4]){ctx.fillRect(x-1,-6,3,2);ctx.fillRect(x-1,4,3,2);}
   if(crashed){ctx.strokeStyle=ink;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-4,-3);ctx.lineTo(4,3);ctx.moveTo(-4,3);ctx.lineTo(4,-3);ctx.stroke();}
   ctx.restore();
  }
  for(const o of race.obstacles){
   ctx.fillStyle=ink;ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(o.x-5,o.y-5);ctx.lineTo(o.x+5,o.y+5);ctx.moveTo(o.x+5,o.y-5);ctx.lineTo(o.x-5,o.y+5);ctx.stroke();
  }
  if(gesture?.drawing){path(ctx,gesture.points);ctx.strokeStyle=good;ctx.lineWidth=5;ctx.setLineDash([5,7]);ctx.stroke();ctx.setLineDash([]);}
  if(showCursor&&mode==='obstacle'){ctx.strokeStyle=good;ctx.lineWidth=2;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(cursor.x,cursor.y,20,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  const finishers=race.runs.filter(r=>r.finished&&elapsed>=r.time),best=finishers.length?Math.min(...finishers.map(r=>r.time)):null;
  $('finish-count').textContent=finishers.length+' / '+POPULATION;$('best-time').textContent=best===null?'未到终点':best.toFixed(2)+' s';
  $('race-clock').textContent=Math.min(elapsed,duration()).toFixed(1)+' 秒';
  $('race-state').textContent=mode==='draw'?'按住拖出一条长线，松手确认':batchLeft?'正在计算完整比赛':elapsed>=duration()?(finishers.length?'本代完成，优秀路线留下来':'本代结束，还没有车跑完'):playing?'这一代正在尝试':'比赛已暂停';
  const completed=race.history.filter(h=>h.generation<race.generation||elapsed>=duration());
  chart.clearRect(0,0,320,100);chart.strokeStyle=line;chart.lineWidth=1;chart.beginPath();chart.moveTo(0,90);chart.lineTo(320,90);chart.stroke();
  if(completed.length){
   chart.strokeStyle=good;chart.lineWidth=3;chart.beginPath();
   completed.forEach((h,i)=>{const x=8+i/Math.max(12,completed.length-1)*304,y=90-h.score/3*80;i?chart.lineTo(x,y):chart.moveTo(x,y);});chart.stroke();
   const h=completed.at(-1);chart.fillStyle=good;chart.beginPath();chart.arc(8+(completed.length-1)/Math.max(12,completed.length-1)*304,90-h.score/3*80,3,0,Math.PI*2);chart.fill();
  }
  geneCanvas.clearRect(0,0,480,80);
  race.population[leader].forEach((g,i)=>{geneCanvas.fillStyle=g>=0?good:muted;geneCanvas.fillRect(i*20+2,g>=0?40-g*32:40,15,Math.max(2,Math.abs(g)*32));});
  geneCanvas.strokeStyle=line;geneCanvas.lineWidth=1;geneCanvas.beginPath();geneCanvas.moveTo(0,40);geneCanvas.lineTo(480,40);geneCanvas.stroke();
 }
 function cancelGesture(){
  if(gesture?.drawing){try{field.releasePointerCapture(gesture.id);}catch{/* capture may already be released */}}
  gesture=null;
 }
 function pause(message){
  playing=false;batchLeft=0;token++;if(raf!==null)cancelAnimationFrame(raf);raf=null;last=null;cancelGesture();
  if(message)$('status').textContent=message;controls();draw();
 }
 function advance(){
  if(race.generation===1){baseline=race.best;baselineKnown=true;}
  race=nextGeneration(race);elapsed=0;controls();
 }
 function schedule(){
  if(playing&&!document.hidden&&raf===null){const version=token;raf=requestAnimationFrame(now=>frame(now,version));}
 }
 function frame(now,version){
  if(version!==token)return;raf=null;if(!playing||document.hidden)return;
  if(last!==null)elapsed+=Math.min(.1,(now-last)/1000)*Number($('speed').value||4);last=now;
  if(elapsed>=duration()+.7){advance();$('status').textContent='新的后代出发了。最好的两条路线被保留，其余重新组合。';}
  draw();schedule();
 }
 function reset(track,obstacles,name,message){
  pause();race=createRace(track,{mutation:race.mutation,obstacles});preset=name;elapsed=0;baseline=race.best;baselineKnown=false;
  $('status').textContent=message;controls();draw();
 }
 function beginBatch(){
  pause();mode='watch';batchLeft=10;const version=token;
  $('status').textContent='正在快进 · 已完成 0 / 10 代。可以随时暂停。';
  const tick=()=>{
   if(version!==token||document.hidden)return;raf=null;advance();batchLeft--;elapsed=duration();draw();controls();
   if(batchLeft){$('status').textContent='正在快进 · 已完成 '+(10-batchLeft)+' / 10 代。可以随时暂停。';raf=requestAnimationFrame(tick);}
   else{$('status').textContent='已完成 10 代完整模拟。可以继续比赛，也可以加个路障考考它们。';}
  };
  controls();draw();raf=requestAnimationFrame(tick);
 }
 function point(e){
  const b=field.getBoundingClientRect();return {x:clamp((e.clientX-b.left)/b.width*WIDTH,45,WIDTH-45),y:clamp((e.clientY-b.top)/b.height*HEIGHT,45,HEIGHT-45)};
 }
 function announceCursor(){ $('cursor-status').textContent='路障光标：横向 '+Math.round(cursor.x/WIDTH*100)+'%，纵向 '+Math.round(cursor.y/HEIGHT*100)+'%。'; }
 function obstacle(){
  const index=race.obstacles.findIndex(o=>distance(o,cursor)<o.radius+10);
  if(index<0&&race.track.points.some((p,i)=>(i===0||i===race.track.points.length-1)&&distance(p,cursor)<60)){$('status').textContent='给起点和终点留一点空间，换个位置吧。';return;}
  if(index<0&&race.obstacles.length>=12){$('status').textContent='最多放 12 个路障。再点已有路障可以移除。';return;}
  const obstacles=index>=0?race.obstacles.filter((_,i)=>i!==index):[...race.obstacles,{...cursor,radius:16}];
  reset(race.track,obstacles,preset,(index>=0?'已移除路障':'已添加路障')+'，从第 1 代重新比较。点继续开跑。');
 }
 function setMode(value){
  pause();mode=value;showCursor=mode==='obstacle';controls();draw();
  $('status').textContent=mode==='draw'?'按住画布画一条长赛道。取消或太短都不会覆盖原赛道。':mode==='obstacle'?'点路上添加路障，再点移除。每次改动都会重新进化。':'可以继续比赛，或快进看后代的变化。';
 }
 field.addEventListener('pointerdown',e=>{
  if(!e.isPrimary||e.button!==0||gesture)return;
  if(mode==='draw'){e.preventDefault();pause();gesture={id:e.pointerId,drawing:true,points:[point(e)],overflow:false};field.setPointerCapture(e.pointerId);}
  else if(mode==='obstacle')gesture={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};
 });
 field.addEventListener('pointermove',e=>{
  if(gesture?.id===e.pointerId){
   if(gesture.drawing){const p=point(e);if(distance(p,gesture.points.at(-1))>=3){if(gesture.points.length<1023)gesture.points.push(p);else gesture.overflow=true;}}
   else if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8)gesture.moved=true;
  }
  if(e.pointerType==='mouse'){cursor=point(e);showCursor=true;}draw();
 });
 field.addEventListener('pointerup',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;
  const current=gesture;cancelGesture();cursor=point(e);
  if(current.drawing){
   try{
    if(current.overflow)throw Error('Track length exceeded');
    const track=makeTrack([...current.points,point(e)]);
    reset(track,[],'custom','新赛道准备好了。路障和旧成绩已清空，点继续开跑。');mode='watch';controls();
   }catch{$('status').textContent='这条线太短或太长了。请画 250 到 4000 单位长的路线，原赛道已保留。';}
  }else if(!current.moved&&Math.hypot(e.clientX-current.x,e.clientY-current.y)<=8){field.focus({preventScroll:true});obstacle();}
  draw();
 });
 field.addEventListener('pointercancel',e=>{if(gesture?.id===e.pointerId){const drawing=gesture.drawing;cancelGesture();if(drawing)$('status').textContent='绘画已取消，原赛道保留。';draw();}});
 field.addEventListener('lostpointercapture',()=>{if(gesture?.drawing){cancelGesture();draw();}});
 field.addEventListener('pointerleave',()=>{if(!gesture?.drawing){cancelGesture();showCursor=false;draw();}});
 field.addEventListener('blur',()=>{cancelGesture();showCursor=false;draw();});
 field.addEventListener('focus',()=>{showCursor=true;announceCursor();draw();});
 field.addEventListener('keydown',e=>{
  const d={ArrowLeft:[-18,0],ArrowRight:[18,0],ArrowUp:[0,-18],ArrowDown:[0,18]}[e.key];
  if(d){e.preventDefault();cursor={x:clamp(cursor.x+d[0],45,855),y:clamp(cursor.y+d[1],45,435)};showCursor=true;announceCursor();draw();}
  else if((e.key===' '||e.key==='Enter')&&mode==='obstacle'){e.preventDefault();if(!e.repeat)obstacle();}
  else if(e.key==='Escape'){cancelGesture();draw();}
 });
 document.querySelectorAll('button[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
 document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{mode='watch';reset(presetTrack(b.dataset.preset),[],b.dataset.preset,'已换赛道，从第 1 代重新开始。点继续开跑。');}));
 $('play').addEventListener('click',()=>{
  if(playing||batchLeft)pause('已暂停。比赛和进化都不会在后台继续。');
  else{cancelGesture();mode='watch';playing=true;last=null;$('status').textContent='正在比赛。观察这一代的路线，也可以随时暂停或快进。';controls();draw();schedule();}
 });
 $('next').addEventListener('click',()=>{pause();mode='watch';advance();$('status').textContent='上一代已完整计算，新一代等待出发。点继续看比赛。';controls();draw();});
 $('evolve').addEventListener('click',beginBatch);
 $('mutation').addEventListener('input',()=>{race={...race,mutation:Number($('mutation').value)/100};controls();$('status').textContent='变异设置将在下一代生效，不改写本代的成绩。';});
 $('ghost').addEventListener('change',draw);
 $('reset').addEventListener('click',()=>reset(race.track,race.obstacles,preset,'已保留赛道、路障和变异设置，重新从第 1 代开始。'));
 $('clear-obstacles').addEventListener('click',()=>{if(race.obstacles.length)reset(race.track,[],preset,'路障已清空，从第 1 代重新开始。');else $('status').textContent='赛道上还没有路障。';});
 $('about').addEventListener('click',()=>{pause();$('guide').showModal();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('页面离开后已暂停，点继续恢复。');});
 window.addEventListener('pagehide',()=>pause());window.addEventListener('blur',()=>{cancelGesture();draw();});
 matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',e=>{if(e.matches)pause('已按减少动画偏好暂停。');});
 const theme=matchMedia('(prefers-color-scheme:dark)');let explicitTheme=false;
 function setTheme(dark){
  document.documentElement.dataset.theme=dark?'dark':'light';$('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');
  const css=getComputedStyle(document.documentElement),get=n=>css.getPropertyValue('--'+n).trim();
  ink=get('ink');muted=get('muted');line=get('line');paper=get('paper');surface=get('soft');accent=get('accent');good=get('good');draw();
 }
 $('theme').addEventListener('click',()=>{explicitTheme=true;setTheme(document.documentElement.dataset.theme!=='dark');});
 theme.addEventListener('change',e=>{if(!explicitTheme)setTheme(e.matches);});
 const birthView=createBirthView();
 $('birth-dialog').addEventListener('close',()=>{$('status').textContent='已返回比赛，仍然暂停。你可以继续观察，或手动继续比赛。';});
 $('inspect-birth').addEventListener('click',()=>{
  pause();mode='watch';if(!race.births)advance();
  $('status').textContent='出生观察中，比赛已暂停。第 1 代随机出生；这里从第 2 代开始保留真实父母与变异记录。';
  controls();draw();birthView.open(race);
 });
 controls();setTheme(theme.matches);schedule();
}
