import {predict,metrics,train,MAX_EPOCHS,MAX_POINTS} from './neural-core.mjs';

// A display band, not a claim that the underlying floating-point value is unchanged.
export const stepDirection=delta=>Math.abs(delta)<.0001?'steady':delta>0?'up':'down';
const copy=value=>structuredClone(value);
function freeze(value){
 if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
 return value;
}
export function createStepTrial(snapshot){
 const {model,points}=snapshot;
 if(!model||!['linear','network'].includes(model.kind)||!Array.isArray(model.weights)||model.weights.length!==(model.kind==='linear'?3:33)||!model.weights.every(Number.isFinite)||!Number.isInteger(model.epoch)||model.epoch<0||model.epoch>=MAX_EPOCHS)throw Error('Model cannot take another step');
 metrics(model,points);
 if(points.length>MAX_POINTS||!points.some(p=>p.label===0)||!points.some(p=>p.label===1))throw Error('Two classes required');
 const a=points.reduce((best,p)=>Math.abs(predict(model,p.x,p.y)-.5)<Math.abs(predict(model,best.x,best.y)-.5)?p:best);
 const b={x:.8,y:.2};
 while(points.some(p=>p.x===b.x&&p.y===b.y))b.x-=.001;
 return {base:freeze(copy(snapshot)),probes:freeze([{id:'A',x:a.x,y:a.y,label:a.label},{id:'B',...b}]),guesses:{},result:null,last:null};
}
export function guessStep(trial,id,choice){
 if(trial.result)throw Error('Rewind before guessing again');
 if(!['A','B'].includes(id)||!['up','down','steady'].includes(choice))throw Error('Invalid guess');
 trial.guesses[id]=choice;
}
export function runStepTrial(trial,rate){
 if(trial.result)throw Error('Rewind before another step');
 if(!trial.guesses.A||!trial.guesses.B)throw Error('Guess both probes first');
 const after=copy(trial.base);
 train(after.model,after.points,rate,1);
 const score=metrics(after.model,after.points);
 if(!after.usedRates.includes(rate))after.usedRates.push(rate);
 after.history.push({epoch:after.model.epoch,loss:score.loss});
 if(after.history.length>600)after.history=after.history.filter((_,i)=>i%2===0);
 trial.result=freeze({rate,after:copy(after),lossBefore:metrics(trial.base.model,trial.base.points).loss,lossAfter:score.loss,
  probes:trial.probes.map(p=>{
   const before=predict(trial.base.model,p.x,p.y),value=predict(after.model,p.x,p.y),delta=value-before;
   return {...p,before,after:value,delta,direction:stepDirection(delta),flipped:(before>=.5)!==(value>=.5),guess:trial.guesses[p.id]};
  })});
 return after;
}
export function rewindStepTrial(trial){
 if(trial.result)trial.last=trial.result;
 trial.result=null;trial.guesses={};
 return copy(trial.base);
}
export function stepEvidence(trial){return trial.result?copy(trial.result):null;}
