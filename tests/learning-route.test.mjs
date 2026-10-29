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
test('same-point observation derives an unrun baseline and a real still-wrong one-step result',()=>{
 const r=setup();let p=r.e().point;
 assert.ok(p,'route must expose a concrete supplied example, not a made-up progress score');
 assert.equal(p.id,3);assert.equal(p.label,0);assert.equal(p.before.predicted,1);assert.equal(p.after,null);
 assert.ok(Math.abs(p.before.towardLabel-.389360766050778)<1e-12,'circle tendency from logit .45 is 1-sigmoid(.45)');
 classify(r);r.act('next');r.act('rate',.03);r.act('guess','parameters');r.act('step');p=r.e().point;
 assert.equal(p.after.predicted,1,'a small genuine update does not magically fix this example');
 assert.equal(p.after.correct,false);assert.ok(p.after.towardLabel>p.before.towardLabel);
 r.s.gradient.model.weights=[0,0,0];p=r.e().point;assert.equal(p.after.towardLabel,.5,'observation must read the current real model');
 r.act('retry');assert.equal(r.e().point.after,null,'retry must not retain a completed result');
});
test('looking at the other wrong example never trains and keeps each station selection independent',()=>{
 const r=setup(),start=structuredClone(r.s.guide);r.act('inspect',5);assert.equal(r.e().point.id,6);assert.equal(r.e().point.label,1);
 assert.ok(Math.abs(r.e().point.before.towardLabel-.389360766050778)<1e-12);assert.deepEqual(r.s.guide,start);
 r.act('inspect',4);assert.equal(r.e().point.id,6,'only the supplied inspectable examples are selectable');
 classify(r);assert.equal(r.e().point,null,'the unseen-probe question must not show an unrelated training inspector');r.act('next');
 assert.equal(r.e().point.id,3);r.act('inspect',5);gradient(r);r.act('retry');assert.equal(r.e().point.id,6);
 r.act('back');assert.equal(r.s.stage,'classify');assert.equal(r.e().point,null);
 r.act('reset');assert.equal(r.e().point.id,3);assert.equal(r.e().point.after,null);
});
