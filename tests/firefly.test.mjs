import test from 'node:test';
import assert from 'node:assert/strict';
import {TAU,createSwarm,stepSwarm,coherence,configureSwarm,perturbSwarm} from '../firefly-core.mjs';

const near=(actual,want,epsilon=1e-10)=>assert.ok(Math.abs(actual-want)<epsilon,`${actual} != ${want}`);
const point=(phase,x=0.5,y=0.5,offset=0)=>({phase,x,y,offset});
const fixture=points=>({points,settings:{coupling:2,radius:2,spread:0},time:0,seed:42,preset:'chorus'});
const advance=(world,steps)=>{for(let i=0;i<steps;i++)world=stepSwarm(world);return world;};

test('coherence measures circular concentration rather than arithmetic phase average',()=>{
 near(coherence([]),0);near(coherence([point(0)]),1);
 near(coherence([point(0),point(Math.PI)]),0);
 near(coherence([point(0),point(TAU-0.02)]),Math.cos(0.01));
 near(coherence([point(0),point(Math.PI/2)]),Math.SQRT1_2);
});
test('uncoupled oscillators advance by their own frequency without mutating the source',()=>{
 const w=fixture([point(1,0,0,0.5)]);w.settings={coupling:0,radius:2,spread:0.4};
 const before=structuredClone(w),next=stepSwarm(w,0.1);
 near(next.points[0].phase,1+(TAU/3.2+0.2)*0.1);near(next.time,0.1);assert.deepEqual(w,before);
});
test('coupling uses a simultaneous snapshot and includes self in normalization',()=>{
 const w=fixture([point(0),point(Math.PI/2)]),next=stepSwarm(w,0.1);
 near(next.points[0].phase,(TAU/3.2+1)*0.1);
 near(next.points[1].phase,Math.PI/2+(TAU/3.2-1)*0.1);
});
test('radius includes its boundary and excludes disconnected neighbors',()=>{
 const w=fixture([point(0,0,0),point(Math.PI/2,0.5,0)]);w.settings.radius=0.8;
 near(stepSwarm(w,0.1).points[0].phase,(TAU/3.2+1)*0.1);
 w.settings.radius=0.79;near(stepSwarm(w,0.1).points[0].phase,TAU/3.2*0.1);
});
test('phase wrapping stays finite and global rotation and point order preserve dynamics',()=>{
 const w=fixture([point(TAU-0.001),point(0.8),point(3)]),next=stepSwarm(w);
 assert.ok(next.points.every(p=>p.phase>=0&&p.phase<TAU));
 const reverse=stepSwarm({...w,points:w.points.toReversed()});
 next.points.forEach((p,i)=>near(p.phase,reverse.points.at(-1-i).phase));
 const rotated=stepSwarm({...w,points:w.points.map(p=>({...p,phase:(p.phase+1)%TAU}))});
 near(coherence(next.points),coherence(rotated.points));
});
test('seeds replay deterministically, presets are fresh and invalid scenes fail',()=>{
 const a=createSwarm('chorus',12),b=createSwarm('chorus',12);
 assert.deepEqual(a,b);assert.notDeepEqual(a.points,createSwarm('chorus',13).points);
 assert.ok(a.points.every(p=>p.x>0&&p.x<1&&p.y>0&&p.y<1&&p.phase>=0&&p.phase<TAU));
 a.points[0].phase=99;assert.notEqual(b.points[0].phase,99);
 assert.throws(()=>createSwarm('missing'));assert.throws(()=>createSwarm('chorus',NaN));
});
test('strong coupling actually increases coherence while an independent population does not collapse',()=>{
 const w=createSwarm('chorus',42),start=coherence(w.points);
 const result=advance(w,1200);assert.ok(coherence(result.points)>0.95);assert.ok(coherence(result.points)>start+0.5);
 const independent=advance(configureSwarm(w,{coupling:0,spread:0}),1200);
 near(coherence(independent.points),start,1e-9);
});
test('isolated islands synchronize locally without forcing a shared global phase',()=>{
 const w=advance(createSwarm('islands',42),1200);
 assert.ok(coherence(w.points.filter(p=>p.x<0.5))>0.9);
 assert.ok(coherence(w.points.filter(p=>p.x>0.5))>0.9);
 assert.ok(w.points.every(p=>Number.isFinite(p.phase)));
});
test('local disturbance changes only the affected disk and never changes positions or time',()=>{
 const w=fixture([point(1,0.2,0.5),point(2,0.9,0.5)]),before=structuredClone(w);
 const aligned=perturbSwarm(w,{x:0.2,y:0.5},'align');
 near(aligned.points[0].phase,0);near(aligned.points[1].phase,2);
 assert.equal(aligned.time,w.time);assert.deepEqual(w,before);
 const a=perturbSwarm(w,{x:0.2,y:0.5}),b=perturbSwarm(w,{x:0.2,y:0.5});assert.deepEqual(a,b);
 assert.notEqual(a.points[0].phase,1);assert.equal(a.points[1].phase,2);
 assert.deepEqual(a.points.map(({x,y})=>({x,y})),w.points.map(({x,y})=>({x,y})));
});
test('configuration preserves the scene, clamps bounded numbers, and rejects nonfinite inputs',()=>{
 const w=createSwarm(),next=configureSwarm(w,{coupling:99,radius:0,spread:-1});
 assert.deepEqual(next.settings,{coupling:3,radius:0.15,spread:0});assert.deepEqual(next.points,w.points);
 assert.notEqual(w.settings.coupling,3);
 for(const v of [NaN,Infinity,'2'])assert.throws(()=>configureSwarm(w,{coupling:v}));
 for(const dt of [-1,NaN,1])assert.throws(()=>stepSwarm(w,dt));
 assert.deepEqual(stepSwarm(w,0),w);
 assert.throws(()=>perturbSwarm(w,{x:NaN,y:0}));assert.throws(()=>perturbSwarm(w,{x:0,y:0},'bad'));
});
