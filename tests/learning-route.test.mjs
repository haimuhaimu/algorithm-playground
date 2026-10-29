import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../learning-route.mjs').catch(()=>({}));
function setup(){assert.equal(typeof api.createLearningRoute,'function','real learning route must exist');const s=api.createLearningRoute();return {s,act:(a,v)=>api.actLearningRoute(s,a,v),e:()=>api.learningRouteEvidence(s)};}
function classify(r){r.act('train');r.act('probe');r.act('guess',1);r.act('explain','parameters');}
function gradient(r){r.act('guess','points');r.act('step');r.act('explain','parameters');}
test('navigation cannot replace actual learning, prediction and explanation',()=>{
 const r=setup();r.act('next');assert.equal(r.s.stage,'classify');assert.deepEqual(r.e().completed,[false,false,false]);
 r.act('train');assert.equal(r.e().guide.steps,120);assert.deepEqual(r.e().guide.mistakesNow,[]);
 r.act('next');assert.equal(r.s.stage,'classify');r.act('probe');r.act('guess',1);
 assert.equal(r.e().guide.matchesGuess,false,'wrong guess still reveals actual circle result');
 r.act('explain','memorize');r.act('next');assert.equal(r.s.stage,'classify');
 r.act('explain','parameters');r.act('next');assert.equal(r.s.stage,'gradient');assert.deepEqual(r.e().completed,[true,false,false]);
});
test('gradient prediction gates a real step and retry restores identical weights at a different rate',()=>{
 const r=setup();classify(r);r.act('next');r.act('step');assert.equal(r.e().gradient.steps,0);
 r.act('rate',.6);r.act('guess','points');r.act('step');const large=structuredClone(r.s.gradient.model);
 assert.equal(large.epoch,1);assert.equal(r.s.gradient.rate,.6);assert.notDeepEqual(large.weights,[1,-1,0]);
 r.act('rate',.03);assert.equal(r.s.gradient.rate,.6,'cannot secretly change rate after a step');
 r.act('retry');assert.deepEqual(r.s.gradient.model.weights,[1,-1,0]);assert.equal(r.s.stepGuess,null);
 r.act('rate',.03);r.act('guess','parameters');r.act('step');assert.equal(r.s.gradient.model.epoch,1);assert.notDeepEqual(r.s.gradient.model.weights,large.weights);
 r.act('explain','points');r.act('next');assert.equal(r.s.stage,'gradient');
 r.act('explain','parameters');r.act('next');assert.equal(r.s.stage,'test');assert.equal(r.s.test.model.epoch,0,'test station explicitly starts its own fixed baseline');
});
test('unseen results require a guess and evaluation never trains on test points',()=>{
 const r=setup();classify(r);r.act('next');gradient(r);r.act('next');assert.equal(r.e().test.test,null);
 r.act('train');const frozen=structuredClone(r.s.test.model);assert.equal(frozen.epoch,120);assert.equal(r.e().test.test,null);
 r.act('guess','all');assert.equal(r.e().test.train.correct,6);assert.equal(r.e().test.test.correct,13);assert.equal(r.e().test.test.total,16);
 r.act('point',15);assert.equal(r.e().test.selected.id,16);assert.deepEqual(r.s.test.model,frozen);
 r.act('explain','practice');r.act('next');assert.equal(r.s.stage,'test');
 r.act('explain','unseen');r.act('next');assert.equal(r.s.stage,'summary');assert.deepEqual(r.e().completed,[true,true,true]);assert.deepEqual(r.s.test.model,frozen);
});
test('back preserves real evidence and explicit restart clears only this ephemeral route',()=>{
 const r=setup();classify(r);const old=structuredClone(r.s.guide.model);r.act('next');gradient(r);r.act('back');
 assert.equal(r.s.stage,'classify');assert.deepEqual(r.s.guide.model,old);assert.equal(r.e().completed[1],true);
 r.act('reset');assert.equal(r.s.stage,'classify');assert.equal(r.e().guide.steps,0);assert.deepEqual(r.e().completed,[false,false,false]);
});
test('invalid or out-of-phase actions cannot fabricate progress or corrupt state',()=>{
 const r=setup(),old=structuredClone(r.s);for(const [a,v]of [['guess',0],['step'],['explain','parameters'],['point',999],['back'],['rate',99],['next'],['unknown']])r.act(a,v);
 assert.deepEqual(r.s,old);
});
