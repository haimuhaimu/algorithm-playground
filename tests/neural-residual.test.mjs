import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../neural-residual.mjs').catch(()=>({}));
function start(){assert.equal(typeof api.createResidualLesson,'function','residual lesson must exist');return api.createResidualLesson();}
test('zero-branch identity is witnessed before actual training, and demo switches never edit model weights',()=>{
 const s=start(),models=structuredClone(s.models);assert.throws(()=>api.openResidualTraining(s),/shortcut/i);
 assert.deepEqual(api.residualEvidence(s).signal.output,[0,0]);api.setResidualShortcut(s,true);
 assert.deepEqual(api.residualEvidence(s).signal.output,[-.25,-.7]);assert.equal(s.sawIdentity,true);
 api.setResidualZero(s,false);assert.notDeepEqual(api.residualEvidence(s).signal.change,[0,0]);assert.deepEqual(s.models,models);
 api.openResidualTraining(s);assert.equal(s.stage,'learn');assert.equal(s.zeroBranch,false);assert.equal(s.models.residual.epoch,0);
 assert.throws(()=>api.setResidualShortcut(s,false),/demo/i);
});
test('both structures share weights/data/budget but retain their own actual starting predictions',()=>{
 const s=start();assert.deepEqual(s.models.plain.weights,s.models.residual.weights);
 const initial=api.residualEvidence(s),points=structuredClone(s.points);assert.notEqual(initial.plain.before.loss,initial.residual.before.loss);
 api.setResidualShortcut(s,true);api.openResidualTraining(s);api.stepResidualPair(s,20);
 const e=api.residualEvidence(s);assert.equal(e.steps,20);assert.equal(s.models.plain.epoch,20);assert.equal(s.models.residual.epoch,20);
 assert.deepEqual(e.plain.before,initial.plain.before);assert.deepEqual(e.residual.before,initial.residual.before);assert.deepEqual(s.points,points);
 api.selectResidualSignal(s,1);assert.equal(api.residualEvidence(s).signalId,'B');assert.equal(s.models.plain.epoch,20);
 api.answerResidual(s,'perfect');assert.equal(s.answer,'perfect');api.answerResidual(s,'carry');assert.equal(s.answer,'carry');
 api.resetResidual(s);assert.equal(s.stage,'signal');assert.equal(s.answer,null);assert.equal(s.models.plain.epoch,0);assert.deepEqual(api.residualEvidence(s).plain.before,initial.plain.before);
});
test('invalid actions, copied evidence edits and repeats cannot corrupt the learning session',()=>{
 const s=start();assert.throws(()=>api.stepResidualPair(s,1));assert.throws(()=>api.answerResidual(s,'carry'));
 assert.throws(()=>api.selectResidualSignal(s,99));assert.throws(()=>api.setResidualShortcut(s,'yes'));
 const e=api.residualEvidence(s);e.signal.output[0]=99;assert.notEqual(api.residualEvidence(s).signal.output[0],99);
 api.setResidualShortcut(s,true);api.openResidualTraining(s);assert.throws(()=>api.answerResidual(s,'carry'));
 for(let i=0;i<12;i++)api.stepResidualPair(s,20);assert.equal(s.models.residual.epoch,200);assert.equal(s.models.plain.epoch,200);
 const models=structuredClone(s.models);api.stepResidualPair(s,1);assert.deepEqual(s.models,models);
});
