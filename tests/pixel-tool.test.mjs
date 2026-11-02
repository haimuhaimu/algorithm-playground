import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../learning-tool.mjs';

const run=(actions=[],preset='cat',mode='delivery')=>{
 assert.equal(typeof api.runPixelDecode,'function','the real pixel decoder must be callable without a browser');
 return api.runPixelDecode({preset,mode,actions});
};
test('pixel tool reproduces the highlighted three-bit cell of the real slow replay',()=>{
 for(const [n,prefix,count] of [[0,'',35],[1,'0',35],[2,'01',35],[3,'011',36]]){
  const r=run(Array.from({length:n},()=>({action:'read',value:1})),'cat','slow-replay');
  assert.equal(r.experimentId,'pixel-decode');assert.equal(r.engineVersion,'pixel-decode-v1');
  assert.equal(r.initialCursor.sentBits,50);assert.equal(r.initialCursor.skippedPixels,35);
  assert.equal(r.result.evidence.sentBits,50+n);assert.equal(r.result.evidence.prefix,prefix);
  assert.equal(r.result.evidence.decodedCount,count);assert.equal(r.result.evidence.focus.index,35);
  assert.equal(r.result.evidence.pixels[35],n===3?1:null);
  assert.equal(r.result.mastery,'not-assessed');assert.equal(r.result.postalDelivery,'not-performed-by-tool');
  assert.equal(api.replayLearningReceipt(r).matches,true);
 }
});
test('pixel byte costs, tree and padding remain real for each fixed fixture',()=>{
 for(const [preset,tree,end,bits,bytes]of [['cat',15,428,432,54],['noise',15,527,528,66],['blank',3,259,264,33]]){
  const treeOnly=run([{action:'seek',value:tree}],preset);
  assert.equal(treeOnly.result.evidence.decodedCount,0);
  const payload=run([{action:'seek',value:end}],preset);
  assert.equal(payload.result.allPixelsDecoded,true);assert.equal(payload.result.packetComplete,false);
  assert.equal(payload.result.evidence.phase,'padding');
  const r=run([{action:'read',value:528}],preset);
  assert.equal(r.result.evidence.totalBits,bits);assert.equal(r.result.evidence.packetBytes,bytes);
  assert.equal(r.result.evidence.treeBits,tree);assert.equal(r.result.evidence.payloadEnd,end);
  assert.equal(r.result.packetComplete,true);assert.equal(r.result.evidence.decodedEntries.length,256);
 }
 const partial=run([{action:'seek',value:378}]);
 assert.equal(partial.result.evidence.decodedCount,216);assert.equal(partial.result.evidence.pixels[220],null);
});
test('cursor jumps, reads, rejected seeks and no-ops are retained instead of inventing a success history',()=>{
 const r=run([{action:'seek',value:529-1},{action:'reset'},{action:'seek',value:50},{action:'read',value:1},{action:'reset'}]);
 assert.deepEqual(r.steps.map(s=>s[0]),['rejected','no-op','applied','applied','applied']);
 assert.equal(r.result.evidence.sentBits,0);assert.equal(r.result.packetComplete,false);
 assert.equal(r.actions[2].action,'seek');assert.equal(r.actions[3].action,'read');
 assert.equal(api.replayLearningReceipt(r).authenticatesUser,false);
});
test('pixel requests reject arbitrary payloads and unbounded or malformed journals',()=>{
 run();
 for(const input of [null,{preset:'private',actions:[]},{preset:'cat',pixels:[],actions:[]},{preset:'cat',packet:[1],actions:[]},{preset:'cat',url:'https://example.org',actions:[]},
  {preset:'cat',actions:[{action:'read',value:0}]},{preset:'cat',actions:[{action:'seek',value:1.5}]},{preset:'cat',actions:[{action:'seek',value:-1}]},
  {preset:'cat',actions:[{action:'eval',value:'code'}]},{preset:'cat',mode:'user-certified',actions:[]},{preset:'cat',actions:Array.from({length:601},()=>({action:'reset'}))}]){
  assert.throws(()=>api.runPixelDecode(input),/invalid|unsupported|unknown|limit/i);
 }
 assert.throws(()=>api.runPixelDecode({preset:'cat',actions:[]},{producer:'human-certified'}),/producer/i);
});
test('pixel receipts recompute the whole record and reject changed evidence, actions, preset, version and hidden fields',()=>{
 const r=run([{action:'seek',value:378}]);
 for(const mutate of [x=>x.result.evidence.decodedCount=224,x=>x.result.evidence.pixels[220]=2,x=>x.actions[0].value=393,x=>x.input.preset='noise',x=>x.engineVersion='other',x=>x.steps[0][0]='no-op',x=>x.privateDraft='private',x=>x.schemaVersion=2]){
  const changed=structuredClone(r);mutate(changed);assert.throws(()=>api.replayLearningReceipt(changed),/receipt|mismatch|unknown|version/i);
 }
 const clean=structuredClone(r);r.result.evidence.codes[0]='malicious';
 assert.equal(api.replayLearningReceipt(clean).matches,true);assert.deepEqual(run([{action:'seek',value:378}]),clean);
});
test('maximum supported pixel journals remain replayable within the existing 64 KiB interchange budget',()=>{
 for(const [preset,actions]of [['noise',Array.from({length:600},()=>({action:'read',value:1}))],['cat',Array.from({length:600},()=>({action:'seek',value:528}))]]){
  const r=run(actions,preset);assert.ok(Buffer.byteLength(JSON.stringify(r))<65536,'supported records cannot exceed CLI replay input');
  assert.equal(api.replayLearningReceipt(r).matches,true);
 }
});
test('generic tool dispatch preserves legacy route input/output while exposing pixel decoding explicitly',()=>{
 run();assert.equal(typeof api.runLearningTool,'function');
 assert.deepEqual(api.runLearningTool({actions:[{action:'train'}]}),api.runLearningRoute([{action:'train'}]));
 const r=api.runLearningTool({experimentId:'pixel-decode',preset:'cat',mode:'slow-replay',actions:[{action:'read',value:1}]});
 assert.equal(r.result.evidence.sentBits,51);
 const catalog=api.listLearningTools();assert.ok(catalog.runnables.some(x=>x.id==='pixel-decode'));
 assert.equal(api.describeLearningTool('pixel-decode').engineVersion,'pixel-decode-v1');
 assert.equal(api.describeLearningTool('pixel').execution,'browser-only');
 assert.throws(()=>api.runLearningTool({experimentId:'pixel-decode',preset:'cat',actions:[],state:{}}),/unknown|invalid/i);
});
