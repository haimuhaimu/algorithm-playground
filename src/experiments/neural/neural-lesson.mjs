import {createModel,makeDataset,train,predict} from './neural-core.mjs';

export const CONDITIONS=Object.freeze({kind:'network',seed:41,rate:.15,steps:500});
export const EXAMPLES=Object.freeze([
 Object.freeze({id:'edge',index:38,title:'① 岛边的方点',hint:'方 → 圆'}),
 Object.freeze({id:'inside',index:14,title:'② 岛里的方点',hint:'方 → 圆'}),
 Object.freeze({id:'opposite',index:25,title:'③ 对岸的圆点',hint:'圆 → 方'}),
]);
export function createLesson(){
 const s={original:makeDataset('islands').train,before:createModel(CONDITIONS.kind,CONDITIONS.seed)};
 selectExample(s,'edge');return s;
}
export function selectExample(s,id){
 const choice=EXAMPLES.find(c=>c.id===id);if(!choice)throw Error('Unknown example');
 s.choice=choice;
 s.changed=s.original.map((p,i)=>({...p,label:i===choice.index?1-p.label:p.label}));
 s.after=createModel(CONDITIONS.kind,CONDITIONS.seed);
}
export function advanceLesson(s,side,steps=25){
 if(!['before','after'].includes(side))throw Error('Invalid side');
 if(!Number.isInteger(steps)||steps<1||steps>500)throw Error('Invalid steps');
 if(side==='after'&&s.before.epoch!==CONDITIONS.steps)throw Error('Complete baseline first');
 const remaining=CONDITIONS.steps-s[side].epoch;
 if(remaining>0)train(s[side],side==='before'?s.original:s.changed,CONDITIONS.rate,Math.min(steps,remaining));
}
export function probesFor(s){
 const {x,y}=s.original[s.choice.index];
 return [{id:'A',name:'改标签的点',x,y},{id:'B',name:'岛边的固定探针',x:.8,y:.2},{id:'C',name:'远处的固定探针',x:-.6,y:.65}];
}
export function evidence(s){
 if(s.before.epoch!==CONDITIONS.steps||s.after.epoch!==CONDITIONS.steps)return null;
 return {choice:{...s.choice},probes:probesFor(s).map(p=>{
  const before=predict(s.before,p.x,p.y),after=predict(s.after,p.x,p.y);
  return {...p,before,after,delta:(after-before)*100,flipped:(before>=.5)!==(after>=.5)};
 })};
}
