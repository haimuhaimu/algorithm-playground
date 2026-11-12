import test from 'node:test';
import assert from 'node:assert/strict';
import {runLearningRoute,runLearningTool} from '../../dist/learning-tool.mjs';
const api=await import('../../dist/learning-route-trials.mjs').catch(()=>({}));
const intro=[{action:'train'},{action:'probe'},{action:'guess',value:1},{action:'explain',value:'parameters'},{action:'next'}];
const first=[...intro,{action:'rate',value:.03},{action:'guess',value:'points'},{action:'step'}];
const repeated=[...first,{action:'step'},{action:'retry'},{action:'rate',value:.6},{action:'guess',value:'parameters'},{action:'step'}];
function inspect(receipt){assert.equal(typeof api.inspectLearningRouteTrials,'function','real receipt trial inspector must exist');return api.inspectLearningRouteTrials(receipt);}

test('retry preserves two real one-step attempts from identical weights at different rates',()=>{
 const receipt=runLearningRoute(repeated,{producer:'browser-session'}),before=JSON.stringify(receipt),trials=inspect(receipt);
 assert.equal(trials.length,2,'a rejected repeated step is not a third trial');
 assert.deepEqual(trials.map(t=>({ordinal:t.ordinal,rate:t.rate,guess:t.guess,lossBefore:t.lossBefore,lossAfter:t.lossAfter,weightsBefore:t.weightsBefore})),[
  {ordinal:1,rate:.03,guess:'points',lossBefore:.665626765614,lossAfter:.661959872896,weightsBefore:[1,-1,0]},
  {ordinal:2,rate:.6,guess:'parameters',lossBefore:.665626765614,lossAfter:.595178642168,weightsBefore:[1,-1,0]},
 ]);
 assert.notDeepEqual(trials[0].weightsAfter,trials[1].weightsAfter);
 assert.ok(trials.every(t=>t.weightsAfter.length===3&&t.weightsAfter.every(Number.isFinite)));
 assert.equal(JSON.stringify(receipt),before,'inspection cannot rewrite the source receipt');
 trials[0].weightsBefore[0]=999;trials[0].weightsAfter[0]=999;
 const again=inspect(receipt);assert.deepEqual(again[0].weightsBefore,[1,-1,0]);assert.notEqual(again[0].weightsAfter[0],999);
});
test('unavailable and no-op actions never invent trials, and an applied reset discards old attempts',()=>{
 assert.deepEqual(inspect(runLearningRoute([{action:'step'},{action:'reset'}])),[]);
 const afterReset=[...repeated,{action:'reset'},...first];
 assert.deepEqual(inspect(runLearningRoute(afterReset)).map(t=>[t.ordinal,t.rate]),[[1,.03]]);
 assert.equal(inspect(runLearningRoute([...first,{action:'retry'}])).length,1,'rewind alone retains the prior result');
});
test('trial inspection rejects forged results and other experiments before returning numerical evidence',()=>{
 const good=runLearningRoute(first),forged=structuredClone(good);forged.result.evidence.gradient.lossAfter=0;
 assert.throws(()=>inspect(forged),/mismatch|differ/i);
 assert.throws(()=>inspect(runLearningTool({experimentId:'pixel-decode',preset:'cat',mode:'slow-replay',actions:[]})),/route|version|experiment/i);
 assert.throws(()=>inspect({...good,extra:true}),/field|receipt/i);
 assert.equal(inspect(good)[0].rate,.03,'agent output is factual reference, not personal progress');
});
