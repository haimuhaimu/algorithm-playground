import test from 'node:test';
import assert from 'node:assert/strict';
import * as pixel from '../pixel-core.mjs';
const fixture=()=>[...Array(128).fill(0),...Array(64).fill(1),...Array(32).fill(2),...Array(32).fill(3)];
const available=()=>assert.equal(typeof pixel.rearrangement,'function','a real rearrangement and encoding comparison is required');

test('rearranging changes positions but preserves every color and real encoding cost',()=>{
 available();const source=fixture(),trial=pixel.rearrangement(source,42);
 assert.deepEqual(source,fixture());
 assert.deepEqual(trial.before.encoded.counts,[128,64,32,32]);
 assert.deepEqual(trial.after.encoded.counts,[128,64,32,32]);
 for(const side of [trial.before,trial.after]){
  assert.equal(side.encoded.packet.length,58);assert.equal(side.encoded.payloadBits,448);
  assert.equal(side.encoded.treeBits,15);assert.equal(side.encoded.paddingBits,1);
  assert.equal(side.encoded.entropy,1.75);assert.deepEqual(side.decoded,side.pixels);assert.equal(side.matches,256);
 }
 assert.ok(trial.changedCells>100);assert.equal(trial.samePacket,false);
 assert.notDeepEqual(trial.before.encoded.packet,trial.after.encoded.packet);
});

test('comparison snapshots are reproducible, independent and do not change the original drawing',()=>{
 available();const source=fixture(),a=pixel.rearrangement(source,42),b=pixel.rearrangement(source,42);
 assert.deepEqual(a,b);assert.notDeepEqual(a.after.pixels,pixel.rearrangement(source,43).after.pixels);
 source.fill(3);assert.deepEqual(a.before.pixels,fixture());
 a.after.pixels.fill(2);a.after.encoded.counts[0]=0;
 assert.deepEqual(a.before.pixels,fixture());assert.deepEqual(b.before.pixels,fixture());
 assert.deepEqual(a.before.encoded.counts,[128,64,32,32]);
});

test('single-color rearrangement truthfully has no visible or byte change',()=>{
 available();const a=pixel.rearrangement(Array(256).fill(2),9);
 assert.equal(a.changedCells,0);assert.equal(a.samePacket,true);
 assert.equal(a.before.encoded.packet.length,33);assert.equal(a.after.encoded.packet.length,33);
 assert.deepEqual(a.after.decoded,Array(256).fill(2));
});

test('rearrangement rejects malformed images and seeds rather than fabricating a comparison',()=>{
 available();for(const p of [[],[0,1],Array(256),Array(256).fill(4)])assert.throws(()=>pixel.rearrangement(p,1));
 for(const seed of [-1,NaN,1.5,2**32])assert.throws(()=>pixel.rearrangement(fixture(),seed));
});
