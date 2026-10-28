import {TAU,createSwarm,stepSwarm,coherence,configureSwarm,perturbSwarm,measureGroups,createListening,advanceListening,chooseListening,listeningOutcome,answerListening} from './firefly-core.mjs?v=one-beat-1';
import {mountBeatLesson} from './firefly-beat-ui.mjs?v=one-beat-1';

const $=id=>document.getElementById(id),field=$('fireflies'),ctx=field.getContext('2d');
const clock=$('phase-clock').getContext('2d'),chart=$('history').getContext('2d');
const titles={chorus:'一起合拍',independent:'各闪各的',islands:'两群对唱'};
const tips={chorus:'先等它们合拍，再点乱一小片。它们会自己找回节奏吗？',independent:'互相影响是 0。试着点亮一片，再把影响调大，看看区别。',islands:'两群可以各自合拍。把「看见多远」拉到整片，看看它们能不能找到共同节奏。'};
let world=createSwarm(),mode='scatter',playing=!document.hidden&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
let cursor={x:0.5,y:0.5},showCursor=false,gesture=null,raf=null,last=null,accumulator=0;
let history=[{t:0,r:coherence(world.points)}],lastSample=0,ink='#25271f',muted='#66695d',line='#dddfd2';
let lesson=null,lessonRenderKey='';
const DT=1/60,BRUSH=0.22;

