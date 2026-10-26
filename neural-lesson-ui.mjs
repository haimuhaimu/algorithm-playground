import {EXAMPLES,createLesson,selectExample,advanceLesson,probesFor,evidence} from './neural-lesson.mjs';
import {predict} from './neural-core.mjs';

const shape=p=>p>=.5?'方':'圆';
const percent=p=>(p*100).toFixed(1)+'%';
const deltaText=d=>Math.abs(d)<.05?'变化不到 0.1 个百分点':`${d>0?'上升':'下降'} ${Math.abs(d).toFixed(1)} 个百分点`;

function paint(canvas,s,side,dark,overlay){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const w=canvas.width,h=canvas.height,nx=60,ny=40,cw=w/nx,ch=h/ny,model=s[side];
 const ink=dark?'#f5efe3':'#302e29',paper=dark?'#222622':'#fcfaf4';
 const pos=p=>[(p.x+1)*w/2,(1-p.y)*h/2];
 const grid=m=>Array.from({length:ny},(_,y)=>Array.from({length:nx},(_,x)=>predict(m,(x+.5)/nx*2-1,1-(y+.5)/ny*2)));
 ctx.clearRect(0,0,w,h);ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
 let values;
 if(model.epoch){
  values=grid(model);
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   const p=values[y][x];ctx.fillStyle=`rgba(${p>=.5?'65,156,155':'220,114,95'},${.08+Math.abs(p-.5)*(dark?.65:.48)})`;ctx.fillRect(x*cw,y*ch,cw,ch);
  }
 }
 ctx.strokeStyle=dark?'#444a43':'#e2dfd5';ctx.lineWidth=1;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();ctx.setLineDash([]);
 function boundary(v,dashed){
  ctx.strokeStyle=ink;ctx.lineWidth=dashed?2:2.5;ctx.setLineDash(dashed?[7,5]:[]);ctx.globalAlpha=dashed?.6:.85;ctx.beginPath();
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   if(x&&((v[y][x]>=.5)!==(v[y][x-1]>=.5))){ctx.moveTo(x*cw,y*ch);ctx.lineTo(x*cw,(y+1)*ch);}
   if(y&&((v[y][x]>=.5)!==(v[y-1][x]>=.5))){ctx.moveTo(x*cw,y*ch);ctx.lineTo((x+1)*cw,y*ch);}
  }ctx.stroke();ctx.globalAlpha=1;ctx.setLineDash([]);
 }
 if(side==='after'&&model.epoch===500&&overlay)boundary(grid(s.before),true);
 if(values)boundary(values,false);
 for(const [i,p] of (side==='before'?s.original:s.changed).entries()){
  const [x,y]=pos(p);ctx.fillStyle=p.label?'#287d7c':'#bb5141';ctx.strokeStyle=paper;ctx.lineWidth=1.5;
  ctx.beginPath();if(p.label)ctx.rect(x-4.5,y-4.5,9,9);else ctx.arc(x,y,4.7,0,Math.PI*2);ctx.fill();ctx.stroke();
  const choice=EXAMPLES.find(c=>c.index===i);
  if(choice&&choice.id!==s.choice.id){ctx.fillStyle=ink;ctx.font='600 20px system-ui';ctx.fillText(String(EXAMPLES.indexOf(choice)+1),x+9,y+5);}
 }
 for(const p of probesFor(s)){
  const [x,y]=pos(p);ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle=ink;ctx.fillRect(x+12,y-30,30,28);ctx.fillStyle=paper;ctx.font='bold 20px system-ui';ctx.textAlign='center';ctx.fillText(p.id,x+27,y-9);ctx.textAlign='start';
 }
}

