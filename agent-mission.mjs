import {runAgentToolLoop} from './agent-tool.mjs?v=agent-tool-loop-v1';
import {readGenaiHandoffContext,createGenaiReturnUrl} from './genai-handoff.mjs?v=handoff-trust-v1';
import {createAgentResultStore} from './agent-last-result.mjs?v=last-result-v1';

const SOURCE={producer:'browser-session'};
const RECEIPT={unknown:'未核验','not-delivered':'未签收',delivered:'已签收'};
const OUTCOME={'in-progress':'进行中',verified:'核验到货',stopped:'主动停止','budget-exhausted':'次数用尽，未核验到货'};
const OBSERVATION={
 'not-delivered':['查询完成','签收台未查到这箱补给。工具有了回复，但任务还没完成。'],
 'retry-accepted':['备用单已受理','备用线路接了单。这不是签收，仍需查证。'],
 signed:['查询完成','签收台确认收到这箱补给。现在有证据说明任务已完成。'],
 stopped:['本轮已停止','你主动停止了本轮，没有核验到货。停止不等于交付完成。'],
 restarted:['已受理','新一轮回到同一起点。原单已受理，仍没有签收证据。'],
};
const STEP={'not-delivered':'查签收 · 未查到','retry-accepted':'重试 · 备用单受理，未核验到货',signed:'查签收 · 确认已签收',stopped:'停止 · 未核验到货',restarted:'回到同一起点'};

function describeComparison(trials){
 if(trials.length<2||trials[1].outcome==='in-progress')return '两轮从相同条件开始：同一张补给单，同样 3 次工具机会。';
 const [first,second]=trials;
 if(first.outcome===second.outcome)return first.outcome==='verified'?'两轮交付结果相同：都核验到货。再对照各自用了几次工具。':'两轮结果相同：都没有核验到货。再对照各自在哪一步停下。';
 if(first.outcome==='verified'||second.outcome==='verified')return `只有第 ${first.outcome==='verified'?1:2} 轮取得签收证据。对照两轮操作，看看从「接了单」到「确认到货」差在哪一步。`;
 return '两轮都没有核验到货，但停下来的原因不同。';
}

