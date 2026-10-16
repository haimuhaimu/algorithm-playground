import test from 'node:test';
import assert from 'node:assert/strict';
import {DRAFT_KEYS,readDraft,writeDraft,clearDraft,validatePixelDraft,validateNeuralDraft} from '../local-drafts.mjs';
import {createModel,makeDataset} from '../neural-core.mjs';
import {preset} from '../pixel-core.mjs';
import {memoryStorage} from './storage-helper.mjs';
const pixel=()=>({pixels:preset('cat'),color:1,history:[],received:null});
const neural=()=>({points:makeDataset('islands').train,preset:'islands',model:createModel(),rate:.15,tool:'probe',guess:null,history:[],undo:[],rates:[],previous:null});
test('drafts are versioned, isolated, deep snapshots and clear only their own key',()=>{
 const s=memoryStorage(),get=()=>s,p=pixel();s.setItem('unrelated','keep');
 assert.ok(writeDraft(DRAFT_KEYS.pixel,p,validatePixelDraft,get));p.pixels[0]=3;
 assert.notDeepEqual(readDraft(DRAFT_KEYS.pixel,validatePixelDraft,get).value.pixels,p.pixels);
 assert.ok(writeDraft(DRAFT_KEYS.neural,neural(),validateNeuralDraft,get));assert.ok(clearDraft(DRAFT_KEYS.pixel,get));
 assert.equal(s.getItem('unrelated'),'keep');assert.equal(readDraft(DRAFT_KEYS.neural,validateNeuralDraft,get).status,'restored');
});
test('corrupt, future-version, oversized and invalid content is ignored without erasing it',()=>{
 const s=memoryStorage(),get=()=>s,key=DRAFT_KEYS.pixel;
 for(const raw of ['{','null',JSON.stringify({version:2,value:pixel()}),' '.repeat(512001),JSON.stringify({version:1,value:{...pixel(),pixels:[0]}})]){
  s.setItem(key,raw);assert.equal(readDraft(key,validatePixelDraft,get).status,'invalid');assert.equal(s.getItem(key),raw);
 }
});
test('blocked getters, quota failures and failed removal are non-throwing and preserve the last saved record',()=>{
 const denied=()=>{throw Error('denied');};assert.equal(readDraft('x',validatePixelDraft,denied).status,'unavailable');
 assert.equal(writeDraft('x',pixel(),validatePixelDraft,denied),false);assert.equal(clearDraft('x',denied),false);
 const s=memoryStorage();writeDraft('x',pixel(),validatePixelDraft,()=>s);const old=s.getItem('x');s.setItem=()=>{throw Error('quota');};
 assert.equal(writeDraft('x',{...pixel(),color:3},validatePixelDraft,()=>s),false);assert.equal(s.getItem('x'),old);
});
test('neural records reject fabricated preset answers, invalid weights, rates, history and oversized undo',()=>{
 const bads=[d=>d.points[0].label=1-d.points[0].label,d=>d.model.weights[0]=Infinity,d=>d.model.weights.pop(),d=>d.rate=7,d=>d.undo=Array(31).fill({points:[],preset:'custom'}),d=>d.history=[{epoch:5000,loss:0}],d=>d.model.epoch=1];
 for(const change of bads){const d=neural();change(d);assert.throws(()=>validateNeuralDraft(d),/Invalid/);}
 const d=neural();d.preset='custom';d.points=[];assert.equal(validateNeuralDraft(d).points.length,0);
});
