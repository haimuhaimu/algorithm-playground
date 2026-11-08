import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../distributions-core.mjs';

const inspect=(...args)=>{
 assert.equal(typeof core.collectOverflowEvidence,'function','real samples need an off-chart evidence API');
 return core.collectOverflowEvidence(...args);
};

test('off-chart geometry and strict red-line membership remain distinct at exactly sixteen',()=>{
 const values=Object.freeze([4,5,15,16,17,100]);
 const result=inspect(values,16);
 assert.deepEqual(result.before,{total:5,inChart:2,outside:3});
 assert.deepEqual(result.current,{total:2,inChart:0,outside:2});
 assert.deepEqual(result.outside,[
  {index:3,value:16,before:true,after:false},
  {index:4,value:17,before:true,after:true},
  {index:5,value:100,before:true,after:true},
 ]);
 assert.deepEqual(result.dropped.map(r=>r.value),[5,15,16]);
 assert.deepEqual(result.kept.map(r=>r.value),[17,100]);
 assert.equal(result.outsideMax,100);
 assert.deepEqual(values,[4,5,15,16,17,100]);
});

test('empty and non-exceeding collections cannot invent a sample or a maximum',()=>{
 const empty=inspect([],16);
 assert.deepEqual(empty.before,{total:0,inChart:0,outside:0});
 assert.deepEqual(empty.current,{total:0,inChart:0,outside:0});
 assert.deepEqual(empty.outside,[]);
 assert.deepEqual(empty.dropped,[]);
 assert.deepEqual(empty.kept,[]);
 assert.equal(empty.outsideMax,null);
 const boundary=inspect([-4,4,16],16);
 assert.equal(boundary.current.total,0);
 assert.equal(boundary.outside.length,1);
 assert.equal(boundary.outside[0].after,false);
});

test('collection validation rejects malformed values rather than silently losing observations',()=>{
 inspect([],4);
 for(const values of [null,{},'16',[Infinity],[NaN],['17'],Array(2),Array(10001).fill(0)])assert.throws(()=>inspect(values,16));
 for(const threshold of [NaN,Infinity,-Infinity,'16',null])assert.throws(()=>inspect([17],threshold));
 assert.throws(()=>inspect([17],16,NaN));
});

test('inspection preserves actual draw order, duplicates and extreme finite numeric values',()=>{
 const values=[100,17,17,Number.MAX_VALUE,15,4];
 const first=inspect(values,16);
 assert.deepEqual(first.outside.map(r=>[r.index,r.value]),[[0,100],[1,17],[2,17],[3,Number.MAX_VALUE]]);
 first.outside[0].value=0;first.dropped.length=0;
 const again=inspect(values,16);
 assert.equal(again.outside[0].value,100);
 assert.deepEqual(again.dropped.map(r=>r.value),[15]);
 assert.deepEqual(values,[100,17,17,Number.MAX_VALUE,15,4]);
});

test('right-side collection rejects a comparison line left of the chart instead of miscounting left outliers',()=>{
 inspect([],4);
 assert.throws(()=>inspect([-5],-6,-6),RangeError);
 assert.throws(()=>inspect([17],16,-6),RangeError);
 assert.deepEqual(inspect([-5,-4,0,17],-4,-4).current,{total:2,inChart:1,outside:1});
});

test('the existing optional model keeps its original evidence contract without a spare collection',()=>{
 const grown=core.actObservatory(core.createObservatory(),{type:'grow'});
 const pushed=core.actObservatory(grown,{type:'push'});
 const done=core.actObservatory(pushed,{type:'answer',value:'sample'});
 const transfer=core.observatoryEvidence(core.actObservatory(done,{type:'inspect'})).transfer;
 assert.equal(transfer.id,'lognormal');
 assert.equal(transfer.stats.n,3030);
 assert.equal(Object.hasOwn(transfer,'collection'),false);
});

test('the real default batch exposes all eighty-eight off-chart observations without redrawing on a threshold change',()=>{
 inspect([],4);
 const initial=core.observatoryEvidence(core.createObservatory());
 assert.deepEqual(initial.rows[2].collection.outside.map(r=>[r.index,r.value]),[[6,31.45827106611436]]);
 const grown=core.actObservatory(core.createObservatory(),{type:'grow'});
 const before=core.observatoryEvidence(grown),after=core.observatoryEvidence(core.actObservatory(grown,{type:'push'}));
 assert.deepEqual(after.rows.map(r=>r.collection.current.total),[0,0,88]);
 const a=before.rows[2].collection,b=after.rows[2].collection;
 assert.deepEqual(b.before,{total:352,inChart:264,outside:88});
 assert.deepEqual(b.current,{total:88,inChart:0,outside:88});
 assert.deepEqual(a.outside,b.outside);
 assert.equal(b.outside.length,88);
 assert.deepEqual(b.outside.slice(0,6).map(r=>r.index),[6,113,152,195,256,323]);
 assert.equal(b.outsideMax,1752.014995452643);
 assert.equal(before.rows[2].stats.max,after.rows[2].stats.max);
 assert.deepEqual(before.baseline,after.baseline);
 assert.deepEqual(before.comparison,after.comparison);
});
