import {createModel,predict,metrics,train,makeDataset,editPoints,MAX_POINTS,MAX_EPOCHS} from './neural-core.mjs';
import {DRAFT_KEYS,readDraft,writeDraft,clearDraft,validateNeuralDraft,draftMessage,questionKey} from './local-drafts.mjs';
import {createStepTrial,guessStep,runStepTrial,rewindStepTrial,stepEvidence} from './neural-step.mjs';
import {paintStep} from './neural-step-view.mjs';
const $=id=>document.getElementById(id),field=$('field'),ctx=field.getContext('2d'),chart=$('history').getContext('2d');
const tools=[...document.querySelectorAll('[data-tool]')],presets=[...document.querySelectorAll('[data-preset]')],guesses=[...document.querySelectorAll('[data-guess]')];
const names={diagonal:'一分为二',islands:'四个小岛',ring:'甜甜圈',custom:'我的涂鸦'};
const W=900,H=560,percent=v=>(v*100).toFixed(0)+'%';
let dataset=makeDataset('islands'),points=dataset.train,testPoints=dataset.test,preset='islands';
let model=createModel(),rate=.15,tool='probe',guess=null,history=[],undo=[],gesture=null;
let running=false,remaining=0,raf=null,token=0,cursor={x:0,y:0},showCursor=false,probeActive=false;
let ink,muted,line,surface,paper,dark=false,manualTheme=false;
let initialized=false,dirty=false,usedRates=[],previous=null;
let stepTrial=null;
const directionNames={up:'更像方',down:'更像圆',steady:'几乎不变'};
const stepPercent=p=>(p*100).toFixed(3)+'%';
function invalidateStep(){
 if(!stepTrial)return;
 stepTrial=null;$('step-note').textContent='题目或模型已继续变化，旧对照已结束。重新留档，就能从现在这一刻再试。';renderStep();
}
function renderStep(){
 const t=stepTrial,e=t?stepEvidence(t):null;
 $('step-body').hidden=!t;$('step-result').hidden=!e;$('step-rewind').disabled=!e;
 $('step-run').disabled=!t||!!e||!t.guesses.A||!t.guesses.B;
 $('step-capture').disabled=!ctx||!chart;
 $('step-capture').textContent=t?'从当前模型另开一轮':'留住当前状态，开始猜';
 if(!t)return;
 $('step-conditions').textContent=`留档：${names[preset]} · ${t.base.points.length} 个样本 · ${t.base.model.kind==='linear'?'直线脑袋':'8 个神经元'} · 第 ${t.base.model.epoch} 步。A、B 坐标始终不变。`;
 $('step-before-epoch').textContent='第 '+t.base.model.epoch+' 步';
 $('step-after-epoch').textContent=e?'第 '+e.after.model.epoch+' 步':'尚未更新';
 $('step-after-title').textContent=e?'走之后 · 只更新了 1 次':'走之后 · 等你先猜';
 $('step-A-label').textContent='A · 靠近分界的训练样本（标签：'+(t.probes[0].label?'方':'圆')+'）';
 for(const p of t.probes){
  $('step-'+p.id+'-before').textContent='走之前的方倾向 '+stepPercent(predict(t.base.model,p.x,p.y))+'，你猜下一步？';
  for(const choice of ['up','down','steady']){
   const button=$('step-'+p.id+'-'+choice);button.disabled=!!e;button.setAttribute('aria-pressed',String(t.guesses[p.id]===choice));
  }
  const r=e?.probes.find(q=>q.id===p.id);
  $('step-'+p.id+'-result').textContent=r?`${p.id}：方倾向 ${stepPercent(r.before)} → ${stepPercent(r.after)}（${r.delta>=0?'+':''}${(r.delta*100).toFixed(3)} 个百分点）。${r.flipped?'判断从'+(r.before>=.5?'方':'圆')+'变为'+(r.after>=.5?'方':'圆'):'仍判为'+(r.after>=.5?'方':'圆')}。你猜${directionNames[r.guess]}，实际${directionNames[r.direction]}；${r.guess===r.direction?'猜中了':'这次不一样，看看前后数值'}。`:'';
 }
 $('step-run').textContent=e?'这一步已完成':t.guesses.A&&t.guesses.B?'用步子 '+rate+'，真实走一步':'猜完 A 和 B，再走一步';
 $('step-rate-note').textContent=e?`本次实际步子 ${e.rate}。${rate!==e.rate?'上方新步子 '+rate+' 尚未应用。':''}先退回，再换步子、重新猜。`:`将用步子 ${rate}。可在上方“每次改多少”调整，不会自动训练。`;
 paintStep($('step-before-canvas'),t.base.model,t.base.points,t.probes,null,dark);
 paintStep($('step-after-canvas'),e?e.after.model:t.base.model,t.base.points,t.probes,e?t.base.model:null,dark);
 if(e){
  const delta=e.lossAfter-e.lossBefore,changed=t.base.model.weights.filter((w,i)=>w!==e.after.model.weights[i]).length;
  $('step-loss-result').textContent=`整组犯错代价：${e.lossBefore.toFixed(6)} → ${e.lossAfter.toFixed(6)}（${Math.abs(delta)<.0000005?'变化小于显示精度':delta<0?'下降':'上升'}）。不是正确率，也不只看 A 这一个点。`;
  $('step-explanation').textContent=`这一步先计算全部 ${t.base.points.length} 个标签的犯错代价，再沿计算出的梯度、按步子 ${e.rate} 调整参数；${t.base.model.weights.length} 个参数中 ${changed} 个发生变化。两个画布的位置与标签完全没动。分界若几乎重合，就用上面的数值看细微变化，不放大或伪造改判。`;
 }
 $('step-attempts').hidden=!t.last;
 const summary=r=>`步子 ${r.rate}：犯错代价 ${r.lossAfter.toFixed(6)}；`+r.probes.map(p=>`${p.id} 方倾向 ${stepPercent(p.after)}`).join('，')+'。';
 if(t.last){$('step-last-result').textContent='上次 · '+summary(t.last);$('step-current-result').textContent=e?'这次 · '+summary(e):'当前已退回第 '+t.base.model.epoch+' 步，尚未再走。上次结果只留作对照，不叠加到本次。';}
}
function applyStepSnapshot(value){
 ({model,history,usedRates,guess}=structuredClone(value));dirty=true;render();saveDraft();
}
function saveDraft(){
 if(!initialized)return;
 const ok=writeDraft(DRAFT_KEYS.neural,{points,preset,model,rate,tool,guess,history,undo,rates:usedRates,previous},validateNeuralDraft);
 dirty=!ok;
 $('draft-status').textContent=ok?'草稿已保留 · 仅在此浏览器，不上传。':'草稿未保存：浏览器存储不可用或空间不足。当前仍可继续玩。';
}
$('forget-draft').addEventListener('click',()=>{
 if(ctx&&chart){stop();announce('已暂停。删除本地草稿不会改变当前题目与成绩。');}
 const ok=clearDraft(DRAFT_KEYS.neural);if(ok)dirty=false;
 $('draft-status').textContent=ok?'已删除本地草稿，当前画面不变；继续操作会重新保存。':'无法删除本地草稿，请在浏览器设置中清理此站点数据。';
});

