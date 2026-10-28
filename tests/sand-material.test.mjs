import test from 'node:test';
import assert from 'node:assert/strict';
import * as lesson from '../sand-lesson.mjs';
import {stepWorld,countMaterials} from '../sand-core.mjs';

const create=()=>{assert.equal(typeof lesson.createMaterialLesson,'function');return lesson.createMaterialLesson();};
const run=(s,guess)=>lesson.runMaterialLesson(lesson.predictMaterialLesson(s,guess));

// Catch an incorrect material branch, fake exchange, loss or double-update.
for(const [material,guess,wantSand,wantWater,wantReason]of [[0,'fall',12,-1,'empty'],[2,'swap',12,7,'swap'],[3,'stay',7,-1,'occupied']]){
 test(`material ${material} runs the real engine once, with sand at ${wantSand} and water at ${wantWater}`,()=>{
  const start=lesson.selectMaterialLesson(create(),material),saved=structuredClone(start);
  const result=run(start,guess),r=result.record;
  assert.deepEqual(start.before,r.before,'the displayed pre-guess world must be the exact world that runs');
  assert.equal(r.after.cells.indexOf(1),wantSand);assert.equal(r.after.cells.indexOf(2),wantWater);
  assert.equal(r.decision.attempts[0].reason,wantReason);assert.equal(r.outcome,guess);assert.equal(r.correct,true);
  assert.equal(r.after.tick,1);assert.equal(r.before.tick,0);assert.deepEqual(r.after,stepWorld(r.before));
  assert.deepEqual(r.countsBefore,countMaterials(r.before));assert.deepEqual(r.countsAfter,r.countsBefore);
  assert.equal(r.countsAfter.sand,1);assert.equal(r.countsAfter.water,material===2?1:0);
  assert.deepEqual(r.waterFrom,material===2?{x:2,y:2}:null);assert.deepEqual(r.waterTo,material===2?{x:2,y:1}:null);
  assert.deepEqual(start,saved);assert.equal(lesson.runMaterialLesson(result),result,'repeat cannot advance the case');
 });
}
test('all three before snapshots differ at exactly the same one cell, with the same sand and tick',()=>{
 const records=[0,2,3].map(m=>run(lesson.selectMaterialLesson(create(),m),'stay').record);
 for(const r of records){
  assert.equal(r.before.width,5);assert.equal(r.before.height,5);assert.equal(r.before.tick,0);assert.equal(r.before.cells[7],1);
  assert.deepEqual([...r.before.cells].map((c,i)=>c===records[0].before.cells[i]?null:i).filter(i=>i!==null),r===records[0]?[]:[12]);
 }
 assert.deepEqual(records[2].decision.attempts.map(a=>a.reason),['occupied','corner','corner']);
});
test('wrong guesses get actual outcomes and switching preserves evidence while invalidating the active prediction',()=>{
 let state=run(create(),'swap');assert.equal(state.record.correct,false);assert.equal(state.record.outcome,'fall');
 const first=structuredClone(state.record);
 state=lesson.selectMaterialLesson(state,2);assert.equal(state.prediction,null);assert.equal(state.record,null);
 assert.throws(()=>lesson.runMaterialLesson(state),/prediction/i);
 assert.deepEqual(state.results[0],first);
 state=run(state,'stay');assert.equal(state.record.correct,false);assert.equal(state.record.outcome,'swap');
 const water=structuredClone(state.record);
 state=run(lesson.selectMaterialLesson(state,3),'stay');
 assert.deepEqual(state.results[0],first);assert.deepEqual(state.results[2],water);assert.equal(Object.keys(state.results).length,3);
});
test('same-condition retry retains prior evidence and restores a fresh guess at tick zero',()=>{
 const result=run(lesson.selectMaterialLesson(create(),2),'swap'),saved=structuredClone(result.results);
 const retry=lesson.retryMaterialLesson(result);
 assert.equal(retry.material,2);assert.equal(retry.prediction,null);assert.equal(retry.record,null);assert.deepEqual(retry.results,saved);
 const next=run(retry,'fall');assert.equal(next.record.after.tick,1);assert.equal(next.record.correct,false);
 assert.equal(result.record.correct,true);assert.equal(create().record,null);assert.deepEqual(create().results,{});
});
test('invalid materials and guesses are rejected without changing the accepted evidence',()=>{
 const state=run(create(),'fall'),saved=structuredClone(state);
 for(const m of [1,-1,4,'2',null,NaN])assert.throws(()=>lesson.selectMaterialLesson(state,m),/material/i);
 for(const g of ['down','left','teleport',null])assert.throws(()=>lesson.predictMaterialLesson(state,g),/prediction/i);
 assert.deepEqual(state,saved);
});
