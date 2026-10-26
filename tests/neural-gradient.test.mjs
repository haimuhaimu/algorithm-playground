import test from 'node:test';
import assert from 'node:assert/strict';
import {metrics,gradients} from '../neural-core.mjs';
const api=await import('../neural-gradient.mjs').catch(()=>({}));
function start(){assert.equal(typeof api.createGradientLesson,'function','gradient lesson must exist');return api.createGradientLesson();}
test('one update follows the actual loss slope on the exact accepted six-point task',()=>{
 const s=start(),before=structuredClone(s.model),points=structuredClone(s.points);
 assert.deepEqual(before.weights,[1,-1,0]);assert.equal(points.length,6);
 // Finite differences independently check direction and magnitude, not just a second call to train().
 const eps=1e-5,g=before.weights.map((_,i)=>{const a=structuredClone(before),b=structuredClone(before);a.weights[i]+=eps;b.weights[i]-=eps;return (metrics(a,points).loss-metrics(b,points).loss)/(2*eps);});
 api.stepGradientLesson(s,1);assert.equal(s.model.epoch,1);
 s.model.weights.forEach((v,i)=>assert.ok(Math.abs(v-(before.weights[i]-.15*g[i]))<1e-9));
 assert.deepEqual(s.points,points);assert.deepEqual(s.baseline,before);
 const e=api.gradientEvidence(s);assert.equal(e.steps,1);assert.ok(e.lossAfter<e.lossBefore);
 assert.equal(e.mistakesNow.length,2,'loss can fall before any point changes class');
 assert.deepEqual(e.lastGradient,gradients(before,points));assert.deepEqual(e.lastWeights,before.weights);
});
test('reset restores the exact same origin and rate changes cannot quietly mix two trials',()=>{
 const s=start();api.setGradientRate(s,.6);api.stepGradientLesson(s,10);const large=[...s.model.weights];
 assert.throws(()=>api.setGradientRate(s,.03),/reset/i);assert.equal(s.rate,.6);
 api.resetGradientLesson(s);assert.equal(s.model.epoch,0);assert.deepEqual(s.model.weights,[1,-1,0]);assert.equal(s.lastGradient,null);
 api.setGradientRate(s,.03);api.stepGradientLesson(s,10);const small=[...s.model.weights];assert.notDeepEqual(small,large);
 api.resetGradientLesson(s);api.setGradientRate(s,.6);api.stepGradientLesson(s,10);assert.deepEqual(s.model.weights,large);
});
test('session caps real updates, gates reflection, and rejects malformed input without mutation',()=>{
 const s=start();assert.throws(()=>api.answerGradientLesson(s,'parameters'),/step/i);
 for(const value of [0,2,NaN,'0.15'])assert.throws(()=>api.setGradientRate(s,value));
 for(const count of [0,2,NaN,-1,1.2])assert.throws(()=>api.stepGradientLesson(s,count));
 assert.equal(s.model.epoch,0);for(let i=0;i<12;i++)api.stepGradientLesson(s,10);
 assert.equal(s.model.epoch,120);const model=structuredClone(s.model);api.stepGradientLesson(s,1);assert.deepEqual(s.model,model);
 api.answerGradientLesson(s,'points');assert.equal(s.answer,'points');api.answerGradientLesson(s,'parameters');assert.equal(s.answer,'parameters');
 api.resetGradientLesson(s);assert.equal(s.answer,null);assert.deepEqual(s.model.weights,[1,-1,0]);
});
