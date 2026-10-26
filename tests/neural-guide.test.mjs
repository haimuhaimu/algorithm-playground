import test from 'node:test';
import assert from 'node:assert/strict';
import {train,predict,metrics,createModel} from '../neural-core.mjs';
const api=await import('../neural-guide.mjs').catch(()=>({}));
function start(){assert.equal(typeof api.createGuide,'function','guided learning state must exist');return api.createGuide();}

test('the opening line visibly misclassifies two specific examples, then real training fixes those examples',()=>{
 const s=start();assert.deepEqual(api.guideEvidence(s).mistakesBefore,[2,5]);assert.deepEqual(api.guideEvidence(s).mistakesNow,[2,5]);
 const original=structuredClone(s.points);api.teachGuide(s);
 assert.deepEqual(api.guideEvidence(s).mistakesNow,[]);assert.deepEqual(api.guideEvidence(s).mistakesBefore,[2,5]);assert.deepEqual(s.points,original);
});

test('guide requires real teaching before testing or recapping and caps repeated training',()=>{
 const s=start();assert.equal(s.phase,'intro');assert.equal(s.model.epoch,0);
 assert.throws(()=>api.openGuideTest(s),/train/i);assert.throws(()=>api.openGuideRecap(s),/test/i);
 const points=structuredClone(s.points);api.teachGuide(s,4);assert.equal(s.phase,'teaching');assert.equal(s.model.epoch,4);
 api.teachGuide(s);assert.equal(s.phase,'trained');assert.equal(s.model.epoch,120);assert.deepEqual(s.points,points);
 const weights=[...s.model.weights];assert.throws(()=>api.teachGuide(s),/train/i);assert.deepEqual(s.model.weights,weights);
});
test('teaching uses actual full-batch gradient descent rather than canned outcomes',()=>{
 const s=start(),reference=createModel('linear');reference.weights=[1,-1,0];train(reference,s.points,.15,120);api.teachGuide(s);
 assert.deepEqual(s.model,reference);assert.ok(metrics(s.model,s.points).loss<.15);
 const e=api.guideEvidence(s);assert.equal(e.changedParameters,3);assert.equal(e.lossBefore,0.6656267656141281);
 assert.equal(e.lossAfter,metrics(reference,s.points).loss);assert.equal(e.examples,6);
});
test('held-out guesses reveal actual predictions without changing data or learned parameters',()=>{
 const s=start();api.teachGuide(s);api.openGuideTest(s);
 const e=api.guideEvidence(s);assert.ok(!s.points.some(p=>p.x===e.probe.x&&p.y===e.probe.y));
 assert.equal(e.probe.before,1/(1+Math.exp(-.29)));assert.equal(e.probe.after,predict(s.model,e.probe.x,e.probe.y));
 const model=structuredClone(s.model),points=structuredClone(s.points),answer=e.probe.after>=.5?1:0;
 api.guessGuide(s,1-answer);assert.equal(s.phase,'reveal');assert.equal(api.guideEvidence(s).matchesGuess,false);
 assert.deepEqual(s.model,model);assert.deepEqual(s.points,points);assert.throws(()=>api.guessGuide(s,answer),/guess/i);
 api.openGuideTest(s,1);api.guessGuide(s,api.guideEvidence(s).probe.after>=.5?1:0);
 assert.equal(api.guideEvidence(s).matchesGuess,true);assert.deepEqual(s.model,model);
});
test('recap needs an independent explanation; retry changes no evidence and restart is clean',()=>{
 const s=start();api.teachGuide(s);api.openGuideTest(s);api.guessGuide(s,0);api.openGuideRecap(s);
 const before=structuredClone(api.guideEvidence(s));api.finishGuide(s,'memorize');assert.equal(s.phase,'reflect');
 api.finishGuide(s,'parameters');assert.equal(s.phase,'done');assert.deepEqual(api.guideEvidence(s).probe,before.probe);
 const fresh=start();assert.equal(fresh.phase,'intro');assert.equal(fresh.guess,null);assert.equal(fresh.reflection,null);
 assert.equal(fresh.model.epoch,0);assert.deepEqual(fresh.model.weights,[1,-1,0]);
});
test('invalid guide actions and external evidence edits cannot corrupt training or probes',()=>{
 const s=start();assert.throws(()=>api.teachGuide(s,NaN));assert.throws(()=>api.teachGuide(s,0));
 api.teachGuide(s);assert.throws(()=>api.openGuideTest(s,99));api.openGuideTest(s);
 assert.throws(()=>api.guessGuide(s,'square'));assert.throws(()=>api.finishGuide(s,'parameters'));
 const e=api.guideEvidence(s);e.probe.x=900;e.lossAfter=900;assert.notEqual(api.guideEvidence(s).probe.x,900);
 assert.equal(s.model.epoch,120);
});
