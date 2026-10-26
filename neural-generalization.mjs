import {createGuide,teachGuide,GUIDE_STEPS} from './neural-guide.mjs';
import {predict} from './neural-core.mjs';

// An authored full grid, fixed independently of the model. Not a random accuracy estimate.
const TEST=Object.freeze([-.85,-.35,.15,.65].flatMap(y=>[-.75,-.25,.25,.75].map(x=>Object.freeze({x,y,label:Number(x+y>0)}))));
export function createGeneralizationLesson(){
 const guide=createGuide();
 return {phase:'intro',train:guide.points,test:TEST,model:guide.model,guess:null,selected:null,view:'training',answer:null};
}
const revealed=s=>['reveal','done'].includes(s.phase);
export function trainGeneralization(s){
 if(s.phase!=='intro')throw Error('Train once before the guess');
 const guide=createGuide();teachGuide(guide,GUIDE_STEPS);
 s.model=Object.freeze({...guide.model,weights:Object.freeze([...guide.model.weights])});s.phase='guess';
}
export function revealGeneralization(s,guess){
 if(s.phase!=='guess'||!['all','not-all'].includes(guess))throw Error('Guess after training');
 s.guess=guess;s.phase='reveal';s.view='test';
 s.selected=s.test.findIndex(p=>Number(predict(s.model,p.x,p.y)>=.5)!==p.label);
 if(s.selected<0)s.selected=0;
}
export function selectGeneralizationPoint(s,index){
 if(!revealed(s)||!Number.isInteger(index)||index<0||index>=s.test.length)throw Error('Select a revealed point');
 s.selected=index;
}
export function setGeneralizationView(s,view){
 if(!revealed(s)||!['training','test'].includes(view))throw Error('Select a revealed view');s.view=view;
}
export function answerGeneralization(s,answer){
 if(s.phase!=='reveal'||!['practice','unseen'].includes(answer))throw Error('Reflect after seeing the new points');
 s.answer=answer;if(answer==='unseen')s.phase='done';
}
export function resetGeneralization(s){Object.assign(s,createGeneralizationLesson());}
export function generalizationEvidence(s){
 const evaluate=points=>{
  const results=points.map((p,index)=>{const probability=predict(s.model,p.x,p.y),predicted=Number(probability>=.5);return {...p,id:index+1,probability,predicted,correct:predicted===p.label};});
  return {points:results,correct:results.filter(p=>p.correct).length,total:results.length};
 };
 const test=revealed(s)?evaluate(s.test):null;
 return {train:evaluate(s.train),test,wrong:test?test.points.flatMap((p,i)=>p.correct?[]:[i]):[],selected:test?test.points[s.selected]:null,frozen:s.phase!=='intro',steps:s.model.epoch};
}
