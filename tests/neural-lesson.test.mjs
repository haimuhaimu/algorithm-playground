import test from 'node:test';
import assert from 'node:assert/strict';
import {createModel,makeDataset,train,predict} from '../neural-core.mjs';
const lesson=await import('../neural-lesson.mjs').catch(()=>({}));
const create=()=>{assert.equal(typeof lesson.createLesson,'function','controlled wrong-label lesson must exist');return lesson.createLesson();};
function finish(s){lesson.advanceLesson(s,'before',500);lesson.advanceLesson(s,'after',500);return s;}

test('controlled pair changes exactly one label, keeping positions, size and identical initial weights',()=>{
 const s=create(),original=makeDataset('islands').train;
 assert.deepEqual(s.original,original);assert.equal(s.changed.length,48);
 const differences=s.changed.flatMap((p,i)=>JSON.stringify(p)!==JSON.stringify(original[i])?[i]:[]);
 assert.deepEqual(differences,[38]);assert.deepEqual(s.changed[38],{...original[38],label:0});
 assert.deepEqual(s.before,createModel('network',41));assert.deepEqual(s.after,s.before);
 assert.notEqual(s.after.weights,s.before.weights);assert.notEqual(s.changed[0],s.original[0]);
 assert.equal(lesson.evidence(s),null,'unfinished models must never produce comparison evidence');
 assert.throws(()=>lesson.advanceLesson(s,'after',25),/baseline/i);
});
test('both outcomes equal independent 500-step training from the same seed, not warm-started fine-tuning',()=>{
 const s=finish(create());
 const original=makeDataset('islands').train;
 const changed=original.map((p,i)=>({...p,label:i===38?0:p.label}));
 assert.deepEqual(s.before,train(createModel('network',41),original,.15,500));
 assert.deepEqual(s.after,train(createModel('network',41),changed,.15,500));
 assert.equal(s.before.epoch,500);assert.equal(s.after.epoch,500);
 const before=structuredClone(s.before);lesson.advanceLesson(s,'before',25);lesson.advanceLesson(s,'after',25);
 assert.deepEqual(s.before,before);assert.equal(s.after.epoch,500,'training is capped to equal conditions');
});
test('fixed probes report numerical tendencies and threshold crossings independently of the wrong label',()=>{
 const s=finish(create()),r=lesson.evidence(s);
 assert.equal(r.probes.length,3);
 for(const p of r.probes){
  assert.equal(p.before,predict(s.before,p.x,p.y));assert.equal(p.after,predict(s.after,p.x,p.y));
  assert.equal(p.delta,(p.after-p.before)*100);assert.equal(p.flipped,(p.before>=.5)!==(p.after>=.5));
 }
 assert.ok(r.probes[0].before>.95&&r.probes[0].after>.5,'edited point remains a square despite wrong circle label');
 assert.equal(r.probes[0].flipped,false);assert.equal(r.probes[1].flipped,true,'nearby fixed probe changes class');
 assert.deepEqual({x:r.probes[1].x,y:r.probes[1].y},{x:.8,y:.2});
});
test('switching examples retains the baseline and resets only intervention and old evidence',()=>{
 const s=finish(create()),baseline=structuredClone(s.before),old=lesson.evidence(s);
 lesson.selectExample(s,'inside');
 assert.deepEqual(s.before,baseline);assert.equal(s.after.epoch,0);assert.equal(lesson.evidence(s),null);
 assert.deepEqual(s.changed[14],{...s.original[14],label:0});assert.deepEqual(s.changed[38],s.original[38]);
 lesson.advanceLesson(s,'after',500);
 assert.notEqual(lesson.evidence(s).probes[1].after,old.probes[1].after);
 const snapshot=structuredClone(s);assert.throws(()=>lesson.selectExample(s,'unknown'),/example/i);assert.deepEqual(s,snapshot);
});
test('incremental execution and replay are deterministic, with input limits checked before mutation',()=>{
 const s=create();for(let i=0;i<20;i++)lesson.advanceLesson(s,'before',25);
 for(let i=0;i<20;i++)lesson.advanceLesson(s,'after',25);
 assert.deepEqual(s,finish(create()));
 for(const steps of [0,-1,1.5,NaN,501])assert.throws(()=>lesson.advanceLesson(s,'after',steps),/steps/i);
 assert.throws(()=>lesson.advanceLesson(s,'other',1),/side/i);
 for(const id of ['edge','inside','opposite']){const t=create();lesson.selectExample(t,id);finish(t);assert.equal(t.before.epoch,t.after.epoch);}
});
