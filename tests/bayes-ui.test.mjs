import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initBayesLesson} from '../mining-bayes-ui.mjs';
import {replayLearningReceipt} from '../learning-tool.mjs';

async function boot(handoff=false){
 const source=await readFile(new URL('../mining.html',import.meta.url),'utf8'),els=new Map(),listeners=new Map();
 for(const [,id]of source.matchAll(/\bid="([^"]+)"/g)){
  const handlers=new Map(),attrs=new Map();els.set(id,{id,hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',open:false,handlers,setAttribute:(k,v)=>attrs.set(k,v),getAttribute:k=>attrs.get(k),addEventListener:(n,fn)=>handlers.set(n,fn),focus(){},scrollIntoView(){},select(){}});
 }
 const previous={document:globalThis.document,window:globalThis.window},destinations=[];
 const query=new URLSearchParams({genaiJourney:'bayes-learning',genaiRequest:'bayes_test_12345678',genaiReturn:'http://127.0.0.1:3100/'});
 const location={href:'http://127.0.0.1:3103/mining.html'+(handoff?'?'+query:''),hash:'',assign:value=>destinations.push(value)};
 const document={hidden:false,getElementById:id=>els.get(id)},window={location,navigator:{clipboard:{writeText:async()=>{}}},addEventListener:(n,fn)=>listeners.set(n,fn)};
 globalThis.document=document;globalThis.window=window;initBayesLesson();
 return {els,document,window,destinations,click:id=>els.get(id)?.handlers.get('click')?.(),restore(){globalThis.document=previous.document;globalThis.window=previous.window;}};
}
function complete(u){for(const id of ['bayes-start','bayes-guess-same','bayes-reveal','bayes-change-many','bayes-update','bayes-answer-never','bayes-answer-evidence'])u.click(id);}
test('Bayes export journals actual wrong choices and resets, never reading the free game or drafts',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('bayes-export-generate'),'the finished lesson needs a real export entry');
  u.click('bayes-export-generate');assert.equal(u.els.get('bayes-export-text').value,'');
  u.click('bayes-start');u.click('bayes-guess-many');u.click('bayes-reveal');u.click('bayes-reset');complete(u);u.click('bayes-export-generate');
  const receipt=JSON.parse(u.els.get('bayes-export-text').value);assert.equal(receipt.producer,'browser-session');assert.equal(replayLearningReceipt(receipt).matches,true);
  assert.ok(receipt.actions.some(item=>item.action==='reset'));assert.deepEqual(receipt.result.evidence.attempts,['never','evidence']);assert.equal(receipt.result.evidence.changeGuess,'many');
  assert.equal(u.els.get('bayes-export-record').hidden,false);u.click('bayes-close');u.click('bayes-start');assert.equal(u.els.get('bayes-export-record').hidden,false);
  u.click('bayes-reset');assert.equal(u.els.get('bayes-export-record').hidden,true);assert.equal(u.els.get('bayes-export-text').value,'');
 }finally{u.restore();}
});
test('Bayes return is absent without matching context and sends only an explicit completed receipt',async()=>{
 const u=await boot(true);try{
  assert.ok(u.els.has('bayes-genai-send'));assert.equal(u.els.get('bayes-genai-return').hidden,true);u.click('bayes-genai-send');assert.equal(u.destinations.length,0);
  complete(u);assert.equal(u.els.get('bayes-genai-return').hidden,false);assert.equal(u.destinations.length,0);u.click('bayes-genai-send');
  const target=new URL(u.destinations[0]);assert.equal(target.search,'?page=routes&section=bayes-journey');const envelope=JSON.parse(Buffer.from(target.hash.slice('#playground='.length),'base64url').toString());assert.equal(envelope.journeyId,'bayes-learning');assert.equal(envelope.receipt.producer,'browser-session');assert.equal(replayLearningReceipt(envelope.receipt).matches,true);
 }finally{u.restore();}
 const v=await boot();try{complete(v);assert.equal(v.els.get('bayes-genai-return').hidden,true);v.click('bayes-genai-send');assert.equal(v.destinations.length,0);}finally{v.restore();}
});
test('copy failure keeps the current receipt for manual selection and hidden pages cannot export',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('bayes-export-copy'));complete(u);u.document.hidden=true;u.click('bayes-export-generate');assert.equal(u.els.get('bayes-export-text').value,'');u.document.hidden=false;u.click('bayes-export-generate');
  const text=u.els.get('bayes-export-text').value;u.window.navigator.clipboard.writeText=async()=>{throw Error('denied');};await u.click('bayes-export-copy');assert.equal(u.els.get('bayes-export-text').value,text);assert.match(u.els.get('bayes-export-status').textContent,/手动/);
 }finally{u.restore();}
});
test('an overlong journal offers an explicit new-record recovery without silently truncating the old history',async()=>{
 const u=await boot(true);try{
  u.click('bayes-start');for(let i=0;i<252;i++)u.click('bayes-guess-same');
  for(const id of ['bayes-reveal','bayes-change-many','bayes-update','bayes-answer-never','bayes-answer-evidence'])u.click(id);
  u.click('bayes-export-generate');assert.equal(u.els.get('bayes-export-text').value,'');
  assert.ok(u.els.has('bayes-new-record'),'limit failure needs a usable explicit recovery');
  assert.equal(u.els.get('bayes-new-record').hidden,false);
  u.click('bayes-new-record');assert.equal(u.els.get('bayes-new-record').hidden,true);
  complete(u);u.click('bayes-export-generate');
  const receipt=JSON.parse(u.els.get('bayes-export-text').value);
  assert.equal(receipt.actions.length,6);assert.equal(replayLearningReceipt(receipt).matches,true);
  u.click('bayes-genai-send');assert.equal(u.destinations.length,1);
 }finally{u.restore();}
});
