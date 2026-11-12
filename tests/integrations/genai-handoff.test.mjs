import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppServer} from '../../scripts/serve.mjs';
import {build} from '../../scripts/build.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runLearningRoute,replayLearningReceipt} from '../../dist/learning-tool.mjs';

const api=await import('../../dist/genai-handoff.mjs').catch(()=>({}));
const requestId='run_20261103_abcXYZ-01';
const sequence=[
 {action:'train'},{action:'probe'},{action:'guess',value:1},{action:'explain',value:'parameters'},{action:'next'},
 {action:'rate',value:.03},{action:'guess',value:'points'},{action:'step'},{action:'explain',value:'parameters'},{action:'next'},
 {action:'train'},{action:'guess',value:'all'},{action:'explain',value:'unseen'},{action:'next'}
];
const publishedPage='https://haimuhaimu.github.io/algorithm-playground/learn.html';
function locationFor(target='https://haimuhaimu.github.io/genai-learning-os/?page=foundation&private=drop#old',source='http://127.0.0.1:3103/learn.html'){
 const url=new URL(source);
 url.searchParams.set('genaiReturn',target);url.searchParams.set('genaiRequest',requestId);url.searchParams.set('genaiJourney','model-learning');
 return url;
}
test('a valid GenAI context canonicalizes the return page without forwarding unrelated URL fields',()=>{
 assert.equal(typeof api.readGenaiHandoffContext,'function','explicit return context adapter is required');
 assert.deepEqual(api.readGenaiHandoffContext(locationFor()),{journeyId:'model-learning',requestId,returnURL:'https://haimuhaimu.github.io/genai-learning-os/?page=routes&section=journey'});
 assert.deepEqual(api.readGenaiHandoffContext(locationFor('http://127.0.0.1:3102/?page=foundation#private')),{journeyId:'model-learning',requestId,returnURL:'http://127.0.0.1:3102/?page=routes&section=journey'});
 assert.equal(api.readGenaiHandoffContext(locationFor('http://localhost:65535/')).returnURL,'http://localhost:65535/?page=routes&section=journey');
});
test('unsafe, partial, duplicate or foreign contexts never create a return destination',()=>{
 assert.equal(typeof api.readGenaiHandoffContext,'function');
 for(const target of ['javascript:alert(1)','data:text/html,hello','https://example.com/genai-learning-os/','https://haimuhaimu.github.io/other/','https://haimuhaimu.github.io:444/genai-learning-os/','https://user:pass@haimuhaimu.github.io/genai-learning-os/','http://127.0.0.1/','http://127.0.0.1:80/','http://localhost:1023/','http://localhost:3102/private','https://localhost:3102/','http://127.0.0.2:3102/']){
  assert.equal(api.readGenaiHandoffContext(locationFor(target)),null,target);
 }
 for(const change of [u=>u.searchParams.delete('genaiReturn'),u=>u.searchParams.set('genaiRequest','short'),u=>u.searchParams.set('genaiRequest','x'.repeat(81)),u=>u.searchParams.set('genaiRequest','123456789012345<'),u=>u.searchParams.set('genaiJourney','pixel'),u=>u.searchParams.append('genaiReturn','https://example.com')]){
  const url=locationFor();change(url);assert.equal(api.readGenaiHandoffContext(url),null);
 }
 assert.equal(api.readGenaiHandoffContext(undefined),null);assert.equal(api.readGenaiHandoffContext({href:'not a URL'}),null);
});
test('public or non-loopback Playground pages cannot accept a loopback return',()=>{
 for(const source of [publishedPage,'https://example.com/learn.html','http://192.168.0.2:3103/learn.html']){
  for(const target of ['http://localhost:65535/','http://127.0.0.1:3102/']){
   assert.equal(api.readGenaiHandoffContext(locationFor(target,source)),null,source+' → '+target);
  }
 }
});
test('the encoder independently rejects a previously accepted loopback return from a public page',()=>{
 const target='http://localhost:65535/',local=locationFor(target);
 const context=api.readGenaiHandoffContext(local),receipt=runLearningRoute(sequence,{producer:'browser-session'});
 const validReturn=new URL(api.createGenaiReturnUrl(context,receipt,local));
 assert.equal(validReturn.origin,'http://localhost:65535');
 assert.throws(()=>api.createGenaiReturnUrl(context,receipt,locationFor(target,publishedPage)),/context|destination|target/i);
 assert.throws(()=>api.createGenaiReturnUrl(context,receipt),/context|destination|target/i);
});
test('the encoder rejects an official return if the live request no longer matches',()=>{
 const source=locationFor(undefined,publishedPage),context=api.readGenaiHandoffContext(source);
 const receipt=runLearningRoute(sequence,{producer:'browser-session'});
 source.searchParams.set('genaiRequest','different_request_20261105');
 assert.throws(()=>api.createGenaiReturnUrl(context,receipt,source),/context|request/i);
});
test('explicit return contains the unchanged real receipt as UTF-8 in the fragment, never the request query',()=>{
 assert.equal(typeof api.createGenaiReturnUrl,'function','receipt return encoder is required');
 const receipt=runLearningRoute(sequence,{producer:'browser-session'}),before=structuredClone(receipt);
 const source=locationFor(undefined,publishedPage),context=api.readGenaiHandoffContext(source),destination=new URL(api.createGenaiReturnUrl(context,receipt,source));
 assert.equal(destination.origin+destination.pathname+destination.search,'https://haimuhaimu.github.io/genai-learning-os/?page=routes&section=journey');
 assert.equal(destination.searchParams.has('receipt'),false);assert.match(destination.hash,/^#playground=[A-Za-z0-9_-]+$/);
 const bytes=Buffer.from(destination.hash.slice('#playground='.length),'base64url');assert.ok(bytes.length<=65536);
 const envelope=JSON.parse(bytes.toString('utf8'));
 assert.deepEqual(Object.keys(envelope),['format','schemaVersion','journeyId','requestId','receipt']);
 assert.equal(envelope.format,'genai-learning-os/playground-handoff');assert.equal(envelope.schemaVersion,1);assert.equal(envelope.journeyId,'model-learning');assert.equal(envelope.requestId,requestId);
 assert.deepEqual(envelope.receipt,before);assert.deepEqual(receipt,before,'encoding must not rewrite the v1 receipt');
 assert.equal(envelope.receipt.result.evidence.stepGuess,'points');assert.equal(envelope.receipt.result.evidence.test.guess,'all');assert.equal(envelope.receipt.result.evidence.test.test.correct,13);
 assert.equal(replayLearningReceipt(envelope.receipt).matches,true,'Chinese boundaries and original evidence must round-trip without changing the replay contract');
});
test('unsupported, incomplete, changed, oversized receipts and forged targets are not returned',()=>{
 assert.equal(typeof api.createGenaiReturnUrl,'function');
 const source=locationFor(),context=api.readGenaiHandoffContext(source),receipt=runLearningRoute(sequence,{producer:'browser-session'});
 assert.throws(()=>api.createGenaiReturnUrl(context,runLearningRoute([]),source),/complete|finished/i);
 assert.throws(()=>api.createGenaiReturnUrl(context,{...receipt,experimentId:'pixel-decode'},source),/unsupported|version|experiment/i);
 const changed=structuredClone(receipt);changed.result.evidence.test.test.correct=16;
 assert.throws(()=>api.createGenaiReturnUrl(context,changed,source),/mismatch|receipt/i);
 assert.throws(()=>api.createGenaiReturnUrl(context,{...receipt,privateNote:'x'.repeat(65536)},source),/size|limit|large/i);
 assert.throws(()=>api.createGenaiReturnUrl({...context,returnURL:'https://example.com/'},receipt,source),/context|destination|target/i);
 assert.throws(()=>api.createGenaiReturnUrl({...context,requestId:'stale'},receipt,source),/context|request/i);
 assert.throws(()=>api.createGenaiReturnUrl({...context,requestId:[requestId]},receipt,source),/context|request/i,'a coerced request id is not a valid wire nonce');
});
test('built handoff module is delivered as JavaScript without broadening the static server CSP',async()=>{
 const out=await mkdtemp(join(tmpdir(),'genai-handoff-')),server=createAppServer(out, {built:true});
 try{
  const files=await build(undefined,out);assert.ok(files.includes('genai-handoff.mjs'));
  await new Promise((ready,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',ready);});
  const response=await fetch(`http://127.0.0.1:${server.address().port}/genai-handoff.mjs`);
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);
  assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
  assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 }finally{if(server.listening)await new Promise(done=>server.close(done));await rm(out,{recursive:true,force:true});}
});