export function mountAgentMission({document,window}){
 const $=id=>document.getElementById(id);
 const el=name=>$(`mission-${name}`);
 const set=(name,text)=>{el(name).textContent=text;};
 const show=(name,visible)=>{el(name).hidden=!visible;};
 const legal=action=>receipt.result.availableActions.some(entry=>entry.action===action);
 const handoff=readGenaiHandoffContext(window.location,'agent-learning');
 const canReturn=!!handoff;
 const page=new URL(window.location.href);
 const isPublished=page.origin==='https://haimuhaimu.github.io'&&page.pathname==='/algorithm-playground/agent-mission.html';
 if(canReturn)el('os-fallback').href=handoff.returnURL;
 let receipt=runAgentToolLoop([],SOURCE);
 const store=createAgentResultStore(window,'agent-tool-loop');
 let previous=store.read(),archived=false,dismissed=false,saveStatus='';

 function renderPrevious(){
  const offered=!dismissed&&receipt.actions.length===0&&previous.status!=='empty';
  show('last-result',offered||archived);
  show('view-last',previous.status==='saved'&&!archived);
  set('last-title',archived?'正在看上次结果':previous.status==='saved'?'上次的两轮结果还在':'本机记录提示');
  set('last-message',archived?'这是上次的两轮操作，可导出 JSON。它不会作为这次新任务的操作带回 GenAI OS。':previous.status==='saved'
   ?'只留最近完成的一局。你可以回看，也可以从同一起点重新玩；未完成的新局不会覆盖它。'
   :previous.status==='invalid'?'上次的记录暂时无法核对，没有载入。仍可开始新局，其他学习记录没有改动。':'此浏览器暂时无法保留本机结果。仍可正常玩，结束后请先导出 JSON 再离开。');
 }

 function render(){
  const {result,fixture,steps}=receipt,trials=result.evidence.trials,current=trials[trials.length-1],last=steps[steps.length-1];
  const detail=last?OBSERVATION[last.observation]:['已受理','受理只说明系统接了单。对方收到没有，还要查签收。'];
  const lastTool=steps.findLast(step=>step.trial===current.number&&(step.action==='check'||step.action==='retry'));
  const toolReply=lastTool?OBSERVATION[lastTool.observation][0]:'已受理';
  const exhausted=current.outcome==='budget-exhausted';
  set('current',archived?'上次结果 · 第 2 轮':`第 ${current.number} 轮`);
  set('budget',`${fixture.toolBudget-current.toolCalls} / ${fixture.toolBudget}`);
  set('tool',toolReply);
  el('tool').dataset.tone=['已受理','备用单已受理'].includes(toolReply)?'success':'neutral';
  set('receipt',RECEIPT[current.receipt]);
  el('receipt').dataset.tone=current.receipt==='delivered'?'success':current.receipt==='not-delivered'?'warning':'unknown';
  set('feedback',exhausted?`${detail[1]} 工具次数用尽，本轮未核验到货。`:detail[1]);
  el('scene').dataset.receipt=current.receipt;
  el('scene').dataset.backup=String(current.backupDispatched);
  set('scene-caption',current.receipt==='delivered'?'已核对签收':current.backupDispatched?'备用线已发出 · 等待核验':current.receipt==='not-delivered'?'查无签收':'等待签收证据');
  for(const action of ['check','retry','stop','restart'])el(action).disabled=!legal(action);
  show('actions',current.outcome==='in-progress');
  show('cost',current.outcome==='in-progress');
  show('restart',legal('restart'));
  show('share',result.workflowComplete);
  show('return',canReturn&&!archived);
  show('os-fallback',(!canReturn||archived)&&isPublished);
  show('os-manual',(!canReturn||archived)&&!isPublished);
  set('save-status',archived?'正在回看本机上次结果；没有记成新的学习进度。':saveStatus);
  set('share-title',archived?'上次两轮已结束':'两轮已结束');
  set('comparison',describeComparison(trials));
  if(trials.length<2)el('trial-2').innerHTML='<p>首轮结束后，可回到同一起点再试。</p>';
  for(const trial of trials){
   const items=steps.filter(step=>step.trial===trial.number).map(step=>`<li><span>${STEP[step.observation]}</span><small>余 ${step.remaining} 次</small></li>`).join('');
   el(`trial-${trial.number}`).innerHTML=`<p class="mission-trial-summary"><strong>${OUTCOME[trial.outcome]}</strong><span>${RECEIPT[trial.receipt]} · 用了 ${trial.toolCalls} 次</span></p><ol class="mission-timeline"><li><span>起点 · 已受理，未核验</span><small>余 ${fixture.toolBudget} 次</small></li>${items}</ol>`;
  }
  renderPrevious();
 }
 function act(action){
  if(document.hidden||archived||!legal(action))return;
  try{
   receipt=runAgentToolLoop([...receipt.actions,{action}],SOURCE);
  }catch{set('feedback','这次没有执行成功，原操作记录仍在。请重试。');return;}
  dismissed=true;
  if(receipt.result.workflowComplete){
   const saved=store.save(receipt);
   if(saved.status==='saved')previous={status:'saved',receipt};
   saveStatus=saved.status==='saved'?'已保留在本机，续关或刷新后可回来查看。这不是学习进度。':'未能在本机保留这局。当前结果仍在，请先生成并复制 JSON 再离开。';
  }
  render();
  if(legal('restart'))el('restart').focus();
  else if(receipt.result.workflowComplete)el('share-title').focus();
  else if(action==='restart'||!legal(action))el('current').focus();
 }
 for(const action of ['check','retry','stop','restart'])el(action).addEventListener('click',()=>act(action));
 function clearExport(){el('export-text').value='';show('export-record',false);set('share-status','');}
 function newRun(){
  if(document.hidden||(!archived&&receipt.actions.length&&!receipt.result.workflowComplete))return;
  receipt=runAgentToolLoop([],SOURCE);archived=false;dismissed=true;saveStatus='';clearExport();
  const note=previous.status==='saved'?'上一份完整结果会留到这局结束。':previous.status==='unavailable'?'本机暂不能保留结果，结束后请先导出 JSON。':'';
  render();set('feedback','新一局开始：同一张补给单、同样 3 次机会。'+note);el('current').focus();
 }
 for(const name of ['new-run','fresh'])el(name).addEventListener('click',newRun);
 el('view-last').addEventListener('click',()=>{
  if(document.hidden||receipt.actions.length||dismissed)return;
  previous=store.read();
  if(previous.status!=='saved'){renderPrevious();return;}
  receipt=previous.receipt;archived=true;clearExport();render();el('share-title').focus();
 });
 el('return').addEventListener('click',()=>{
  if(document.hidden||archived||!receipt.result.workflowComplete||!canReturn)return;
  try{
   window.location.assign(createGenaiReturnUrl(handoff,receipt,window.location));
  }catch{
   show('os-fallback',true);
   set('share-status','暂时无法带回。两轮记录仍保留，可生成 JSON 后回 GenAI OS 手动导入。');
  }
 });
 el('export').addEventListener('click',()=>{
  if(document.hidden||!receipt.result.workflowComplete)return;
  el('export-text').value=JSON.stringify(receipt,null,2);
  show('export-record',true);
  el('export-text').focus();
  set('share-status','JSON 已生成，仍在本页，没有上传。');
 });
 el('copy').addEventListener('click',async()=>{
  const snapshot=receipt,text=el('export-text').value;
  if(document.hidden||!text)return;
  try{
   await window.navigator.clipboard.writeText(text);
   if(receipt!==snapshot||document.hidden)return;
   set('share-status','已复制。请自行选择是否分享或导入。');
  }catch{
   if(receipt!==snapshot||document.hidden)return;
   el('export-text').focus();el('export-text').select();
   set('share-status','浏览器没有允许自动复制。已选中 JSON，请手动复制。');
  }
 });
 const theme=$('home-theme'),scheme=window.matchMedia('(prefers-color-scheme: dark)');
 let manualTheme=false;
 function applyTheme(dark){
  document.documentElement.dataset.theme=dark?'dark':'light';
  theme.setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');
 }
 applyTheme(scheme.matches);theme.hidden=false;
 theme.addEventListener('click',()=>{manualTheme=true;applyTheme(document.documentElement.dataset.theme!=='dark');});
 scheme.addEventListener('change',event=>{if(!manualTheme)applyTheme(event.matches);});
 render();
}
if(typeof document!=='undefined'&&document.getElementById('mission'))mountAgentMission({document,window});
