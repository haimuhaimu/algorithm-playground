import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../neural-step.mjs').catch(()=>({}));
const fixture=()=>({model:{kind:'linear',weights:[0,0,0],epoch:7},points:[{x:1,y:0,label:1},{x:-1,y:0,label:0}],history:[{epoch:7,loss:Math.log(2)}],usedRates:[.03],guess:'yes'});
function trial(snapshot=fixture()){assert.equal(typeof api.createStepTrial,'function');return api.createStepTrial(snapshot);}
function guess(t){api.guessStep(t,'A','up');api.guessStep(t,'B','up');}

test('a guess is required for both probes before exactly one analytic training update',()=>{
 const t=trial();assert.throws(()=>api.runStepTrial(t,.15),/guess/i);
 api.guessStep(t,'A','up');assert.throws(()=>api.runStepTrial(t,.15),/guess/i);
 api.guessStep(t,'B','up');const result=api.runStepTrial(t,.15);
 assert.deepEqual(result.model,{kind:'linear',weights:[.075,0,0],epoch:8});
 assert.equal(t.base.model.epoch,7);assert.deepEqual(result.usedRates,[.03,.15]);assert.equal(result.history.at(-1).epoch,8);
 assert.ok(Math.abs(result.history.at(-1).loss-.6563501408267952)<1e-12);
 assert.throws(()=>api.runStepTrial(t,.15),/rewind/i);assert.throws(()=>api.guessStep(t,'A','down'),/rewind/i);
 const e=api.stepEvidence(t);assert.equal(e.probes[0].before,.5);assert.ok(Math.abs(e.probes[0].after-.5187412158785352)<1e-12);assert.equal(e.probes[0].direction,'up');
});
test('snapshot, result and rewind do not alias each other, and retry starts at identical weights/history',()=>{
 const input=fixture(),t=trial(input);input.model.weights[0]=100;input.points[0].label=0;input.history[0].loss=0;
 guess(t);const first=api.runStepTrial(t,.15);first.model.weights[0]=99;
 assert.equal(api.stepEvidence(t).after.model.weights[0],.075);
 const restored=api.rewindStepTrial(t);assert.deepEqual(restored,fixture());restored.points[0].x=0;
 assert.equal(t.base.points[0].x,1);assert.equal(api.stepEvidence(t),null);assert.equal(t.last.rate,.15);
 assert.throws(()=>api.runStepTrial(t,.6),/guess/i);guess(t);const second=api.runStepTrial(t,.6);
 assert.equal(second.model.epoch,8);assert.deepEqual(second.model.weights,[.3,0,0]);assert.equal(second.history.length,2);assert.deepEqual(second.usedRates,[.03,.6]);
 assert.equal(t.last.rate,.15);assert.equal(t.last.after.model.weights[0],.075);
});
test('changing rates without running never changes frozen conditions and same-rate retries reproduce results',()=>{
 const t=trial();guess(t);api.runStepTrial(t,.03);const evidence=api.stepEvidence(t);
 api.rewindStepTrial(t);guess(t);api.runStepTrial(t,.03);assert.deepEqual(api.stepEvidence(t),evidence);
});
test('bad guesses/settings and untrainable models fail before making evidence',()=>{
 for(const points of [[],[{x:0,y:0,label:1}],[{x:NaN,y:0,label:0},{x:0,y:0,label:1}]])assert.throws(()=>trial({...fixture(),points}));
 for(const model of [{kind:'linear',weights:[0,0,0],epoch:4000},{kind:'linear',weights:[NaN,0,0],epoch:0},{kind:'other',weights:[0,0,0],epoch:0}])assert.throws(()=>trial({...fixture(),model}));
 const t=trial();assert.throws(()=>api.guessStep(t,'C','up'));assert.throws(()=>api.guessStep(t,'A','certain'));
 guess(t);for(const rate of [0,NaN,.7])assert.throws(()=>api.runStepTrial(t,rate));
 assert.equal(t.result,null);assert.equal(t.base.model.epoch,7);
});
test('display precision distinguishes tiny changes from a material direction without faking flips',()=>{
 trial();assert.equal(api.stepDirection(0),'steady');assert.equal(api.stepDirection(.00001),'steady');
 assert.equal(api.stepDirection(.00011),'up');assert.equal(api.stepDirection(-.00011),'down');
});
