import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cli=new URL('../scripts/learning-tool.mjs',import.meta.url);
function call(command,input='',extra=[]){
 const r=spawnSync(process.execPath,[cli.pathname,command,...extra],{input,encoding:'utf8',timeout:5000,maxBuffer:200000});
 assert.equal(r.error,undefined);assert.ok(r.stdout.trim(),'the CLI must emit a structured JSON response');return {...r,json:JSON.parse(r.stdout)};
}
test('CLI discovers and replays the second Agent mission without rewriting a wrong choice',()=>{
 const describe=call('describe','',['agent-reroute']);
 assert.equal(describe.status,0,describe.json.error);
 assert.equal(describe.json.data.engineVersion,'agent-reroute-v1');
 const run=call('run',JSON.stringify({experimentId:'agent-reroute',actions:['advance','advance','reroute','advance','accept-old'].map(action=>({action}))}));
 assert.equal(run.status,0,run.json.error);
 assert.equal(run.json.data.result.evidence.outcome,'misattributed');
 assert.equal(run.json.data.result.evidence.newReceipt,null);
 const replay=call('replay',JSON.stringify(run.json.data));
 assert.equal(replay.status,0,replay.json.error);
 assert.equal(replay.json.data.authenticatesUser,false);
 assert.deepEqual(replay.json.data.receipt,run.json.data);
});
test('a fresh external process can discover, describe and actually run the same core without a browser',()=>{
 const list=call('list');assert.equal(list.status,0);assert.equal(list.json.data.experiments.length,10);
 const detail=call('describe','',['learning-route']);assert.equal(detail.status,0);assert.equal(detail.json.data.fixture.trainingExamples,6);
 const run=call('run',JSON.stringify({actions:[{action:'train'}]}));assert.equal(run.status,0);assert.equal(run.json.data.result.evidence.guide.steps,120);
 assert.equal(run.json.data.producer,'agent');assert.equal(run.json.data.result.workflowComplete,false);
 const replay=call('replay',JSON.stringify(run.json.data));assert.equal(replay.status,0);assert.equal(replay.json.data.matches,true);assert.equal(replay.json.data.authenticatesUser,false);
});
test('CLI malformed, excessive, unsupported and unexpected inputs fail in structured form',()=>{
 for(const [command,input,extra]of [
  ['run','not-json',[]],['run',JSON.stringify({actions:[],state:{}}),[]],['execute','',[]],
  ['run',JSON.stringify({actions:[{action:'train',url:'https://example.org'}]}),[]],['run',' '.repeat(65537)+'{}',[]],['run','{}',['/etc/passwd']]
 ]){const r=call(command,input,extra);assert.equal(r.status,1);assert.equal(r.json.ok,false);assert.ok(r.json.error);assert.equal(r.stderr,'');}
});
test('CLI replay never trusts an edited score',()=>{
 const run=call('run',JSON.stringify({actions:[{action:'train'}]}));run.json.data.result.evidence.guide.steps=999;
 const replay=call('replay',JSON.stringify(run.json.data));assert.equal(replay.status,1);assert.match(replay.json.error,/mismatch/i);
});
test('CLI runs the same Agent mission without assigning personal practice',()=>{
 const run=call('run',JSON.stringify({experimentId:'agent-tool-loop',actions:['stop','restart','retry','check'].map(action=>({action}))}));
 assert.equal(run.status,0);
 const receipt=run.json.data;
 assert.equal(receipt.producer,'agent');assert.equal(receipt.result.workflowComplete,true);
 assert.deepEqual(receipt.result.evidence.trials.map(t=>t.outcome),['stopped','verified']);
 const replay=call('replay',JSON.stringify(receipt));
 assert.equal(replay.status,0);assert.equal(replay.json.data.authenticatesUser,false);
});
test('CLI discovery exposes a pixel decoder without removing the existing learning route',()=>{
 const list=call('list');assert.equal(list.status,0);assert.equal(list.json.data.experiments.length,10);
 assert.ok(list.json.data.runnables.some(tool=>tool.id==='learning-route'));
 assert.ok(list.json.data.runnables.some(tool=>tool.id==='pixel-decode'));
 const detail=call('describe','',['pixel-decode']);assert.equal(detail.status,0);
 assert.equal(detail.json.data.engineVersion,'pixel-decode-v1');
});
test('CLI slow replay reads the real next cat pixel only after all three code bits arrive',()=>{
 for(const [count,sentBits,decodedCount,prefix] of [[1,51,35,'0'],[2,52,35,'01'],[3,53,36,'011']]){
  const run=call('run',JSON.stringify({experimentId:'pixel-decode',preset:'cat',mode:'slow-replay',actions:Array.from({length:count},()=>({action:'read',value:1}))}));
  assert.equal(run.status,0,run.json.error);const receipt=run.json.data,evidence=receipt.result.evidence;
  assert.equal(receipt.experimentId,'pixel-decode');assert.equal(receipt.engineVersion,'pixel-decode-v1');
  assert.equal(receipt.numericFormat,'integer-bits');assert.equal(receipt.producer,'agent');
  assert.equal(evidence.sentBits,sentBits);assert.equal(evidence.decodedCount,decodedCount);assert.equal(evidence.prefix,prefix);
  assert.equal(evidence.pixels[35],count===3?1:null);assert.equal(receipt.result.packetComplete,false);
  assert.equal(receipt.result.mastery,'not-assessed');
  const replay=call('replay',JSON.stringify(receipt));assert.equal(replay.status,0,replay.json.error);
  assert.equal(replay.json.data.matches,true);assert.equal(replay.json.data.authenticatesUser,false);
 }
});
test('CLI accepts only the four fixed postcards and completes their actual packets',()=>{
 for(const preset of ['cat','heart','noise','blank']){
  const run=call('run',JSON.stringify({experimentId:'pixel-decode',preset,actions:[{action:'read',value:528}]}));
  assert.equal(run.status,0,run.json.error);const receipt=run.json.data,evidence=receipt.result.evidence;
  assert.equal(evidence.decodedCount,256);assert.equal(evidence.pixels.length,256);
  assert.equal(receipt.result.packetComplete,true);assert.equal(receipt.result.allPixelsDecoded,true);
  assert.equal(evidence.sentBits,evidence.totalBits);assert.equal(evidence.phase,'complete');
  if(preset==='noise')assert.equal(evidence.packetBytes,66,'the uniform-frequency picture is larger than the 64-byte raw image');
  if(preset==='blank'){assert.equal(evidence.treeBits,3);assert.equal(evidence.totalBits,264);}
 }
});
test('CLI preserves the distinction between all decoded pixels and a complete padded packet',()=>{
 const run=call('run',JSON.stringify({experimentId:'pixel-decode',preset:'cat',actions:[{action:'seek',value:428}]}));
 assert.equal(run.status,0,run.json.error);const receipt=run.json.data,evidence=receipt.result.evidence;
 assert.equal(evidence.treeBits,15);assert.equal(evidence.payloadEnd,428);assert.equal(evidence.totalBits,432);
 assert.equal(evidence.paddingBits,4);assert.equal(evidence.decodedCount,256);assert.equal(evidence.phase,'padding');
 assert.equal(receipt.result.allPixelsDecoded,true);assert.equal(receipt.result.packetComplete,false);
});
test('CLI pixel requests reject unknown selectors, executable payloads and invalid cursor actions',()=>{
 const valid={experimentId:'pixel-decode',preset:'cat',actions:[]};
 const invalid=[
  {...valid,preset:'custom'},{...valid,mode:'remote'},{...valid,pixels:Array(256).fill(0)},
  {...valid,packet:[128]},{...valid,url:'https://example.org'},{...valid,producer:'browser-session'},
  {...valid,actions:[{action:'read',value:0}]},{...valid,actions:[{action:'read',value:529}]},
  {...valid,actions:[{action:'read',value:'1'}]},{...valid,actions:[{action:'read',value:1.5}]},
  {...valid,actions:[{action:'seek',value:-1}]},{...valid,actions:[{action:'seek',value:529}]},
  {...valid,actions:[{action:'seek',value:null}]},{...valid,actions:[{action:'reset',value:0}]},
  {...valid,actions:[{action:'eval',value:'process.exit()'}]},{...valid,actions:[{action:'read',value:1,state:{}}]},
  {...valid,actions:Array.from({length:601},()=>({action:'read',value:1}))}
 ];
 for(const request of invalid){const response=call('run',JSON.stringify(request));assert.equal(response.status,1);assert.equal(response.json.ok,false);assert.ok(response.json.error);assert.equal(response.stderr,'');}
});
test('CLI replays a maximum-length compact pixel receipt within its unchanged 64 KiB input limit',()=>{
 const run=call('run',JSON.stringify({experimentId:'pixel-decode',preset:'noise',actions:Array.from({length:600},()=>({action:'read',value:1}))}));
 assert.equal(run.status,0,run.json.error);const receipt=run.json.data;
 assert.equal(receipt.steps.length,600);assert.ok(receipt.steps.every(step=>Array.isArray(step)&&step.length>=3&&step.length<=4));
 assert.ok(receipt.stepFormat,'compact step tuples must have an explicit schema');
 const input=JSON.stringify(receipt);assert.ok(Buffer.byteLength(input)<=65536,'an accepted run must fit back through replay');
 const replay=call('replay',input);assert.equal(replay.status,0,replay.json.error);assert.equal(replay.json.data.matches,true);
});
test('CLI pixel replay detects edited playhead, visible pixels, action history and step status',()=>{
 const run=call('run',JSON.stringify({experimentId:'pixel-decode',preset:'cat',mode:'slow-replay',actions:[{action:'read',value:1}]}));
 assert.equal(run.status,0,run.json.error);
 for(const mutate of [receipt=>receipt.result.evidence.sentBits=52,receipt=>receipt.result.evidence.pixels[35]=1,receipt=>receipt.actions[0].value=2,receipt=>receipt.steps[0][0]='rejected',receipt=>receipt.engineVersion='pixel-decode-v2',receipt=>receipt.privateDraft='not allowed']){
  const changed=structuredClone(run.json.data);mutate(changed);const replay=call('replay',JSON.stringify(changed));
  assert.equal(replay.status,1);assert.equal(replay.json.ok,false);assert.ok(replay.json.error);
 }
});
