import test from 'node:test';
import assert from 'node:assert/strict';
import {createPredictionField} from '../../../src/experiments/neural/neural-field.mjs';
import {createModel,makeDataset,predict,train} from '../../../src/experiments/neural/neural-core.mjs';

test('field probabilities retain full precision and the original cell-center coordinates',()=>{
 const read=createPredictionField(75,46),points=makeDataset('islands').train;
 const models=[createModel('linear'),createModel(),train(createModel(),points,.15,20)];
 for(const model of models){
  const before=structuredClone(model),values=read(model);
  assert.ok(values instanceof Float64Array);assert.equal(values.byteLength,27600);
  // Compatibility oracle: the unchanged scalar engine at the original draw coordinates.
  for(let row=0;row<46;row++)for(let col=0;col<75;col++){
   assert.equal(values[row*75+col],predict(model,(col+.5)/75*2-1,1-(row+.5)/46*2));
  }
  assert.deepEqual(model,before,'sampling must not change learned weights or epoch');
 }
});

test('in-place parameter changes invalidate even when model identity and epoch are unchanged',()=>{
 const model=createModel('linear'),read=createPredictionField(3,2);
 assert.deepEqual([...read(model)],[.5,.5,.5,.5,.5,.5]);
 model.weights[2]=Math.log(3);
 assert.ok(read(model).every(p=>Math.abs(p-.75)<Number.EPSILON),'log/exp round-off stays within one machine epsilon of 3/4');
 model.weights[2]=0;
 assert.deepEqual([...read(model)],[.5,.5,.5,.5,.5,.5]);
});

test('unchanged snapshots reuse work, but training, switching and rewind show the right field',()=>{
 const read=createPredictionField(75,46),model=createModel(),base=structuredClone(model);
 const originalTanh=Math.tanh;let calls=0;
 Math.tanh=value=>{calls++;return originalTanh(value);};
 try{
  const first=read(model);assert.equal(calls,27600);calls=0;
  for(let i=0;i<60;i++)read(structuredClone(model));
  model.epoch++;read(model);
  assert.equal(calls,0,'identity or epoch alone is not a prediction change');
  train(model,makeDataset('islands').train,.15,1);calls=0;
  const after=read(model);assert.equal(calls,27600);assert.notDeepEqual(after,first);
  const linear=createModel('linear');assert.ok(read(linear).every(p=>p===.5));calls=0;
  const rewound=read(base);assert.equal(calls,27600);assert.deepEqual(rewound,first);
  calls=0;read(structuredClone(base));assert.equal(calls,0);
 }finally{Math.tanh=originalTanh;}
});