if(!ctx||!clock||!chart){
 document.querySelector('.habitat').innerHTML='<p class="chorus-error" role="alert">这个浏览器暂时无法绘制画布。请换用支持 Canvas 的浏览器体验，其他实验仍可从上方进入。</p>';
 document.querySelector('.chorus-controls').hidden=true;
}else{
 function controls(message){
  const locked=Boolean(lesson),atStop=locked&&['before','after'].includes(lesson.stage);
  for(const id of ['coupling','radius','spread','shuffle','reset'])$(id).disabled=locked;
  $('play').disabled=atStop;$('step').disabled=atStop;
  $('play').textContent=playing?'暂停':'继续';$('play').setAttribute('aria-pressed',String(playing));
  $('play-status').textContent=message||(locked?(playing?'引导运行中 · 可暂停观察':'引导已暂停 · 按本轮提示继续'):(playing?'运行中 · 点按可以干预':'已暂停 · 仍可点按，或走一拍'));
  $('habitat-label').textContent=titles[world.preset];$('scene-tip').textContent=locked?'本轮固定其他参数。上方选择听见的范围，下方保留同一批萤火的前后证据。':tips[world.preset];
  for(const key of ['coupling','radius','spread']){
   $(key).value=world.settings[key];
   $(key+'-value').textContent=key==='radius'?(world.settings[key]>=1.9?'整片':world.settings[key].toFixed(2)):world.settings[key].toFixed(key==='coupling'?1:2);
  }
  const defaults=createSwarm(world.preset).settings;
  const untouched=Object.keys(defaults).every(key=>defaults[key]===world.settings[key]);
  document.querySelectorAll('[data-preset]').forEach(b=>{b.disabled=locked;b.setAttribute('aria-pressed',String(untouched&&b.dataset.preset===world.preset));});
  document.querySelectorAll('[data-mode]').forEach(b=>{b.disabled=locked;b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
  $('field-caption').textContent=locked?'青绿是左群，暖黄是右群。观察内部整齐与两群错开的区别。':mode==='scatter'?'点一下，把附近的节拍打乱':'点一下，让附近的节拍在此刻亮起';
 }
 const percent=value=>Math.round(value*100)+'%';
 function focusLesson(){
  const id=!lesson?'listening-start':lesson.stage==='before'?'listening-wide':lesson.stage==='after'?'comparison-title':'listening-fast';
  $(id).focus();
 }
 function evidenceCard(snapshot,title){
  const m=snapshot.metrics;
  return `<h3>${title}</h3><p class="snapshot-time">模拟第 ${snapshot.world.time.toFixed(0)} 秒 · 已封存</p><dl><div><dt>左群内部</dt><dd>${percent(m.left)}</dd></div><div><dt>右群内部</dt><dd>${percent(m.right)}</dd></div><div class="whole-row"><dt>整体合拍度</dt><dd>${percent(m.whole)}</dd></div><div><dt>两群节拍错开</dt><dd>${m.gap===null?'暂不可比':Math.round(m.gap)+'°'}</dd></div><div><dt>跨群影响</dt><dd>${m.links?'已连通':'未连通'}</dd></div><div><dt>最近 3 秒整体范围</dt><dd>${percent(snapshot.range.min)}–${percent(snapshot.range.max)}</dd></div></dl>`;
 }
 function drawLesson(){
  const stage=lesson?.stage||'idle',busy=['observing','comparing'].includes(stage);
  const status=busy?`${playing?'正在运行':'已暂停'} · ${stage==='observing'?'观察各自合拍':'观察你的选择'} ${Math.floor(Math.min(lesson.ticks/60,stage==='observing'?15:10))} / ${stage==='observing'?15:10} 秒。可看动画，也可快进实际模拟。`:'';
  if($('listening-status').textContent!==status)$('listening-status').textContent=status;
  const key=stage+':'+lesson?.choice+':'+lesson?.answer?.choice;
  if(key===lessonRenderKey)return;lessonRenderKey=key;
  const wasFastFocused=document.activeElement===$('listening-fast');
  $('listening-lesson').dataset.stage=stage;
  document.documentElement.dataset.listening=stage==='idle'?'free':'guided';
  $('listening-start').hidden=stage!=='idle'&&stage!=='after';
  $('listening-start').textContent=stage==='after'?'重开两群实验':'开始两群实验';
  $('listening-exit').hidden=stage==='idle';$('listening-fast').hidden=!busy;$('listening-fast').disabled=!busy;
  $('listening-evidence-link').hidden=!lesson?.before;$('listening-jumps').hidden=stage==='idle';$('listening-result-jump').hidden=!lesson?.before;
  for(const id of ['listening-wide','listening-near']){$(id).hidden=!['before','after'].includes(stage);$(id).disabled=!['before','after'].includes(stage);}
  $('listening-wide').textContent=stage==='after'?'从同一起点：互相听见':'让两群互相听见';
  $('listening-near').textContent=stage==='after'?'从同一起点：只听身边':'仍然只听身边';
  const titles={idle:'让两群互相听见',observing:'先看：各自找到节拍',before:'各自很齐了。要让两群互相听见吗？',comparing:lesson?.choice==='wide'?'范围打开了，看它们怎么靠近':'保留小范围，看看会不会一直同拍',after:'对照已经留下，再做一次判断'};
  const instructions={idle:'先看它们各自找到节拍，再由你决定要不要让两群相互影响。没有指挥，也不需要刷到 100%。',observing:'左右各 40 个亮点，只影响身边的小伙伴。留意：内部整齐时，两群不一定同时亮。到第 15 秒会自动暂停。',before:'调整前已封存。下面两种选择只改变听见的范围，不重抽萤火虫，也不改变它们天生的节奏。',comparing:'再运行 10 秒。左群是青绿，右群是暖黄；连线只示意部分真实邻居。没有预设的合拍结果。',after:'下方保留调整前后和最近 3 秒的范围。也可以从完全相同的起点试另一种选择。'};
  $('listening-title').textContent=titles[stage];$('listening-instruction').textContent=instructions[stage];
  $('listening-stage').textContent=stage==='idle'?'一次小实验 · 约半分钟':stage==='observing'?'01 / 03 · 先观察':stage==='before'||stage==='comparing'?'02 / 03 · 你来改变连接':'03 / 03 · 看证据，作判断';
  $('listening-comparison').hidden=!lesson?.before;$('listening-quiz').hidden=stage!=='after';
  $('listening-answer').textContent='';$('listening-answer').dataset.correct='';$('listening-takeaway').hidden=true;
  if(!lesson?.before)return;
  $('comparison-before').innerHTML=evidenceCard(lesson.before,'调整前 · 只听身边');
  $('comparison-after').innerHTML=lesson.after?evidenceCard(lesson.after,lesson.choice==='wide'?'调整后 · 互相听见':'对照组 · 仍只听身边'):'<h3>调整后 · 等你决定</h3><p>选择一种听见的范围，运行 10 秒后留下结果。</p>';
  $('comparison-context').textContent=lesson.choice?`只将范围 ${lesson.choice==='wide'?'从 0.32 改为 2.00':'保留在 0.32'}；互相影响 2.4、天生节奏差 0.60 均未改变。`:'调整前已暂停在第 15 秒；左、右群的记录不会随接下来的运行变化。';
  const outcome=listeningOutcome(lesson);$('listening-comparison').dataset.outcome=outcome||'pending';
  const explanation={joined:'现在不只是各自整齐：跨群影响连通后，整体合拍度在最后 3 秒里持续接近 98%。两群找到了稳定的节拍关系，但仍有少量错开，不是所有节拍完全一样。',separate:'看似高分，不一定是持续合拍。两群仍未相互影响，最后 3 秒整体分数大幅起伏；此刻碰巧靠近，随后还会错开。两群内部却一直可以很整齐。',unsettled:'这次观察尚未形成稳定的整体节拍。连接提供相互调整的机会，不保证任何参数、任何时刻都同步。请以实际记录为准。'};
  $('comparison-explanation').textContent=explanation[outcome]||'先分别看左右两群，再看整体。它们衡量的不是同一件事。';
  if(lesson.answer){
   $('listening-answer').dataset.correct=String(lesson.answer.correct);
   $('listening-answer').textContent=lesson.answer.correct?'对：调整前左右群内部都接近 100%，只是两群彼此错开。整体 21% 不是「21% 的个体合拍」。':'再看调整前的两列内部指标：它们都接近 100%。低的是整体分数，问题不在群内，而在两群之间。可以再选一次。';
   $('listening-takeaway').hidden=!lesson.answer.correct;
   $('listening-ending').textContent=outcome==='joined'?'你这次只打开了连接，就看到了整体节拍关系稳定下来。可以再试「只听身边」，比较偶然同拍与持续合拍。':'你这次保留了小范围，发现总分即使暂时很高，也不能证明两群一直同拍。再试「互相听见」，检验连接的作用。';
  }
  if(wasFastFocused&&!busy)focusLesson();
 }
 function draw(){
  const W=field.width,H=field.height;
  const bg=ctx.createRadialGradient(W*.5,H*.5,0,W*.5,H*.5,W*.7);bg.addColorStop(0,'#223a29');bg.addColorStop(1,'#102119');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  // The radius overlay uses the exact same 1.6:1 geometry as the model.
  if(showCursor){
   ctx.strokeStyle='#b6c9a14d';ctx.fillStyle='#cfdf9b08';ctx.lineWidth=1;
   ctx.beginPath();ctx.arc(cursor.x*W,cursor.y*H,world.settings.radius*H,0,TAU);ctx.fill();ctx.stroke();
   ctx.setLineDash([4,5]);ctx.strokeStyle='#e1ec9da0';ctx.beginPath();ctx.arc(cursor.x*W,cursor.y*H,BRUSH*H,0,TAU);ctx.stroke();ctx.setLineDash([]);
  }
  const showPhase=$('show-phase').checked;
  const groups=measureGroups(world);
  if(groups){
   ctx.font=`${Math.max(16,11*W/(field.clientWidth||W))}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#9de3c2';ctx.fillText('左群 · 40 个节拍',W*.22,40);ctx.fillStyle='#f4d38b';ctx.fillText('右群 · 40 个节拍',W*.78,40);
   if(groups.links){
    ctx.strokeStyle='#adcaae40';ctx.lineWidth=1;
    const left=world.points.filter(p=>p.x<.5),right=world.points.filter(p=>p.x>=.5);
    for(let i=0;i<left.length;i+=5){
     const p=left[i],q=right[(i+7)%right.length];
     if(q&&((p.x-q.x)*1.6)**2+(p.y-q.y)**2<=world.settings.radius**2){ctx.beginPath();ctx.moveTo(p.x*W,p.y*H);ctx.lineTo(q.x*W,q.y*H);ctx.stroke();}
    }
   }
  }
  for(const p of world.points){
   const x=p.x*W,y=p.y*H,glow=((1+Math.cos(p.phase))/2)**8;
   const color=groups?(p.x<.5?'157,227,194':'244,211,139'):'223,237,130';
   const radius=11+glow*27,g=ctx.createRadialGradient(x,y,0,x,y,radius);
   g.addColorStop(0,`rgba(${color},${0.1+glow*.45})`);g.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();
   ctx.fillStyle=`rgba(${color},${0.22+glow*.78})`;ctx.beginPath();ctx.ellipse(x,y,3+glow*1.4,2+glow*1.1,-.6,0,TAU);ctx.fill();
   ctx.strokeStyle=`rgba(211,225,179,${.12+glow*.3})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-5,y-3);ctx.lineTo(x,y);ctx.lineTo(x+5,y-3);ctx.stroke();
   if(showPhase){ctx.lineWidth=1.5;ctx.strokeStyle=`rgba(${color},.65)`;ctx.beginPath();ctx.arc(x,y,9,-Math.PI/2,p.phase-Math.PI/2);ctx.stroke();}
  }
  const r=coherence(world.points);
  $('coherence').innerHTML=Math.round(r*100)+'<small>%</small>';
  $('coherence-label').textContent=groups?'瞬时整体值，不代表持续同拍':r>.9?'节拍很接近':r>.5?'部分合拍':'各有节奏';
  $('group-readout').hidden=!groups;
  if(groups){
   $('left-coherence').textContent=percent(groups.left);$('right-coherence').textContent=percent(groups.right);
   $('group-gap').textContent=groups.gap===null?'暂不可比':Math.round(groups.gap)+'°';
   $('group-message').textContent=groups.links?`两群之间已连通 · ${groups.links} 对跨群邻居互相影响。看整体能否持续稳定。`:'两群之间还没连通。各自整齐，不等于两群同一拍。';
  }
  $('elapsed').textContent=world.time.toFixed(1)+' 秒';
  clock.clearRect(0,0,180,180);clock.strokeStyle=line;clock.lineWidth=2;clock.beginPath();clock.arc(90,90,66,0,TAU);clock.stroke();
  let mx=0,my=0;
  for(const p of world.points){const x=Math.sin(p.phase),y=-Math.cos(p.phase);mx+=x;my+=y;clock.fillStyle=groups?(p.x<.5?'#49a37e':'#be8b2d'):muted;clock.beginPath();clock.arc(90+x*66,90+y*66,3,0,TAU);clock.fill();}
  clock.strokeStyle=ink;clock.lineWidth=3;clock.beginPath();clock.moveTo(90,90);clock.lineTo(90+mx/world.points.length*66,90+my/world.points.length*66);clock.stroke();
  chart.clearRect(0,0,600,120);chart.strokeStyle=line;chart.lineWidth=1;chart.beginPath();chart.moveTo(0,110);chart.lineTo(600,110);chart.moveTo(0,10);chart.lineTo(600,10);chart.stroke();
  chart.strokeStyle=ink;chart.lineWidth=2.5;chart.beginPath();
  const start=Math.max(0,world.time-30),span=30;
  history.forEach((p,i)=>{const x=(p.t-start)/span*600,y=110-p.r*100;if(i===0)chart.moveTo(x,y);else chart.lineTo(x,y);});chart.stroke();
  chart.fillStyle=ink;chart.beginPath();chart.arc((world.time-start)/span*600,110-r*100,3,0,TAU);chart.fill();
  drawLesson();
 }
 function sample(){
  if(world.time-lastSample>=.2-1e-8){history.push({t:world.time,r:coherence(world.points)});lastSample=world.time;history=history.filter(p=>p.t>=world.time-30);}
 }
 function schedule(){if(playing&&!document.hidden&&raf===null)raf=requestAnimationFrame(frame);}
 function tick(){
  if(lesson){
   const previous=lesson.stage;lesson=advanceListening(lesson);world=lesson.world;
   if(previous!==lesson.stage){playing=false;last=null;controls('观察点已暂停 · 上方选择下一步，下方保留证据');}
  }else world=stepSwarm(world,DT);
  sample();
 }
 function frame(now){
  raf=null;if(!playing||document.hidden)return;
  if(last!==null)accumulator+=Math.min(.1,(now-last)/1000);last=now;
  while(accumulator>=DT&&playing){tick();accumulator-=DT;}
  draw();schedule();
 }
 function cancelGesture(){gesture=null;}
 function pause(message){document.dispatchEvent(new Event('firefly-world-action'));playing=false;cancelGesture();if(raf!==null)cancelAnimationFrame(raf);raf=null;last=null;accumulator=0;controls(message);draw();}
 function announceCursor(){ $('cursor-status').textContent=`光标横向 ${Math.round(cursor.x*100)}%，纵向 ${Math.round(cursor.y*100)}%，${mode==='scatter'?'打乱一片':'点亮一片'}`; }
 function apply(){
  if(lesson){$('interaction-status').textContent='引导中只比较听见的范围；退出引导后可自由点乱。';return;}
  const count=world.points.filter(p=>((p.x-cursor.x)*1.6)**2+(p.y-cursor.y)**2<=BRUSH**2).length;
  world=perturbSwarm(world,cursor,mode,BRUSH);
  $('interaction-status').textContent=count?`${mode==='scatter'?'打乱':'点亮'}了 ${count} 个节拍。`:'这里没有萤火虫，试试点亮点附近。';
  // Record the discontinuity at the current simulation time, also while paused.
  history.push({t:world.time,r:coherence(world.points)});history=history.slice(-600);draw();announceCursor();
 }
 function point(e){const r=field.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
 field.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};});
 field.addEventListener('pointermove',e=>{
  if(gesture&&e.pointerId===gesture.id&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8)gesture.moved=true;
  if(e.pointerType==='mouse'){cursor=point(e);showCursor=true;draw();}
 });
 field.addEventListener('pointerup',e=>{
  if(!gesture||gesture.id!==e.pointerId)return;
  const tap=!gesture.moved&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<=8;cancelGesture();
  if(!tap)return;cursor=point(e);showCursor=e.pointerType==='mouse';field.focus({preventScroll:true});apply();
 });
 field.addEventListener('pointercancel',cancelGesture);field.addEventListener('pointerleave',()=>{cancelGesture();showCursor=false;draw();});
 field.addEventListener('blur',()=>{cancelGesture();showCursor=false;draw();});
 field.addEventListener('focus',()=>{showCursor=true;announceCursor();draw();});
 field.addEventListener('keydown',e=>{
  const directions={ArrowLeft:[-.03,0],ArrowRight:[.03,0],ArrowUp:[0,-.03],ArrowDown:[0,.03]},d=directions[e.key];
  if(d){e.preventDefault();cursor={x:Math.max(0,Math.min(1,cursor.x+d[0])),y:Math.max(0,Math.min(1,cursor.y+d[1]))};showCursor=true;announceCursor();draw();}
  else if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)apply();}
  else if(e.key==='1'||e.key==='2'){e.preventDefault();mode=e.key==='1'?'scatter':'align';controls();announceCursor();draw();}
 });
 function reset(preset,shuffle=false,preserve=false){
  if(lesson)return;
  cancelGesture();const next=createSwarm(preset,shuffle?world.seed+1:42),settings=world.settings;
  world=shuffle?{...next,points:world.points.map((p,i)=>({...p,phase:next.points[i].phase}))}:next;
  if(preserve)world=configureSwarm(world,settings);
  history=[{t:0,r:coherence(world.points)}];lastSample=0;last=null;accumulator=0;showCursor=false;
  $('interaction-status').textContent=shuffle?'换了一组初始节拍。':'场景已重置。';controls();draw();schedule();
 }
 document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>reset(b.dataset.preset)));
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{cancelGesture();mode=b.dataset.mode;controls();announceCursor();draw();}));
 for(const key of ['coupling','radius','spread'])$(key).addEventListener('input',()=>{if(lesson)return;cancelGesture();world=configureSwarm(world,{[key]:Number($(key).value)});controls();draw();});
 $('show-phase').addEventListener('change',draw);
 $('play').addEventListener('click',()=>{if(lesson&&['before','after'].includes(lesson.stage))return;document.dispatchEvent(new Event('firefly-world-action'));if(playing)pause();else{playing=true;last=null;accumulator=0;controls();schedule();}});
 $('step').addEventListener('click',()=>{if(lesson&&['before','after'].includes(lesson.stage))return;pause();tick();controls('已走一拍 · 推进 1/60 秒');draw();});
 function adoptLesson(){
  world=lesson.world;history=lesson.samples.map(s=>({t:s.time,r:s.value}));lastSample=world.time;last=null;accumulator=0;showCursor=false;
  $('show-phase').checked=true;$('interaction-status').textContent='引导中固定其他条件，只比较两群听见的范围。';
 }
 $('listening-start').addEventListener('click',()=>{pause();lesson=createListening();adoptLesson();playing=!document.hidden;controls();draw();focusLesson();schedule();});
 for(const [id,choice] of [['listening-wide','wide'],['listening-near','near']])$(id).addEventListener('click',()=>{
  if(!lesson||!['before','after'].includes(lesson.stage))return;
  pause();lesson=chooseListening(lesson,choice);adoptLesson();playing=!document.hidden;controls();draw();focusLesson();schedule();
 });
 $('listening-fast').addEventListener('click',()=>{
  if(!lesson||!['observing','comparing'].includes(lesson.stage))return;
  pause();lesson=advanceListening(lesson,900);adoptLesson();controls('实际模拟已快进到观察点 · 已暂停');draw();focusLesson();
 });
 $('listening-exit').addEventListener('click',()=>{pause();lesson=null;lessonRenderKey='';$('interaction-status').textContent='已退出引导并清除对照，当前节拍保留，可自由探索。';controls();draw();focusLesson();});
 for(const choice of ['separate','chaotic','everyone'])$('answer-'+choice).addEventListener('click',()=>{
  if(lesson?.stage!=='after')return;lesson=answerListening(lesson,choice);draw();
 });
 $('reset').addEventListener('click',()=>reset(world.preset,false,true));$('shuffle').addEventListener('click',()=>reset(world.preset,true,true));
 $('about').addEventListener('click',()=>{pause();$('guide').showModal();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('页面离开后已暂停 · 点继续恢复');});
 window.addEventListener('pagehide',()=>pause());window.addEventListener('blur',cancelGesture);window.addEventListener('resize',draw);
 const motion=matchMedia('(prefers-reduced-motion:reduce)');motion.addEventListener('change',e=>{if(e.matches)pause('已按减少动画偏好暂停');});
 const theme=matchMedia('(prefers-color-scheme:dark)');let explicitTheme=false;
 function setTheme(dark){document.documentElement.dataset.theme=dark?'dark':'light';$('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');const css=getComputedStyle(document.documentElement);ink=css.getPropertyValue('--ink');muted=css.getPropertyValue('--muted');line=css.getPropertyValue('--line');draw();}
 theme.addEventListener('change',e=>{if(!explicitTheme)setTheme(e.matches);});$('theme').addEventListener('click',()=>{explicitTheme=true;setTheme(document.documentElement.dataset.theme!=='dark');});
 mountBeatLesson({onStart:()=>pause('放大观察一只时已暂停 · 原场景与两群证据保留')});
 controls();setTheme(theme.matches);schedule();
}
