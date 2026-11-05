const ID='agent-frames',VERSION='agent-frames-v1';
const TITLE='只留三帧，你会留下哪一帧？';
const URL='https://haimuhaimu.github.io/algorithm-playground/agent-frames.html#mission';
const GENAI=[{concept:'Agent 实战：实时预处理与证据取舍',url:'https://haimuhaimu.github.io/genai-learning-os/?page=routes&section=agent-frames-journey'}];
const FIXED_FRAMES=[0,4,8];
const VIEWS=['wide','approach','door','forklift-near','blocked','sign-clear','forklift-pass','door','wide'];
const MAX_ACTIONS=18;
const BOUNDARIES=[
 '固定像素画面和对讲字幕，模拟流式到达，不访问摄像头、麦克风或模型。',
 '三帧是教学预算，不代表实际成本；规则只读取留存帧的预设证据，不执行图像识别或真实放行。',
 '重放核对操作及其结果，不认证操作者、评定掌握或自动写入课程进度。'
];
export const AGENT_FRAME_CLIP=Object.freeze(VIEWS.map((view,id)=>Object.freeze({
 id,timeMs:id*1000,view,sign:view==='sign-clear'?'unload':null,
 caption:id<4?'先到 08 号站，等现场确认。':id<7?'看门边的牌子，确认能不能卸货。':'先别根据车停下就放行。'
})));
const fixture=()=>({id:'station-08-stream-v1',station:'08',frameCount:AGENT_FRAME_CLIP.length,budget:3,fixedFrames:[...FIXED_FRAMES]});
const isRecord=value=>Boolean(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value)));
const asAction=action=>({action});
const dataField=(value,key)=>Object.getOwnPropertyDescriptor(value,key)?.value;
const last=AGENT_FRAME_CLIP.length-1;

function available(phase,frame,manualPick){
 if(phase==='baseline')return ['advance'];
 if(phase==='baseline-done')return ['start-manual'];
 if(phase==='manual')return frame>0&&frame<last&&manualPick===null?['advance','pin']:['advance'];
 return [];
}
function normalizeActions(actions){
 if(!Array.isArray(actions)||actions.length>MAX_ACTIONS||Reflect.ownKeys(actions).length!==actions.length+1)throw Error('Invalid Agent frames action count or fields');
 return Array.from({length:actions.length},(_,i)=>{
  const item=dataField(actions,i);
  if(!isRecord(item)||Reflect.ownKeys(item).length!==1||typeof dataField(item,'action')!=='string'||
   !Object.getOwnPropertyDescriptor(item,'action').enumerable)throw Error('Invalid Agent frames action');
  return asAction(dataField(item,'action'));
 });
}
function round(middle){
 const frameIds=[FIXED_FRAMES[0],middle,FIXED_FRAMES[2]];
 const signFrame=frameIds.find(id=>AGENT_FRAME_CLIP[id].sign==='unload')??null;
 return {frameIds,signFrame,conclusion:signFrame===null?'insufficient-evidence':'clear-to-unload'};
}
// Compare against our bounded schema, without trusting any derived evidence.
function sameWireData(actual,input){
 if(actual===null||typeof actual!=='object')return actual===input;
 if(Array.isArray(actual)?!Array.isArray(input):!isRecord(input))return false;
 const keys=Reflect.ownKeys(actual);
 return keys.length===Reflect.ownKeys(input).length&&keys.every(key=>{
  const expected=Object.getOwnPropertyDescriptor(actual,key),value=Object.getOwnPropertyDescriptor(input,key);
  return value&&Object.hasOwn(value,'value')&&value.enumerable===expected.enumerable&&sameWireData(expected.value,value.value);
 });
}

export function describeAgentFrames(){
 return {id:ID,title:TITLE,url:URL,engineVersion:VERSION,numericFormat:'integer-events',maxActions:MAX_ACTIONS,
  fixture:fixture(),execution:'local-cli-or-library',operations:['list','describe','run','replay'],
  input:{actions:'ordered array of {action}',allowedActions:['advance','start-manual','pin']},
  boundaries:[...BOUNDARIES],genai:structuredClone(GENAI),mastery:'not-assessed'};
}

export function runAgentFrames(actions,options={}){
 if(!isRecord(options)||Reflect.ownKeys(options).some(key=>key!=='producer'))throw Error('Invalid Agent frames options');
 const producer=Object.hasOwn(options,'producer')?dataField(options,'producer'):'agent';
 if(!['agent','browser-session'].includes(producer))throw Error('Invalid producer');
 const journal=normalizeActions(actions),steps=[];
 let phase='baseline',frame=0,manualPick=null,fixed=null,manual=null;
 for(const {action} of journal){
  if(!available(phase,frame,manualPick).includes(action))throw Error('Action unavailable at this Agent frames stage');
  if(action==='start-manual'){phase='manual';frame=0;}
  if(action==='pin')manualPick=frame;
  if(action==='advance'&&++frame===last){
   if(phase==='baseline'){fixed=round(FIXED_FRAMES[1]);phase='baseline-done';}
   else if(manualPick===null)phase='manual-empty';
   else {manual=round(manualPick);phase='done';}
  }
  steps.push({action,phase,frame});
 }
 return {format:'algorithm-playground/learning-run',schemaVersion:1,experimentId:ID,engineVersion:VERSION,
  numericFormat:'integer-events',producer,fixture:fixture(),actions:journal,steps,
  result:{stage:phase,workflowComplete:phase==='done',mastery:'not-assessed',evidence:{frame,manualPick,fixed,manual},availableActions:available(phase,frame,manualPick).map(asAction)},
  boundaries:[...BOUNDARIES],genai:structuredClone(GENAI)};
}

export function replayAgentFramesReceipt(receipt){
 if(!isRecord(receipt)||dataField(receipt,'format')!=='algorithm-playground/learning-run'||dataField(receipt,'schemaVersion')!==1||
  dataField(receipt,'experimentId')!==ID||dataField(receipt,'engineVersion')!==VERSION)throw Error('Unsupported Agent frames receipt version');
 const actual=runAgentFrames(dataField(receipt,'actions'),{producer:dataField(receipt,'producer')});
 if(!sameWireData(actual,receipt))throw Error('Agent frames receipt mismatch: recomputed evidence differs');
 return {matches:true,authenticatesUser:false,receipt:actual};
}
