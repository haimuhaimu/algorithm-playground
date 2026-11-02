import {createBayesLesson,actBayesLesson,bayesLessonEvidence} from './mining-bayes.mjs?v=bayes-1';

const percent=value=>(value*100).toFixed(1)+'%';
const interval=belief=>`真实成功率的 90% 可信区间：${percent(belief.interval[0])}–${percent(belief.interval[1])}`;
const answerLabels={never:'能，命中率都是 0%',guarantee:'样本更多，下一趟就一定挖得到',evidence:'不能；0/10 更支持低概率，但不是证明为零'};
const x=value=>14+572*value;
const y=value=>188-164*value/6;
const path=curve=>curve.map((point,i)=>`${i?'L':'M'}${x(point.x).toFixed(2)},${y(point.y).toFixed(2)}`).join(' ');
// Fixed axes for baseline/update only. Transfer Beta(1,11) peaks at 11;
// transfer evidence is numeric, so that density is never clipped to fit.
function chart(series){
 const grid=[0,2,4,6].map(value=>`<line x1="14" x2="586" y1="${y(value)}" y2="${y(value)}" class="bayes-grid"/>`).join('');
 const bands=series.filter(s=>!s.before).map(s=>`<rect x="${x(s.belief.interval[0])}" y="24" width="${572*(s.belief.interval[1]-s.belief.interval[0])}" height="164" class="bayes-band bayes-${s.id}"/>`).join('');
 const lines=series.map(s=>`<path d="${path(s.belief.curve)}" class="bayes-line bayes-${s.id}${s.before?' bayes-before':''}" vector-effect="non-scaling-stroke"/>`).join('');
 return `<svg viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true">${bands}${grid}${lines}</svg>`;
}

export function initBayesLesson({onEnter=()=>{}}={}){
 const doc=document,win=window,$=id=>doc.getElementById(id);
 let state=createBayesLesson(),opened=false;
 const available=()=>opened&&!doc.hidden&&!$('guide').open;
 const focus=id=>{$(id).focus({preventScroll:true});$(id).scrollIntoView({block:'start',behavior:'instant'});};
 function render(){
  const e=bayesLessonEvidence(state),compared=e.phase!=='predict';
  $('bayes-lesson').hidden=!opened;$('bayes-start').setAttribute('aria-expanded',String(opened));
  $('bayes-comparison').hidden=!compared;$('bayes-updated').hidden=!e.after;
  $('bayes-transfer-results').hidden=!e.transfer;$('bayes-ending').hidden=!e.ending;
  for(const value of ['little','many','same']){
   const guess=$('bayes-guess-'+value),change=$('bayes-change-'+value);
   guess.setAttribute('aria-pressed',String(e.guess===value));guess.disabled=compared;
   change.setAttribute('aria-pressed',String(e.changeGuess===value));change.disabled=e.phase!=='compare';
  }
  $('bayes-reveal').disabled=e.phase!=='predict'||e.guess===null;
  $('bayes-update').disabled=e.phase!=='compare'||e.changeGuess===null;
  for(const value of ['never','evidence','guarantee']){
   $('bayes-answer-'+value).disabled=e.phase!=='updated';
   $('bayes-answer-'+value).setAttribute('aria-pressed',String(state.attempts.at(-1)===value));
  }
  $('bayes-chart-overview').innerHTML=compared?chart(e.baseline.map(row=>({id:row.id,belief:row.belief}))):'';
  $('bayes-guess-feedback').textContent=compared?(e.guess==='many'?'你的判断是 B。':'你刚才选了 '+(e.guess==='same'?'“一样”':'A')+'。')+' 看曲线宽窄：B 的观察更多，对未知成功率的判断更集中；这不等于 B 一定有更高的真实成功率。':'';
  for(const row of e.baseline){
   $('bayes-mean-'+row.id).textContent=row.belief?percent(row.belief.mean):'';
   $('bayes-interval-'+row.id).textContent=row.belief?interval(row.belief):'';
   const after=e.after?.find(item=>item.id===row.id);
   $('bayes-change-summary-'+row.id).textContent=after?`${percent(row.belief.mean)} → ${percent(after.belief.mean)} · 下降 ${((row.belief.mean-after.belief.mean)*100).toFixed(1)} 个百分点`:'';
   $('bayes-after-chart-'+row.id).innerHTML=after?chart([{id:row.id,belief:row.belief,before:true},{id:row.id,belief:after.belief}]):'';
   $('bayes-after-interval-'+row.id).textContent=after?'更新后 '+interval(after.belief):'';
   if(after)$('bayes-after-chart-'+row.id).setAttribute('aria-label',`${row.id==='little'?'A 少样本':'B 多样本'}：更新前 ${percent(row.belief.mean)}，更新后 ${percent(after.belief.mean)}。${interval(after.belief)}。虚线为更新前，实线为更新后。`);
  }
  $('bayes-update-feedback').textContent=e.after?(e.changeGuess==='little'?'你猜中了变化更大的 A。':'结果是 A 下降更多。')+' 同样一次空手，在少样本日志里占比更大；B 还有更多旧观察，新反馈并不会抹掉它们。':'';
  const last=state.attempts.at(-1);
  $('bayes-answer-feedback').textContent=!last?'':last==='evidence'?'对，没挖到不等于永远没有；0/10 比 0/1 更支持低概率，但仍保留不确定性。':last==='never'?'不能从有限次空手断言永远没矿。看看下面两份判断，再选一次。':'更多空手不是“下一趟该中奖”的保证。下面是模型更新后的预测，可以修正你的选择。';
  $('bayes-transfer-results').textContent=e.transfer?e.transfer.map(row=>`${row.id==='one'?'0/1':'0/10'}：下一次命中预测 ${percent(row.belief.mean)}；${interval(row.belief)}。`).join('\n'):'';
  $('bayes-ending-evidence').textContent=e.ending?(e.ending.firstAttemptCorrect?`你第一次就选择了「${answerLabels.evidence}」。`:`第一次，你选了「${answerLabels[state.attempts[0]]}」。看到对照后，你修正为「${answerLabels.evidence}」。`)+' 这记录的是本次选择，不代表已经掌握或通过测验。':'';
 }
 function open(){if(doc.hidden||$('guide').open)return;onEnter();opened=true;render();focus('bayes-title');}
 function act(action,heading){
  if(!available())return;
  const before=state.phase;state=actBayesLesson(state,action);render();
  if(heading&&state.phase!==before)focus(heading);
 }
 $('bayes-start').addEventListener('click',open);
 $('bayes-close').addEventListener('click',()=>{if(!available())return;opened=false;render();$('bayes-start').focus();});
 $('bayes-reset').addEventListener('click',()=>{if(!available())return;state=createBayesLesson();render();focus('bayes-title');});
 for(const value of ['little','many','same']){
  $('bayes-guess-'+value).addEventListener('click',()=>act({type:'guess',value}));
  $('bayes-change-'+value).addEventListener('click',()=>act({type:'change-guess',value}));
 }
 $('bayes-reveal').addEventListener('click',()=>act({type:'reveal'},'bayes-comparison-title'));
 $('bayes-update').addEventListener('click',()=>act({type:'update'},'bayes-updated-title'));
 for(const value of ['never','evidence','guarantee'])$('bayes-answer-'+value).addEventListener('click',()=>act({type:'answer',value},'bayes-ending-title'));
 win.addEventListener('hashchange',()=>{if(win.location?.hash==='#bayes-lesson')open();});
 render();if(win.location?.hash==='#bayes-lesson')open();
}
