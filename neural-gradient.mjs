import {gradients,train} from './neural-core.mjs';
import {createGuide,guideEvidence,GUIDE_STEPS} from './neural-guide.mjs';

// Independent of both the introductory lesson and the player's saved drawing.
export function createGradientLesson(){
 return {...createGuide(),rate:.15,lastGradient:null,lastWeights:null,answer:null};
}
export function setGradientRate(s,rate){
 if(![.03,.15,.6].includes(rate))throw Error('Invalid rate');
 if(s.model.epoch)throw Error('Reset before changing rate');
 s.rate=rate;
}
export function stepGradientLesson(s,count=1){
 if(![1,10].includes(count))throw Error('Invalid step count');
 const n=Math.min(count,GUIDE_STEPS-s.model.epoch);
 for(let i=0;i<n;i++){
  s.lastWeights=[...s.model.weights];s.lastGradient=gradients(s.model,s.points);
  train(s.model,s.points,s.rate,1);
 }
 if(n)s.answer=null;
}
export function resetGradientLesson(s){
 s.model=structuredClone(s.baseline);s.lastWeights=null;s.lastGradient=null;s.answer=null;
}
export function answerGradientLesson(s,answer){
 if(!s.model.epoch)throw Error('Take a step before reflecting');
 if(!['points','parameters'].includes(answer))throw Error('Invalid answer');
 s.answer=answer;
}
export function gradientEvidence(s){
 return {...guideEvidence(s),rate:s.rate,lastWeights:s.lastWeights?.slice()??null,lastGradient:s.lastGradient?.slice()??null};
}
