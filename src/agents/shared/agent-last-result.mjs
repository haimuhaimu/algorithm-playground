import {replayAgentToolReceipt} from '../mission/agent-tool.mjs';
import {replayAgentRerouteReceipt} from '../reroute/agent-reroute-tool.mjs';
import {replayAgentFramesReceipt} from '../frames/agent-frames-tool.mjs';

const VERSION=1,MAX_RAW_LENGTH=32768;
const isRecord=value=>Boolean(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value)));

// Compare only the engine's bounded shape. Reject accessors, hidden fields,
// extra array properties and other values JSON would silently omit or repair.
function sameWireData(actual,provided){
 if(actual===null||typeof actual!=='object')return Object.is(actual,provided);
 if(Array.isArray(actual)?!Array.isArray(provided):!isRecord(provided))return false;
 const keys=Reflect.ownKeys(actual);
 return Reflect.ownKeys(provided).length===keys.length&&keys.every(key=>{
  const expected=Object.getOwnPropertyDescriptor(actual,key);
  const field=Object.getOwnPropertyDescriptor(provided,key);
  return field&&field.enumerable===expected.enumerable&&Object.hasOwn(field,'value')&&sameWireData(expected.value,field.value);
 });
}

export function createAgentResultStore(window,experimentId){
 const replay=experimentId==='agent-tool-loop'?replayAgentToolReceipt:experimentId==='agent-reroute'?replayAgentRerouteReceipt:experimentId==='agent-frames'?replayAgentFramesReceipt:null;
 const key=replay?`algorithm-playground:agent-last-result:${experimentId}:v1`:null;

 function verify(receipt){
  if(!replay||!isRecord(receipt)||receipt.experimentId!==experimentId||receipt.producer!=='browser-session'||receipt.result?.workflowComplete!==true)return null;
  const result=replay(receipt);
  return result.matches===true&&sameWireData(result.receipt,receipt)?result.receipt:null;
 }

 function read(){
  if(!replay)return {status:'invalid'};
  let raw;
  try{raw=window.localStorage.getItem(key);}catch{return {status:'unavailable'};}
  if(raw===null)return {status:'empty'};
  try{
   if(typeof raw!=='string'||raw.length>MAX_RAW_LENGTH)return {status:'invalid'};
   const envelope=JSON.parse(raw);
   if(!isRecord(envelope)||Reflect.ownKeys(envelope).length!==2||envelope.version!==VERSION||!Object.hasOwn(envelope,'receipt'))return {status:'invalid'};
   const receipt=verify(envelope.receipt);
   return receipt?{status:'saved',receipt}:{status:'invalid'};
  }catch{return {status:'invalid'};}
 }

 function save(receipt){
  let raw;
  try{
   const verified=verify(receipt);
   if(!verified)return {status:'invalid'};
   // Keep the exact verified receipt only. Never capture the page URL,
   // handoff request, return destination, current run or progress state.
   raw=JSON.stringify({version:VERSION,receipt:verified});
   if(raw.length>MAX_RAW_LENGTH)return {status:'invalid'};
  }catch{return {status:'invalid'};}
  try{
   const storage=window.localStorage;
   storage.setItem(key,raw);
   return {status:storage.getItem(key)===raw?'saved':'unavailable'};
  }catch{return {status:'unavailable'};}
 }

 return {read,save};
}
