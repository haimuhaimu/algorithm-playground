import {createGuide,teachGuide,openGuideTest,guessGuide,openGuideRecap,finishGuide,guideEvidence} from './neural-guide.mjs';
import {createGradientLesson,setGradientRate,stepGradientLesson,resetGradientLesson,answerGradientLesson,gradientEvidence} from './neural-gradient.mjs';
import {createGeneralizationLesson,trainGeneralization,revealGeneralization,selectGeneralizationPoint,answerGeneralization,generalizationEvidence} from './neural-generalization.mjs';

const STAGES=['classify','gradient','test','summary'];
export function createLearningRoute(){
 return {stage:'classify',guide:createGuide(),gradient:createGradientLesson(),test:createGeneralizationLesson(),stepGuess:null};
}
export function learningRouteEvidence(s){
 const completed=[s.guide.phase==='done',s.gradient.answer==='parameters',s.test.phase==='done'];
 return {stage:s.stage,index:STAGES.indexOf(s.stage),completed,canAdvance:completed[STAGES.indexOf(s.stage)]===true,
  guide:guideEvidence(s.guide),gradient:gradientEvidence(s.gradient),test:generalizationEvidence(s.test),stepGuess:s.stepGuess};
}
// Every station owns its model. Moving between them never trains or copies answers.
export function actLearningRoute(s,action,value){
 if(action==='reset'){Object.assign(s,createLearningRoute());return;}
 const index=STAGES.indexOf(s.stage);
 if(action==='back'){if(index>0)s.stage=STAGES[index-1];return;}
 if(action==='next'){
  if(learningRouteEvidence(s).canAdvance&&(index<2||learningRouteEvidence(s).completed.every(Boolean)))s.stage=STAGES[index+1];
  return;
 }
 if(s.stage==='classify'){
  const g=s.guide;
  if(action==='train'&&g.phase==='intro')teachGuide(g);
  else if(action==='probe'&&g.phase==='trained')openGuideTest(g);
  else if(action==='guess'&&g.phase==='test'&&[0,1].includes(value))guessGuide(g,value);
  else if(action==='explain'&&['reveal','reflect'].includes(g.phase)&&['memorize','parameters'].includes(value)){
   if(g.phase==='reveal')openGuideRecap(g);finishGuide(g,value);
  }
 }else if(s.stage==='gradient'){
  const g=s.gradient;
  if(action==='rate'&&!g.model.epoch&&[.03,.15,.6].includes(value))setGradientRate(g,value);
  else if(action==='guess'&&!g.model.epoch&&['points','parameters'].includes(value))s.stepGuess=value;
  else if(action==='step'&&!g.model.epoch&&s.stepGuess!==null)stepGradientLesson(g);
  else if(action==='explain'&&g.model.epoch&&['points','parameters'].includes(value))answerGradientLesson(g,value);
  else if(action==='retry'){resetGradientLesson(g);s.stepGuess=null;}
 }else if(s.stage==='test'){
  const g=s.test;
  if(action==='train'&&g.phase==='intro')trainGeneralization(g);
  else if(action==='guess'&&g.phase==='guess'&&['all','not-all'].includes(value))revealGeneralization(g,value);
  else if(action==='point'&&['reveal','done'].includes(g.phase)&&Number.isInteger(value)&&value>=0&&value<g.test.length)selectGeneralizationPoint(g,value);
  else if(action==='explain'&&g.phase==='reveal'&&['practice','unseen'].includes(value))answerGeneralization(g,value);
 }
}
