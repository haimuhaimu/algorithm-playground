import {createModel,train,predict,metrics} from './neural-core.mjs';

// A deliberately small, spatial classification task; not image recognition.
const EXAMPLES=Object.freeze([
 {x:-.8,y:-.6,label:0},{x:-.65,y:-.1,label:0},{x:-.25,y:-.7,label:0},
 {x:.8,y:.6,label:1},{x:.65,y:.1,label:1},{x:.25,y:.7,label:1}
].map(Object.freeze));
const PROBES=Object.freeze([{x:-.36,y:-.65},{x:-.72,y:-.45},{x:.08,y:-.1}].map(Object.freeze));
export const GUIDE_STEPS=120;
export function createGuide(){
 // A supplied imperfect rule makes two specific errors visible before learning.
 const baseline=createModel('linear');baseline.weights=[1,-1,0];
 return {phase:'intro',points:EXAMPLES,baseline,model:structuredClone(baseline),probeIndex:0,guess:null,reflection:null};
}
export function teachGuide(s,steps=GUIDE_STEPS){
 if(!['intro','teaching'].includes(s.phase))throw Error('Training is complete');
 if(!Number.isInteger(steps)||steps<1||steps>GUIDE_STEPS)throw Error('Invalid training batch');
 train(s.model,s.points,.15,Math.min(steps,GUIDE_STEPS-s.model.epoch));
 s.phase=s.model.epoch===GUIDE_STEPS?'trained':'teaching';
}
export function openGuideTest(s,index=0){
 if(!['trained','reveal','done'].includes(s.phase))throw Error('Train before testing');
 if(!Number.isInteger(index)||index<0||index>=PROBES.length)throw Error('Invalid probe');
 s.probeIndex=index;s.guess=null;s.reflection=null;s.phase='test';
}
export function guessGuide(s,label){
 if(s.phase!=='test'||![0,1].includes(label))throw Error('Invalid guess');
 s.guess=label;s.phase='reveal';
}
export function openGuideRecap(s){
 if(s.phase!=='reveal')throw Error('Test before recap');
 s.phase='reflect';
}
export function finishGuide(s,answer){
 if(s.phase!=='reflect'||!['memorize','parameters'].includes(answer))throw Error('Invalid explanation');
 s.reflection=answer;if(answer==='parameters')s.phase='done';
}
export function guideEvidence(s){
 const p=PROBES[s.probeIndex],after=predict(s.model,p.x,p.y),label=Number(after>=.5);
 const mistakes=model=>s.points.flatMap((p,i)=>Number(predict(model,p.x,p.y)>=.5)===p.label?[]:[i]);
 return {examples:s.points.length,steps:s.model.epoch,lossBefore:metrics(s.baseline,s.points).loss,lossAfter:metrics(s.model,s.points).loss,
  mistakesBefore:mistakes(s.baseline),mistakesNow:mistakes(s.model),
  changedParameters:s.model.weights.filter((w,i)=>w!==s.baseline.weights[i]).length,
  probe:{...p,id:String.fromCharCode(65+s.probeIndex),before:predict(s.baseline,p.x,p.y),after,label},
  guess:s.guess,matchesGuess:s.guess===null?null:s.guess===label};
}
