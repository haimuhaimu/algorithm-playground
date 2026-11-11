import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgentToolLoop} from '../agent-tool.mjs';
import {runAgentReroute} from '../agent-reroute-tool.mjs';

// The store is loaded inside the assertion so the initial TDD run reports
// the absent capability as an assertion failure rather than a loader crash.
let createAgentResultStore;
test.before(async()=>{
 await assert.doesNotReject(async()=>{
  ({createAgentResultStore}=await import('../agent-last-result.mjs'));
 },'the completed-result storage module must be available');
});

const l1='agent-tool-loop',l2='agent-reroute';
const run1=(names=['stop','restart','stop'],producer='browser-session')=>runAgentToolLoop(names.map(action=>({action})),{producer});
const run2=(names=['advance','advance','reroute','advance','verify-new'],producer='browser-session')=>runAgentReroute(names.map(action=>({action})),{producer});
const clone=structuredClone;
function storageFixture(entries=[]){
 const data=new Map(entries),calls=[];
 const storage={
  getItem(key){calls.push(['get',key]);return data.get(key)??null;},
  setItem(key,value){calls.push(['set',key]);data.set(key,String(value));},
  removeItem(key){calls.push(['remove',key]);data.delete(key);},
  clear(){calls.push(['clear']);data.clear();},
  key(index){calls.push(['key',index]);return [...data.keys()][index]??null;},
  get length(){calls.push(['length']);return data.size;},
 };
 return {window:{localStorage:storage},storage,data,calls};
}
function seeded(id=l1,receipt=run1()){
 const f=storageFixture(),store=createAgentResultStore(f.window,id);
 assert.deepEqual(store.save(receipt),{status:'saved'});
 const key=[...f.data.keys()][0];
 return {...f,store,key,raw:f.data.get(key)};
}

test('an untouched experiment has no saved result and creates no record',()=>{
 const f=storageFixture(),store=createAgentResultStore(f.window,l1);
 assert.deepEqual(store.read(),{status:'empty'});
 assert.equal(f.data.size,0);
 assert.equal(f.calls.some(([action])=>action!=='get'),false);
});

const endings=[
 ['stopped',['stop']],
 ['budget-exhausted',['check','check','check']],
 ['verified',['retry','check']],
];
for(const [first,a] of endings)for(const [second,b] of endings){
 test(`level 1 persists a complete ${first} / ${second} result across a new store`,()=>{
  const f=storageFixture(),receipt=run1([...a,'restart',...b]);
  assert.deepEqual(createAgentResultStore(f.window,l1).save(receipt),{status:'saved'});
  const restored=createAgentResultStore(f.window,l1).read();
  assert.equal(restored.status,'saved');
  assert.deepEqual(restored.receipt,receipt);
  assert.notEqual(restored.receipt,receipt);
  assert.deepEqual(restored.receipt.result.evidence.trials.map(trial=>trial.outcome),[first,second]);
  assert.deepEqual(JSON.parse([...f.data.values()][0]),{version:1,receipt});
 });
}

for(const [name,names,outcome] of [
 ['misattributed',['advance','advance','reroute','advance','accept-old'],'misattributed'],
 ['verified',['advance','advance','reroute','advance','verify-new'],'verified'],
 ['stopped',['advance','advance','reroute','advance','stop'],'unverified'],
 ['kept old then stopped',['advance','advance','keep-old','advance','stop'],'unverified'],
 ['corrected later',['advance','advance','keep-old','advance','reroute','verify-new'],'verified'],
])test(`level 2 persists ${name} without upgrading its evidence`,()=>{
 const f=storageFixture(),receipt=run2(names);
 assert.deepEqual(createAgentResultStore(f.window,l2).save(receipt),{status:'saved'});
 const restored=createAgentResultStore(f.window,l2).read();
 assert.equal(restored.status,'saved');
 assert.deepEqual(restored.receipt,receipt);
 assert.equal(restored.receipt.result.evidence.outcome,outcome);
});

test('experiments use independent versioned keys and leave existing progress and drafts untouched',()=>{
 const existing=[['algorithm-playground:progress:v1','progress sentinel'],['algorithm-playground:neural:v1','neural sentinel'],['algorithm-playground:pixel:v1','pixel sentinel']];
 const f=storageFixture(existing),one=createAgentResultStore(f.window,l1),two=createAgentResultStore(f.window,l2);
 assert.deepEqual(one.save(run1()),{status:'saved'});
 assert.deepEqual(two.read(),{status:'empty'});
 assert.deepEqual(two.save(run2()),{status:'saved'});
 assert.equal(one.read().receipt.experimentId,l1);
 assert.equal(two.read().receipt.experimentId,l2);
 const keys=[...f.data.keys()].filter(key=>!existing.some(([other])=>key===other));
 assert.equal(keys.length,2);
 assert.ok(keys.every(key=>key.includes('last-result')&&key.includes('v1')));
 assert.ok(keys.some(key=>key.includes(l1))&&keys.some(key=>key.includes(l2)));
 assert.ok(f.calls.every(([operation,key])=>['get','set'].includes(operation)&&keys.includes(key)));
 for(const [key,value] of existing)assert.equal(f.data.get(key),value);
});