function theme(){
 if(!manualTheme)dark=matchMedia('(prefers-color-scheme:dark)').matches;
 document.documentElement.dataset.theme=dark?'dark':'light';
 $('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');
 const css=getComputedStyle(document.documentElement),color=k=>css.getPropertyValue('--'+k).trim();
 ink=color('ink');muted=color('muted');line=color('line');surface=color('surface');paper=color('paper');
 if(ctx&&chart){draw();renderStep();}
}
$('theme').addEventListener('click',()=>{manualTheme=true;dark=!dark;theme();});
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',theme);

function announce(text){$('status').textContent=text;}
function controls(){
 $('model').value=model.kind;$('rate').value=String(rate);
 $('prediction-model').textContent=model.kind==='linear'?'直线脑袋':'会拐弯 · 8 个神经元';
 $('compare-model').disabled=model.epoch===0||running;
 $('compare-model').textContent=model.kind==='linear'?'换神经网络试试 ↗':'换直线模型试试 ↗';
 $('play').textContent=running?'暂停':'开始训练';$('play').setAttribute('aria-pressed',String(running));
 $('fast').textContent=remaining?'快进中 '+remaining+' 步':'快进 500 步';$('fast').disabled=remaining>0;
 $('undo').disabled=!undo.length;$('dataset-name').textContent=names[preset];
 $('epoch').textContent=String(model.epoch);$('point-count').textContent=points.length+' / '+MAX_POINTS+' 个点';
 field.dataset.editing=String(tool!=='probe');
 tools.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
 presets.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===preset)));
 guesses.forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.guess===guess));b.disabled=model.epoch>0;});
 const trainScore=metrics(model,points),testScore=testPoints?metrics(model,testPoints):null;
 $('accuracy').textContent=trainScore?percent(trainScore.accuracy):'无样本';
 $('test-accuracy').textContent=testScore?percent(testScore.accuracy):'未设答案';
 $('loss').textContent=trainScore?trainScore.loss.toFixed(3):'无样本';
 if(guess)$('prediction-result').textContent='你猜：'+(guess==='yes'?'能分开':'可能分不开')+'。'+(model.epoch?'已走 '+model.epoch+' 步，练习题 '+percent(trainScore.accuracy)+'。再换个模型比较。':'开始训练来看看。');
 else $('prediction-result').textContent=model.epoch?'先观察这一轮。想留个预测，可以重新训练。':'可跳过。先留一个判断，再看实验。';
 comparison();
}
function comparison(){
 $('model-comparison').hidden=!previous;
 if(!previous)return;
 $('comparison-question').textContent=names[preset]+' · '+points.length+' 道练习题'+(testPoints?' · 120 道固定新题':'');
 for(const [prefix,m,rs]of [['previous',previous.model,previous.rates],['current',model,usedRates]]){
  const a=metrics(m,points),b=testPoints?metrics(m,testPoints):null;
  $(prefix+'-model').textContent=m.kind==='linear'?'直线脑袋':'小神经网络';
  $(prefix+'-steps').textContent=m.epoch+' 步';
  $(prefix+'-rate').textContent=rs.length?rs.join(' / '):'尚未使用';
  $(prefix+'-train').textContent=m.epoch?percent(a.accuracy):'待训练';
  $(prefix+'-test').textContent=!testPoints?'未设答案':m.epoch?percent(b.accuracy):'待训练';
  $(prefix+'-loss').textContent=m.epoch?a.loss.toFixed(3):'待训练';
 }
 const same=model.epoch===previous.model.epoch&&usedRates.length===1&&previous.rates.length===1&&usedRates[0]===previous.rates[0];
 $('comparison-note').textContent=(!model.epoch?'上轮成绩已留档。训练当前模型，再看同题表现。':same?'相同步数与固定步子，可观察两种模型的表达差异；一次结果不代表普遍优劣。':'训练条件不同（步数或使用过的步子），仅供观察，不判胜负。')+(testPoints?'':' 自定义题目没有标准答案，不比较新题成绩。');
}
function switchModel(kind){
 if(kind===model.kind)return;
 invalidateStep();
 stop();
 if(!model.epoch&&previous?.model.kind===kind){
  model=structuredClone(previous.model);usedRates=[...previous.rates];previous=null;guess=null;
  history=[{epoch:model.epoch,loss:metrics(model,points).loss}];render();saveDraft();
  announce('切回上轮已经训练的模型，成绩保留。曲线从恢复点继续记录。');return;
 }
 previous=model.epoch?{question:questionKey({points,preset}),model:structuredClone(model),rates:[...usedRates]}:null;
 model=createModel(kind);restart();
 announce(previous?'上轮成绩已留在对照卡。题目和步子不变，再训练这个脑袋看看。':'换了一个脑袋，题目保留，从头训练。');
}
function path(context,pts){context.beginPath();pts.forEach((p,i)=>i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));}
function draw(){
 ctx.fillStyle=paper;ctx.fillRect(0,0,W,H);
 const cols=75,rows=46;
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const x=(col+.5)/cols*2-1,y=1-(row+.5)/rows*2,p=predict(model,x,y);
  // Neutral at 0.5; saturation represents model tendency, not calibrated certainty.
  const strength=Math.abs(p-.5)*2;
  ctx.globalAlpha=(dark?.42:.52)*strength;
  ctx.fillStyle=p<.5?'#dc725f':'#419c9b';
  const left=Math.floor(col*W/cols),top=Math.floor(row*H/rows);
  ctx.fillRect(left,top,Math.floor((col+1)*W/cols)-left,Math.floor((row+1)*H/rows)-top);
 }
 ctx.globalAlpha=1;
 ctx.strokeStyle=line;ctx.lineWidth=1;
 for(let i=1;i<5;i++){path(ctx,[{x:W*i/5,y:0},{x:W*i/5,y:H}]);ctx.stroke();path(ctx,[{x:0,y:H*i/5},{x:W,y:H*i/5}]);ctx.stroke();}
 const displayed=gesture?gesture.draft:points;
 for(const p of displayed){
  const x=(p.x+1)/2*W,y=(1-p.y)/2*H;
  ctx.fillStyle=p.label?'#419c9b':'#dc725f';ctx.strokeStyle=surface;ctx.lineWidth=2;
  ctx.beginPath();if(p.label)ctx.rect(x-5,y-5,10,10);else ctx.arc(x,y,5.6,0,Math.PI*2);ctx.fill();ctx.stroke();
  if(!gesture&&Number(predict(model,p.x,p.y)>=.5)!==p.label){
   ctx.strokeStyle=ink;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.stroke();
  }
 }
 if(showCursor){
  const x=(cursor.x+1)/2*W,y=(1-cursor.y)/2*H;
  ctx.strokeStyle=ink;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.stroke();
  path(ctx,[{x:x-20,y},{x:x-10,y}]);ctx.stroke();path(ctx,[{x:x+10,y},{x:x+20,y}]);ctx.stroke();
 }
 if(!displayed.length){ctx.fillStyle=muted;ctx.textAlign='center';ctx.font='18px sans-serif';ctx.fillText('给它画一个有两种答案的世界。',W/2,H/2);}
 chart.clearRect(0,0,320,80);chart.strokeStyle=line;chart.lineWidth=1;path(chart,[{x:0,y:72},{x:320,y:72}]);chart.stroke();
 if(history.length){
  const max=Math.max(.1,...history.map(p=>p.loss)),last=Math.max(1,history.at(-1).epoch);
  chart.strokeStyle=ink;chart.lineWidth=2;
  path(chart,history.map(p=>({x:3+p.epoch/last*314,y:72-p.loss/max*65})));chart.stroke();
 }
}
function render(){controls();refreshProbe();draw();renderStep();}
function pause(){running=false;remaining=0;token++;if(raf!==null)cancelAnimationFrame(raf);raf=null;controls();if(dirty)saveDraft();}
function cancelGesture(){if(gesture){const {id,previousCursor}=gesture;gesture=null;showCursor=previousCursor;try{field.releasePointerCapture(id);}catch{}draw();}}
function stop(){pause();cancelGesture();}
function restart(){invalidateStep();dirty=false;model=createModel(model.kind);usedRates=[];guess=null;history=[];probeActive=false;showCursor=false;stop();const s=metrics(model,points);if(s)history.push({epoch:0,loss:s.loss});$('probe-result').textContent='点一下画面，看看它会怎么猜。';render();saveDraft();}
function canTrain(){
 if(!points.some(p=>p.label===0)||!points.some(p=>p.label===1)){announce('需要两类样本。先各画至少一个圆点和方点。');return false;}
 if(model.epoch>=MAX_EPOCHS){announce('本轮已走 4000 步。可以换模型、改题目，或重新训练。');return false;}
 return !document.hidden;
}
function advance(count){
 invalidateStep();
 train(model,points,rate,Math.min(count,MAX_EPOCHS-model.epoch));
 if(!usedRates.includes(rate))usedRates.push(rate);dirty=true;
 $('draft-status').textContent='训练中 · 暂停或离开页面时保留进度。';
 history.push({epoch:model.epoch,loss:metrics(model,points).loss});
 if(history.length>600)history=history.filter((_,i)=>i%2===0);
 render();
}
function schedule(){
 const ownToken=token;
 raf=requestAnimationFrame(()=>{
  if(ownToken!==token||!running||document.hidden)return;
  raf=null;const count=Math.min(remaining||8,remaining?25:8,MAX_EPOCHS-model.epoch);
  advance(count);if(remaining)remaining-=count;
  if(model.epoch>=MAX_EPOCHS||(count>0&&remaining===0&&batch)){
   pause();announce(model.epoch>=MAX_EPOCHS?'本轮 4000 步结束。试着改变题目或模型。':'这 500 步算完了。看看分错的点，再决定怎么改。');
  }else schedule();
 });
}
let batch=false;
function start(fast=false){
 if(gesture)cancelGesture();
 if(fast&&remaining)return;
 pause();if(!canTrain())return;invalidateStep();
 batch=fast;remaining=fast?Math.min(500,MAX_EPOCHS-model.epoch):0;running=true;
 announce(fast?'正在计算 500 次参数更新。':'正在学习你给的标签。随时可以暂停或改题目。');controls();schedule();
}
function snapshot(){return {points,testPoints,preset};}
function rememberQuestion(){undo.push(snapshot());if(undo.length>30)undo.shift();}
function commit(next){
 if(next.length===points.length&&next.every((p,i)=>p===points[i]))return;
 rememberQuestion();
 points=next;testPoints=null;preset='custom';previous=null;restart();
 announce('题目变了，从头学习。自定义涂鸦没有标准答案，因此不显示新题成绩。');
}
function refreshProbe(){
 if(!probeActive)return;
 const v=predict(model,cursor.x,cursor.y);
 $('probe-result').textContent='这里更像'+(v>=.5?'方点':'圆点')+'：模型倾向 '+percent(v>=.5?v:1-v)+'，不是正确率。';
}
function probe(p){cursor=p;showCursor=true;probeActive=true;refreshProbe();draw();}
function position(e){const r=field.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*2-1,y:1-(e.clientY-r.top)/r.height*2};}
function applyDraft(p){
 if(!gesture)return;
 gesture.draft=editPoints(gesture.draft,p,tool);draw();
}
if(!ctx||!chart){
 announce('这个浏览器暂不支持 Canvas。请换用现代浏览器；上方其他实验仍可访问。');
 for(const id of ['play','step','fast','reset','undo','clear','model','rate','compare-model','step-capture','step-run','step-rewind'])$(id).disabled=true;
 for(const b of [...tools,...presets,...guesses])b.disabled=true;
 $('step-body').hidden=true;theme();
}else{
 const draft=readDraft(DRAFT_KEYS.neural,validateNeuralDraft);
 if(draft.value){
  ({points,preset,model,rate,tool,guess,history,undo,previous}=draft.value);usedRates=draft.value.rates;
  testPoints=preset==='custom'?null:makeDataset(preset).test;
  undo=undo.map(s=>({...s,testPoints:s.preset==='custom'?null:makeDataset(s.preset).test}));
  theme();render();announce('已恢复上次的题目和学习结果。训练已暂停，想继续时再开始。');
  $('step-note').textContent='已恢复实际模型和草稿。临时单步对照不跨刷新保留，请重新留档。';
 }else{theme();restart();}
 initialized=true;$('draft-status').textContent=draftMessage(draft.status);
 $('step-capture').addEventListener('click',()=>{
  stop();if(!canTrain()){$('step-note').textContent=model.epoch>=MAX_EPOCHS?'已经走满 4000 步。请重新训练或换题后再留档。':'需要两类样本。先各画至少一个圆点和方点，再留档。';return;}
  stepTrial=createStepTrial({model,points,history,usedRates,guess});
  renderStep();$('step-note').textContent='起点已留住。先猜 A、B 的方倾向，再点“真实走一步”；执行后当前模型和草稿也会更新。';
  $('step-A-up').focus({preventScroll:true});
 });
 for(const id of ['A','B'])for(const choice of ['up','down','steady'])$('step-'+id+'-'+choice).addEventListener('click',()=>{
  if(!stepTrial||stepTrial.result)return;guessStep(stepTrial,id,choice);renderStep();
 });
 $('step-run').addEventListener('click',()=>{
  if(document.hidden||!stepTrial||stepTrial.result||!stepTrial.guesses.A||!stepTrial.guesses.B)return;
  stop();applyStepSnapshot(runStepTrial(stepTrial,rate));$('step-note').textContent='只执行了 1 次真实更新。先比较两个位置，再退回原状态换步子试试。';$('step-result').focus({preventScroll:true});
 });
 $('step-rewind').addEventListener('click',()=>{
  if(!stepTrial?.result)return;stop();applyStepSnapshot(rewindStepTrial(stepTrial));
  $('step-note').textContent='权重、步数与训练历史都已退回同一留档；上次结果保留在下方。换步子，再猜一次。';$('rate').focus({preventScroll:true});
 });
 $('play').addEventListener('click',()=>{if(running){pause();announce('已暂停。可以用探针看看分界两侧。');}else start();});
 $('fast').addEventListener('click',()=>start(true));
 $('step').addEventListener('click',()=>{stop();if(canTrain()){advance(1);saveDraft();announce('更新了一次参数。');}});
 $('reset').addEventListener('click',()=>{restart();announce('保留题目，模型回到同一个起点。');});
 $('clear').addEventListener('click',()=>{stop();commit([]);announce('空白画布准备好了。圆点和方点都需要至少一个。');});
 $('undo').addEventListener('click',()=>{stop();const prev=undo.pop();if(prev){points=prev.points;testPoints=prev.testPoints;preset=prev.preset;previous=null;restart();announce('已撤销改题，找回「'+names[preset]+'」。训练从头开始。');}});
 $('model').addEventListener('change',()=>{const kind=$('model').value;if(!['linear','network'].includes(kind))return;switchModel(kind);});
 $('compare-model').addEventListener('click',()=>{
  if(running||model.epoch===0)return;
  switchModel(model.kind==='linear'?'network':'linear');
 });
 $('rate').addEventListener('change',()=>{const next=Number($('rate').value);if(![.03,.15,.6].includes(next))return;stop();rate=next;if(stepTrial&&!stepTrial.result)stepTrial.guesses={};render();saveDraft();announce('步子已调整，保留已有学习结果。不会自动训练。');});
 presets.forEach(b=>b.addEventListener('click',()=>{stop();rememberQuestion();previous=null;preset=b.dataset.preset;dataset=makeDataset(preset);points=dataset.train;testPoints=dataset.test;restart();announce('新题目准备好了。「撤销上一步」可以找回换题前的样本，训练从头开始。');}));
 tools.forEach(b=>b.addEventListener('click',()=>{cancelGesture();tool=b.dataset.tool;controls();draw();saveDraft();}));
 guesses.forEach(b=>b.addEventListener('click',()=>{if(model.epoch)return;if(guess!==b.dataset.guess)invalidateStep();guess=b.dataset.guess;controls();saveDraft();}));
 field.addEventListener('pointerdown',e=>{
  if(e.isPrimary===false||e.button!==0||gesture)return;
  const p=position(e);
  if(tool==='probe'){probe(p);return;}
  pause();gesture={id:e.pointerId,draft:points,previousCursor:showCursor};showCursor=false;
  field.setPointerCapture(e.pointerId);applyDraft(p);
 });
 field.addEventListener('pointermove',e=>{if(gesture?.id===e.pointerId)applyDraft(position(e));});
 field.addEventListener('pointerup',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;
  applyDraft(position(e));const next=gesture.draft,id=gesture.id;gesture=null;
  try{field.releasePointerCapture(id);}catch{}
  commit(next);render();if(points.length>=MAX_POINTS)announce('已到 160 个点。可以擦掉一些，或撤销后继续。');
 });
 field.addEventListener('pointercancel',e=>{if(gesture?.id===e.pointerId){cancelGesture();announce('这一笔已取消，原来的题目和成绩保留。');}});
 field.addEventListener('lostpointercapture',e=>{if(gesture?.id===e.pointerId)cancelGesture();});
 field.addEventListener('keydown',e=>{
  const moves={ArrowLeft:[-.05,0],ArrowRight:[.05,0],ArrowUp:[0,.05],ArrowDown:[0,-.05]};
  if(moves[e.key]){e.preventDefault();cursor={x:Math.max(-.95,Math.min(.95,cursor.x+moves[e.key][0])),y:Math.max(-.95,Math.min(.95,cursor.y+moves[e.key][1]))};showCursor=true;$('cursor-status').textContent='横向 '+Math.round((cursor.x+1)*50)+'%，纵向 '+Math.round((1-cursor.y)*50)+'%。';refreshProbe();draw();}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(e.repeat)return;if(tool==='probe')probe(cursor);else{stop();commit(editPoints(points,cursor,tool));render();}}
  else if(e.key==='Escape'){cancelGesture();draw();}
 });
 $('about').addEventListener('click',()=>{stop();$('guide').showModal();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener('pagehide',stop);
}
