import {createModel,metrics,predict,train} from './neural-core.mjs';

// The art is for the player. These two hand-assigned scores, not pixels, are the model inputs.
const sample=(id,truth,x,y)=>Object.freeze({
 id,image:`./neural-cat-${id}.jpg`,truth,features:Object.freeze([x,y])
});
export const CAT_TRAIN=Object.freeze([
 sample('01','bobby',2,9),sample('02','chouchou',9,2),sample('03','chouchou',4,2),
 sample('04','bobby',6,8),sample('05','bobby',4,7),sample('06','chouchou',8,4),
]);
export const CAT_TEST=Object.freeze([sample('07','bobby',6,6),sample('08','chouchou',6,6)]);
const RATE=.15,STEPS=120;
const isLabel=value=>value==='bobby'||value==='chouchou';
const inputs=([x,y])=>[(x-5)/5,(y-5)/5];
const score=(model,features)=>predict(model,...inputs(features));
const choice=value=>value>=.5?'chouchou':'bobby';
export const predictCat=(model,features)=>choice(score(model,features));
const frozenModel=model=>Object.freeze({...model,weights:Object.freeze([...model.weights])});
const ready=({labels})=>CAT_TRAIN.every(({id})=>isLabel(labels[id]))&&
 new Set(CAT_TRAIN.map(({id})=>labels[id])).size===2;

export function makeCatLesson(){
 // Start from a readable but imperfect rule: only look at cheeks, with 5 as the cut.
 return {baseline:frozenModel({...createModel('linear'),weights:[1,0,0]}),
  labels:{},guess:null,result:null,testGuess:null,revealed:false};
}
export function labelCat(state,id,label){
 if(!CAT_TRAIN.some(sample=>sample.id===id)||!isLabel(label)||state.labels[id]===label)return false;
 state.labels[id]=label;
 Object.assign(state,{guess:null,result:null,testGuess:null,revealed:false});
 return true;
}
export function guessCatTraining(state,guess){
 if(!ready(state)||state.result||!['moves','stays'].includes(guess))return false;
 state.guess=guess;
 return true;
}
export function trainCats(state){
 if(state.result)return state.result;
 if(!ready(state)||!state.guess)return null;
 const before=state.baseline;
 const points=CAT_TRAIN.map(({features,id})=>{
  const [x,y]=inputs(features);
  return {x,y,label:Number(state.labels[id]==='chouchou')};
 });
 const after=frozenModel(train({...before,weights:[...before.weights]},points,RATE,STEPS));
 const rows=Object.freeze(CAT_TRAIN.map(({id,features,truth})=>Object.freeze({
  id,truth,label:state.labels[id],before:predictCat(before,features),after:predictCat(after,features)
 })));
 return state.result=Object.freeze({before,after,rows,steps:after.epoch,
  lossBefore:metrics(before,points).loss,lossAfter:metrics(after,points).loss,
  correctBefore:rows.filter(row=>row.before===row.label).length,
  correctAfter:rows.filter(row=>row.after===row.label).length,
  changed:rows.filter(row=>row.before!==row.after).length});
}
export function guessCatTest(state,guess){
 if(!state.result||state.revealed||!['same','different'].includes(guess))return false;
 state.testGuess=guess;
 state.revealed=true;
 return true;
}
export function catTestEvidence(state){
 if(!state.result||!state.revealed)return null;
 return CAT_TEST.map(({id,truth,features})=>{
  const value=score(state.result.after,features);
  return {id,truth,prediction:choice(value),score:value};
 });
}