test('incomplete, agent-produced, mismatched and tampered saves preserve the previous result',()=>{
 const f=seeded(),before=f.calls.length;
 const bad=[run1(['stop']),run1(undefined,'agent'),run2(),null,{},[]];
 for(const edit of [
  r=>{r.result.evidence.trials[0].outcome='verified';},
  r=>{r.result.workflowComplete=false;},
  r=>{r.steps[0].observation='signed';},
  r=>{r.fixture.toolBudget=4;},
  r=>{r.engineVersion='agent-tool-loop-v0';},
  r=>{r.returnURL='https://example.com/private';},
  r=>{r.genaiRequest='private-request';},
  r=>{r.extra='x'.repeat(32769);},
  r=>{r.actions.extra='must not be silently dropped';},
  r=>{Object.defineProperty(r.actions[0],'action',{get(){return 'stop';},enumerable:true});},
  r=>{Object.defineProperty(r,'hidden',{value:'must not be silently dropped'});},
 ]){const receipt=run1();edit(receipt);bad.push(receipt);}
 for(const receipt of bad)assert.deepEqual(f.store.save(receipt),{status:'invalid'});
 assert.equal(f.data.get(f.key),f.raw);
 assert.equal(f.calls.slice(before).some(([operation])=>operation!=='get'),false);
 assert.deepEqual(f.store.read().receipt,run1());
});

test('reroute rejects unfinished, forged and agent-produced saves without replacing the last result',()=>{
 const f=seeded(l2,run2());
 const forged=run2();forged.result.evidence.oldReceipt.orderId='SUP-08';
 for(const receipt of [run2(['advance']),run2(undefined,'agent'),run1(),forged]){
  assert.deepEqual(f.store.save(receipt),{status:'invalid'});
  assert.equal(f.data.get(f.key),f.raw);
 }
});

test('malformed, oversized and wrong-version envelopes are invalid and remain untouched',()=>{
 const f=seeded();
 for(const raw of ['','{','null','[]','{}',JSON.stringify({version:2,receipt:run1()}),JSON.stringify({version:1,receipt:run1(),returnURL:'private'}),' '.repeat(32769)]){
  f.data.set(f.key,raw);
  const before=f.calls.length;
  assert.deepEqual(f.store.read(),{status:'invalid'});
  assert.equal(f.data.get(f.key),raw);
  assert.deepEqual(f.calls.slice(before),[['get',f.key]]);
 }
});

test('the raw size bound is enforced even when an oversized envelope contains a valid receipt',()=>{
 const f=seeded();
 const atLimit=f.raw.padEnd(32768,' ');
 f.data.set(f.key,atLimit);
 assert.equal(f.store.read().status,'saved');
 f.data.set(f.key,atLimit+' ');
 assert.deepEqual(f.store.read(),{status:'invalid'});
});

test('stored tampering, experiment mismatches, incomplete records and agent receipts are not repaired',()=>{
 for(const id of [l1,l2]){
  const good=id===l1?run1():run2(),f=seeded(id,good);
  const changed=clone(good);changed.result.mastery='mastered';
  const candidates=[changed,id===l1?run2():run1(),id===l1?run1(['stop']):run2(['advance']),id===l1?run1(undefined,'agent'):run2(undefined,'agent')];
  for(const receipt of candidates){
   const raw=JSON.stringify({version:1,receipt});f.data.set(f.key,raw);
   assert.deepEqual(f.store.read(),{status:'invalid'});
   assert.equal(f.data.get(f.key),raw);
  }
 }
});

test('unsupported experiment IDs do not inspect or mutate storage',()=>{
 const f=storageFixture();
 for(const id of ['agent-learning','agent-frames','__proto__',null,{},undefined]){
  const store=createAgentResultStore(f.window,id);
  assert.deepEqual(store.read(),{status:'invalid'});
  assert.deepEqual(store.save(run1()),{status:'invalid'});
 }
 assert.deepEqual(f.calls,[]);
});

test('blocked localStorage getters, missing storage and throwing reads degrade to unavailable',()=>{
 const blocked={get localStorage(){throw new Error('blocked');}};
 for(const window of [blocked,{},null,undefined]){
  const store=createAgentResultStore(window,l1);
  assert.deepEqual(store.read(),{status:'unavailable'});
  assert.deepEqual(store.save(run1()),{status:'unavailable'});
 }
 const f=storageFixture();
 f.storage.getItem=()=>{throw new Error('read blocked');};
 assert.deepEqual(createAgentResultStore(f.window,l1).read(),{status:'unavailable'});
});

test('quota failures preserve the previous record and report unavailable',()=>{
 const f=seeded();
 f.storage.setItem=()=>{throw new Error('QuotaExceededError');};
 assert.deepEqual(f.store.save(run1(['retry','check','restart','retry','check'])),{status:'unavailable'});
 assert.equal(f.data.get(f.key),f.raw);
 assert.equal(f.store.read().status,'saved');
});

test('a silently discarded write is not reported as saved',()=>{
 const f=storageFixture();
 f.storage.setItem=()=>{};
 assert.deepEqual(createAgentResultStore(f.window,l1).save(run1()),{status:'unavailable'});
});

test('saved data is an independent snapshot, not a mutable receipt reference',()=>{
 const f=storageFixture(),store=createAgentResultStore(f.window,l1),receipt=run1();
 assert.deepEqual(store.save(receipt),{status:'saved'});
 receipt.result.evidence.trials[0].outcome='verified';
 const read=store.read();read.receipt.result.evidence.trials[1].outcome='verified';
 assert.deepEqual(store.read().receipt.result.evidence.trials.map(trial=>trial.outcome),['stopped','stopped']);
});
