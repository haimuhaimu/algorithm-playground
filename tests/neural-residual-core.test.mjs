import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuide} from '../neural-guide.mjs';
const api=await import('../neural-residual-core.mjs').catch(()=>({}));
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} ≠ ${b}`);
function model(skip=true){assert.equal(typeof api.createResidualModel,'function','real residual network must exist');return api.createResidualModel(skip);}
test('shortcut adds the input once to a genuine learned two-dimensional branch',()=>{
 const m=model(),p=model(false);m.weights.fill(0);m.weights[20]=.2;m.weights[21]=-.1;m.weights[22]=1;m.weights[23]=-1;m.weights[24]=.1;p.weights=[...m.weights];
 const a=api.residualForward(m,-.25,-.7),b=api.residualForward(p,-.25,-.7);
 assert.deepEqual(a.change,[.2,-.1]);near(a.output[0],-.05);near(a.output[1],-.8);near(a.logit,.85);
 assert.deepEqual(b.output,[.2,-.1]);near(b.logit,.4);
 const weights=[...m.weights],z=api.residualForward(m,-.25,-.7,{zeroBranch:true});assert.deepEqual(z.output,[-.25,-.7]);
 assert.deepEqual(api.residualForward(p,-.25,-.7,{zeroBranch:true}).output,[0,0]);assert.deepEqual(m.weights,weights);
});
test('all25 parameters in both structures match independent finite-difference BCE derivatives',()=>{
 const points=createGuide().points,eps=1e-5;
 for(const skip of [false,true]){
  const m=model(skip),g=api.residualGradients(m,points);assert.equal(g.length,25);
  for(let i=0;i<25;i++){
   const a=structuredClone(m),b=structuredClone(m);a.weights[i]+=eps;b.weights[i]-=eps;
   near(g[i],(api.residualMetrics(a,points).loss-api.residualMetrics(b,points).loss)/(2*eps),1e-7);
  }
  const initial=[...m.weights];api.trainResidual(m,points,1);assert.equal(m.epoch,1);
  m.weights.forEach((w,i)=>near(w,initial[i]-.15*g[i]));
  assert.ok(m.weights.slice(0,22).some((w,i)=>w!==initial[i]),'branch must really learn');
  assert.ok(m.weights.slice(22).some((w,i)=>w!==initial[i+22]),'head is not frozen');
 }
});
test('training is deterministic, finite, budgeted and reports actual mistakes without guaranteed wins',()=>{
 const points=createGuide().points,m=model(),copy=model();assert.deepEqual(m.weights,copy.weights);
 for(let i=0;i<10;i++){api.trainResidual(m,points,20);api.trainResidual(copy,points,20);}
 assert.equal(m.epoch,200);assert.deepEqual(m,copy);const final=structuredClone(m);api.trainResidual(m,points,1);assert.deepEqual(m,final);
 const e=api.residualMetrics(m,points);assert.ok(Number.isFinite(e.loss));assert.ok(e.loss>=0);
 assert.ok(e.mistakes.every(i=>Number(api.residualForward(m,points[i].x,points[i].y).probability>=.5)!==points[i].label));
 for(const steps of [0,NaN,2,-1])assert.throws(()=>api.trainResidual(m,points,steps));
 assert.throws(()=>api.residualGradients(m,[]));assert.throws(()=>api.trainResidual(model(),[{x:0,y:0,label:0}],1));
});