export function mountLabelLesson({document,window,schedule=callback=>requestAnimationFrame(callback)}){
 const $=id=>document.getElementById(id);
 let lesson=createLesson(),running=null,token=0;
 const set=(id,text)=>{$(id).textContent=text;};
 function clearJudgment(){set('label-judgment','');for(const id of ['local','shared'])$('label-answer-'+id).setAttribute('aria-pressed','false');}
 function render(){
  const ready=lesson.before.epoch===500,done=lesson.after.epoch===500;
  $('label-before-run').disabled=ready||!!running;
  set('label-before-run',ready?'正常分界已留档':lesson.before.epoch?'继续正常训练':'1 · 先正常训练 500 步');
  $('label-after-run').disabled=!ready||done||!!running;
  set('label-after-run',done?'本轮对照完成':lesson.after.epoch?'继续改标签后的训练':'2 · 换这个标签，再训 500 步');
  $('label-pause').disabled=!running;
  for(const c of EXAMPLES){$('label-choice-'+c.id).setAttribute('aria-pressed',String(c.id===lesson.choice.id));$('label-choice-'+c.id).disabled=running==='before';}
  set('label-change',`${lesson.choice.title}：${lesson.choice.hint}。选中的点记作 A；只改标签，不挪位置，另外 47 个点不变。`);
  set('label-before-state',ready?'500 / 500 步 · 原始标签 · 已留档':`${lesson.before.epoch} / 500 步 · ${running==='before'?'正在训练':'等待训练'}`);
  set('label-after-state',`${lesson.after.epoch} / 500 步 · ${done?'改标签后的结果':running==='after'?'从同一起点训练中':'尚无完成的对照'}`);
  set('label-after-name',`改后 · ${lesson.choice.title.slice(2)}`);
  $('label-result').hidden=!done;$('label-overlay').disabled=!done;
  const dark=document.documentElement.dataset.theme==='dark';
  paint($('label-before-canvas'),lesson,'before',dark,false);paint($('label-after-canvas'),lesson,'after',dark,$('label-overlay').checked);
  const record=evidence(lesson);
  if(!record){
   for(const id of ['label-probe-A','label-probe-B','label-probe-C','label-summary','label-reason'])set(id,'');
  }else{
   for(const p of record.probes){
    const verdict=p.flipped?`${shape(p.before)} → ${shape(p.after)}`:`仍判为${shape(p.after)}`;
    set('label-probe-'+p.id,`${p.id} · ${p.name}：方倾向 ${percent(p.before)} → ${percent(p.after)}，${deltaText(p.delta)}；${verdict}。`);
    $('label-meter-'+p.id+'-before').style.width=percent(p.before);$('label-meter-'+p.id+'-after').style.width=percent(p.after);
   }
   const flips=record.probes.filter(p=>p.flipped).length;
   set('label-summary',flips?`3 个观察位置中，${flips} 处改判。并非每个观察点都改判，影响也不一定只停在 A。`:'3 个观察位置都没有改判，但倾向已经改变。变化不等于一定翻转答案，也不等于没有影响。');
   const target=lesson.original[lesson.choice.index].label?'往圆的方向拉低':'往方的方向拉高';
   set('label-reason',`你给 A 的新标签，会把这里的方倾向${target}。每一步，模型用同一组参数同时照顾 48 个点；它没有给 A 单独开一个记忆格。为了降低整组标签的犯错代价，参数和分界一起调整，B、C 的输出也可能跟着变。其他 47 个标签仍在拉住它，所以贴什么标签，不保证就判成什么。`);
  }
 }
 function pause(message){if(!running)return;running=null;token++;render();set('label-status',message||'已暂停，进度与原来的分界都保留。点对应的继续按钮接着看。');}
 function run(side){
  if(document.hidden||running||lesson[side].epoch===500||(side==='after'&&lesson.before.epoch!==500))return;
  // Pause the existing free-drawing engine via its public control; never replace its data or draft.
  if($('play')?.getAttribute('aria-pressed')==='true')$('play').click();
  running=side;const active=++token;clearJudgment();render();
  set('label-status',side==='before'?'正在学习原始标签，完成后把这张分界留住。':'只换一个标签。从完全相同的初始权重重新训练，不沿用左边的训练结果。');
  const tick=()=>{
   if(active!==token||running!==side)return;
   advanceLesson(lesson,side,25);render();
   if(lesson[side].epoch<500){schedule(tick);return;}
   running=null;render();
   set('label-status',side==='before'?'正常分界已留档。选一个点，再点第二步；原分界不会被覆盖。':'两边都训练了 500 步。先看 A，再看 B：没有参与训练的位置，预测也可能变化。');
   if(side==='before')$('label-after-run').focus({preventScroll:true});else $('label-result').focus({preventScroll:true});
  };schedule(tick);
 }
 $('label-before-run').addEventListener('click',()=>run('before'));
 $('label-after-run').addEventListener('click',()=>run('after'));
 $('label-pause').addEventListener('click',()=>pause());
 for(const c of EXAMPLES)$('label-choice-'+c.id).addEventListener('click',()=>{
  if(c.id===lesson.choice.id||running==='before')return;
  running=null;token++;selectExample(lesson,c.id);clearJudgment();render();
  set('label-status','已换观察对象，旧的改后结果已清除；正常分界仍保留。每次只教错这一个点，不累积。');
 });
 $('label-restart').addEventListener('click',()=>{token++;running=null;lesson=createLesson();clearJudgment();render();set('label-status','小实验已重置。下面的自由涂鸦、模型和草稿都没有改变。');});
 $('label-overlay').addEventListener('change',render);
 for(const id of ['local','shared'])$('label-answer-'+id).addEventListener('click',()=>{
  if(!evidence(lesson))return;
  for(const other of ['local','shared'])$('label-answer-'+other).setAttribute('aria-pressed',String(other===id));
  set('label-judgment',id==='shared'?'答对了。你刚刚控制了模型、起点和训练步数，只换一个标签，看到了共享参数如何改变预测。你学到的是：数据会影响分界，但一个错标签不保证局部或全局一定改判。':'再想一下：这里不是给每个点单独存一个答案。所有位置共享参数，所以没参与训练的位置也可能受影响。对照 B 的前后倾向再试试。');
 });
 for(const id of ['about','play','step','fast'])$(id)?.addEventListener('click',()=>pause('小实验已暂停，证据保留。看完帮助或自由涂鸦后，可手动继续。'));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('页面离开时已暂停。回来后不会自动继续。');});
 window.addEventListener('pagehide',()=>pause());
 window.addEventListener('neural-guide-pause',()=>pause('进阶区已暂停，已有训练与对照保留。重新打开后可手动继续。'));
 if(typeof MutationObserver!=='undefined')new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 render();set('label-status','先让它正常学会，再只换一个标签。这个小实验不读写你的自由涂鸦草稿。');
 return {snapshot:()=>({lesson:structuredClone(lesson),running})};
}
if(typeof document!=='undefined'&&document.getElementById('label-lab'))mountLabelLesson({document,window});
