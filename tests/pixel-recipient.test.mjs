import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../pixel-core.mjs';

test('packet inspection reads exact code boundaries from hand-derived bytes', () => {
  assert.equal(typeof core.inspectPacket, 'function');
  // Tree: branch, leaf white(100), leaf black(101); payload white/black/white = 010.
  const packet = Uint8Array.of(0b01001010, 0b10000000);
  const trace = core.inspectPacket(packet, 3);
  assert.deepEqual(trace.pixels, [0,1,0]);
  assert.deepEqual(trace.codes, ['0','1',null,null]);
  assert.deepEqual(trace.entries, [
    {index:0,color:0,code:'0',startBit:7,endBit:8},
    {index:1,color:1,code:'1',startBit:8,endBit:9},
    {index:2,color:0,code:'0',startBit:9,endBit:10},
  ]);
  assert.equal(trace.treeBits,7); assert.equal(trace.payloadBits,3); assert.equal(trace.paddingBits,6);
  assert.deepEqual(core.decode(packet,3),trace.pixels);
  assert.throws(()=>core.inspectPacket(Uint8Array.of(0b01001010,0b10000001),3),/padding/);
});

test('inspection preserves full packet validation and single-color convention', () => {
  assert.equal(typeof core.inspectPacket,'function');
  for (const pixels of [core.preset('cat'),core.preset('noise'),Array(256).fill(3)]) {
    const encoded=core.encode(pixels), trace=core.inspectPacket(encoded.packet,pixels.length);
    assert.deepEqual(trace.pixels,pixels); assert.deepEqual(trace.codes,encoded.codes);
    assert.equal(trace.payloadBits,encoded.payloadBits);
    assert.equal(trace.entries.at(-1).endBit,trace.treeBits+trace.payloadBits);
    assert.equal(trace.entries.map(e=>e.code).join(''),pixels.map(p=>encoded.codes[p]).join(''));
  }
  assert.throws(()=>core.inspectPacket(Uint8Array.of(255),1));
  assert.throws(()=>core.inspectPacket(Uint8Array.of(128,0,0),1),/Trailing/);
});

test('recipient uses real full-postcard codes and an isolated eight-pixel row segment', async () => {
  const lessonAPI=await import('../pixel-recipient.mjs').catch(()=>({}));
  assert.equal(typeof lessonAPI.createRecipientLesson,'function');
  const source=core.preset('cat'), lesson=lessonAPI.createRecipientLesson(source);
  assert.equal(lesson.entries.length,8);
  assert.equal(Math.floor(lesson.start/16),Math.floor((lesson.start+7)/16));
  assert.ok(new Set(lesson.entries.map(e=>e.color)).size>=3);
  const encoded=core.encode(source);
  assert.deepEqual(lesson.codes,encoded.codes);
  assert.equal(lesson.packetBytes,encoded.packet.length);
  source.fill(2); assert.notDeepEqual(lesson.snapshot,source);
  assert.ok(Object.isFrozen(lesson.snapshot));
});

test('manual reading gates answers, wrong colors preserve progress, all eight restore exactly', async () => {
  const api=await import('../pixel-recipient.mjs').catch(()=>({}));
  assert.equal(typeof api.createRecipientLesson,'function');
  let s=api.createRecipientLesson(core.preset('cat'));
  const initial=s;
  const blocked=api.chooseRecipientColor(s,s.entries[0].color);
  assert.equal(blocked.restored.length,0); assert.equal(blocked.feedback,'incomplete');
  while(s.restored.length<8) {
    const entry=s.entries[s.restored.length];
    for(let bit=0;bit<entry.code.length;bit++) s=api.readRecipientBit(s);
    assert.equal(s.prefix,entry.code);
    const atLeaf=api.readRecipientBit(s); assert.equal(atLeaf.prefix,s.prefix);
    const wrong=api.chooseRecipientColor(s,(entry.color+1)%4);
    assert.equal(wrong.feedback,'wrong'); assert.deepEqual(wrong.restored,s.restored);
    s=api.chooseRecipientColor(wrong,entry.color);
  }
  assert.deepEqual(s.restored,s.snapshot.slice(s.start,s.start+8));
  assert.equal(s.prefix,''); assert.equal(initial.restored.length,0);
  assert.equal(api.readRecipientBit(s),s);
  assert.equal(api.chooseRecipientColor(s,0),s);
  assert.equal(s.readBits,s.entries.reduce((n,e)=>n+e.code.length,0));
});

test('a blank postcard remains a valid lesson without inventing other color codes', async () => {
  const api=await import('../pixel-recipient.mjs').catch(()=>({}));
  assert.equal(typeof api.createRecipientLesson,'function');
  const s=api.createRecipientLesson(Array(256).fill(0));
  assert.deepEqual(s.codes,['0',null,null,null]); assert.equal(s.packetBytes,33);
  assert.equal(s.treeBits,3); assert.equal(s.paddingBits,5);
  assert.ok(s.entries.every(e=>e.code==='0'));
  assert.throws(()=>api.createRecipientLesson([0,1]),/256/);
});
