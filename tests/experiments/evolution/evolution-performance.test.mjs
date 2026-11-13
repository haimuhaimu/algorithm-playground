import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeTrack,evaluateGenome,createRace,nextGeneration,presetTrack,changeObstacles,suggestRoadblock} from '../../../src/experiments/evolution/evolution-core.mjs';

// Source-only tests do not race the build used by browser/UI verification.
const source=await readFile(new URL('../../../src/experiments/evolution/evolution-core.mjs',import.meta.url),'utf8');
const load=code=>import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const {boundaryBlocked}=await load(source+'\nexport {blocked as boundaryBlocked};');
// Freeze the pre-optimization collision predicate, not a second gameplay model.
// The public race/selection pipeline stays shared; only this numerical kernel
// is replaced so full samples, scores, RNG, births and records can be compared.
const legacyBlocked=`function blocked(p,track,obstacles){
 if(obstacles.some(o=>Math.hypot(p.x-o.x,p.y-o.y)<=o.radius+CAR_RADIUS+1))return true;
 return !track.points.slice(1).some((b,i)=>{
  const a=track.points[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const t=den?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1):0;
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)<=ROAD_RADIUS-CAR_RADIUS-1;
 });
}
`;
const legacySource=source.replace(/function blocked\(p,track,obstacles\)\{[\s\S]*?(?=export function evaluateGenome)/,legacyBlocked);
assert.notEqual(legacySource,source,'the differential harness must install the frozen collision predicate');
const legacy=await load(legacySource+'\nexport {blocked as boundaryBlocked};');

test('a centered race avoids per-sample road-segment hypot work while keeping its real result',()=>{
 const track=makeTrack([{x:80,y:240},{x:820,y:240}]),original=Math.hypot;
 let calls=0,run;
 try{
  Math.hypot=(...args)=>{calls++;return original(...args);};
  run=evaluateGenome(track,Array(24).fill(0));
 }finally{Math.hypot=original;}
 assert.equal(run.finished,true);
 assert.ok(Math.abs(run.time-7.4)<1e-8);
 // This path is far inside the road: only route geometry needs a norm.
 // A call budget tied to route vertices catches restoring the sample×segment
 // hot loop without a flaky wall-clock or device-speed assertion.
 assert.ok(calls<=track.points.length*2,`${calls} hypot calls for ${track.points.length} route vertices`);
});

test('road boundary keeps legacy hypot decisions even when squared rounding disagrees',()=>{
 const degenerate={points:[{x:0,y:0},{x:0,y:0}]};
 const fixtures=[
  {x:37,y:0,blocked:false},
  {x:37-1e-10,y:0,blocked:false},
  {x:37+1e-10,y:0,blocked:true},
  // Hand-checked opposite ULP cases: hypot is 37, then 37.00000000000001.
  {x:36.999934268454155,y:0.0697433156093402,blocked:false},
  {x:36.99999116275657,y:0.025572562164266156,blocked:true}
 ];
 for(const {x,y,blocked} of fixtures)assert.equal(boundaryBlocked({x,y},degenerate,[]),blocked);
});

test('road segment projection clamps endpoints and tolerates a duplicate vertex',()=>{
 const track={points:[{x:0,y:0},{x:0,y:0},{x:100,y:0}]};
 for(const [point,blocked] of [
  [{x:50,y:37},false],[{x:50,y:37.001},true],
  [{x:-37,y:0},false],[{x:-37.001,y:0},true],
  [{x:137,y:0},false],[{x:137.001,y:0},true]
 ])assert.equal(boundaryBlocked(point,track,[]),blocked);
 // Obstacles retain their separate inclusive radius + car + clearance rule.
 assert.equal(boundaryBlocked({x:20,y:0},track,[{x:0,y:0,radius:15}]),true);
 assert.equal(boundaryBlocked({x:20.001,y:0},track,[{x:0,y:0,radius:15}]),false);
});

test('rotated near-boundary projections preserve the old predicate on both sides of the rounding band',()=>{
 for(let i=0;i<256;i++){
  const angle=i*Math.PI/128,dx=Math.cos(angle),dy=Math.sin(angle);
  const a={x:450,y:240},b={x:a.x+100*dx,y:a.y+100*dy},track={points:[a,b]};
  for(const along of [0,.5,1])for(const offset of [-64,-2,0,2,64]){
   const radius=37*(1+offset*Number.EPSILON);
   const p={x:a.x+along*(b.x-a.x)-radius*dy,y:a.y+along*(b.y-a.y)+radius*dx};
   assert.equal(boundaryBlocked(p,track,[]),legacy.boundaryBlocked(p,track,[]),`${i}/${along}/${offset}`);
  }
 }
});

test('full races and adaptation records exactly match the old kernel across presets, seeds and generations',()=>{
 for(const preset of ['sweep','hairpin','slalom'])for(const seed of [1,42,12345]){
  let current=createRace(presetTrack(preset),{seed}),before=legacy.createRace(legacy.presetTrack(preset),{seed});
  assert.deepEqual(current,before,`${preset}/${seed}/initial`);
  for(let generation=0;generation<6;generation++){
   if(generation===3){
    const obstacle=suggestRoadblock(current);
    if(obstacle){current=changeObstacles(current,[obstacle]);before=legacy.changeObstacles(before,[obstacle]);assert.deepEqual(current,before,`${preset}/${seed}/roadblock`);}
   }
   current=nextGeneration(current);before=legacy.nextGeneration(before);
   assert.deepEqual(current,before,`${preset}/${seed}/generation-${generation+2}`);
  }
 }
});
