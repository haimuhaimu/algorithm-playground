const ID='agent-tool-loop',VERSION='agent-tool-loop-v1';
const URL='https://haimuhaimu.github.io/algorithm-playground/agent-mission.html#mission';
const GENAI=[{concept:'Agent 实战：工具反馈与结果验证',url:'https://haimuhaimu.github.io/genai-learning-os/?page=routes&section=agent-journey'}];
const FIXTURE={id:'supply-receipt-v1',toolBudget:3,initialToolStatus:'accepted'};
const ACTIONS=['check','retry','stop','restart'];
const MAX_ACTIONS=9;
const BOUNDARIES=[
 '固定模拟工单；没有调用外部工具、模型或真实物流服务。',
 '受理与签收是不同证据；两轮结束不代表成功送达。',
 '重放只核对记录与引擎是否一致，不认证操作者，不代表掌握，也不自动写入课程进度。'
];

const isRecord=value=>Boolean(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value)));
const newTrial=number=>({number,outcome:'in-progress',toolCalls:0,receipt:'unknown',backupDispatched:false});
function available(trial){
 if(trial.outcome!=='in-progress')return trial.number===1?[{action:'restart'}]:[];
 return (trial.backupDispatched?['check','stop']:['check','retry','stop']).map(action=>({action}));
}
function normalizeAction(value){
 if(!isRecord(value)||Reflect.ownKeys(value).length!==1||!Object.hasOwn(value,'action')||!ACTIONS.includes(value.action))throw Error('Invalid Agent mission action');
 return {action:value.action};
}
// Compare data as JSON, independent of object key order. Reject malformed,
// oversized or non-JSON values before doing recursive equality.
function canonical(value,depth=0,limits={count:0}){
 if(depth>14||++limits.count>4000)throw Error('Agent receipt is too complex');
 if(Array.isArray(value)){
  if(value.length>64)throw Error('Agent receipt array is too long');
  return '['+Array.from(value,item=>canonical(item,depth+1,limits)).join(',')+']';
 }
 if(isRecord(value)){
  const keys=Object.keys(value).sort();
  if(keys.length>40||Reflect.ownKeys(value).length!==keys.length)throw Error('Invalid Agent receipt fields');
  return '{'+keys.map(key=>JSON.stringify(key)+':'+canonical(value[key],depth+1,limits)).join(',')+'}';
 }
 if(value===null||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value))||(typeof value==='string'&&value.length<=1024))return JSON.stringify(value);
 throw Error('Invalid Agent receipt data');
}

export function describeAgentTool(){
 return {id:ID,title:'显示成功，补给真的到了吗？',url:URL,engineVersion:VERSION,
  maxActions:MAX_ACTIONS,numericFormat:'integer-tool-calls',fixture:{...FIXTURE},execution:'local-cli-or-library',
  operations:['list','describe','run','replay'],input:{actions:'ordered array of {action}',allowedActions:[...ACTIONS]},
  boundaries:[...BOUNDARIES],genai:structuredClone(GENAI),mastery:'not-assessed'};
}

export function runAgentToolLoop(actions,options={}){
 if(!isRecord(options)||Reflect.ownKeys(options).some(key=>key!=='producer'))throw Error('Invalid Agent mission options');
 const producer=Object.hasOwn(options,'producer')?options.producer:'agent';
 if(!['agent','browser-session'].includes(producer))throw Error('Invalid producer');
 if(!Array.isArray(actions)||actions.length>MAX_ACTIONS)throw Error('Invalid Agent action count');
 const journal=Array.from(actions,normalizeAction),trials=[newTrial(1)],steps=[];
 let trial=trials[0];
 for(const {action} of journal){
  if(!available(trial).some(item=>item.action===action))throw Error('Action is not available in this Agent mission state');
  let observation;
  if(action==='restart'){
   trial=newTrial(2);trials.push(trial);observation='restarted';
  }else if(action==='stop'){
   trial.outcome='stopped';observation='stopped';
  }else{
   trial.toolCalls++;
   if(action==='retry'){
    trial.backupDispatched=true;observation='retry-accepted';
   }else{
    // In the fixed scenario the primary line stalls. The backup reaches
    // base by the next tool turn, and the receipt query provides evidence.
    trial.receipt=trial.backupDispatched?'delivered':'not-delivered';
    observation=trial.backupDispatched?'signed':'not-delivered';
    if(trial.backupDispatched)trial.outcome='verified';
   }
   if(trial.outcome==='in-progress'&&trial.toolCalls===FIXTURE.toolBudget)trial.outcome='budget-exhausted';
  }
  steps.push({action,trial:trial.number,remaining:FIXTURE.toolBudget-trial.toolCalls,observation});
 }
 const complete=trial.number===2&&trial.outcome!=='in-progress';
 return {format:'algorithm-playground/learning-run',schemaVersion:1,experimentId:ID,engineVersion:VERSION,
  numericFormat:'integer-tool-calls',producer,fixture:{...FIXTURE},actions:journal,steps,
  result:{stage:complete?'done':'mission',workflowComplete:complete,mastery:'not-assessed',evidence:{trials},availableActions:available(trial)},
  boundaries:[...BOUNDARIES],genai:structuredClone(GENAI)};
}

export function replayAgentToolReceipt(receipt){
 if(!isRecord(receipt)||receipt.format!=='algorithm-playground/learning-run'||receipt.schemaVersion!==1||receipt.experimentId!==ID||receipt.engineVersion!==VERSION)throw Error('Unsupported Agent receipt version');
 const actual=runAgentToolLoop(receipt.actions,{producer:receipt.producer});
 if(canonical(actual)!==canonical(receipt))throw Error('Agent receipt mismatch: recomputed actions and evidence differ');
 return {matches:true,authenticatesUser:false,receipt:actual};
}
