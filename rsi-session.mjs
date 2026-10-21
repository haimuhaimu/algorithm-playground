import {createWorkflow,briefs,produce,draw,assess,retouch,improve} from './rsi-core.mjs?v=decision-trace-1';
export function createStudio(){
 const workflow=createWorkflow(),jobs=briefs('first'),art=produce(workflow,jobs);
 return {stage:'welcome',workflow,jobs,art,before:structuredClone(art),active:0,selected:[false,false,false],credits:3,
  history:[],firstRecord:null,method:'diagnose',methodReports:{},candidate:null,traceStep:0,prediction:null,transferRecord:null,finalRecord:null,decision:null,answer:null,notice:''};
}
export function studioTrace(s){
 if(!['trial','judgment'].includes(s.stage)||!s.candidate)return null;
 const report=s.candidate,total=report.attempts.length*3,done=s.traceStep===total;
 const attempt=done?null:report.attempts[Math.floor(s.traceStep/3)];
 return {report,total,done,attempt,number:Math.floor(s.traceStep/3)+1,
  phase:done?'summary':['inspect','try','decide'][s.traceStep%3],
  original:report.before,retained:attempt?.before||report.after};
}
function moveTrace(s,step){
 const next={...s,traceStep:step},frame=studioTrace(next);
 next.art=(frame.done?frame.report.after:frame.phase==='inspect'?frame.attempt.before:frame.attempt.after).art;
 return next;
}
function beginTrace(s,candidate,stage){return moveTrace({...s,stage,candidate,traceStep:0},0);}
function batch(s,group,stage){
 const jobs=briefs(group),art=produce(s.workflow,jobs);
 return {...s,stage,jobs,art,before:structuredClone(art),active:0,selected:[false,false,false],notice:''};
}
export function studioAction(s,event){
 const {type}=event;
 if(type==='reset')return createStudio();
 if(type==='select'&&Number.isInteger(event.index)&&event.index>=0&&event.index<s.art.length)return {...s,active:event.index,notice:''};
 const trace=studioTrace(s);
 if(trace){
  if(type==='trace-next')return s.traceStep<trace.total?moveTrace(s,s.traceStep+1):s;
  if(type==='trace-back')return s.traceStep>0?moveTrace(s,s.traceStep-1):s;
  if(type==='trace-replay')return moveTrace(s,0);
  if(type==='inspect-issue'&&!trace.done){
   const index=trace.retained.issues.findIndex(issues=>issues.includes(event.issue));
   return index<0?s:{...s,active:index};
  }
 }
 if(s.stage==='welcome')return type==='start'?{...s,stage:'curate'}:s;
 if(s.stage==='curate'){
  if(type==='curate'){const selected=[...s.selected];selected[s.active]=!selected[s.active];return {...s,selected,notice:selected[s.active]?'已加入精选。你仍可以取消，或继续返修。':'已从精选中移出。'};}
  if(['retouch','redraw'].includes(type)&&s.credits>0){
   if(type==='retouch'&&!['identity','outfit','pose'].includes(event.issue))return s;
   const old=s.art[s.active],next=type==='retouch'?retouch(old,s.jobs[s.active],event.issue):draw(s.workflow,s.jobs[s.active],old.variation+1);
   const changed=['species','coat','pose'].some(key=>old[key]!==next[key]);
   const art=[...s.art],selected=[...s.selected];art[s.active]=next;if(changed)selected[s.active]=false;
   return {...s,art,selected,credits:s.credits-1,history:[...s.history,{type,index:s.active,issue:event.issue,before:old,after:next}],
    notice:!changed?'这一项原本就符合委托，画面没有变化；仍消耗了 1 次检查机会，精选状态保留。':type==='redraw'?'整张重画了：检查角色和衣服，有些原本正确的细节可能变了。需重新精选。':'只返修了你选的这一项，其他细节保留。这张图需重新精选。'};
  }
  if(type==='next'){
   const result=assess(s.art,s.jobs),firstRecord={...result,picked:s.selected.filter(Boolean).length,qualified:s.selected.filter((picked,i)=>picked&&!result.issues[i].length).length,spent:3-s.credits,history:structuredClone(s.history),original:structuredClone(s.before)};
   return batch({...s,firstRecord},'method','method');
  }
 }
 if(s.stage==='method'){
  if(type==='method'&&['cycle','diagnose'].includes(event.method))return {...s,method:event.method};
  if(type==='trial'){
   const candidate=improve(s.workflow,s.jobs,s.method,2);
   return beginTrace({...s,methodReports:{...s.methodReports,[s.method]:candidate}},candidate,'trial');
  }
 }
 if(s.stage==='trial'){
  if(type==='alternate'){
   const method=s.method==='diagnose'?'cycle':'diagnose',candidate=s.methodReports[method]||improve(s.workflow,s.jobs,method,2);
   return beginTrace({...s,method,methodReports:{...s.methodReports,[method]:candidate}},candidate,'trial');
  }
  if(type==='adopt'&&trace.done)return batch({...s,workflow:structuredClone(s.candidate.workflow),candidate:null},'transfer','transfer');
 }
 if(s.stage==='transfer'&&type==='predict'&&['identity','outfit','pose'].includes(event.issue))return {...s,prediction:event.issue};
 if(s.stage==='transfer'&&type==='repair-next'){
  const candidate=improve(s.workflow,s.jobs,s.workflow.improver,1);
  return beginTrace({...s,transferRecord:candidate},candidate,'judgment');
 }
 if(s.stage==='judgment'&&trace.done&&type==='finish'&&['adopt','keep'].includes(event.decision)){
  const workflow=event.decision==='adopt'?structuredClone(s.candidate.workflow):s.workflow,art=produce(workflow,s.jobs);
  return {...s,stage:'ending',workflow,art,decision:event.decision,finalRecord:assess(art,s.jobs)};
 }
 if(s.stage==='ending'&&type==='answer'&&['picture','method','unlimited'].includes(event.answer))return {...s,answer:event.answer};
 return s;
}
