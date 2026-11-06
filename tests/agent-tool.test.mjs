import test from 'node:test';
import assert from 'node:assert/strict';
import {describeLearningTool,listLearningTools,replayLearningReceipt,runLearningTool} from '../learning-tool.mjs';
import {createGenaiReturnUrl,readGenaiHandoffContext} from '../genai-handoff.mjs';

const id='agent-tool-loop';
const run=(actions=[],producer='browser-session')=>runLearningTool({experimentId:id,actions:actions.map(action=>({action}))},{producer});
const trials=r=>r.result.evidence.trials;
const contextURL=(target='http://127.0.0.1:3130/')=>{
 const url=new URL('http://127.0.0.1:3131/agent-mission.html');
 url.search=new URLSearchParams({genaiReturn:target,genaiRequest:'agent-test-request-1234',genaiJourney:'agent-learning'}).toString();
 return url.href;
};

test('Agent mission is discoverable, without displacing the original tools',()=>{
 const catalog=listLearningTools();
 assert.deepEqual(catalog.runnables.map(tool=>tool.id),['learning-route','pixel-decode','bayes-update','agent-tool-loop','agent-reroute','agent-frames']);
 assert.equal(catalog.experiments.length,10);
 assert.match(describeLearningTool(id).url,/agent-mission\.html#mission$/);
});
test('acceptance is not delivery; stopping does not consume a tool call or claim success',()=>{
 const initial=run();
 assert.equal(initial.fixture.initialToolStatus,'accepted');
 assert.equal(trials(initial)[0].receipt,'unknown');
 assert.deepEqual(initial.result.availableActions.map(x=>x.action),['check','retry','stop']);
 const stopped=run(['stop']);
 assert.deepEqual(trials(stopped),[{number:1,outcome:'stopped',toolCalls:0,receipt:'unknown',backupDispatched:false}]);
 assert.deepEqual(stopped.result.availableActions,[{action:'restart'}]);
 assert.equal(stopped.result.workflowComplete,false);
});
test('same start retains the first run; only check after retry verifies delivery',()=>{
 const replay=run(['stop','restart','check','retry']);
 assert.equal(trials(replay)[1].receipt,'not-delivered');
 assert.equal(trials(replay)[1].outcome,'in-progress');
 assert.equal(replay.steps[1].remaining,3);
 assert.equal(replay.steps[3].observation,'retry-accepted');
 const receipt=run(['stop','restart','check','retry','check']);
 assert.deepEqual(trials(receipt),[
  {number:1,outcome:'stopped',toolCalls:0,receipt:'unknown',backupDispatched:false},
  {number:2,outcome:'verified',toolCalls:3,receipt:'delivered',backupDispatched:true},
 ]);
 assert.equal(receipt.steps[4].observation,'signed');
 assert.equal(receipt.result.workflowComplete,true);
 assert.deepEqual(replayLearningReceipt(receipt),{matches:true,authenticatesUser:false,receipt});
});
test('checking a stalled primary route exhausts budget, never invents a signature',()=>{
 const receipt=run(['check','check','check']);
 assert.equal(trials(receipt)[0].outcome,'budget-exhausted');
 assert.equal(trials(receipt)[0].receipt,'not-delivered');
 assert.deepEqual(receipt.result.availableActions,[{action:'restart'}]);
});
test('a retry accepted with the last call cannot become verified delivery',()=>{
 const receipt=run(['check','check','retry']);
 assert.equal(receipt.steps.at(-1).observation,'retry-accepted');
 assert.equal(trials(receipt)[0].backupDispatched,true);
 assert.equal(trials(receipt)[0].outcome,'budget-exhausted');
 assert.notEqual(trials(receipt)[0].receipt,'delivered');
});
test('running both rounds with the same choices is allowed and yields the same evidence',()=>{
 const [first,second]=trials(run(['retry','check','restart','retry','check']));
 assert.deepEqual(second,{...first,number:2});
});
test('actions cannot add unbounded calls, bypass phases or inject tool payloads',()=>{
 for(const actions of [['restart'],['retry','retry'],['stop','check'],['stop','restart','stop','restart'],Array(10).fill('check')]) assert.throws(()=>run(actions));
 assert.throws(()=>runLearningTool({experimentId:id,actions:[{action:'check',url:'https://example.com/'}]}));
 assert.throws(()=>run([], 'human'));
});
test('replay rejects forged world state, extra fields and incompatible versions',()=>{
 const receipt=run(['stop','restart','retry','check']);
 for(const mutate of [
  r=>{r.result.evidence.trials[0].outcome='verified';},
  r=>{r.steps[2].observation='signed';},
  r=>{r.fixture.toolBudget=900;},
  r=>{r.extra='not in the contract';},
  r=>{r.engineVersion='agent-tool-loop-v0';},
 ]){
  const forged=structuredClone(receipt);mutate(forged);
  assert.throws(()=>replayLearningReceipt(forged));
 }
});
test('Agent return keeps route and request binding, rejects unfinished or mismatched runs',()=>{
 const source=contextURL('http://127.0.0.1:3130/?page=bad#old'),context=readGenaiHandoffContext(source);
 assert.deepEqual(context,{journeyId:'agent-learning',requestId:'agent-test-request-1234',returnURL:'http://127.0.0.1:3130/?page=routes&section=agent-journey'});
 assert.equal(readGenaiHandoffContext(contextURL('https://example.com/')),null);
 assert.throws(()=>createGenaiReturnUrl(context,run(['stop']),source));
 assert.throws(()=>createGenaiReturnUrl(context,runLearningTool({experimentId:'learning-route',actions:[]}),source));
 const receipt=run(['stop','restart','retry','check']);
 const back=new URL(createGenaiReturnUrl(context,receipt,source));
 const encoded=back.hash.split('=')[1];
 assert.deepEqual(JSON.parse(Buffer.from(encoded,'base64url').toString('utf8')),{format:'genai-learning-os/playground-handoff',schemaVersion:1,journeyId:'agent-learning',requestId:context.requestId,receipt});
});
