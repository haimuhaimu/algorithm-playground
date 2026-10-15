import test from 'node:test';
import assert from 'node:assert/strict';
const core = await import('../neural-core.mjs').catch(() => ({}));
const fixture=[{x:-.8,y:-.6,label:0},{x:.8,y:.6,label:1},{x:-.6,y:.2,label:0},{x:.6,y:-.2,label:1}];

test('classifier APIs exist and equal seeds reproduce actual predictions',()=>{
 assert.equal(typeof core.createModel,'function');
 const a=core.createModel(),b=core.createModel();
 assert.equal(core.predict(a,.23,-.61),core.predict(b,.23,-.61));
 assert.notEqual(core.predict(a,.23,-.61),core.predict(core.createModel('network',42),.23,-.61));
});
test('backprop agrees with finite-difference BCE gradients for every weight',()=>{
 for(const kind of ['linear','network']){
  const m=core.createModel(kind),g=core.gradients(m,fixture),epsilon=1e-5;
  for(let i=0;i<m.weights.length;i++){
   const v=m.weights[i];m.weights[i]=v+epsilon;const plus=core.metrics(m,fixture).loss;
   m.weights[i]=v-epsilon;const minus=core.metrics(m,fixture).loss;m.weights[i]=v;
   assert.ok(Math.abs(g[i]-(plus-minus)/(2*epsilon))<1e-6,kind+' weight '+i);
  }
 }
});
test('gradient training reduces loss and learns the held-out diagonal',()=>{
 const data=core.makeDataset('diagonal'),m=core.createModel('linear'),before=core.metrics(m,data.train).loss;
 core.train(m,data.train,.15,500);
 assert.equal(m.epoch,500);assert.ok(core.metrics(m,data.train).loss<before*.5);
 assert.ok(core.metrics(m,data.test).accuracy>.9);
});
test('network learns separated islands which a straight boundary cannot solve',()=>{
 const data=core.makeDataset('islands'),a=core.createModel('linear'),b=core.createModel('network');
 for(let i=0;i<6;i++){core.train(a,data.train,.6,500);core.train(b,data.train,.6,500);}
 assert.ok(core.metrics(a,data.test).accuracy<.8);
 assert.ok(core.metrics(b,data.test).accuracy>.9);
});
test('training remains finite at the largest exposed rate and stops at its epoch budget',()=>{
 const data=core.makeDataset('ring'),m=core.createModel();
 for(let i=0;i<10;i++)core.train(m,data.train,.6,500);
 assert.equal(m.epoch,4000);assert.ok(m.weights.every(Number.isFinite));
 assert.ok(Number.isFinite(core.metrics(m,data.train).loss));
 assert.ok(core.predict(m,1,-1)>=0&&core.predict(m,1,-1)<=1);
});
test('preset test points are independent, reproducible and never changed by training',()=>{
 for(const preset of ['islands','diagonal','ring']){
  const a=core.makeDataset(preset),b=core.makeDataset(preset);assert.deepEqual(a,b);
  assert.equal(a.train.length,48);assert.equal(a.test.length,120);
  assert.deepEqual([...new Set(a.train.map(p=>p.label))].sort(),[0,1]);
  const keys=new Set(a.train.map(p=>p.x+','+p.y));
  assert.ok(a.test.every(p=>!keys.has(p.x+','+p.y)));
  core.train(core.createModel(),a.train,.15,1);assert.deepEqual(a,b);
 }
});
test('empty metrics are unavailable and invalid training input cannot corrupt weights',()=>{
 const m=core.createModel(),original=structuredClone(m);
 assert.equal(core.metrics(m,[]),null);
 for(const points of [[],[{x:0,y:0,label:0}],[{x:NaN,y:0,label:0},fixture[1]]]){
  assert.throws(()=>core.train(m,points,.15,1));assert.deepEqual(m,original);
 }
 for(const rate of [NaN,0,4])assert.throws(()=>core.train(m,fixture,rate,1));
 assert.throws(()=>core.createModel('unknown'));assert.throws(()=>core.makeDataset('unknown'));
});
test('painting is immutable, bounded, capped and erasing removes nearby samples',()=>{
 let p=[];p=core.editPoints(p,{x:0,y:0},'0');assert.equal(p[0].label,0);
 const old=structuredClone(p),newer=core.editPoints(p,{x:.5,y:.5},'1');assert.deepEqual(p,old);
 assert.equal(newer.length,2);assert.equal(core.editPoints(newer,{x:.5,y:.5},'erase').length,1);
 assert.deepEqual(core.editPoints(newer,{x:NaN,y:0},'0'),newer);
 assert.deepEqual(core.editPoints(newer,{x:2,y:0},'0'),newer);
 for(let i=0;i<200;i++)p=core.editPoints(p,{x:(i%20)/11-.9,y:Math.floor(i/20)/6-.9},String(i%2));
 assert.equal(p.length,160);
 assert.deepEqual(core.editPoints(p,{x:0,y:0},'probe'),p);
});
