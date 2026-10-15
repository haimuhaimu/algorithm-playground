import {TAU,createSwarm,stepSwarm,coherence,configureSwarm,perturbSwarm} from './firefly-core.mjs';

const $=id=>document.getElementById(id),field=$('fireflies'),ctx=field.getContext('2d');
const clock=$('phase-clock').getContext('2d'),chart=$('history').getContext('2d');
const titles={chorus:'一起合拍',independent:'各闪各的',islands:'两群对唱'};
const tips={chorus:'先等它们合拍，再点乱一小片。它们会自己找回节奏吗？',independent:'互相影响是 0。试着点亮一片，再把影响调大，看看区别。',islands:'两群可以各自合拍。把「看见多远」拉到整片，看看它们能不能找到共同节奏。'};
let world=createSwarm(),mode='scatter',playing=!document.hidden&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
let cursor={x:0.5,y:0.5},showCursor=false,gesture=null,raf=null,last=null,accumulator=0;
let history=[{t:0,r:coherence(world.points)}],lastSample=0,ink='#25271f',muted='#66695d',line='#dddfd2';
const DT=1/60,BRUSH=0.22;

if(!ctx||!clock||!chart){
 document.querySelector('.habitat').innerHTML='<p class="chorus-error" role="alert">这个浏览器暂时无法绘制画布。请换用支持 Canvas 的浏览器体验，其他实验仍可从上方进入。</p>';
 document.querySelector('.chorus-controls').hidden=true;
}else{
 function controls(message){
  $('play').textContent=playing?'暂停':'继续';$('play').setAttribute('aria-pressed',String(playing));
  $('play-status').textContent=message||(playing?'运行中 · 点按可以干预':'已暂停 · 仍可点按，或走一拍');
  $('habitat-label').textContent=titles[world.preset];$('scene-tip').textContent=tips[world.preset];
  for(const key of ['coupling','radius','spread']){
   $(key).value=world.settings[key];
   $(key+'-value').textContent=key==='radius'?(world.settings[key]>=1.9?'整片':world.settings[key].toFixed(2)):world.settings[key].toFixed(key==='coupling'?1:2);
  }
  const defaults=createSwarm(world.preset).settings;
  const untouched=Object.keys(defaults).every(key=>defaults[key]===world.settings[key]);
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(untouched&&b.dataset.preset===world.preset)));
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  $('field-caption').textContent=mode==='scatter'?'点一下，把附近的节拍打乱':'点一下，让附近的节拍在此刻亮起';
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
  for(const p of world.points){
   const x=p.x*W,y=p.y*H,glow=((1+Math.cos(p.phase))/2)**8;
   const radius=11+glow*27,g=ctx.createRadialGradient(x,y,0,x,y,radius);
   g.addColorStop(0,`rgba(223,237,130,${0.1+glow*.45})`);g.addColorStop(1,'rgba(223,237,130,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();
   ctx.fillStyle=`rgba(226,238,143,${0.22+glow*.78})`;ctx.beginPath();ctx.ellipse(x,y,3+glow*1.4,2+glow*1.1,-.6,0,TAU);ctx.fill();
   ctx.strokeStyle=`rgba(211,225,179,${.12+glow*.3})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-5,y-3);ctx.lineTo(x,y);ctx.lineTo(x+5,y-3);ctx.stroke();
   if(showPhase){ctx.lineWidth=1.5;ctx.strokeStyle='#b8c79a99';ctx.beginPath();ctx.arc(x,y,9,-Math.PI/2,p.phase-Math.PI/2);ctx.stroke();}
  }
  const r=coherence(world.points);
  $('coherence').innerHTML=Math.round(r*100)+'<small>%</small>';
  $('coherence-label').textContent=r>.9?'节拍很接近':r>.5?'部分合拍':'各有节奏';
  $('elapsed').textContent=world.time.toFixed(1)+' 秒';
  clock.clearRect(0,0,180,180);clock.strokeStyle=line;clock.lineWidth=2;clock.beginPath();clock.arc(90,90,66,0,TAU);clock.stroke();
  let mx=0,my=0;
  for(const p of world.points){const x=Math.sin(p.phase),y=-Math.cos(p.phase);mx+=x;my+=y;clock.fillStyle=muted;clock.beginPath();clock.arc(90+x*66,90+y*66,3,0,TAU);clock.fill();}
  clock.strokeStyle=ink;clock.lineWidth=3;clock.beginPath();clock.moveTo(90,90);clock.lineTo(90+mx/world.points.length*66,90+my/world.points.length*66);clock.stroke();
  chart.clearRect(0,0,600,120);chart.strokeStyle=line;chart.lineWidth=1;chart.beginPath();chart.moveTo(0,110);chart.lineTo(600,110);chart.moveTo(0,10);chart.lineTo(600,10);chart.stroke();
  chart.strokeStyle=ink;chart.lineWidth=2.5;chart.beginPath();
  const start=Math.max(0,world.time-30),span=30;
  history.forEach((p,i)=>{const x=(p.t-start)/span*600,y=110-p.r*100;if(i===0)chart.moveTo(x,y);else chart.lineTo(x,y);});chart.stroke();
  chart.fillStyle=ink;chart.beginPath();chart.arc((world.time-start)/span*600,110-r*100,3,0,TAU);chart.fill();
 }
 function sample(){
  if(world.time-lastSample>=.2-1e-8){history.push({t:world.time,r:coherence(world.points)});lastSample=world.time;history=history.filter(p=>p.t>=world.time-30);}
 }
 function schedule(){if(playing&&!document.hidden&&raf===null)raf=requestAnimationFrame(frame);}
 function frame(now){
  raf=null;if(!playing||document.hidden)return;
  if(last!==null)accumulator+=Math.min(.1,(now-last)/1000);last=now;
  while(accumulator>=DT){world=stepSwarm(world,DT);accumulator-=DT;sample();}
  draw();schedule();
 }
 function cancelGesture(){gesture=null;}
 function pause(message){playing=false;cancelGesture();if(raf!==null)cancelAnimationFrame(raf);raf=null;last=null;accumulator=0;controls(message);draw();}
 function announceCursor(){ $('cursor-status').textContent=`光标横向 ${Math.round(cursor.x*100)}%，纵向 ${Math.round(cursor.y*100)}%，${mode==='scatter'?'打乱一片':'点亮一片'}`; }
 function apply(){
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
  cancelGesture();const next=createSwarm(preset,shuffle?world.seed+1:42),settings=world.settings;
  world=shuffle?{...next,points:world.points.map((p,i)=>({...p,phase:next.points[i].phase}))}:next;
  if(preserve)world=configureSwarm(world,settings);
  history=[{t:0,r:coherence(world.points)}];lastSample=0;last=null;accumulator=0;showCursor=false;
  $('interaction-status').textContent=shuffle?'换了一组初始节拍。':'场景已重置。';controls();draw();schedule();
 }
 document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>reset(b.dataset.preset)));
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{cancelGesture();mode=b.dataset.mode;controls();announceCursor();draw();}));
 for(const key of ['coupling','radius','spread'])$(key).addEventListener('input',()=>{cancelGesture();world=configureSwarm(world,{[key]:Number($(key).value)});controls();draw();});
 $('show-phase').addEventListener('change',draw);
 $('play').addEventListener('click',()=>{if(playing)pause();else{playing=true;last=null;accumulator=0;controls();schedule();}});
 $('step').addEventListener('click',()=>{pause();world=stepSwarm(world);sample();controls('已走一拍 · 推进 1/60 秒');draw();});
 $('reset').addEventListener('click',()=>reset(world.preset,false,true));$('shuffle').addEventListener('click',()=>reset(world.preset,true,true));
 $('about').addEventListener('click',()=>{pause();$('guide').showModal();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('页面离开后已暂停 · 点继续恢复');});
 window.addEventListener('pagehide',()=>pause());window.addEventListener('blur',cancelGesture);
 const motion=matchMedia('(prefers-reduced-motion:reduce)');motion.addEventListener('change',e=>{if(e.matches)pause('已按减少动画偏好暂停');});
 const theme=matchMedia('(prefers-color-scheme:dark)');let explicitTheme=false;
 function setTheme(dark){document.documentElement.dataset.theme=dark?'dark':'light';$('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');const css=getComputedStyle(document.documentElement);ink=css.getPropertyValue('--ink');muted=css.getPropertyValue('--muted');line=css.getPropertyValue('--line');draw();}
 theme.addEventListener('change',e=>{if(!explicitTheme)setTheme(e.matches);});$('theme').addEventListener('click',()=>{explicitTheme=true;setTheme(document.documentElement.dataset.theme!=='dark');});
 controls();setTheme(theme.matches);schedule();
}
