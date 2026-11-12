const ID='agent-reroute',VERSION='agent-reroute-v1';
const TITLE='新指令来了，旧任务还该继续吗？';
const URL='https://haimuhaimu.github.io/algorithm-playground/agent-reroute.html#mission';
const GENAI=[{concept:'Agent 实战：新指令、进行中的任务和迟到回执',url:'https://haimuhaimu.github.io/genai-learning-os/?page=routes&section=agent-reroute-journey'}];
const FIXTURE={id:'reroute-07-to-08-v1',from:'07',to:'08'};
const MAX_ACTIONS=8;
const BOUNDARIES=[
 '固定字幕和画面的教学模拟，不接麦克风、外部工具、模型或真实物流。',
 '字幕确认改的是当前目标；改派不证明旧单取消，新单受理也不证明送达。',
 '回放只检查固定场景与操作是否一致，不认证操作者，不代表掌握，也不自动写进度。'
];

const TRANSITIONS={
 original:{advance:['partial','correction-start']},
 partial:{advance:['decision','correction-confirmed']},
 decision:{reroute:['await-old','reroute-accepted'],'keep-old':['await-old','kept-old']},
 'await-old':{advance:['review','old-receipt']},
 review:{
  'accept-old':['done','old-receipt-misattributed'],
  'verify-new':['done','new-receipt-verified'],
  stop:['done','stopped-unverified'],
  reroute:['review','reroute-accepted']
 },
 done:{}
};
const isRecord=value=>Boolean(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value)));
const asAction=action=>({action});
function available(phase,evidence){
 return Object.keys(TRANSITIONS[phase])
  .filter(action=>phase!=='review'||(evidence.dispatched08?action!=='reroute':action!=='verify-new'));
}
function normalizeAction(item){
 if(!isRecord(item)||Reflect.ownKeys(item).length!==1)throw Error('Invalid reroute action');
 const field=Object.getOwnPropertyDescriptor(item,'action');
 if(!field?.enumerable||typeof field.value!=='string')throw Error('Invalid reroute action');
 return asAction(field.value);
}
// Walk only the engine-produced shape. Extra fields, sparse arrays and
// accessors are not valid wire data, regardless of property ordering.
function sameWireData(actual,provided){
 if(actual===null||typeof actual!=='object')return actual===provided;
 if(Array.isArray(actual)?!Array.isArray(provided):!isRecord(provided))return false;
 const keys=Reflect.ownKeys(actual);
 return Reflect.ownKeys(provided).length===keys.length&&keys.every(key=>{
  const expected=Object.getOwnPropertyDescriptor(actual,key);
  const value=Object.getOwnPropertyDescriptor(provided,key);
  return value&&value.enumerable===expected.enumerable&&Object.hasOwn(value,'value')&&sameWireData(expected.value,value.value);
 });
}

export function describeAgentReroute(){
 return {id:ID,title:TITLE,url:URL,engineVersion:VERSION,numericFormat:'integer-events',maxActions:MAX_ACTIONS,
  fixture:{...FIXTURE},execution:'local-cli-or-library',operations:['list','describe','run','replay'],
  input:{actions:'ordered array of {action}',allowedActions:['advance','reroute','keep-old','accept-old','verify-new','stop']},
  boundaries:[...BOUNDARIES],genai:structuredClone(GENAI),mastery:'not-assessed'};
}

export function runAgentReroute(actions,options={}){
 if(!isRecord(options)||Reflect.ownKeys(options).some(key=>key!=='producer'))throw Error('Invalid reroute options');
 const producer=Object.hasOwn(options,'producer')?options.producer:'agent';
 if(!['agent','browser-session'].includes(producer))throw Error('Invalid producer');
 if(!Array.isArray(actions)||actions.length>MAX_ACTIONS||Reflect.ownKeys(actions).length!==actions.length+1)throw Error('Invalid reroute action count or fields');
 const journal=Array.from(actions,normalizeAction),steps=[];
 const evidence={activeTarget:FIXTURE.from,dispatched08:false,oldReceipt:null,newReceipt:null,outcome:'in-progress'};
 let phase='original';
 for(const {action} of journal){
  if(!available(phase,evidence).includes(action))throw Error('Action is not available in this reroute state');
  const [next,event]=TRANSITIONS[phase][action];
  if(event==='correction-confirmed')evidence.activeTarget=FIXTURE.to;
  if(event==='reroute-accepted')evidence.dispatched08=true;
  if(event==='old-receipt')evidence.oldReceipt={orderId:'SUP-07',station:FIXTURE.from};
  if(event==='old-receipt-misattributed')evidence.outcome='misattributed';
  if(event==='stopped-unverified')evidence.outcome='unverified';
  if(event==='new-receipt-verified'){
   evidence.newReceipt={orderId:'SUP-08',station:FIXTURE.to};
   evidence.outcome='verified';
  }
  phase=next;
  steps.push({action,phase,event});
 }
 return {format:'algorithm-playground/learning-run',schemaVersion:1,experimentId:ID,engineVersion:VERSION,
  numericFormat:'integer-events',producer,fixture:{...FIXTURE},actions:journal,steps,
  result:{stage:phase,workflowComplete:phase==='done',mastery:'not-assessed',evidence,availableActions:available(phase,evidence).map(asAction)},
  boundaries:[...BOUNDARIES],genai:structuredClone(GENAI)};
}

export function replayAgentRerouteReceipt(receipt){
 if(!isRecord(receipt)||receipt.format!=='algorithm-playground/learning-run'||receipt.schemaVersion!==1||
   receipt.experimentId!==ID||receipt.engineVersion!==VERSION)throw Error('Unsupported reroute receipt version');
 const actual=runAgentReroute(receipt.actions,{producer:receipt.producer});
 if(!sameWireData(actual,receipt))throw Error('Reroute receipt mismatch: recomputed actions and evidence differ');
 return {matches:true,authenticatesUser:false,receipt:actual};
}
