import test from 'node:test';
import assert from 'node:assert/strict';
import {preset,decode} from '../pixel-core.mjs';
const api=await import('../pixel-code.mjs').catch(()=>null);
const subject=()=>{assert.ok(api,'code-allocation lesson must exist');return api;};
function finish(pairs,pixels=preset('cat')){
 const a=subject();let state=a.createCodeLesson(pixels);
 for(const pair of pairs)state=a.mergeCodeGroups(state,pair);
 return {state,result:a.codeLessonResult(state)};
}
test('lightest merges produce real cat packet with hand-calculated 413 payload bits and 54 bytes',()=>{
 const {result}=finish([['c2','c1'],['n0','c3'],['n1','c0']]);
 assert.deepEqual(result.user.codes,['1','001','000','01']);
 assert.deepEqual(result.user.counts,[154,37,18,47]);
 assert.equal(result.user.payloadBits,413);assert.equal(result.user.treeBits,15);
 assert.equal(result.user.paddingBits,4);assert.equal(result.user.packet.length,54);
 assert.equal(result.reference.payloadBits,413);assert.equal(result.payloadDelta,0);
 assert.deepEqual(decode(result.user.packet,256),preset('cat'));assert.equal(result.matches,256);
});
test('nonoptimal balanced tree is accepted, really costs 66 bytes and still restores every original cell',()=>{
 const {result}=finish([['c0','c3'],['c1','c2'],['n0','n1']]);
 assert.equal(result.user.payloadBits,512);assert.equal(result.user.packet.length,66);
 assert.equal(result.payloadDelta,99);assert.equal(result.byteDelta,12);
 assert.deepEqual(decode(result.user.packet,256),preset('cat'));assert.equal(result.matches,256);
});
test('merge cost explains why each chosen group gains a bit and undo restores identical choices',()=>{
 const a=subject(),source=preset('cat'),s=a.createCodeLesson(source);
 source[0]=3;assert.equal(s.snapshot[0],0);assert.ok(Object.isFrozen(s.snapshot));
 assert.deepEqual(a.suggestCodePair(s),['c2','c1']);
 const next=a.mergeCodeGroups(s,['c0','c3']);
 assert.equal(next.steps[0].weight,201);assert.equal(next.forest.find(n=>n.id==='n0').weight,201);
 assert.equal(s.forest.length,4);assert.equal(next.forest.length,3);
 assert.deepEqual(a.undoCodeMerge(next),s);assert.equal(a.undoCodeMerge(s),s);
 assert.equal(a.codeLessonResult(next),null);
});
test('blank is honestly one bit per pixel with no phantom merging or zero-byte promise',()=>{
 const a=subject(),state=a.createCodeLesson(preset('blank')),r=a.codeLessonResult(state);
 assert.deepEqual(a.suggestCodePair(state),[]);assert.equal(state.steps.length,0);
 assert.deepEqual(r.user.codes,['0',null,null,null]);assert.equal(r.user.payloadBits,256);
 assert.equal(r.user.treeBits,3);assert.equal(r.user.paddingBits,5);assert.equal(r.user.packet.length,33);
 assert.equal(r.matches,256);
});
test('equal frequencies may tie and absent colors never receive a phantom leaf',()=>{
 const {result}=finish([['c0','c1'],['c2','c3'],['n0','n1']],Array.from({length:256},(_,i)=>i%4));
 assert.equal(result.user.payloadBits,512);assert.equal(result.payloadDelta,0);assert.equal(result.byteDelta,0);
 const a=subject(),two=a.mergeCodeGroups(a.createCodeLesson(Array(128).fill(0).concat(Array(128).fill(3))),['c0','c3']);
 const r=a.codeLessonResult(two);assert.equal(r.user.treeBits,7);assert.equal(r.user.packet.length,33);
 assert.deepEqual(r.user.codes,['0',null,null,'1']);assert.equal(r.matches,256);
});
test('invalid duplicate or consumed groups are rejected without changing the current forest',()=>{
 const a=subject(),s=a.createCodeLesson(preset('cat'));
 for(const ids of [['c0','c0'],['c0','x'],['c0'],[]])assert.throws(()=>a.mergeCodeGroups(s,ids),/group/i);
 const next=a.mergeCodeGroups(s,['c0','c1']);assert.throws(()=>a.mergeCodeGroups(next,['c0','c2']),/group/i);
 assert.equal(s.forest.length,4);assert.throws(()=>a.createCodeLesson([0]),/256/);
 assert.throws(()=>a.createCodeLesson(Array(256).fill(8)),/pixel/i);
});
