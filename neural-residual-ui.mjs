import {createResidualLesson,setResidualShortcut,setResidualZero,selectResidualSignal,openResidualTraining,stepResidualPair,answerResidual,resetResidual,residualEvidence} from './neural-residual.mjs';
import {paintResidualSignal,paintResidualField} from './neural-residual-view.mjs';
const vector=v=>'['+v.map(n=>(Math.abs(n)<.00005?0:n).toFixed(2)).join(', ')+']';
export function mountResidualLesson({document,window}){
 const $=id=>document.getElementById(id),set=(id,text)=>{$(id).textContent=text;};
 const s=createResidualLesson(),canvas=$('residual-map'),supported=[canvas,$('residual-plain-map'),$('residual-res-map')].every(c=>!!c.getContext('2d'));
 let opened=false,view='residual';
 function render(){
  const e=residualEvidence(s),learning=s.stage==='learn',dark=document.documentElement.dataset.theme==='dark';
  $('residual-lesson').hidden=!opened;$('residual-signal-stage').hidden=learning;$('residual-training-stage').hidden=!learning;
  $('residual-lesson').setAttribute('data-stage',s.stage);
  set('residual-subtitle',learning?'恢复真实分支。直通路没有替你答题，两种结构仍然需要学习。':'先让变化为零。原来的信号，还能到达输出吗？');
  $('residual-circuit').setAttribute('data-enabled',String(s.skip));set('residual-circuit-shortcut',s.skip?'原信号直接相加':'直通路关闭');set('residual-circuit-branch',`变化 ${vector(e.signal.change)}`);set('residual-circuit-output',s.skip?'输入 + 变化':'只输出变化');
  $('residual-shortcut').disabled=$('residual-zero').disabled=!supported;
  $('residual-shortcut').setAttribute('aria-pressed',String(s.skip));set('residual-shortcut',s.skip?'关闭直通路，再看一次':'打开直通路');
  $('residual-shortcut').setAttribute('data-first',String(!s.sawIdentity));$('residual-zero').hidden=$('residual-learn').hidden=!s.sawIdentity;
  $('residual-zero').setAttribute('aria-pressed',String(!s.zeroBranch));set('residual-zero',s.zeroBranch?'再试：让变化分支工作':'让变化分支暂时归零');
  $('residual-learn').disabled=!s.sawIdentity||!supported;
  set('residual-path',s.skip?'直通路打开：原信号直接加到输出':'直通路关闭：只输出变化分支');
  set('residual-vector-input',`输入 ${e.signalId} ${vector(e.signal.input)}`);set('residual-vector-change',`变化 ${vector(e.signal.change)}`);set('residual-vector-output',`输出 ${vector(e.signal.output)}`);
  set('residual-reading',s.zeroBranch?(s.skip?'变化为 0，输出仍等于输入。直通路把原信号带过来了；两个标记现在重合。':'变化分支输出 0，没有直通路时，输出也只剩 0。空心圈是进来时的信号，实心点是出去时的信号。'):(s.skip?'输出 = 原信号 + 这次变化。原信号不是被替换，而是直接参与相加。':'没有直通路，输出只来自变化分支。切换直通路，对比同一份输入和同一份变化。'));
  set('residual-map-text',`输入信号 ${e.signalId} 为 ${vector(e.signal.input)}，变化为 ${vector(e.signal.change)}，输出为 ${vector(e.signal.output)}。${s.skip?'已相加原信号。':'未相加原信号。'}这是内部表示，不是移动原始样本。`);
  for(const [i,id]of ['A','B','C'].entries())$('residual-pick-'+id).setAttribute('aria-pressed',String(i===s.selected));
  set('residual-status',!supported?'此浏览器不支持 Canvas，无法展示本课信号与分界。可阅读下面说明，或返回前两课。':s.sawIdentity?'你已经看到“变化为 0，原信号仍能通过”。接下来恢复真实分支，让两种结构都学习。':'先保持变化为 0，打开一次直通路，看看输出去哪了。');
  for(const [key,id]of [['plain','plain'],['residual','res']]){
   const r=e[key];set('residual-'+id+'-metric',`误差 ${r.before.loss.toFixed(3)} → ${r.now.loss.toFixed(3)}`);
   set('residual-'+id+'-mistakes',`分错 ${r.before.mistakes.length} → ${r.now.mistakes.length} / 6`);
  }
  set('residual-steps',`两边各更新 ${e.steps} / 200 步`);
  const lower=e.plain.now.loss<e.residual.now.loss?'普通结构':'残差结构';
  set('residual-comparison',e.steps?`本轮${lower}的训练误差较低。两边都在真实学习；这是一个很浅、只有 6 个样本的小例子，不说明哪种结构一定更好。请同时看各自的起点与变化。`:'分支和分类头的初始参数相同，但结构不同，起始预测也不同。不能把起点差异当成残差更强的证据。');
  $('residual-step').disabled=$('residual-twenty').disabled=!supported||e.steps===200;
  $('residual-answer-carry').disabled=$('residual-answer-perfect').disabled=!e.steps||!supported;
  $('residual-takeaway').hidden=s.answer!=='carry';
  set('residual-answer',s.answer==='perfect'?'再想一下：直通路做的是相加，不会替你检查答案。当前两边的误差，就是实际训练结果。':s.answer==='carry'?'对。变化分支和分类头仍需学习；多出来的是一条让原信号直接相加的路径。':'训练过一步后，再回答这次看到了什么。');
  set('residual-internal',`以信号 ${e.signalId} 为例：输入 ${vector(e.signal.input)}；残差分支 ${vector(e.signal.change)}；相加后 ${vector(e.signal.output)}。原始样本坐标没有变化。`);
  $('residual-plain-panel').setAttribute('data-active',String(view==='plain'));$('residual-res-panel').setAttribute('data-active',String(view==='residual'));
  for(const name of ['plain','residual'])$('residual-view-'+name).setAttribute('aria-pressed',String(view===name));
  if(opened&&supported){if(!learning)paintResidualSignal(canvas,e,{dark});else{paintResidualField($('residual-plain-map'),s.models.plain,s.points,{dark});paintResidualField($('residual-res-map'),s.models.residual,s.points,{dark});}}
 }
 const canAct=()=>opened&&supported&&!document.hidden;
 function open(){opened=true;window.dispatchEvent(new Event('neural-gradient-open'));window.dispatchEvent(new Event('neural-guide-pause'));render();$('residual-title').focus({preventScroll:true});$('residual-lesson').scrollIntoView({block:'start',behavior:'instant'});}
 $('gradient-open-residual').addEventListener('click',open);
 $('residual-shortcut').addEventListener('click',()=>{if(canAct()&&s.stage==='signal'){setResidualShortcut(s,!s.skip);render();$('residual-lesson').scrollIntoView({block:'start',behavior:'instant'});}});
 $('residual-zero').addEventListener('click',()=>{if(canAct()&&s.stage==='signal'){setResidualZero(s,!s.zeroBranch);render();$('residual-lesson').scrollIntoView({block:'start',behavior:'instant'});}});
 for(const [i,id]of ['A','B','C'].entries())$('residual-pick-'+id).addEventListener('click',()=>{if(canAct()){selectResidualSignal(s,i);render();}});
 $('residual-learn').addEventListener('click',()=>{if(!canAct()||!s.sawIdentity||s.stage!=='signal')return;openResidualTraining(s);render();$('residual-training-stage').scrollIntoView({block:'start',behavior:'instant'});$('residual-training-title').focus({preventScroll:true});});
 for(const [id,n]of [['step',1],['twenty',20]])$('residual-'+id).addEventListener('click',()=>{if(canAct()&&s.stage==='learn'){stepResidualPair(s,n);render();}});
 for(const answer of ['carry','perfect'])$('residual-answer-'+answer).addEventListener('click',()=>{if(canAct()&&s.stage==='learn'&&s.models.residual.epoch){answerResidual(s,answer);render();}});
 for(const name of ['plain','residual'])$('residual-view-'+name).addEventListener('click',()=>{if(canAct()){view=name;render();}});
 $('residual-reset').addEventListener('click',()=>{if(!opened||document.hidden)return;resetResidual(s);view='residual';render();$('residual-lesson').scrollIntoView({block:'start',behavior:'instant'});$('residual-title').focus({preventScroll:true});});
 function route(){if(window.location.hash==='#residual-lesson')open();}window.addEventListener('hashchange',route);
 if(typeof MutationObserver!=='undefined')new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 render();route();return {snapshot:()=>structuredClone(s)};
}
if(typeof document!=='undefined'&&document.getElementById('residual-lesson'))mountResidualLesson({document,window});
