import {runAgentReroute} from './agent-reroute-tool.mjs?v=agent-reroute-v1';
import {readGenaiHandoffContext,createGenaiReturnUrl} from '../../integrations/genai-handoff.mjs?v=handoff-trust-v1';
import {createAgentResultStore} from '../shared/agent-last-result.mjs?v=last-result-v1';

const SOURCE={producer:'browser-session'};
const CONTROLS={advance:'advance',dispatch:'reroute','keep-old':'keep-old','verify-new':'verify-new','accept-old':'accept-old',stop:'stop'};
const EVENTS={
 'correction-start':'继续字幕 · 改口只到半句',
 'correction-confirmed':'继续字幕 · 用户确认改送 08',
 'reroute-accepted':'改派到 08 · SUP-08 已派出',
 'kept-old':'保留旧单 · 未发出 SUP-08',
 'old-receipt':'查看迟到回执 · SUP-07 在 07 签收',
 'old-receipt-misattributed':'用 07 回执结案 · 错配，08 未核验',
 'new-receipt-verified':'核对 08 签收 · SUP-08 在 08 签收',
 'stopped-unverified':'停止核验 · 08 未核验',
};
const OUTCOMES={misattributed:'结案错配 · 08 未核验',unverified:'已停止 · 08 未核验',verified:'08 签收已核验'};

function responseTo({workflowComplete,evidence:{outcome,dispatched08,newReceipt}}){
 if(!workflowComplete)return '';
 if(outcome==='verified'&&newReceipt)return `「单号 ${newReceipt.orderId} 和 ${newReceipt.station} 号站都对上了，这单可以结案。」`;
 if(outcome==='misattributed')return '「这张是 07 的回执。我改要的 08，还没核验。」';
 if(outcome==='unverified')return dispatched08
  ?'「08 的单已经派出，但还没核对签收。先别算送到了。」'
  :'「08 还没派单，不能算送到。」';
 return '';
}

function describe({stage,evidence:{dispatched08,outcome}},lastEvent){
 switch(stage){
  case 'original': return ['原单在途','07 原单已经发出。继续看用户怎么说。'];
  case 'partial': return ['指令还没说完','字幕只到半句，目的地还没改。原单仍在途。'];
  case 'decision': return ['改送指令已确认','目标改成了 08，但原单不会自动改道或撤回。现在要怎么派单？'];
  case 'await-old': return dispatched08?['08 新单已派出','SUP-08 已派出，还没有签收。07 原单也没有被撤回。']:['仍只有 07 原单','你没有发出新单；用户最新要求仍是送到 08。'];
  case 'review': return ['迟到的回执到了',lastEvent==='reroute-accepted'?'SUP-08 已发出，等你核对签收。刚收到的 SUP-07 仍是 07 的回执。':dispatched08?'07 的回执到了。当前目标是 08，你会用哪张单结案？':'07 的回执到了。08 还没派单，不能直接核对 08 的签收。'];
  case 'done': return [OUTCOMES[outcome],{
   misattributed:'SUP-07 只证明 07 收到了补给。用它结案，把旧目标的证据算给了 08；08 仍未核验。',
   unverified:'你选择停止。07 的签收记录仍然有效，但 08 没有核验，不能算完成交付。',
   verified:'签收回执上的单号 SUP-08 和站点 08 都对上了。SUP-07 仍只属于旧任务。',
  }[outcome]];
 }
}

