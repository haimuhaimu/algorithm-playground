import test from 'node:test';
import assert from 'node:assert/strict';
import {encode,preset} from '../pixel-core.mjs';
import {createDelivery,deliveryAt} from '../pixel-delivery.mjs';

test('cat decode gates a three-bit black pixel on the final bit, not the reveal percentage',()=>{
 const trace=createDelivery(encode(preset('cat')).packet,256);
 assert.equal(deliveryAt(trace,15).decoded,0);
 for(const sent of [50,51,52]){
  const state=deliveryAt(trace,sent);
  assert.equal(state.decoded,35);assert.equal(state.pixels[35],null);
 }
 assert.equal(deliveryAt(trace,51).prefix,'0');
 assert.equal(deliveryAt(trace,52).prefix,'01');
 assert.equal(deliveryAt(trace,53).decoded,36);
 assert.equal(deliveryAt(trace,53).pixels[35],1);
 assert.equal(deliveryAt(trace,378).decoded,216);
 assert.equal(deliveryAt(trace,378).pixels[220],null);
});
test('tree and padding are real packet costs, never extra image pixels',()=>{
 for(const [name,tree,end,total] of [['cat',15,428,432],['noise',15,527,528],['blank',3,259,264]]){
  const trace=createDelivery(encode(preset(name)).packet,256);
  assert.equal(deliveryAt(trace,tree-1).phase,'tree');
  assert.equal(deliveryAt(trace,tree-1).decoded,0);
  assert.equal(deliveryAt(trace,end).phase,'padding');
  assert.equal(deliveryAt(trace,end).decoded,256);
  assert.equal(deliveryAt(trace,end).complete,false);
  assert.equal(deliveryAt(trace,total).complete,true);
  assert.deepEqual(deliveryAt(trace,total).pixels,preset(name));
 }
});
test('a delivery owns its byte snapshot and caps playhead values',()=>{
 const packet=encode(preset('cat')).packet,trace=createDelivery(packet,256);
 packet.fill(0);
 assert.deepEqual(deliveryAt(trace,432).pixels,preset('cat'));
 assert.equal(deliveryAt(trace,-9).sent,0);
 assert.equal(deliveryAt(trace,9999).sent,432);
 assert.equal(deliveryAt(trace,NaN).sent,0);
 assert.equal(deliveryAt(trace,33.8).sent,33);
 assert.equal(deliveryAt(createDelivery(encode(preset('noise')).packet,256),33).decoded,9);
});
