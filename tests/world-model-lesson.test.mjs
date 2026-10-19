import test from 'node:test';
import assert from 'node:assert/strict';
import {planFlight,initialModel} from '../world-model-core.mjs';
import {createSession,startFlight,advanceFlight,moveTarget,learnLatest} from '../world-model-session.mjs';
import {createLesson,nextLesson,recordLessonFlight,chooseLesson} from '../world-model-lesson.mjs';

function guidedChallenge(){
 let lesson=createLesson(),session=createSession();
 for(let i=0;i<8;i++){
  const next=nextLesson(lesson,session);({lesson,session}=next);
  if(next.fly){session=advanceFlight(startFlight(session),60);lesson=recordLessonFlight(lesson,session.flight);}
 }
 return {lesson,session};
}
test('moving the goal changes planning but never changes dynamics or scores an earlier flight against a new ring',()=>{
 let s=learnLatest(advanceFlight(startFlight(createSession()),60));const old=structuredClone(s.flight),model=structuredClone(s.model);
 s=moveTarget(s,{x:112,y:63,radius:5});
 assert.deepEqual(s.previous,old);assert.equal(s.flight,null);assert.deepEqual(s.model,model);assert.equal(s.worldVersion,0);
 const plan=planFlight(s.model,s.target),end=plan.path.at(-1);
 assert.ok(Math.hypot(end.x-112,end.y-63)<Math.hypot(end.x-88,end.y-45));
 s=startFlight(s);const snapshot=structuredClone(s.flight.target);
 assert.equal(moveTarget(s,{x:80,y:30,radius:5}),s,'active flights cannot change goal');
 s={...s,target:{x:1,y:1,radius:5}};s=advanceFlight(s,60);
 assert.deepEqual(s.flight.target,snapshot);
 assert.ok(Math.abs(s.flight.distance-Math.hypot(s.flight.actual.at(-1).x-112,s.flight.actual.at(-1).y-63))<1e-9);
 assert.throws(()=>moveTarget(createSession(),{x:NaN,y:0,radius:5}));
 assert.throws(()=>planFlight(initialModel(),{x:0,y:0,radius:0}));
});
test('guided journey reaches an independent choice after four real flights, without silently training on the new goal',()=>{
 const {lesson,session}=guidedChallenge();
 assert.equal(lesson.stage,'choose');assert.equal(session.completed,4);assert.equal(session.model.version,2);
 assert.deepEqual(session.target,{x:112,y:63,radius:5});assert.equal(session.worldVersion,1);assert.equal(session.wind,-1);
 assert.ok(lesson.evidence.first.distance>5);assert.ok(lesson.evidence.learned.distance<=5);
 assert.ok(lesson.evidence.changed.error>3);assert.ok(lesson.evidence.recovered.error<3);
 assert.equal(lesson.attempts.length,0);
});
test('the three choices perform different real operations and every retry starts from the same learned world',()=>{
 const {lesson}=guidedChallenge();const frozen=structuredClone(lesson);
 let previousResult=null;
 for(const choice of ['reuse','learn','plan']){
  const pick=chooseLesson(previousResult?{...previousResult,stage:'choose'}:lesson,choice);
  assert.equal(pick.lesson.stage,'attempt');assert.equal(pick.session.wind,-1);
  assert.equal(pick.session.model.version,choice==='learn'?3:2);
  const result=advanceFlight(startFlight(pick.session),60);
  assert.equal(result.flight.distance<=5,choice==='plan','only a newly planned route reaches the moved ring');
  assert.ok(result.flight.error<3,'all three still predict this unchanged world accurately');
  if(choice!=='plan')assert.deepEqual(result.controls,lesson.baseline.controls);
  previousResult=recordLessonFlight(pick.lesson,result.flight);
  assert.equal(previousResult.stage,'result');assert.equal(previousResult.attempts.at(-1).choice,choice);
  assert.deepEqual(previousResult.attempts.at(-1).flight,result.flight);
 }
 assert.equal(previousResult.attempts.length,3);assert.deepEqual(lesson,frozen);
 const end=nextLesson(previousResult,createSession());assert.equal(end.lesson.stage,'ending');
 const free=nextLesson(end.lesson,end.session);assert.equal(free.lesson.stage,'free');
});
test('unfinished and duplicate flights cannot advance the lesson or create duplicate evidence',()=>{
 const lesson=createLesson(),partial=advanceFlight(startFlight(createSession()),10);
 assert.equal(recordLessonFlight(lesson,partial.flight),lesson);
 const done=advanceFlight(partial,60),recorded=recordLessonFlight(lesson,done.flight);
 assert.equal(recorded.stage,'learn');assert.equal(recordLessonFlight(recorded,done.flight),recorded);
 const {lesson:challenge}=guidedChallenge(),pick=chooseLesson(challenge,'reuse');
 assert.equal(chooseLesson(pick.lesson,'plan'),null,'a running choice cannot be replaced');
 const result=recordLessonFlight(pick.lesson,advanceFlight(startFlight(pick.session),60).flight);
 assert.equal(nextLesson(result,pick.session).lesson.stage,'choose','an unsuccessful method has a retry path');
 assert.equal(recordLessonFlight(result,partial.flight),result);
});
