import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialModel,learnModel,predict,planFlight,makeActions,START,TARGET,STEPS,trajectoryError} from '../world-model-core.mjs';
import {stepWorld,observeFlight} from '../world-model-environment.mjs';
import {createSession,startFlight,advanceFlight,learnLatest,changeWind,selectPlan} from '../world-model-session.mjs';

test('physics is deterministic and wind changes only the real outcome',()=>{
 const a=makeActions({angle:0,power:1});
 assert.deepEqual(observeFlight(a,0),observeFlight(a,0));
 const calm=observeFlight(a,0),windy=observeFlight(a,1);
 assert.equal(calm.length,STEPS);assert.ok(windy.at(-1).next.y>calm.at(-1).next.y+10);
 assert.equal(calm.at(-1).next.x,windy.at(-1).next.x);
 assert.deepEqual(START,{x:12,y:45,vx:0,vy:0});
});
test('learning uses state transitions and improves a fresh, different flight',()=>{
 const prior=initialModel();const training=observeFlight(makeActions({angle:15,power:0.8}),0.6);
 const frozen=structuredClone(training);const learned=learnModel(training,prior);
 const actions=makeActions({angle:-10,power:1});const actual=[START,...observeFlight(actions,0.6).map(s=>s.next)];
 assert.ok(trajectoryError(predict(learned,actions),actual)<trajectoryError(predict(prior,actions),actual)*0.25);
 assert.deepEqual(training,frozen);assert.equal(prior.samples,0);assert.equal(learned.samples,STEPS);
});
test('learner and planner have no environment import or oracle input',async()=>{
 const source=await readFile(new URL('../world-model-core.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bimport\b|stepWorld|observeFlight/);
 const model=initialModel(),copy=structuredClone(model),a=planFlight(model),b=planFlight(model);
 assert.deepEqual(a,b);assert.deepEqual(model,copy);assert.ok(a.candidates>100);
 const route=predict(model,makeActions(a.controls));assert.deepEqual(a.path,route);
 assert.ok(a.distance<=Math.hypot(...['x','y'].map(k=>predict(model,makeActions({angle:0,power:0.8})).at(-1)[k]-TARGET[k])));
});
test('invalid and empty observations cannot poison the model',()=>{
 assert.throws(()=>learnModel([],initialModel()),/observations/);
 assert.throws(()=>learnModel([{state:START,action:{x:NaN,y:0},next:START}],initialModel()),/finite/);
 assert.throws(()=>makeActions({angle:Infinity,power:1}),/finite/);
 assert.throws(()=>stepWorld(START,{x:0,y:0},Infinity),/finite/);
 const allStill=Array.from({length:60},()=>({state:START,action:{x:0,y:0},next:START}));
 assert.ok(learnModel(allStill,initialModel()).x.every(Number.isFinite));
});
test('prediction remains frozen during a flight and only arrival makes learning available',()=>{
 let s=createSession();s=startFlight(s);const predicted=structuredClone(s.flight.predicted);
 s=advanceFlight(s,20);assert.equal(s.samples.length,0);assert.equal(learnLatest(s),s);
 assert.equal(s.flight.actual.length,21);assert.deepEqual(s.flight.predicted,predicted);
 s=advanceFlight(s,STEPS);assert.equal(s.samples.length,STEPS);assert.equal(s.completed,1);
 assert.equal(s.flight.actual.length,STEPS+1);assert.equal(s.flight.done,true);
 const result=structuredClone(s.flight);s=learnLatest(s);assert.equal(s.model.version,1);
 assert.deepEqual(s.flight,result);assert.equal(learnLatest(s),s,'same flight is not learned twice');
});
test('wind shift preserves learned model and historical evidence, invalidates stale training',()=>{
 let s=learnLatest(advanceFlight(startFlight(createSession()),STEPS));
 const before=structuredClone(s.model),history=structuredClone(s.flight);
 s=changeWind(s,1);assert.deepEqual(s.model,before);assert.deepEqual(s.previous,history);
 assert.equal(s.flight,null);assert.equal(s.samples.length,0);assert.equal(learnLatest(s),s);
 s=selectPlan(s);assert.equal(s.plan.modelVersion,before.version);
 s=advanceFlight(startFlight(s),STEPS);assert.ok(s.flight.error>5);
 s=learnLatest(s);s=selectPlan(s);s=advanceFlight(startFlight(s),STEPS);
 assert.ok(s.flight.error<1);assert.ok(s.flight.distance<6,'relearned plan reaches target');
});
test('changing wind mid-flight discards partial samples and starting twice cannot reset it',()=>{
 let s=advanceFlight(startFlight(createSession()),10);assert.equal(startFlight(s),s);
 s=changeWind(s,-1);assert.equal(s.flight,null);assert.equal(s.samples.length,0);
 assert.equal(s.completed,0);assert.equal(s.model.version,0);
});
