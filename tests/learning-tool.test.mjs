import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../learning-tool.mjs').catch(()=>({}));
const sequence=(rate=.15)=>[
 {action:'train'},{action:'probe'},{action:'guess',value:1},{action:'explain',value:'parameters'},{action:'next'},
 {action:'rate',value:rate},{action:'guess',value:'points'},{action:'step'},{action:'explain',value:'parameters'},{action:'next'},
 {action:'train'},{action:'guess',value:'all'},{action:'point',value:4},{action:'explain',value:'unseen'},{action:'next'}
];
test('tool discovery distinguishes ten web experiments from the one executable learning route',()=>{
 assert.equal(typeof api.listLearningTools,'function','an executable discovery adapter is required');
 const tools=api.listLearningTools();assert.equal(tools.experiments.length,10);assert.equal(tools.runnables.length,1);
 assert.equal(tools.runnables[0].id,'learning-route');assert.equal(tools.runnables[0].transport,'local-cli-or-library');
 const detail=api.describeLearningTool('learning-route');assert.equal(detail.id,'learning-route');
 assert.ok(detail.genai.some(l=>l.url==='https://haimuhaimu.github.io/genai-learning-os/?page=foundation&node=gradient-descent'));
 assert.throws(()=>api.describeLearningTool('arbitrary-module'),/unknown/i);
 tools.experiments.length=0;assert.equal(api.listLearningTools().experiments.length,10,'caller mutation cannot corrupt the shared catalog');
});
test('real route execution keeps wrong guesses and separates workflow completion from mastery',()=>{
 assert.equal(typeof api.runLearningRoute,'function');
 const r=api.runLearningRoute(sequence(),{producer:'agent'});
 assert.equal(r.format,'algorithm-playground/learning-run');assert.equal(r.schemaVersion,1);assert.equal(r.engineVersion,'learning-route-v1');
 assert.equal(r.producer,'agent');assert.equal(r.result.stage,'summary');assert.equal(r.result.workflowComplete,true);assert.equal(r.result.mastery,'not-assessed');
 assert.equal(r.result.evidence.guide.guess,1);assert.equal(r.result.evidence.gradient.steps,1);assert.equal(r.result.evidence.stepGuess,'points');
 assert.equal(r.result.evidence.test.guess,'all');assert.equal(r.result.evidence.test.test.correct,13);assert.equal(r.result.evidence.test.test.total,16);
 assert.equal(r.result.evidence.test.train.correct,6);assert.equal(r.result.evidence.test.steps,120);
 assert.equal(r.steps.length,15);assert.equal(r.steps.every(s=>s.status==='applied'||s.status==='no-op'),true);
 assert.deepEqual(api.runLearningRoute(sequence(),{producer:'agent'}),r,'same inputs must give the same receipt without timestamps or random ids');
});
test('one-step rates change the actual gradient result but never the independent test model',()=>{
 assert.equal(typeof api.runLearningRoute,'function');
 const small=api.runLearningRoute(sequence(.03)),big=api.runLearningRoute(sequence(.6));
 assert.ok(Math.abs(small.result.evidence.gradient.lossAfter-.6619599)<1e-6);
 assert.ok(Math.abs(big.result.evidence.gradient.lossAfter-.5951786)<1e-6);
 assert.equal(small.result.evidence.gradient.mistakesNow.length,2,'an improved reading is not automatically a corrected class');
 assert.deepEqual(small.result.evidence.test,big.result.evidence.test,'test uses its own fixed 120-step model');
});
test('out-of-phase actions are rejected and idempotent actions are explicitly no-op',()=>{
 assert.equal(typeof api.runLearningRoute,'function');
 const r=api.runLearningRoute([{action:'step'},{action:'next'},{action:'inspect',value:2},{action:'train'}]);
 assert.deepEqual(r.steps.map(s=>s.status),['rejected','rejected','no-op','applied']);
 assert.equal(r.result.workflowComplete,false);assert.equal(r.result.evidence.guide.steps,120);assert.equal(r.result.evidence.gradient.steps,0);
 assert.ok(r.steps[0].reason);assert.ok(r.result.availableActions.some(a=>a.action==='probe'));
});
test('request validation never accepts arbitrary states, code, modules, invalid values or unbounded journals',()=>{
 assert.equal(typeof api.runLearningRoute,'function');
 for(const actions of [null,{},[{action:'eval',value:'process.exit()'}],[{action:'rate',value:.2}],[{action:'train',model:{weights:[1]}}],[{action:'point',value:16}],Array.from({length:257},()=>({action:'reset'}))]){
  assert.throws(()=>api.runLearningRoute(actions),/invalid|unsupported|limit|unknown|256/i);
 }
 assert.throws(()=>api.runLearningRoute([],{producer:'human-certified'}),/producer/i);
 assert.throws(()=>api.runLearningRoute([],{producer:'agent',state:{}}),/option|unknown/i);
});
test('receipt replay recomputes results and detects altered results, actions, versions and extra payloads',()=>{
 assert.equal(typeof api.replayLearningReceipt,'function');
 const r=api.runLearningRoute(sequence(),{producer:'browser-session'}),replayed=api.replayLearningReceipt(r);
 assert.equal(replayed.matches,true);assert.equal(replayed.authenticatesUser,false);
 for(const mutate of [x=>x.result.evidence.test.test.correct=16,x=>x.actions[0].action='reset',x=>x.engineVersion='other',x=>x.schemaVersion=2,x=>x.privateDraft='do not copy',x=>x.steps[0].status='no-op']){
  const changed=structuredClone(r);mutate(changed);assert.throws(()=>api.replayLearningReceipt(changed),/receipt|version|mismatch|unknown/i);
 }
});
test('retry and reset receipts represent the actual last state rather than a canned successful run',()=>{
 assert.equal(typeof api.runLearningRoute,'function');
 const retry=api.runLearningRoute([...sequence().slice(0,8),{action:'retry'}]);
 assert.equal(retry.result.stage,'gradient');assert.equal(retry.result.evidence.gradient.steps,0);assert.equal(retry.result.evidence.stepGuess,null);
 const reset=api.runLearningRoute([...sequence(),{action:'reset'}]);
 assert.equal(reset.result.stage,'classify');assert.deepEqual(reset.result.evidence.completed,[false,false,false]);assert.equal(reset.result.workflowComplete,false);
});
test('receipt wire precision survives actual browser and Node floating-point differences without weakening tamper checks',()=>{
 assert.equal(typeof api.runLearningRoute,'function');
 const r=api.runLearningRoute(sequence());
 assert.equal(r.result.evidence.test.test.points[4].probability,.0693633623888,'wire format must normalize the observed Chrome/Node 0.06936336238875873 vs 0.06936336238875875 difference');
 assert.equal(r.numericFormat,'decimal-12-significant-digits');assert.equal(api.replayLearningReceipt(r).matches,true);
 const edited=structuredClone(r);edited.result.evidence.test.test.points[4].probability+=1e-9;
 assert.throws(()=>api.replayLearningReceipt(edited),/mismatch/i,'normalizing the genuine output must not become a general tolerance for edited results');
});
test('mutating a returned receipt cannot change the process whitelist or invalidate an earlier genuine receipt',()=>{
 assert.equal(typeof api.runLearningRoute,'function');
 const r=api.runLearningRoute(sequence().slice(0,12)),pristine=structuredClone(r);
 r.result.availableActions.find(a=>a.action==='point').values.push(999);
 assert.equal(api.describeLearningTool('learning-route').input.allowedValues.point.includes(999),false,'returned action options must not alias internal validation choices');
 assert.throws(()=>api.runLearningRoute([...sequence().slice(0,12),{action:'point',value:999}]),/invalid/i);
 assert.equal(api.replayLearningReceipt(pristine).matches,true,'another consumer cannot retroactively corrupt a genuine replay');
});