export function mountAgentReroute({document,window}){
 const $=id=>document.getElementById(id);
 const e=name=>$(`reroute-${name}`);
 const set=(name,text)=>{if(e(name).textContent!==text)e(name).textContent=text;};
 const show=(name,visible)=>{e(name).hidden=!visible;};
 const focus=name=>e(name).focus({preventScroll:true});
 const handoff=readGenaiHandoffContext(window.location,'agent-reroute');
 const canReturn=!!handoff;
 let run=runAgentReroute([],SOURCE),replayAt=null;
 const store=createAgentResultStore(window,'agent-reroute');
 let previous=store.read(),archived=false,dismissed=false,saveStatus='';
 if(canReturn)e('os-fallback').href=handoff.returnURL;

 function renderPrevious(){
  show('last-result',(!dismissed&&run.actions.length===0&&previous.status!=='empty')||archived);
  show('view-last',previous.status==='saved'&&!archived);
  set('last-title',archived?'正在看上次结果':previous.status==='saved'?'上次的改派结果还在':'本机记录提示');
  set('last-message',archived?'这是上次的操作，可逐步重放或导出 JSON。它不会作为这次新任务的操作带回 GenAI OS。':previous.status==='saved'
   ?'只留最近完成的一局。你可以回看，也可以从同一起点重新玩；未完成的新局不会覆盖它。'
   :previous.status==='invalid'?'上次的记录暂时无法核对，没有载入。仍可开始新局，其他学习记录没有改动。':'此浏览器暂时无法保留本机结果。仍可正常玩，结束后请先导出 JSON 再离开。');
 }

 function render(){
  const replaying=replayAt!==null;
  const view=replaying?runAgentReroute(run.actions.slice(0,replayAt),SOURCE):run;
  const {result,steps}=view,{stage,workflowComplete,evidence,availableActions}=result;
  const {activeTarget,dispatched08,oldReceipt,newReceipt,outcome}=evidence;
  const [status,feedback]=describe(result,steps.at(-1)?.event);
  const ready=action=>availableActions.some(entry=>entry.action===action);
  Object.assign(e('scene').dataset,{target:activeTarget,dispatched:String(dispatched08),oldReceipt:String(Boolean(oldReceipt)),newReceipt:String(Boolean(newReceipt)),outcome});
  set('active-target',`当前目标 · ${activeTarget} 号站`);
  set('old-route',oldReceipt?'旧单已签收':'原单在途');
  set('new-route',newReceipt?'新单已核验':dispatched08?'已派出，待核验':'尚未派单');
  set('status',status);
  e('status').dataset.outcome=outcome;
  set('caption',stage==='original'?'「先送到 07 号站。」':stage==='partial'?'「等等，改送……」':'「改送 08 号站。」');
  set('old-receipt',oldReceipt?`${oldReceipt.orderId} · ${oldReceipt.station} 号站签收`:'等待回执');
  set('new-receipt',newReceipt?`${newReceipt.orderId} · ${newReceipt.station} 号站签收`:dispatched08?'已派单，未核验':'未派单');
  e('old-receipt').dataset.tone=oldReceipt?'old':'waiting';
  e('new-receipt').dataset.tone=newReceipt?'success':'waiting';
  const response=responseTo(result);
  set('response-text',response);
  show('response',Boolean(response));
  set('feedback',feedback);
  set('advance',stage==='await-old'?'查看迟到回执':'继续字幕');
  for(const [name,action] of Object.entries(CONTROLS)){
   const allowed=ready(action);
   show(name,allowed||(name==='verify-new'&&stage==='review'));
   e(name).disabled=!allowed;
  }
  show('actions',!replaying&&!workflowComplete);
  show('share',!replaying&&workflowComplete);
  show('return',canReturn&&!archived);
  show('os-manual',!canReturn||archived);
  set('save-status',archived?'正在回看本机上次结果；没有记成新的学习进度。':saveStatus);
  show('replay-controls',replaying);
  set('review-title',replaying?'已回放的操作':archived?'上次操作':'本轮操作');
  if(replaying){
   set('replay-position',`回放 ${replayAt} / ${run.actions.length} 步`);
   e('replay-prev').disabled=replayAt===0;
   e('replay-next').disabled=replayAt===run.actions.length;
  }
  // The reducer emits a fixed set of event IDs. All rendered item text is local copy.
  const row=(index,event,label)=>`<li data-event="${event}"${index===steps.length?' aria-current="step"':''}><span>${label}</span></li>`;
  e('timeline').innerHTML=row(0,'start','07 原单发出 · 等待签收')+steps.map(({event},i)=>row(i+1,event,EVENTS[event])).join('');
  renderPrevious();
 }

 function act(name,action){
  if(document.hidden||archived||replayAt!==null||!run.result.availableActions.some(entry=>entry.action===action))return;
  try{run=runAgentReroute([...run.actions,{action}],SOURCE);}
  catch{set('feedback','操作没有执行成功，已有记录仍在。请重试。');return;}
  dismissed=true;
  if(run.result.workflowComplete){
   const saved=store.save(run);
   if(saved.status==='saved')previous={status:'saved',receipt:run};
   saveStatus=saved.status==='saved'?'已保留在本机，续关或刷新后可回来查看。这不是学习进度。':'未能在本机保留这局。当前结果仍在，请先生成并复制 JSON 再离开。';
  }
  render();
  if(run.result.workflowComplete||e(name).hidden)focus('status');
  if(run.result.workflowComplete){
   const status=e('status'),response=e('response');
   if(status.getBoundingClientRect().top<8||response.getBoundingClientRect().bottom>window.innerHeight-12){
    status.scrollIntoView({block:'start',behavior:'instant'});
   }
  }
 }

 for(const [name,action] of Object.entries(CONTROLS))e(name).addEventListener('click',()=>act(name,action));
 const onCompleted=()=>!document.hidden&&replayAt===null&&run.result.workflowComplete;
 function newRun(){
  if(document.hidden||(!archived&&run.actions.length&&!onCompleted()))return;
  run=runAgentReroute([],SOURCE);
  replayAt=null;archived=false;dismissed=true;saveStatus='';
  e('export-text').value='';
  show('export-record',false);
  show('os-fallback',false);
  set('share-status','');
  const note=previous.status==='saved'?'上一份完整结果会留到这局结束。':previous.status==='unavailable'?'本机暂不能保留结果，结束后请先导出 JSON。':'';
  render();set('feedback','新一局开始：07 原单已经发出。'+note);e('advance').focus();
 }
 e('restart').addEventListener('click',()=>{if(onCompleted())newRun();});
 e('new-run').addEventListener('click',newRun);
 e('view-last').addEventListener('click',()=>{
  if(document.hidden||run.actions.length||dismissed)return;
  previous=store.read();
  if(previous.status!=='saved'){renderPrevious();return;}
  run=previous.receipt;archived=true;replayAt=null;
  e('export-text').value='';show('export-record',false);show('os-fallback',false);set('share-status','');
  render();e('status').focus();
 });
 e('replay').addEventListener('click',()=>{
  if(!onCompleted())return;
  replayAt=0;render();focus('replay-next');
 });
 function replayMove(amount){
  if(document.hidden||replayAt===null)return;
  const next=replayAt+amount;
  if(next<0||next>run.actions.length)return;
  replayAt=next;render();
  if(next===0)focus('replay-next');
  else if(next===run.actions.length)focus('replay-exit');
 }
 e('replay-prev').addEventListener('click',()=>replayMove(-1));
 e('replay-next').addEventListener('click',()=>replayMove(1));
 e('replay-exit').addEventListener('click',()=>{
  if(document.hidden||replayAt===null)return;
  replayAt=null;render();focus('replay');
 });
 e('return').addEventListener('click',()=>{
  if(!onCompleted()||archived||!canReturn)return;
  try{
   window.location.assign(createGenaiReturnUrl(handoff,run,window.location));
  }catch{
   show('os-fallback',true);
   set('share-status','暂时无法带回。记录仍在，可生成 JSON 后手动导入。');
  }
 });
 e('export').addEventListener('click',()=>{
  if(!onCompleted())return;
  e('export-text').value=JSON.stringify(run,null,2);
  show('export-record',true);
  e('export-text').focus();
  set('share-status','JSON 已生成，仍在本页，没有上传。');
 });
 e('copy').addEventListener('click',async()=>{
  const snapshot=run,text=e('export-text').value;
  if(!onCompleted()||!text)return;
  try{
   await window.navigator.clipboard.writeText(text);
   if(run===snapshot&&onCompleted())set('share-status','已复制，可回 GenAI OS 手动导入。');
  }catch{
   if(run!==snapshot||!onCompleted())return;
   e('export-text').focus();e('export-text').select();
   set('share-status','浏览器未允许自动复制，已选中 JSON，请手动复制。');
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

if(typeof document!=='undefined'&&document.getElementById('reroute-scene'))mountAgentReroute({document,window});
