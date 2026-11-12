import test from 'node:test';
import assert from 'node:assert/strict';
import {describeLearningTool,listLearningTools,replayLearningReceipt,runLearningTool} from '../../dist/learning-tool.mjs';
import {createGenaiReturnUrl,readGenaiHandoffContext} from '../../dist/genai-handoff.mjs';

const id='agent-reroute';
const actions=(...names)=>names.map(action=>({action}));
const run=(...names)=>runLearningTool({experimentId:id,actions:actions(...names)},{producer:'browser-session'});
const incoming=(decision='reroute')=>['advance','advance',decision,'advance'];

test('level two has its own versioned entry, beside level one',()=>{
 assert.equal(describeLearningTool(id).engineVersion,'agent-reroute-v1');
 assert.match(describeLearningTool(id).url,/agent-reroute\.html#mission$/);
 const ids=listLearningTools().runnables.map(x=>x.id);
 assert.ok(ids.includes('agent-tool-loop')&&ids.includes(id));
});

test('partial subtitles cannot change the goal or start a second job',()=>{
 const partial=run('advance');
 assert.equal(partial.result.stage,'partial');
 assert.equal(partial.result.evidence.activeTarget,'07');
 assert.deepEqual(partial.result.availableActions,actions('advance'));
 assert.throws(()=>run('advance','reroute'));
 const confirmed=run('advance','advance');
 assert.equal(confirmed.result.evidence.activeTarget,'08');
 assert.equal(confirmed.result.evidence.dispatched08,false);
 assert.deepEqual(confirmed.result.availableActions,actions('reroute','keep-old'));
});

test('after re-dispatch the late 07 receipt stays attached to the old order',()=>{
 const dispatched=run('advance','advance','reroute');
 assert.equal(dispatched.result.evidence.newReceipt,null);
 assert.equal(dispatched.result.evidence.oldReceipt,null);
 const late=run(...incoming());
 assert.deepEqual(late.result.evidence.oldReceipt,{orderId:'SUP-07',station:'07'});
 assert.equal(late.result.evidence.activeTarget,'08');
 assert.equal(late.result.evidence.newReceipt,null);
 assert.equal(late.result.workflowComplete,false);
 assert.equal(late.steps.at(-1).event,'old-receipt');
});

test('accepting the old receipt is recorded as a wrong conclusion, not 08 delivery',()=>{
 const wrong=run(...incoming(),'accept-old');
 assert.equal(wrong.result.workflowComplete,true);
 assert.equal(wrong.result.evidence.outcome,'misattributed');
 assert.equal(wrong.result.evidence.newReceipt,null);
 assert.equal(wrong.steps.at(-1).event,'old-receipt-misattributed');
 assert.equal(replayLearningReceipt(wrong).matches,true);
});

test('verification uses the matching 08 order and preserves the late 07 receipt',()=>{
 const good=run(...incoming(),'verify-new');
 assert.equal(good.result.evidence.outcome,'verified');
 assert.deepEqual(good.result.evidence.newReceipt,{orderId:'SUP-08',station:'08'});
 assert.deepEqual(good.result.evidence.oldReceipt,{orderId:'SUP-07',station:'07'});
 assert.equal(good.steps.at(-1).event,'new-receipt-verified');
 assert.deepEqual(replayLearningReceipt(good),{matches:true,authenticatesUser:false,receipt:good});
});

test('keeping the old job cannot confirm 08; the player may stop or correct the plan',()=>{
 const stayed=run(...incoming('keep-old'));
 assert.equal(stayed.result.evidence.activeTarget,'08');
 assert.equal(stayed.result.evidence.dispatched08,false);
 assert.throws(()=>run(...incoming('keep-old'),'verify-new'));
 const stop=run(...incoming('keep-old'),'stop');
 assert.equal(stop.result.evidence.outcome,'unverified');
 assert.equal(stop.result.evidence.newReceipt,null);
 const correct=run(...incoming('keep-old'),'reroute','verify-new');
 assert.equal(correct.result.evidence.outcome,'verified');
});

test('replay detects altered order IDs, outcome and event sequence',()=>{
 const good=run(...incoming(),'verify-new');
 for(const edit of [
  r=>{r.result.evidence.oldReceipt.orderId='SUP-08';},
  r=>{r.result.evidence.activeTarget='07';},
  r=>{r.result.evidence.outcome='misattributed';},
  r=>{r.steps[3].event='new-receipt-verified';},
  r=>{r.engineVersion='agent-reroute-v0';},
  r=>{r.fixture.extra='anything';},
 ]){
  const forged=structuredClone(good);edit(forged);
  assert.throws(()=>replayLearningReceipt(forged));
 }
});

test('invalid or extra actions cannot bypass the mission timeline',()=>{
 assert.throws(()=>run(...incoming(),'verify-new','advance'));
 assert.throws(()=>run(...Array(9).fill('advance')));
 assert.throws(()=>runLearningTool({experimentId:id,actions:[{action:'advance',station:'08'}]}));
 assert.throws(()=>runLearningTool({experimentId:id,actions:[{action:'advance'}],url:'https://example.com'}));
});

test('level 2 handoff preserves the exact journal and cannot impersonate level 1',()=>{
 const source=new URL('http://127.0.0.1:3141/agent-reroute.html');
 source.search=new URLSearchParams({genaiReturn:'http://localhost:3140/?page=wrong#old',genaiRequest:'reroute-test-request-123',genaiJourney:id}).toString();
 const context=readGenaiHandoffContext(source.href);
 assert.deepEqual(context,{journeyId:id,requestId:'reroute-test-request-123',returnURL:'http://localhost:3140/?page=routes&section=agent-reroute-journey'});
 assert.throws(()=>createGenaiReturnUrl(context,run(...incoming()),source));
 const r=run(...incoming(),'accept-old');
 const url=new URL(createGenaiReturnUrl(context,r,source));
 assert.equal(url.search,'?page=routes&section=agent-reroute-journey');
 const data=JSON.parse(Buffer.from(url.hash.slice('#playground='.length),'base64url').toString('utf8'));
 assert.equal(data.journeyId,id);assert.equal(data.requestId,context.requestId);
 assert.deepEqual(data.receipt,r);
 const first=runLearningTool({experimentId:'agent-tool-loop',actions:actions('stop','restart','stop')},{producer:'browser-session'});
 assert.throws(()=>createGenaiReturnUrl(context,first,source));
 const firstContext={...context,journeyId:'agent-learning',returnURL:'http://localhost:3140/?page=routes&section=agent-journey'};
 assert.throws(()=>createGenaiReturnUrl(firstContext,r,source));
});
