import {learnLatest,selectPlan,changeWind,moveTarget} from './world-model-session.mjs?v=same-flight-1';

export const CHALLENGE_TARGET=Object.freeze({x:112,y:63,radius:5});
export const CHOICES=Object.freeze({reuse:'沿用原路线',plan:'重新规划路线',learn:'只重新学习'});
export function createLesson(){return {stage:'first',evidence:{},attempts:[],baseline:null,choice:null};}
export function recordLessonFlight(lesson,flight){
 if(!flight?.done)return lesson;
 const key={first:'first',learnedPreview:'learned',changedPreview:'changed',recoveredPreview:'recovered'}[lesson.stage];
 const success=flight.distance<=flight.target.radius&&flight.error<=3;
 if(key){
  const stage={first:'learn',learnedPreview:success?'wind':'learn',changedPreview:'relearn',recoveredPreview:success?'challenge':'relearn'}[lesson.stage];
  return {...lesson,stage,evidence:{...lesson.evidence,[key]:structuredClone(flight)}};
 }
 if(lesson.stage==='attempt')return {...lesson,stage:'result',attempts:[...lesson.attempts,{choice:lesson.choice,flight:structuredClone(flight)}]};
 return lesson;
}
export function nextLesson(lesson,session){
 if(session.flight&&!session.flight.done)return {lesson,session,fly:false};
 let stage=lesson.stage;
 if(['first','learnedPreview','changedPreview','recoveredPreview'].includes(stage))return {lesson,session,fly:true};
 if(stage==='learn'||stage==='relearn'){
  session=learnLatest(session);stage=stage==='learn'?'learningComparison':'relearningComparison';
  lesson={...lesson,evidence:{...lesson.evidence,[stage]:structuredClone(session.comparison)}};
 }else if(stage==='learningComparison'||stage==='relearningComparison'){
  session=selectPlan(session);stage=stage==='learningComparison'?'learnedPreview':'recoveredPreview';
 }else if(stage==='wind'){
  session=selectPlan(changeWind(session,-1));stage='changedPreview';
 }else if(stage==='challenge'){
  lesson={...lesson,baseline:structuredClone(session)};session=moveTarget(session,CHALLENGE_TARGET);stage='choose';
 }else if(stage==='result'){
  const last=lesson.attempts.at(-1);
  stage=last.choice==='plan'&&last.flight.distance<=last.flight.target.radius?'ending':'choose';
  if(stage==='choose')session=moveTarget(structuredClone(lesson.baseline),CHALLENGE_TARGET);
 }else if(stage==='ending')stage='free';
 return {lesson:{...lesson,stage},session,fly:false};
}
export function chooseLesson(lesson,choice){
 if(lesson.stage!=='choose'||!lesson.baseline||!Object.hasOwn(CHOICES,choice))return null;
 // Compare each method from the same completed flight, never learn from a retry.
 let session=structuredClone(lesson.baseline);
 if(choice==='learn')session=learnLatest(session);
 session=moveTarget(session,CHALLENGE_TARGET);
 if(choice==='plan')session=selectPlan(session);
 return {lesson:{...lesson,stage:'attempt',choice},session};
}
