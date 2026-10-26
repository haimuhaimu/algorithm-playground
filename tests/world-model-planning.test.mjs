import test from 'node:test';
import assert from 'node:assert/strict';
import * as sessions from '../world-model-session.mjs';
import {predict,makeActions,START} from '../world-model-core.mjs';

test('planning preserves the old route and exposes three predictions under one unchanged model',()=>{
 const s=sessions.createSession(),snapshot=structuredClone(s),planned=sessions.selectPlan(s);
 assert.ok(Array.isArray(planned.plan.alternatives),'planning needs inspectable candidate evidence');
 assert.deepEqual(s,snapshot,'planning cannot learn or execute');
 assert.equal(planned.plan.candidates,2009);
 const [original,direction,best]=planned.plan.alternatives;
 assert.deepEqual(planned.plan.alternatives.map(c=>c.key),['original','direction','best']);
 assert.deepEqual(original.controls,{angle:0,power:1});
 assert.deepEqual(direction.controls,{angle:best.controls.angle,power:1});
 assert.deepEqual(best.controls,planned.controls);
 assert.equal(planned.plan.selectedKey,'best');
 assert.equal(planned.completed,0);assert.equal(planned.model.version,0);assert.equal(planned.flight,null);
 for(const candidate of planned.plan.alternatives){
  assert.equal(candidate.path.length,61);assert.deepEqual(candidate.path[0],START);
  assert.deepEqual(candidate.path,predict(s.model,makeActions(candidate.controls)));
  const end=candidate.path.at(-1);
  assert.equal(candidate.distance,Math.hypot(end.x-88,end.y-45));
 }
 // Summing v[t+1]=.87*v[t]+.18 for 36 steps, then 24 coast steps gives x≈61.520714.
 assert.ok(Math.abs(original.distance-26.4792856602379)<1e-8);
 assert.ok(best.distance<=original.distance);
 s.controls.angle=24;s.model.x[0]=10;s.target.x=4;
 assert.deepEqual(original.controls,{angle:0,power:1},'evidence is a snapshot, not a live controls reference');
 assert.equal(original.path[0].x,12);
});

test('choosing a candidate changes only the planned controls, then the real flight verifies that same prediction',()=>{
 assert.equal(typeof sessions.usePlanningRoute,'function','candidate launch requires a guarded session transition');
 const planned=sessions.selectPlan(sessions.createSession()),before=structuredClone(planned);
 const chosen=sessions.usePlanningRoute(planned,'original');
 assert.deepEqual(planned,before);
 assert.deepEqual(chosen.controls,{angle:0,power:1});assert.equal(chosen.plan.selectedKey,'original');
 assert.equal(chosen.model.version,0);assert.equal(chosen.completed,0);
 const flown=sessions.advanceFlight(sessions.startFlight(chosen),60);
 assert.deepEqual(flown.flight.predicted,chosen.plan.path);
 assert.deepEqual(flown.flight.controls,chosen.controls);assert.equal(flown.flight.done,true);
 assert.ok(flown.flight.error>10,'the initial model can be confidently wrong');
 assert.equal(flown.plan.distance,chosen.plan.distance,'real flight must not rewrite the prediction');
 assert.equal(sessions.usePlanningRoute(planned,'unknown'),planned);
 const active=sessions.advanceFlight(sessions.startFlight(planned),3);
 assert.equal(sessions.usePlanningRoute(active,'original'),active,'paused and moving partial flights cannot be replaced');
 assert.equal(sessions.usePlanningRoute(sessions.createSession(),'best').plan,null);
});

test('wind, target and learning invalidate candidate evidence; identical alternatives remain identical',()=>{
 const planned=sessions.selectPlan(sessions.createSession());
 assert.ok(planned.plan.alternatives,'planning evidence is missing');
 assert.equal(sessions.changeWind(planned,-1).plan,null);
 assert.equal(sessions.moveTarget(planned,{x:112,y:63,radius:5}).plan,null);
 const completed=sessions.advanceFlight(sessions.startFlight(planned),60);
 assert.equal(sessions.learnLatest(completed).plan,null);
 const repeat=sessions.selectPlan(planned),[a,b,c]=repeat.plan.alternatives;
 assert.deepEqual(a.controls,c.controls);assert.deepEqual(b.controls,c.controls);
 assert.deepEqual(a.path,c.path);assert.equal(a.distance,c.distance,'do not fabricate a difference when routes coincide');
});
