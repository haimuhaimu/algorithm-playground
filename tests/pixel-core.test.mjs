import test from 'node:test';
import assert from 'node:assert/strict';
const c=await import('../pixel-core.mjs').catch(()=>({}));
const available=()=>assert.equal(typeof c.encode,'function','real pixel codec is required');
test('sparse arrays cannot silently turn missing pixels into padding colors', () => {
 available(); assert.throws(() => c.encode([0, , 1]), /pixels/);
 const sparse = Array(256).fill(0); delete sparse[4];
 assert.throws(() => c.stroke(sparse, {x:0,y:0}, {x:1,y:0}, 1), /pixels/);
});

test('Huffman code and package costs match a hand-calculated four-symbol fixture',()=>{
 available();const pixels=[0,0,0,0,1,1,2,3],copy=[...pixels],e=c.encode(pixels);
 assert.deepEqual(e.codes,['0','10','110','111']);assert.deepEqual(e.counts,[4,2,1,1]);
 assert.equal(e.payloadBits,14);assert.equal(e.treeBits,15);assert.equal(e.paddingBits,3);
 assert.equal(e.packet.length,4);assert.equal(e.entropy,1.75);assert.deepEqual(pixels,copy);
 assert.deepEqual(c.decode(e.packet,8),pixels);
});
test('single-color and uniform images include tree and byte padding, even when bigger',()=>{
 available();const flat=c.encode(Array(256).fill(2)),noise=c.encode(Array.from({length:256},(_,i)=>i%4));
 assert.equal(flat.packet.length,33);assert.equal(flat.payloadBits,256);assert.equal(flat.treeBits,3);assert.equal(flat.paddingBits,5);assert.equal(flat.entropy,0);
 assert.equal(noise.packet.length,66);assert.equal(noise.payloadBits,512);assert.equal(noise.treeBits,15);assert.equal(noise.entropy,2);
 assert.deepEqual(c.decode(flat.packet,256),Array(256).fill(2));
});
test('independent literal packets decode without the original image or code table',()=>{
 available();assert.deepEqual(c.decode(Uint8Array.of(0b10000000),3),[0,0,0]);
 // tree: 0 100 101, then pixel codes 0 1 0 1, then five zero padding bits.
 assert.deepEqual(c.decode(Uint8Array.of(0b01001010,0b10100000),4),[0,1,0,1]);
});
test('Huffman only sees frequency, not shape, and has deterministic tie breaking',()=>{
 available();const a=Array.from({length:256},(_,i)=>i%4),b=[...a].reverse();
 assert.deepEqual(c.encode(a).codes,['00','01','10','11']);
 assert.equal(c.encode(a).packet.length,c.encode(b).packet.length);
 assert.deepEqual(c.encode(a).packet,c.encode(a).packet);
});
test('all presets and varied deterministic images survive packed-byte round trips',()=>{
 available();for(const name of ['cat','heart','noise','blank']){const p=c.preset(name);assert.equal(p.length,256);assert.deepEqual(c.decode(c.encode(p).packet,256),p);p[0]=3;assert.notDeepEqual(c.preset(name),p);}
 for(let n=1;n<=512;n+=7){const p=Array.from({length:n},(_,i)=>(i*i+3*i+n)%4);assert.deepEqual(c.decode(c.encode(p).packet,n),p);}
});
test('invalid pixels and malformed packets fail explicitly',()=>{
 available();for(const p of [[],[4],[-1],[.5],Array(4097).fill(0),[NaN]])assert.throws(()=>c.encode(p));
 for(const count of [0,-1,1.5,4097])assert.throws(()=>c.decode(Uint8Array.of(128),count));
 for(const packet of [new Uint8Array(),Uint8Array.of(0),Uint8Array.of(255),Uint8Array.of(0b01001000),Uint8Array.of(128,0,0)])assert.throws(()=>c.decode(packet,1));
 const good=c.encode(c.preset('cat')).packet;assert.throws(()=>c.decode(good.slice(0,-1),256));
 const pad=c.encode(Array(256).fill(0)).packet;pad[pad.length-1]|=1;assert.throws(()=>c.decode(pad,256));
});
test('paint strokes connect endpoints, preserve input and reject invalid cells',()=>{
 available();const p=Array(256).fill(0),out=c.stroke(p,{x:0,y:0},{x:15,y:15},2);
 assert.equal(out.filter(x=>x===2).length,16);for(let i=0;i<16;i++)assert.equal(out[i*17],2);
 assert.ok(p.every(x=>x===0));assert.deepEqual(c.stroke(p,{x:15,y:15},{x:0,y:0},2),out);
 assert.equal(c.stroke(p,{x:0,y:15},{x:15,y:15},1).slice(240).filter(x=>x===1).length,16);
 assert.throws(()=>c.stroke(p,{x:-1,y:0},{x:0,y:0},1));assert.throws(()=>c.stroke(p,{x:0,y:0},{x:0,y:0},4));
});
