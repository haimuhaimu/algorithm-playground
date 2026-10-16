import {makeDataset,MAX_POINTS,MAX_EPOCHS} from './neural-core.mjs';

export const DRAFT_KEYS={neural:'algorithm-playground:neural:v1',pixel:'algorithm-playground:pixel:v1'};
const LIMIT=512000, rates=[.03,.15,.6];
const requireValue=(condition)=>{if(!condition)throw Error('Invalid draft');};
const integer=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
const finite=(n,max)=>Number.isFinite(n)&&Math.abs(n)<=max;
const storage=()=>window.localStorage;

// Read/write only our own keys; never enumerate or clear the browser's storage.
export function readDraft(key,validate,getStorage=storage){
 let raw;try{raw=getStorage().getItem(key);}catch{return {status:'unavailable',value:null};}
 if(raw===null)return {status:'empty',value:null};
 try{
  requireValue(typeof raw==='string'&&raw.length<=LIMIT);
  const data=JSON.parse(raw);requireValue(data.version===1);
  return {status:'restored',value:validate(data.value)};
 }catch{return {status:'invalid',value:null};}
}
export function writeDraft(key,value,validate,getStorage=storage){
 try{const raw=JSON.stringify({version:1,value:validate(value)});requireValue(raw.length<=LIMIT);getStorage().setItem(key,raw);return true;}catch{return false;}
}
export function clearDraft(key,getStorage=storage){try{getStorage().removeItem(key);return true;}catch{return false;}}
export function draftMessage(status){
 return {empty:'完成操作后自动保留在此浏览器，不上传。',restored:'已恢复本地草稿 · 不会自动继续运行。',invalid:'旧草稿无法读取；已打开初始画面，继续操作会重新保存。',unavailable:'此浏览器无法保存草稿；当前仍可玩，离开可能丢失。'}[status];
}
function pixels(value){requireValue(Array.isArray(value)&&value.length===256&&value.every(n=>integer(n,3)));return [...value];}
export function validatePixelDraft(value){
 requireValue(value&&integer(value.color,3)&&Array.isArray(value.history)&&value.history.length<=30);
 return {pixels:pixels(value.pixels),color:value.color,history:value.history.map(pixels),received:value.received===null?null:pixels(value.received)};
}
function points(value){
 requireValue(Array.isArray(value)&&value.length<=MAX_POINTS&&value.every(p=>p&&finite(p.x,1)&&finite(p.y,1)&&(p.label===0||p.label===1)));
 return value.map(({x,y,label})=>({x,y,label}));
}
function question(value){
 requireValue(value&&['custom','diagonal','islands','ring'].includes(value.preset));
 const result={points:points(value.points),preset:value.preset};
 if(result.preset!=='custom')requireValue(JSON.stringify(result.points)===JSON.stringify(makeDataset(result.preset).train));
 return result;
}
export const questionKey=(value)=>JSON.stringify({points:value.points,preset:value.preset});
function model(value){
 requireValue(value&&['linear','network'].includes(value.kind)&&integer(value.epoch,MAX_EPOCHS));
 requireValue(Array.isArray(value.weights)&&value.weights.length===(value.kind==='linear'?3:33)&&value.weights.every(w=>finite(w,10000)));
 return {kind:value.kind,epoch:value.epoch,weights:[...value.weights]};
}
function usedRates(value,epoch){
 requireValue(Array.isArray(value)&&value.length<=3&&value.every(r=>rates.includes(r))&&new Set(value).size===value.length);
 requireValue(epoch===0?value.length===0:value.length>0);return [...value];
}
export function validateNeuralDraft(value){
 const q=question(value),m=model(value.model);
 requireValue(rates.includes(value.rate)&&['probe','0','1','erase'].includes(value.tool)&&[null,'yes','no'].includes(value.guess));
 requireValue(Array.isArray(value.undo)&&value.undo.length<=30&&Array.isArray(value.history)&&value.history.length<=600);
 requireValue(!m.epoch||(q.points.some(p=>p.label===0)&&q.points.some(p=>p.label===1)));
 let last=-1;
 const history=value.history.map(p=>{requireValue(p&&integer(p.epoch,m.epoch)&&p.epoch>=last&&finite(p.loss,100000)&&p.loss>=0);last=p.epoch;return {epoch:p.epoch,loss:p.loss};});
 let previous=null;
 if(value.previous!==null){
  requireValue(value.previous&&value.previous.question===questionKey(q));
  const old=model(value.previous.model);requireValue(old.epoch>0&&old.kind!==m.kind);
  previous={question:questionKey(q),model:old,rates:usedRates(value.previous.rates,old.epoch)};
 }
 return {...q,model:m,rate:value.rate,tool:value.tool,guess:value.guess,history,undo:value.undo.map(question),rates:usedRates(value.rates,m.epoch),previous};
}
