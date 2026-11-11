import {createBayesLesson,actBayesLesson,bayesLessonEvidence} from './mining-bayes.mjs?v=transfer-feedback-v1';
import {runBayesTool} from './bayes-tool.mjs?v=transfer-feedback-v1';
import {readGenaiHandoffContext,createGenaiReturnUrl} from './genai-handoff.mjs?v=transfer-feedback-v1';

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
 let state=createBayesLesson(),opened=false,journal=[],exportGeneration=0;
 const handoff=readGenaiHandoffContext(win.location,'bayes-learning');
 const available=()=>opened&&!doc.hidden&&!$('guide').open;
 const focus=id=>{$(id).focus({preventScroll:true});$(id).scrollIntoView({block:'start',behavior:'instant'});};
 function render(){
  const e=bayesLessonEvidence(state),compared=e.phase!=='predict';
  $('bayes-lesson').hidden=!opened;$('bayes-start').setAttribute('aria-expanded',String(opened));
  $('bayes-comparison').hidden=!compared;$('bayes-updated').hidden=!e.after;
  $('bayes-transfer-results').hidden=!e.transfer;$('bayes-ending').hidden=!e.ending;
  $('bayes-try-again').hidden=!e.transfer||Boolean(e.ending);
  $('bayes-genai-return').hidden=!e.ending||!handoff;
  $('bayes-export').hidden=!e.ending;$('bayes-export-generate').disabled=!e.ending;
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
  $('bayes-answer-feedback').textContent=!last?'':last==='evidence'?'对。和只空手一次相比，连着十次没挖到，更支持产矿概率偏低。但偏低不等于零。':last==='never'?'没挖到不等于永远没有。两边的预测都不是零，看完数字再选一次。':'更多空手不代表下一趟就该中奖。这两份日志里，空手更多的那颗，预测反而更低。';
  for(const id of ['one','ten']){
   const belief=e.transfer?.find(row=>row.id===id)?.belief;
   $('bayes-transfer-prediction-'+id).textContent=belief?percent(belief.mean):'';
   $('bayes-transfer-interval-'+id).textContent=belief?interval(belief):'';
  }
  $('bayes-ending-evidence').textContent=e.ending?(e.ending.firstAttemptCorrect?`你第一次就选择了「${answerLabels.evidence}」。`:`第一次，你选了「${answerLabels[state.attempts[0]]}」。看到对照后，你修正为「${answerLabels.evidence}」。`)+' 这记录的是本次选择，不代表已经掌握或通过测验。':'';
 }
 function open(){if(doc.hidden||$('guide').open)return;onEnter();opened=true;render();focus('bayes-title');}
 function act(action,heading){
  if(!available())return;
  journal.push(action.value===undefined?{action:action.type}:{action:action.type,value:action.value});
  clearExport();
  const before=state.phase;state=actBayesLesson(state,action);render();
  if(heading&&state.phase!==before)focus(heading);
  return true;
 }
 function clearExport(){exportGeneration++;$('bayes-export-text').value='';$('bayes-export-record').hidden=true;$('bayes-export-status').textContent='';$('bayes-genai-status').textContent='';$('bayes-new-record').hidden=journal.length<=256;}
 $('bayes-export-generate').addEventListener('click',()=>{
  if(!available()||state.phase!=='done')return;
  clearExport();try{$('bayes-export-text').value=JSON.stringify(runBayesTool(journal,{producer:'browser-session'}),null,2);$('bayes-export-record').hidden=false;$('bayes-export-status').textContent='记录已生成，只在本页。包含本课的真实选择与纠错，不含自由探索或草稿。主动分享后才会离开这里；完成不代表掌握。';}
  catch{$('bayes-export-status').textContent='这轮操作超出记录上限，暂未导出。当前结果仍保留，没有截断记录。可用下方“开始新记录”明确清空本轮小课后重试；不影响自由探索或其他草稿。';}
 });
 $('bayes-export-copy').addEventListener('click',async()=>{
  if(!available()||state.phase!=='done')return;const text=$('bayes-export-text').value,generation=exportGeneration;if(!text)return;
  try{if(!win.navigator?.clipboard?.writeText)throw Error('Clipboard unavailable');await win.navigator.clipboard.writeText(text);if(generation===exportGeneration)$('bayes-export-status').textContent='已复制。请主动交给自己的 AI，让它先重放核对，再根据本轮证据陪练；不要把猜对当成掌握。';}
  catch{if(generation!==exportGeneration)return;$('bayes-export-text').focus();$('bayes-export-text').select?.();$('bayes-export-status').textContent='浏览器未允许复制，记录仍保留。请在下方文本框手动全选、复制；没有自动发送。';}
 });
 $('bayes-genai-send').addEventListener('click',()=>{
  if(!available()||state.phase!=='done'||!handoff)return;
  try{win.location.assign(createGenaiReturnUrl(handoff,runBayesTool(journal,{producer:'browser-session'}),win.location));}
  catch{$('bayes-genai-status').textContent='暂时无法带回，当前结果仍保留。可生成下方实验记录，再回到 GenAI OS 手动粘贴；没有自动发送或改写草稿。';}
 });
 $('bayes-start').addEventListener('click',open);
 $('bayes-new-record').addEventListener('click',()=>{if(!available()||journal.length<=256)return;state=createBayesLesson();journal=[];clearExport();render();focus('bayes-title');});
 $('bayes-close').addEventListener('click',()=>{if(!available())return;opened=false;render();$('bayes-start').focus();});
 $('bayes-reset').addEventListener('click',()=>{if(!available())return;act({type:'reset'});focus('bayes-title');});
 for(const value of ['little','many','same']){
  $('bayes-guess-'+value).addEventListener('click',()=>act({type:'guess',value}));
  $('bayes-change-'+value).addEventListener('click',()=>act({type:'change-guess',value}));
 }
 $('bayes-reveal').addEventListener('click',()=>act({type:'reveal'},'bayes-comparison-title'));
 $('bayes-update').addEventListener('click',()=>act({type:'update'},'bayes-updated-title'));
 for(const value of ['never','evidence','guarantee'])$('bayes-answer-'+value).addEventListener('click',()=>{
  if(state.phase==='updated'&&act({type:'answer',value}))focus('bayes-transfer-title');
 });
 $('bayes-try-again').addEventListener('click',()=>{
  if(available()&&state.phase==='updated'&&state.attempts.length)focus('bayes-transfer-question');
 });
 win.addEventListener('hashchange',()=>{if(win.location?.hash==='#bayes-lesson')open();});
 clearExport();render();if(handoff||win.location?.hash==='#bayes-lesson')open();
}
