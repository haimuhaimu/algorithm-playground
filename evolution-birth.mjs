import {WIDTH,HEIGHT,ROAD_RADIUS,CAR_RADIUS,inspectBirth,positionAt,compareRuns} from './evolution-core.mjs';

const result=run=>run.finished?`${run.time.toFixed(2)} 秒 · 完赛`:`未完赛 · 走到 ${(run.progress*100).toFixed(0)}%`;
function difference(before,after){
 const d=compareRuns(before,after);
 const labels={'gained-finish':'从未完赛变成完赛','lost-finish':'原来能完赛，现在撞停了','same-time':'用时相同','same-progress':'走到的位置相同'};
 if(labels[d.outcome])return labels[d.outcome];
 if(d.seconds!==undefined)return `${d.outcome==='faster'?'快':'慢'}了 ${d.seconds.toFixed(2)} 秒`;
 return `${d.outcome==='further'?'多':'少'}走了 ${(d.progress*100).toFixed(1)}% 的路线`;
}

export function createBirthView(){
 const $=id=>document.getElementById(id),dialog=$('birth-dialog'),canvas=$('birth-scene'),ctx=canvas.getContext('2d');
 let race,view,step=0,segment=0,focusParent=0,time=0,complete=false,running=false,raf=null,last=null,token=0;
 const runs=()=>[view.parents[0].run,view.parents[1].run,view.inheritedRun,view.childRun];
 const end=()=>Math.max(...runs().map(r=>r.time));
 const set=(id,text)=>{$(id).textContent=text;};
 const colors=()=>{const css=getComputedStyle(document.documentElement),get=n=>css.getPropertyValue('--'+n).trim();return {a:get('birth-a'),b:get('birth-b'),child:get('good'),mut:get('birth-mut'),ink:get('ink'),muted:get('muted'),paper:get('paper'),soft:get('soft'),line:get('line')};};
 function stop(){running=false;token++;if(raf!==null)cancelAnimationFrame(raf);raf=null;last=null;}
 function stroke(points,color,width=3,dash=[]){if(!points.length)return;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
 function draw(){
  if(!view||!ctx)return;const c=colors();
  ctx.fillStyle=c.paper;ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.lineCap='round';ctx.lineJoin='round';
  stroke(view.track.points,c.line,ROAD_RADIUS*2+3);stroke(view.track.points,c.soft,ROAD_RADIUS*2);
  stroke(view.track.points,c.muted,1,[6,12]);
  for(const o of view.obstacles){ctx.fillStyle=c.ink;ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.fill();}
  const start=view.track.points[0],finish=view.track.points.at(-1);
  ctx.font='bold 14px sans-serif';ctx.fillStyle=c.ink;ctx.textAlign='center';ctx.fillText('起点',start.x,start.y-52);ctx.fillText('终点',finish.x,finish.y-52);
  if(step===0){
   view.parents.forEach((p,i)=>{ctx.globalAlpha=focusParent===i?1:.35;stroke(p.run.route,i?c.b:c.a,focusParent===i?5:3,i?[8,5]:[]);});ctx.globalAlpha=1;
  }else if(step===1){
   view.parents.forEach((p,i)=>{ctx.globalAlpha=.2;stroke(p.run.route,i?c.b:c.a,2,i?[6,7]:[]);});ctx.globalAlpha=1;
   const route=view.inheritedRun.route;
   stroke(route,c.ink,3);
   view.sources.forEach((source,i)=>{const p=route[i+1];ctx.fillStyle=source?c.b:c.a;ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();});
  }else if(step===2){
   stroke(view.inheritedRun.route,c.muted,3,[7,8]);stroke(view.childRun.route,c.child,4);
   for(const m of view.mutations){const i=m.index+1;stroke(view.childRun.route.slice(i-1,i+2),c.mut,6);}
  }else{
   const shades=[c.a,c.b,c.muted,c.child],labels=['A','B','未变异','后代'];
   runs().forEach((run,i)=>{
    const samples=run.samples.filter(p=>p.t<=time),p=positionAt(run,time);
    stroke(samples,shades[i],i===3?5:2,i===2?[5,7]:[]);
    ctx.fillStyle=shades[i];ctx.beginPath();ctx.arc(p.x,p.y,i===3?8:5,0,Math.PI*2);ctx.fill();
    ctx.textAlign='left';ctx.font='bold 14px sans-serif';ctx.fillText(labels[i]+(!run.finished&&time>=run.time?' ×':''),p.x+10,p.y-34+i*18);
   });
  }
  if(step<3){
   const route=step===0?view.parents[focusParent].run.route:step===1?view.inheritedRun.route:view.childRun.route,p=route[segment+1];
   ctx.fillStyle=c.paper;ctx.strokeStyle=c.ink;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,13,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.fillStyle=c.ink;ctx.textAlign='center';ctx.font='bold 12px sans-serif';ctx.fillText(String(segment+1),p.x,p.y+4);
  }
  canvas.setAttribute('aria-label',step===3?`四条路线同场模拟，已播放 ${time.toFixed(1)} 秒${complete?'，下方有完整文字结果':''}`:`第 ${segment+1} 个路标对照。${$('birth-segment-detail').textContent}`);
 }
 function updatePlayback(){
  set('birth-clock',complete?`本次已完整模拟 · 回放 ${time.toFixed(1)} 秒`:`${running?'正在实跑':'等待 / 已暂停'} · 模拟 ${time.toFixed(1)} 秒`);
  set('birth-run',running?'暂停实跑':complete&&time>=end()?'再看一次 ↻':time>0?'继续实跑 →':'开始同场实跑 →');
  $('birth-time').max=String(Math.ceil(end()*10)/10);$('birth-time').value=String(time>=end()?Number($('birth-time').max):time);
  $('birth-time').setAttribute('aria-valuetext',`模拟 ${time.toFixed(1)} 秒，共 ${end().toFixed(1)} 秒`);
  $('birth-results').hidden=step!==3||!complete;
 }
 function render(){
  if(!view)return;
  const stages=['父母不是随便贴上去的标签。','把两条走法，拼成一条新路线。','挪动几个路标，不保证更好。','同样条件，跑过才知道。'];
  const countA=view.sources.filter(s=>s===0).length,n=view.mutations.length;
  const descriptions=[
   '每选一位父代，随机抽 4 次车，留下其中表现最好的一辆。先比能否完赛，再比用时；没跑完则比走了多远。点 A / B 看它的路线。',
   `24 个路标中，${countA} 个继承 A，${24-countA} 个继承 B。每个基因决定一个路标的左右偏移；彩色圆点表示来源，连线是重新连接的，不是整段照搬父母路线。拖动观察位置，看这个路标来自谁。`,
   n?`这辆后代有 ${n} 个路标偏移发生变异（出生时概率 ${Math.round(view.mutationRate*100)}%）。橙色标出受影响路段，虚线是只继承、还没变异的路线。改得更激进，也可能撞停。`:'这辆后代没有任何基因发生改变：本次没有变异。最终路线与只继承的路线相同，不会为了演示偷偷补一次变异。',
   'A、B、只继承未变异、最终后代，从同一起点出发。碰撞会停下，不会把提前撞停的短时间当成更快。下面的结论来自同一套模拟，不是预设赢家。'
  ];
  set('birth-step-title',stages[step]);set('birth-explanation',descriptions[step]);
  for(let i=0;i<4;i++)$('birth-stage-'+i).setAttribute('aria-current',i===step?'step':'false');
  view.parents.forEach((p,i)=>{const id=i?'birth-parent-b':'birth-parent-a';set(id,`父代 ${i?'B':'A'} · 上代 #${p.index+1}（第 ${p.rank} 名）\n${result(p.run)}`);$(id).setAttribute('aria-pressed',String(i===focusParent));});
  $('birth-parents').hidden=step!==0;
  $('birth-selection-note').hidden=step!==0;
  const draws=view.parents.map((p,i)=>`${i?'B':'A'} 的抽选：${p.candidates.map(n=>'#'+(n+1)).join('、')} → #${p.index+1}`).join('\n');
  set('birth-selection-note',draws+'\n'+(view.parents[0].index===view.parents[1].index?'两次选中了同一辆车，所以 A、B 相同。这是合法结果，不伪造另一位父母。':'抽选允许重复，不保证抽到全场冠军。另有 2 辆精英车直接保留，不经过交叉。'));
  set('birth-legend',step===0?'实线 A · 虚线 B｜这是候选路线，不是已行驶轨迹':step===1?'路标来源：A 蓝点 / B 棕点｜中性连线是新组合':step===2?'虚线：未变异 · 绿线：最终后代 · 橙色：变异影响处':'A 蓝 · B 棕 · 未变异 灰虚线 · 最终后代 绿');
  $('birth-genome').hidden=step===0||step===3;
  $('birth-segment-control').hidden=step===3;$('birth-segment-detail').hidden=step===3;
  $('birth-genome').innerHTML=view.sources.map((source,i)=>{const changed=step>=2&&view.mutations.some(m=>m.index===i);return `<span class="gene-${source?'b':'a'}${changed?' gene-mutated':''}${i===segment?' gene-selected':''}">${source?'B':'A'}${changed?'·':''}</span>`;}).join('');
  set('birth-segment-number',String(segment+1));$('birth-segment').value=String(segment);
  const m=view.mutations.find(m=>m.index===segment),offset=g=>(g*(ROAD_RADIUS-CAR_RADIUS-3)).toFixed(1);
  const inherited=`第 ${segment+1} 个路标从 ${view.sources[segment]?'B':'A'} 继承`;
  set('birth-segment-detail',step===0?`父代 ${focusParent?'B':'A'} 的第 ${segment+1} 个路标：左右偏移 ${offset(view.parents[focusParent].genes[segment])} 单位。`:step===1?`${inherited}，左右偏移 ${offset(view.inherited[segment])} 单位。`: `${inherited}。${m?`变异使左右偏移从 ${offset(m.before)} 变成 ${offset(m.after)} 单位。`:'这个路标没有变异，保持继承的位置。'}${step===3?' 单点不是全部原因；下方比较的是所有变异合起来的效果。':''}`);
  $('birth-step-next').hidden=step===3;set('birth-step-next',['看它继承了什么 →','看看哪里变异了 →','一起跑一次，检验猜想 →'][step]||'');
  $('birth-playback').hidden=step!==3;
  set('birth-a-result',result(view.parents[0].run));set('birth-b-result',result(view.parents[1].run));
  set('birth-inherited-result',result(view.inheritedRun));set('birth-child-result',result(view.childRun));
  const best=view.parents[0].run.score>=view.parents[1].run.score?view.parents[0].run:view.parents[1].run;
  set('birth-inheritance-result',`继承这一步：相对表现更好的父代，${difference(best,view.inheritedRun)}。拼接优秀片段，也不一定拼出更好的整体。`);
  set('birth-mutation-result',`变异这一步：相对未变异路线，${difference(view.inheritedRun,view.childRun)}。${n?'这是 '+n+' 处变异的合计效果；改变一个点也会影响相邻转弯，不能把全部变化归给选中的一个点。':'因为没有发生变异，两条路线完全相同。'}`);
  updatePlayback();draw();
 }
 function choose(index){
  stop();view=inspectBirth(race,index);step=0;time=0;complete=false;focusParent=0;segment=view.mutations[0]?.index??0;
  set('birth-generation',`第 ${view.parentGeneration} 代 → 第 ${view.generation} 代 · 后代 #${index+1}`);render();
 }
 function stage(value){stop();step=value;render();$('birth-step-title').focus({preventScroll:true});}
 function finish(){stop();time=end();complete=true;render();}
 function schedule(){const version=token;raf=requestAnimationFrame(now=>{
  if(version!==token||!running||document.hidden||!dialog.open)return;raf=null;
  if(last!==null)time=Math.min(end(),time+Math.min(.1,(now-last)/1000)*4);last=now;
  if(time>=end()){finish();return;}updatePlayback();draw();schedule();
 });}
 for(let i=0;i<4;i++)$('birth-stage-'+i).addEventListener('click',()=>stage(i));
 $('birth-step-next').addEventListener('click',()=>stage(Math.min(3,step+1)));
 $('birth-child').addEventListener('change',()=>choose(Number($('birth-child').value)));
 for(const [id,i]of [['birth-parent-a',0],['birth-parent-b',1]])$(id).addEventListener('click',()=>{focusParent=i;render();});
 $('birth-segment').addEventListener('input',()=>{segment=Math.max(0,Math.min(23,Math.round(Number($('birth-segment').value)||0)));render();});
 $('birth-run').addEventListener('click',()=>{
  if(running){stop();render();return;}
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){finish();return;}
  if(time>=end())time=0;running=true;last=null;updatePlayback();schedule();
 });
 $('birth-finish').addEventListener('click',finish);
 $('birth-time').addEventListener('input',()=>{stop();time=Math.max(0,Math.min(end(),Number($('birth-time').value)||0));if(time>=end())complete=true;render();});
 $('birth-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{stop();$('inspect-birth').focus({preventScroll:true});});
 dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){stop();render();}});
 window.addEventListener('pagehide',stop);
 matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',e=>{if(e.matches&&dialog.open){stop();render();}});
 return {open(current){race=current;choose(2);$('birth-child').innerHTML=race.births.map((b,i)=>b.kind==='child'?`<option value="${i}">后代 #${i+1}</option>`:'').join('');$('birth-child').value='2';dialog.showModal();draw();$('birth-close').focus({preventScroll:true});}};
}
