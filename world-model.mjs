import {STEPS,START,TARGET,makeActions,predict} from './world-model-core.mjs';
import {createSession,startFlight,advanceFlight,learnLatest,changeWind,selectPlan} from './world-model-session.mjs?v=same-flight-1';
import {createLesson,nextLesson,recordLessonFlight,chooseLesson,CHOICES} from './world-model-lesson.mjs?v=same-flight-1';

const $=id=>document.getElementById(id),media=matchMedia('(prefers-reduced-motion: reduce)');
let session=createSession(),lesson=createLesson(),running=false,frame=null,token=0,lastTime=null,remainder=0,view='preview',comparisonEmphasis='after';
const points=path=>path.map(p=>`${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');
const windText=wind=>`${wind>0?'↓ 下吹':'↑ 上吹'} ${Math.abs(wind).toFixed(1)}`;
const errorText=value=>value>0&&value<.05?'< 0.1':value.toFixed(1);
const comparisonConditions=c=>`第 ${c.number} 趟 · ${windText(c.wind)} · 方向 ${c.controls.angle}° · 推力 ${c.controls.power.toFixed(2)}×`;
function stop(){running=false;token++;if(frame!==null)cancelAnimationFrame(frame);frame=null;lastTime=null;remainder=0;}
function message(text){$('status').textContent=text;}
function freeGuidance(){
 const s=session,f=s.flight;
 if(f&&!f.done)return {action:'resume',stage:'试飞中 · 看两条线的区别',title:running?'它正在真实世界里飞。':'暂停了，可以慢慢看。',copy:'虚线不会跟着飞船改。两条线分开，就说明它猜错了。',label:running?'正在试飞…':'继续试飞 ↗'};
 if(view==='comparison'&&s.comparison){
  const c=s.comparison,improved=c.afterError<c.beforeError;
  return {action:'replan',stage:'只学习了，还没规划',title:improved?'同一趟飞行，它现在猜得更近了。':'这次学习，没有让回看偏差变小。',copy:`起点、方向、推力和风都没动，只更新了模型。${improved?'新的预测更贴近橙色记录，但飞船并没有重新飞，真实落点也没改变。':'比较两次预测，不能把“学过”直接当成“学好了”。'}下一步才用新模型选路线。`,label:'再用新模型，选一条路线 →'};
 }
 if(view==='preview'){
  if(s.model.source&&s.model.source.worldVersion!==s.worldVersion)return {action:'fly',stage:'第三步 · 换风挑战',title:'风变了，它还记着旧经验。',copy:'它不知道自己可能猜错了。用同一个模型再飞一次，看看会发生什么。',label:'用旧经验试飞 ↗'};
  if(s.plan&&!s.model.version)return {action:'fly',stage:'第一步 · 先凭猜测试试',title:'路线想好了，但它还没学过。',copy:'它还没从真实经历中学习。虚线只是初始猜测，试飞后才知道对不对。',label:'按这条路线试飞 ↗'};
  if(s.plan)return {action:'fly',stage:'第二步 · 学完，再试',title:'新路线想好了，真的能行吗？',copy:`看看新的虚线：它选择${s.controls.angle<0?'向上':s.controls.angle>0?'向下':'水平'}飞${s.controls.angle?` ${Math.abs(s.controls.angle)}°`:''}。这只是预测，由你发射来验证。`,label:'按新路线试飞 ↗'};
  return {action:'fly',stage:s.completed?'自由尝试':'第一步 · 试一试',title:s.completed?'你改了出发方式，再试试看。':'先看看，它会飞到哪？',copy:'点一下出发，不用先懂参数。虚线是它的猜测，橙色是实际路线。',label:s.completed?'试试这条路线 ↗':'先试飞一次 ↗'};
 }
 if(f?.done){
  if(f.distance<=f.target.radius&&f.error<=3)return {action:'wind',stage:'挑战成功',title:'进圈了！这次也猜准了。',copy:'两条路线很接近，飞船也到了圆环里。想给它出个难题吗？把风反过来，旧经验未必管用。',label:'换个风向，挑战它 ↕'};
  if(f.error<=3)return {action:'replan',stage:'换条路线',title:'猜得准，不等于路线合适。',copy:'它已经能预测这次的运动，只是选的路线没进圈。先用现有模型选一条新路线，不必再学习一遍。',label:'用现有模型，重新规划 →'};
  return {action:'learn',stage:'第二步 · 从经历中学',title:f.distance<=f.target.radius?'进圈了，但还没猜准。':'飞偏了，还没进圈。',copy:'它以为会走虚线，实际却走了另一条路。先只学习这趟经历：不换路线，看看预测怎样变。',label:'只学习，看看预测怎么变 →'};
 }
 return {action:'fly',stage:'第一步 · 试一试',title:'先看看，它会飞到哪？',copy:'点一下出发，不用调参数。',label:'先试飞一次 ↗'};
}
function guidance(){
 const guide=freeGuidance(),stage=lesson.stage;
 if(stage==='free')return {...guide,stage:'自由实验 · 不计入本轮回顾'};
 if(session.flight&&!session.flight.done)return stage==='attempt'?{...guide,stage:`独立判断 · ${CHOICES[lesson.choice]}`,copy:'这是你选的方法正在实际执行。预测已在出发前锁定，先看飞船最后会到哪里。'}:guide;
 const guided={
  first:{...guide,stage:'1 / 3 · 先从经历中学习'},
  learn:{...guide,stage:'1 / 3 · 先从经历中学习'},
  learningComparison:{...guide,stage:'1 / 3 · 同一趟飞行，它学到了什么？'},
  learnedPreview:{...guide,stage:'1 / 3 · 学完，再实飞验证'},
  wind:{...guide,stage:'1 / 3 · 进圈了，也猜准了'},
  changedPreview:{...guide,stage:'2 / 3 · 世界改变了'},
  relearn:{...guide,stage:'2 / 3 · 旧经验失灵了',copy:'风改变了运动规律，旧模型还不知道。先用刚才的新经历修正预测，路线暂时不动。'},
  relearningComparison:{...guide,stage:'2 / 3 · 同一趟新风况，再看一次学习'},
  recoveredPreview:{...guide,stage:'2 / 3 · 修正后，再实飞验证'},
  challenge:{action:'lesson',stage:'2 / 3 · 重新进圈了',title:'这次，轮到你判断。',copy:'刚才是风变了。最后试一个不同的变化：只把圆环挪远一点，风不变。下一步该做什么？',label:'移动圆环，我来选 →'},
  choose:{action:'none',stage:'3 / 3 · 独立判断',title:'只换目标，飞船要重学吗？',copy:lesson.attempts.length?'再选一种方法。每次都从换目标前的同一份经验出发，风仍然不变。':'圆环向右下方移动了，风和飞船都没有变。选一种方法，让它真的飞一次。',label:'请选一种方法'},
  ending:{action:'lesson',stage:'本轮实验结束',title:'这一轮，有了一个完整答案。',copy:'下方保留了你刚才的真实轨迹和发现。现在可以自由尝试，也可以回游乐场。',label:'进入自由实验 ↗'}
 };
 if(stage==='result'){
  const attempt=lesson.attempts.at(-1),f=attempt.flight,reached=f.distance<=f.target.radius;
  const explain={reuse:'原路线仍然能被准确预测，但它是为旧圆环选的。目标换了，下一步需要换路线，不一定要换模型。',learn:'重新学习更新了模型，却不会替你选择新路线。风没变，这次关键是用已有经验规划去新目标的路。',plan:'没有重新学习，只用已有模型挑了新路线。目标变了，运动规律没变，所以这次重新规划就够了。'};
  return {action:'lesson',stage:`3 / 3 · 你选了「${CHOICES[attempt.choice]}」`,title:reached?'到新圆环了！':f.error<=3?'预测很准，却没到新目标。':'这次，还没到新圆环。',copy:`${explain[attempt.choice]} 实际距新靶心 ${f.distance.toFixed(1)} 单位（≤ 5 算抵达）。`,label:reached&&attempt.choice==='plan'?'看看这轮学到了什么 →':'换个办法试试 →'};
 }
 return guided[stage]||guide;
}
function bounds(paths,target){
 const all=[...paths.flat(),target,START],minX=Math.min(0,...all.map(p=>p.x-8)),minY=Math.min(0,...all.map(p=>p.y-10));
 return `${minX} ${minY} ${Math.max(140,...all.map(p=>p.x+8))-minX} ${Math.max(90,...all.map(p=>p.y+14))-minY}`;
}
function renderEnding(){
 $('lesson-ending').hidden=lesson.stage!=='ending';
 if(lesson.stage!=='ending')return;
 const {learningComparison:learned,relearningComparison:recovered}=lesson.evidence,last=lesson.attempts.at(-1),f=last.flight;
 $('recap-learning').textContent=`同一趟记录，学习前偏差 ${errorText(learned.beforeError)} → 学习后回看偏差 ${errorText(learned.afterError)} 单位。只变了预测，没有改变方向和推力；之后才另选路线、实飞验证。`;
 $('recap-wind').textContent=`换风那趟，学习前偏差 ${errorText(recovered.beforeError)} → 学习后回看偏差 ${errorText(recovered.afterError)} 单位。实际记录始终没变，模型要从新经历中更新，不会自动知道风变了。`;
 $('recap-decision').textContent=`你尝试了 ${lesson.attempts.length} 次，最后选「${CHOICES[last.choice]}」，距新靶心 ${f.distance.toFixed(1)} 单位。${last.choice==='plan'?(f.distance<=f.target.radius?'这次没重学，只重新规划就到达了。':'规划过也不保证抵达，还要用实际结果检查。'):'这次没有改路线，因此没到新目标。风没变，可以先用已有模型重新规划。'}`;
 for(const [key,flight] of [['learn',{...learned,predicted:learned.after}],['wind',{...recovered,predicted:recovered.after}],['choice',f]]){
  $(`recap-${key}-scene`).setAttribute('viewBox',bounds([flight.predicted,flight.actual],flight.target));
  $(`recap-${key}-predicted`).setAttribute('points',points(flight.predicted));$(`recap-${key}-actual`).setAttribute('points',points(flight.actual));
  $(`recap-${key}-target`).setAttribute('cx',flight.target.x);$(`recap-${key}-target`).setAttribute('cy',flight.target.y);
 }
}
function renderComparison(c){
 $('learning-comparison').hidden=!c;
 $('learned-key').hidden=!c;
 $('prediction-key').textContent=c?'学习前预测':'出发前预测';
 $('scene').setAttribute('data-comparison',String(Boolean(c)));
 $('scene').setAttribute('data-emphasis',comparisonEmphasis);
 if(c){
  $('comparison-conditions').textContent=`${comparisonConditions(c)} · 同一起点、目标和整段推力`;
  for(const key of ['before','after']){
   $(`compare-${key}`).setAttribute('aria-pressed',String(comparisonEmphasis===key));
   $(`comparison-${key}-label`).textContent=`学习${key==='before'?'前':'后'} · M${c[`${key}Version`]}`;
   $(`comparison-${key}-error`).textContent=`偏差 ${errorText(c[`${key}Error`])}`;
  }
  $('comparison-hint').textContent=`正在突出${comparisonEmphasis==='before'?'学习前':'学习后'}预测。橙色实线始终是同一趟真实轨迹，坐标和原成绩不变。`;
 }
 const saved=session.comparison;$('learning-record').hidden=!saved;
 if(!saved)return;
 $('record-context').textContent=`${comparisonConditions(saved)} · M${saved.beforeVersion} → M${saved.afterVersion} · 起点、目标与整段推力相同`;
 const axes=bounds([saved.before,saved.after,saved.actual],saved.target);
 for(const key of ['before','after']){
  $(`record-${key}-error`).textContent=`M${saved[`${key}Version`]} · 偏差 ${errorText(saved[`${key}Error`])}`;
  $(`record-${key}-scene`).setAttribute('viewBox',axes);
  $(`record-${key}-predicted`).setAttribute('points',points(saved[key]));
  $(`record-${key}-actual`).setAttribute('points',points(saved.actual));
  $(`record-${key}-target`).setAttribute('cx',saved.target.x);$(`record-${key}-target`).setAttribute('cy',saved.target.y);
 }
}
function render(){
 const s=session,f=s.flight,active=Boolean(f&&!f.done),displayFlight=view==='flight'&&f,c=view==='comparison'?s.comparison:null;
 const focusedControl=[$('pause'),$('step')].find(el=>el===document.activeElement);
 $('model-label').textContent=`M${s.model.version} · ${s.model.version?'已学习':'初始猜测'}`;
 const source=s.model.source;
 $('sample-label').textContent=source?`上次学习：第 ${source.number} 趟 · ${windText(source.wind)} · ${s.model.samples} 条观测${source.worldVersion!==s.worldVersion?'（旧风况）':''}`:'还没有学习任何观测';
 $('wind-label').textContent=s.wind>0?'↓ 风向下吹':'↑ 风向上吹';
 $('angle').value=String(s.controls.angle);$('power').value=String(s.controls.power);
 $('angle-label').textContent=s.controls.angle===0?'水平向右':`${s.controls.angle<0?'向上':'向下'} ${Math.abs(s.controls.angle)}°`;
 $('power-label').textContent=`${s.controls.power.toFixed(2)}×`;
 for(const id of ['angle','power','plan'])$(id).disabled=active;
 $('fly').disabled=active;$('fly').textContent=f?.done?'再试飞一次 ↗':'按这条路线试飞 ↗';
 $('pause').disabled=!active;$('pause').textContent=running?'暂停':'继续';$('step').disabled=!active||running;
 $('pause').hidden=!active||!running;$('step').hidden=!active||running;
 const guide=guidance();$('guide-stage').textContent=guide.stage;$('guide-title').textContent=guide.title;$('guide-copy').textContent=guide.copy;
 $('next').textContent=guide.label;$('next').setAttribute('aria-disabled',String(active&&running));
 $('next').hidden=lesson.stage==='choose';$('choices').hidden=lesson.stage!=='choose';
 for(const choice of Object.keys(CHOICES))$(`choice-${choice}`).disabled=lesson.stage!=='choose';
 $('finish-lesson').hidden=lesson.stage!=='result';
 if(focusedControl?.hidden)$('next').focus();
 const learnable=f?.done&&f.worldVersion===s.worldVersion&&s.learnedFlight!==f.number;
 $('learn').disabled=!learnable;
 $('learn-note').textContent=learnable?'60 条真实观测准备好了。学习不会改写这趟的分数。':s.learnedFlight===f?.number?'这趟已经学过。下一步：让模型选一条新路线。':'完整试飞后，才会得到 60 条观测。';
 $('plan-note').textContent=s.plan?`已在 M${s.plan.modelVersion} 中试了 ${s.plan.candidates} 条路线；预测距靶心 ${s.plan.distance.toFixed(1)} 单位。还要实飞验证。`:'当前为手动路线。脑内规划只使用模型，不偷看真实世界。';
 const predicted=c?c.before:displayFlight?f.predicted:s.plan?.path||predict(s.model,makeActions(s.controls));
 const actual=c?c.actual:displayFlight?f.actual:[],learned=c?c.after:[],end=predicted.at(-1),ship=actual.at(-1)||START;
 $('prediction-path').setAttribute('points',points(predicted));$('actual-path').setAttribute('points',points(actual));
 $('learned-path').setAttribute('points',points(learned));
 $('prediction-end').setAttribute('cx',end.x);$('prediction-end').setAttribute('cy',end.y);
 $('prediction-end').setAttribute('visibility',c?'hidden':'visible');
 const angle=actual.length>1?Math.atan2(ship.vy,ship.vx)*180/Math.PI:s.controls.angle;
 $('ship').setAttribute('transform',`translate(${ship.x} ${ship.y}) rotate(${angle})`);
 const target=c?c.target:displayFlight?f.target:s.target;
 $('target-marker').setAttribute('transform',`translate(${target.x-TARGET.x} ${target.y-TARGET.y})`);
 $('scene').setAttribute('viewBox',bounds([predicted,learned,actual],target));
 $('scene-label').textContent=c?'同一趟 · 只更新预测，没有重新飞':displayFlight?`想象 vs 现实 · ${f.done?'已完成':running?'试飞中':'已暂停'}`:'它想象的路线 · 尚未试飞';
 $('progress').textContent=c?'固定记录':`${displayFlight?f.step:0} / ${STEPS} 拍`;
 $('scene-desc').textContent=c?`第 ${c.number} 趟训练经历回看。学习前 M${c.beforeVersion} 偏差 ${errorText(c.beforeError)}，学习后 M${c.afterVersion} 偏差 ${errorText(c.afterError)}。两次预测使用同一起点和推力，橙色真实记录未改变，不代表下一趟表现。`:displayFlight?`本趟第 ${f.step} 拍；虚线是出发前模型 M${f.modelVersion} 的预测，实线是真实轨迹。${f.done?`实际距靶心 ${f.distance.toFixed(1)} 单位。`:''}`:'虚线是下一趟模型预演，尚未实际试飞。目标在右侧圆环。';
 renderComparison(c);
 $('results').hidden=!f?.done;$('result-link').hidden=!f?.done;
 if(f?.done){
  $('result-context').textContent=`第 ${f.number} 趟 · 出发时 M${f.modelVersion} · 风 ${windText(f.wind)}`;
  $('prediction-error').textContent=`${f.error.toFixed(1)} 单位`;$('target-distance').textContent=`${f.distance.toFixed(1)} 单位`;
  const reached=f.distance<=f.target.radius;
  $('result-title').textContent=reached?'抵达圆环。再看看模型猜得准不准。':'这一趟，还没到圆环。';
  $('result-explanation').textContent=f.error>3?'虚线与实线分开了：模型对运动的预测有偏差。先学习这趟真实观测，再用更新后的模型选路线。':reached?'这次预测与实际很接近，也到达了本趟的目标。猜得准和路线合适，是两件不同的事。':'模型已经预测得较准，但这条路线没到目标。试着让模型在脑内比较路线，而不是继续盲调参数。';
 }
 const p=s.previous;$('history').hidden=!p;
 if(p)$('history').textContent=`保留上一趟 #${p.number}：M${p.modelVersion} · 风 ${windText(p.wind)} · 预测偏差 ${p.error.toFixed(1)} · 距当时靶心 ${p.distance.toFixed(1)} 单位。${p.worldVersion!==s.worldVersion?'旧风况，不作同场比较。':'目标或路线可能不同，不作为严格算法排名。'}`;
 renderEnding();
}
function complete(){stop();lesson=recordLessonFlight(lesson,session.flight);render();message(`${$('guide-title').textContent} 下一步：${$('next').textContent}`);}
function animate(time,myToken){
 if(myToken!==token||!running)return;
 if(lastTime===null)lastTime=time;
 remainder+=Math.max(0,time-lastTime);lastTime=time;
 const count=Math.floor(remainder/100);remainder-=count*100;
 if(count)session=advanceFlight(session,Math.min(count,STEPS));
 if(session.flight?.done){complete();return;}
 render();frame=requestAnimationFrame(t=>animate(t,myToken));
}
function play(){
 if(media.matches){session=advanceFlight(session,STEPS);complete();return;}
 running=true;lastTime=null;const myToken=++token;frame=requestAnimationFrame(t=>animate(t,myToken));render();
}
function fly(){
 if(session.flight&&!session.flight.done)return;
 stop();session=startFlight(session);view='flight';message('出发了。看橙色路线，会不会和虚线重合？');play();
}
function enterFree(){lesson={...lesson,stage:'free'};}
function advanceGuide(){
 const next=nextLesson(lesson,session);lesson=next.lesson;session=next.session;
 if(next.fly){fly();return;}
 if(['learningComparison','relearningComparison'].includes(lesson.stage)){view='comparison';comparisonEmphasis='after';}
 else if(!['ending','free'].includes(lesson.stage))view='preview';
 render();message(`${$('guide-title').textContent} ${$('guide-copy').textContent}`);
 if(lesson.stage==='choose')$('choice-reuse').focus();
 if(view==='comparison')$('scene-wrap').scrollIntoView({block:'start',behavior:'instant'});
 if(lesson.stage==='ending'){$('ending-title').focus();$('lesson-ending').scrollIntoView({block:'start',behavior:'instant'});}
 if(lesson.stage==='free'){$('advanced-controls').open=true;$('next').focus();$('scene-wrap').scrollIntoView({block:'start',behavior:'instant'});}
}
$('fly').addEventListener('click',()=>{enterFree();fly();$('scene-wrap').scrollIntoView({block:'nearest',behavior:'instant'});});
$('next').addEventListener('click',()=>{
 const action=guidance().action;
 if(action==='resume'){if(!running){message('继续试飞。沿着刚才的位置往前飞。');play();}return;}
 if(lesson.stage!=='free'){advanceGuide();return;}
 if(action==='fly'){fly();return;}
 if(action==='replan'){
  session=selectPlan(session);view='preview';render();message('保留现有模型，只重新规划了路线。还没有实际出发。');return;
 }
 if(action==='learn'){
  session=learnLatest(session);view='comparison';comparisonEmphasis='after';render();
  message('只更新了模型。现在对照同一趟的两次预测，真实记录和方向推力都没变。');$('scene-wrap').scrollIntoView({block:'start',behavior:'instant'});return;
 }
 if(action==='wind'){
  stop();session=selectPlan(changeWind(session,session.wind>0?-1:0.6));view='preview';render();
  message('风变了，模型没有自动更新。点「用旧经验试飞」看结果。');
 }
});
for(const choice of Object.keys(CHOICES))$(`choice-${choice}`).addEventListener('click',()=>{
 const next=chooseLesson(lesson,choice);if(!next)return;
 lesson=next.lesson;session=next.session;render();$('next').focus();fly();
 $('scene-wrap').scrollIntoView({block:'nearest',behavior:'instant'});
});
$('finish-lesson').addEventListener('click',()=>{
 if(lesson.stage!=='result')return;
 lesson={...lesson,stage:'ending'};render();message('本轮实验结束。回顾里保留了刚才真实发生的结果。');
 $('ending-title').focus();$('lesson-ending').scrollIntoView({block:'start',behavior:'instant'});
});
$('free-experiment').addEventListener('click',()=>{if(lesson.stage==='ending')advanceGuide();});
$('pause').addEventListener('click',()=>{
 if(!session.flight||session.flight.done)return;
 if(running){stop();message('已暂停。可以走一拍，细看真实位置与预演的差别。');render();}else{message('继续试飞。预测仍是出发前锁定的那一条，不会追着真实路线改。');play();}
});
$('step').addEventListener('click',()=>{if(running||!session.flight||session.flight.done)return;session=advanceFlight(session);if(session.flight.done)complete();else render();});
$('learn').addEventListener('click',()=>{
 const next=learnLatest(session);if(next===session)return;enterFree();session=next;view='comparison';comparisonEmphasis='after';
 message(`模型更新为 M${session.model.version}。现在对照同一趟的学习前后预测，旧预测与分数原样保留。还没有规划新路线。`);render();
 $('next').focus();$('scene-wrap').scrollIntoView({block:'start',behavior:'instant'});
});
for(const key of ['before','after'])$(`compare-${key}`).addEventListener('click',()=>{
 if(view!=='comparison'||!session.comparison)return;
 comparisonEmphasis=key;render();message($('comparison-hint').textContent);
});
$('plan').addEventListener('click',()=>{
 if(session.flight&&!session.flight.done)return;
 enterFree();session=selectPlan(session);view='preview';message(`只用 M${session.model.version} 预演了 ${session.plan.candidates} 条路线。虚线不是保证，试飞才知道。`);render();
 $('scene-wrap').scrollIntoView({block:'nearest',behavior:'instant'});
});
for(const id of ['angle','power'])$(id).addEventListener('input',()=>{
 if(session.flight&&!session.flight.done)return;
 enterFree();session={...session,controls:{...session.controls,[id]:Number($(id).value)},plan:null};view='preview';render();
});
$('wind-flip').addEventListener('click',()=>{
 enterFree();stop();session=changeWind(session,session.wind>0?-1:0.6);view='preview';
 message('风变了，模型没有自动更新。先用旧模型选路线并试飞，再看它哪里猜错了。未完成的试飞不计入学习。');render();
});
$('reset').addEventListener('click',()=>{stop();session=createSession();lesson=createLesson();view='preview';$('advanced-controls').open=false;message('重新开始。所有试飞记录与学过的模型已清空。');render();$('next').focus();});
function pauseAway(){if(running){stop();message('已因离开页面暂停；回来后点「继续」，不会自动出发。');render();}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAway();});window.addEventListener('pagehide',pauseAway);
media.addEventListener('change',()=>{if(running){stop();message('动态效果设置已改变，试飞已暂停。点「继续」完成，或逐拍查看。');render();}});
$('theme').addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';$('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');});
render();
