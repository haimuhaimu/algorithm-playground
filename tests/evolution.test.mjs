import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTrack,presetTrack,evaluateGenome,createRace,nextGeneration,positionAt} from '../evolution-core.mjs';

const straight=()=>makeTrack([{x:80,y:240},{x:820,y:240}]);
const zeros=()=>Array(24).fill(0);
test('a straight centered genome finishes with the hand-calculated travel time',()=>{
 const run=evaluateGenome(straight(),zeros(),[]);
 assert.equal(run.finished,true);assert.equal(run.progress,1);
 assert.ok(Math.abs(run.time-740/100)<1e-8);
 assert.deepEqual(positionAt(run,0),{x:80,y:240});
 assert.deepEqual(positionAt(run,1e6),{x:820,y:240});
 assert.ok(Math.abs(positionAt(run,2).x-280)<1e-8);
});
test('swept collision stops before a roadblock and cannot tunnel through a tiny disk',()=>{
 for(const radius of [16,.1]){
  const run=evaluateGenome(straight(),zeros(),[{x:451,y:240,radius}]);
  assert.equal(run.finished,false);assert.ok(run.progress<.51);
  assert.ok(run.samples.at(-1).x<447);
 }
});
test('lateral genes can genuinely avoid an obstacle without leaving the road',()=>{
 const run=evaluateGenome(straight(),Array(24).fill(.8),[{x:450,y:240,radius:16}]);
 assert.equal(run.finished,true);assert.ok(run.time>7.4);
});
test('invalid or unbounded tracks and malformed genomes fail explicitly',()=>{
 for(const points of [[],[{x:70,y:70},{x:71,y:71}],[{x:NaN,y:100},{x:800,y:100}],[{x:-20,y:40},{x:800,y:40}]]){
  assert.throws(()=>makeTrack(points),/track/i);
 }
 assert.throws(()=>evaluateGenome(straight(),[0],[]),/genome/i);
 assert.throws(()=>evaluateGenome(straight(),Array(24).fill(Infinity),[]),/genome/i);
 assert.throws(()=>createRace(straight(),{mutation:NaN}),/mutation/i);
 assert.throws(()=>createRace(straight(),{obstacles:[{x:40,y:40,radius:-1}]}),/obstacle/i);
});
test('resampling rejects collapsed and near-collapsed scribbles despite their long raw length',()=>{
 for(const drift of [0,.1]){
  const points=Array.from({length:51},(_,i)=>({x:100+(i%2)*10,y:200+i*drift}));
  assert.throws(()=>makeTrack(points),/track/i);
 }
});
test('a seed replays real populations and generations without mutating parents',()=>{
 const a=createRace(presetTrack('sweep'),{seed:42}),b=createRace(presetTrack('sweep'),{seed:42});
 assert.deepEqual(a,b);assert.notDeepEqual(a.population,createRace(a.track,{seed:43}).population);
 const frozen=JSON.stringify(a),next=nextGeneration(a);
 assert.equal(JSON.stringify(a),frozen);assert.deepEqual(next,nextGeneration(b));
 assert.equal(next.generation,2);assert.equal(next.population.length,48);
 for(const genome of next.population){assert.equal(genome.length,24);assert.ok(genome.every(x=>Number.isFinite(x)&&Math.abs(x)<=1));}
 assert.notDeepEqual(next.population,a.population);
});
test('two elites survive exactly and bounded crossover/mutation do not alias parents',()=>{
 for(const mutation of [0,1]){
  const race=createRace(presetTrack('sweep'),{mutation}),next=nextGeneration(race);
  const ranked=race.runs.map((r,i)=>({score:r.score,i})).sort((a,b)=>b.score-a.score);
  assert.deepEqual(next.population[0],race.population[ranked[0].i]);
  assert.deepEqual(next.population[1],race.population[ranked[1].i]);
  assert.notEqual(next.population[0],race.population[ranked[0].i]);
  assert.ok(next.best.score>=race.best.score);
  assert.ok(next.population.flat().every(v=>Math.abs(v)<=1));
 }
});
test('selection really improves a fixed course rather than inventing progress',()=>{
 let race=createRace(presetTrack('sweep'),{seed:42,mutation:.18});
 const first=race.best.score,initialTime=race.best.time;
 for(let i=0;i<15;i++){const score=race.best.score;race=nextGeneration(race);assert.ok(race.best.score>=score);}
 assert.ok(race.best.score>first+.015,`fitness: ${first} -> ${race.best.score}`);
 assert.equal(race.best.finished,true);assert.ok(race.best.time<initialTime);
 assert.equal(race.history.length,16);
});
test('course changes create fresh scores and crossed courses never skip route checkpoints',()=>{
 const track=makeTrack([{x:100,y:100},{x:800,y:380},{x:100,y:380},{x:800,y:100}]);
 const run=evaluateGenome(track,zeros(),[]);
 assert.equal(run.finished,true);assert.ok(run.time>20);
 const a=createRace(straight()),b=createRace(straight(),{obstacles:[{x:450,y:240,radius:50}]});
 assert.equal(b.generation,1);assert.equal(b.history.length,1);
 assert.equal(b.runs.filter(r=>r.finished).length,0);assert.ok(b.best.score<a.best.score);
});
test('all presets are fresh and replay positions clamp to actual evaluated paths',()=>{
 for(const name of ['sweep','hairpin','slalom']){
  const a=presetTrack(name),b=presetTrack(name);assert.deepEqual(a,b);assert.notEqual(a.points,b.points);
  const run=evaluateGenome(a,zeros(),[]);
  assert.ok(run.samples.every(p=>Number.isFinite(p.x+p.y+p.t)));
  assert.deepEqual(positionAt(run,-1),{x:run.samples[0].x,y:run.samples[0].y});
 }
 assert.throws(()=>presetTrack('missing'),/preset/i);
 assert.throws(()=>positionAt(evaluateGenome(straight(),zeros(),[]),NaN),/time/i);
});
