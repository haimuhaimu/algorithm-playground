import test from 'node:test';
import assert from 'node:assert/strict';
import {predict} from '../neural-core.mjs';
const api=await import('../neural-generalization.mjs').catch(()=>({}));
const create=()=>{assert.equal(typeof api.createGeneralizationLesson,'function','frozen held-out lesson must exist');return api.createGeneralizationLesson();};
test('the full fixed grid has independent authored labels and never overlaps the training set',()=>{
 const s=create();assert.equal(s.train.length,6);assert.equal(s.test.length,16);
 assert.deepEqual(s.test.map(p=>p.label),[0,0,0,0,0,0,0,1,0,0,1,1,0,1,1,1]);
 assert.deepEqual(s.test.map(p=>p.x),[-.75,-.25,.25,.75,-.75,-.25,.25,.75,-.75,-.25,.25,.75,-.75,-.25,.25,.75]);
 for(const p of s.test)assert.ok(!s.train.some(t=>t.x===p.x&&t.y===p.y));
 for(const p of [...s.train,...s.test])assert.equal(p.label,Number(p.x+p.y>0));
});
test('only the six practice examples train the real model before a mandatory frozen guess',()=>{
 const s=create();assert.equal(api.generalizationEvidence(s).test,null);api.trainGeneralization(s);
 assert.equal(s.phase,'guess');assert.equal(s.model.epoch,120);assert.equal(api.generalizationEvidence(s).train.correct,6);
 assert.deepEqual(s.model.weights,[2.972579595837726,1.0487868656982415,-8.326672684688666e-18]);
 assert.ok(Object.isFrozen(s.model));assert.ok(Object.isFrozen(s.model.weights));assert.equal(api.generalizationEvidence(s).test,null);
 assert.throws(()=>api.trainGeneralization(s));
});
test('reveal reports actual held-out predictions without changing the frozen decision rule',()=>{
 const s=create();api.trainGeneralization(s);const model=structuredClone(s.model);api.revealGeneralization(s,'all');
 const e=api.generalizationEvidence(s);assert.equal(e.test.correct,13);assert.equal(e.test.total,16);assert.deepEqual(e.wrong,[3,6,13]);
 assert.equal(e.selected.id,4);assert.equal(e.selected.label,0);assert.equal(e.selected.predicted,1);assert.ok(e.selected.probability>.75);
 for(const p of e.test.points)assert.equal(p.predicted,Number(predict(s.model,p.x,p.y)>=.5));
 for(const index of [13,0,6]){api.selectGeneralizationPoint(s,index);assert.equal(api.generalizationEvidence(s).selected.id,index+1);}
 api.setGeneralizationView(s,'training');api.setGeneralizationView(s,'test');
 api.answerGeneralization(s,'practice');assert.equal(s.phase,'reveal');api.answerGeneralization(s,'unseen');assert.equal(s.phase,'done');
 assert.deepEqual(s.model,model);assert.equal(s.model.epoch,120);assert.ok(e.test.points.every(p=>p.id>=1&&p.id<=16));
});
test('invalid transitions, hidden answers and reset cannot mutate another lesson or a frozen run',()=>{
 const s=create(),other=create();assert.throws(()=>api.revealGeneralization(s,'all'));assert.throws(()=>api.selectGeneralizationPoint(s,0));
 assert.throws(()=>api.answerGeneralization(s,'unseen'));api.trainGeneralization(s);
 assert.throws(()=>api.revealGeneralization(s,'maybe'));api.revealGeneralization(s,'not-all');
 for(const index of [-1,16,.5,NaN])assert.throws(()=>api.selectGeneralizationPoint(s,index));
 assert.throws(()=>api.setGeneralizationView(s,'other'));assert.throws(()=>api.answerGeneralization(s,'other'));
 assert.deepEqual(other,create());api.resetGeneralization(s);assert.deepEqual(s,create());assert.equal(api.generalizationEvidence(s).selected,null);
 api.trainGeneralization(s);api.revealGeneralization(s,'not-all');assert.equal(api.generalizationEvidence(s).test.correct,13);
});
