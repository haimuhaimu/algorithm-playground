import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as api from '../learning-tool.mjs';
import {preset} from '../pixel-core.mjs';
import {pixelPresetForSnapshot} from '../pixel-tool.mjs';

const run=(actions=[],preset='cat',mode='delivery')=>{
 assert.equal(typeof api.runPixelDecode,'function','the real pixel decoder must be callable without a browser');
 return api.runPixelDecode({preset,mode,actions});
};
test('discovery separates the six editor presets from the two legacy cats',()=>{
 const detail=api.describeLearningTool('pixel-decode');
 assert.deepEqual(detail.presetGroups,{editor:['heim','bobby','chouchou-studio','heart','noise','blank'],legacy:['chouchou','cat']});
 assert.deepEqual(new Set(detail.input.preset),new Set(['heim','bobby','chouchou-studio','heart','noise','blank','chouchou','cat']));
});
test('Heim and Bobby are distinct fixed postcards with replayable receipts',()=>{
 const snapshots=[];
 for(const name of ['heim','bobby']){
  const receipt=run([{action:'read',value:528}],name),pixels=preset(name);
  assert.deepEqual(receipt.fixture,{id:'pixel-'+name+'-v1',preset:name,pixelCount:256,protocol:'four-color-huffman-v1'});
  assert.equal(receipt.result.packetComplete,true);
  assert.deepEqual(receipt.result.evidence.pixels,pixels);
  assert.equal(pixelPresetForSnapshot(pixels),name);
  const edited=[...pixels];edited[0]=(edited[0]+1)%4;
  assert.equal(pixelPresetForSnapshot(edited),null);
  assert.deepEqual(api.replayLearningReceipt(receipt),{matches:true,authenticatesUser:false,receipt});
  snapshots.push(pixels);
 }
 assert.notDeepEqual(...snapshots);
});
test('the legacy Chouchou postcard is still recognized without reusing the old cat',()=>{
 const receipt=run([{action:'read',value:528}],'chouchou');
 const chouchou=preset('chouchou'),old=preset('cat');
 assert.deepEqual(receipt.fixture,{id:'pixel-chouchou-v1',preset:'chouchou',pixelCount:256,protocol:'four-color-huffman-v1'});
 assert.equal(receipt.engineVersion,'pixel-decode-v1');
 assert.equal(receipt.result.packetComplete,true);
 assert.deepEqual(receipt.result.evidence.pixels,chouchou);
 assert.notDeepEqual(chouchou,old);
 assert.equal(pixelPresetForSnapshot(chouchou),'chouchou');
 assert.equal(pixelPresetForSnapshot(old),'cat');
 const edited=[...chouchou];edited[0]=(edited[0]+1)%4;
 assert.equal(pixelPresetForSnapshot(edited),null);
 assert.deepEqual(api.replayLearningReceipt(receipt),{matches:true,authenticatesUser:false,receipt});
});
test('a frozen receipt for each previous preset keeps its exact wire bytes',()=>{
 // Capture these from the preceding implementations, before changing the fixture catalog.
 const hashes={
  heim:'ec252c9899e1a831935fb900c6b99563a81db66e3b07b5521d273ad13b93a75e',
  bobby:'d51ec64f5aa93f05b6334f39f81345dd32e3f82062ef9efb71cd308057a7cbcb',
  chouchou:'379078663ec4ac09654e0560ff0bf394bfdc4f624c491ac812ab8ab0a520df9f',
  cat:'3980fa80dd350e328222f7e71e0746e188b45e05622ab7d76f75002f78ec850d',
  heart:'11818471e2e12f8c7518a629aac43ab6c9b60b7d54e57cdee02974c5f2452a4e',
  noise:'838f11665bf82c645326384253893ee230d734edd918742b4062356e2fee784e',
  blank:'17669843e70c2799e06b6318313bf7c2c325ccf15c9d58353e6a57143fe55984'
 };
 const actions=[{action:'read',value:1},{action:'seek',value:528},{action:'read',value:528}];
 for(const [preset,expected] of Object.entries(hashes)){
  const receipt=api.runPixelDecode({preset,mode:'slow-replay',actions},{producer:'browser-session'});
  assert.equal(createHash('sha256').update(JSON.stringify(receipt)).digest('hex'),expected,preset);
  assert.deepEqual(api.replayLearningReceipt(receipt),{matches:true,authenticatesUser:false,receipt});
 }
});
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
