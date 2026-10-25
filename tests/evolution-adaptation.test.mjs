import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../evolution-core.mjs';

function fixture(){
 const track=core.makeTrack([{x:80,y:240},{x:820,y:240}]);
 const population=Array.from({length:48},(_,i)=>Array(24).fill(i===0?0:.8));
 const runs=population.map(g=>core.evaluateGenome(track,g));
 return {...core.createRace(track),population,runs,best:runs[0],bestIndex:0,generation:7,seed:987,
  history:[{generation:7,score:runs[0].score,time:runs[0].time,progress:1,finished:48}]};
}
const block=[{x:450,y:240,radius:16}];
test('roadblock re-scores the exact population without rewinding generation or consuming randomness',()=>{
 assert.equal(typeof core.changeObstacles,'function');
 const before=fixture(),original=structuredClone(before),after=core.changeObstacles(before,block);
 assert.deepEqual(after.population,original.population);assert.notEqual(after.population[0],before.population[0]);
 assert.equal(after.generation,7);assert.equal(after.seed,987);assert.equal(after.mutation,.18);
 assert.equal(after.runs[0].finished,false);assert.ok(after.runs[0].progress<.5);
 assert.equal(after.runs[1].finished,true);assert.equal(after.bestIndex,1);
 assert.equal(after.history.length,1);assert.equal(after.history[0].finished,47);
 assert.deepEqual(before,original);assert.equal(after.births,undefined);
 assert.equal(after.adaptation.oldRun.finished,true);assert.ok(Math.abs(after.adaptation.oldRun.time-7.4)<1e-8);
 assert.equal(after.adaptation.oldFinished,48);assert.equal(after.adaptation.initialFinished,47);
 assert.equal(after.adaptation.newRun.finished,false);
});
test('breeding selects elites using new fitness and keeps the old route unchanged for comparison',()=>{
 assert.equal(typeof core.changeObstacles,'function');
 const changed=core.changeObstacles(fixture(),block),snapshot=structuredClone(changed.adaptation);
 const next=core.nextGeneration(changed);
 assert.deepEqual(next.population[0],Array(24).fill(.8));assert.equal(next.generation,8);
 assert.deepEqual(next.adaptation,snapshot);assert.deepEqual(next,core.nextGeneration(changed));
 assert.deepEqual(next.births[2].parents[0].genes,changed.population[next.births[2].parents[0].index]);
});
test('repeated edits and removal create independent environment checkpoints without mixing history',()=>{
 assert.equal(typeof core.changeObstacles,'function');
 const before=fixture(),obstacles=structuredClone(block),a=core.changeObstacles(before,obstacles);
 const frozen=structuredClone(a);
 obstacles[0].x=10;before.population[0][0]=1;before.best.samples[0].x=0;
 assert.equal(a.obstacles[0].x,450);assert.equal(a.adaptation.genome[0],0);assert.equal(a.adaptation.oldRun.samples[0].x,80);
 const b=core.changeObstacles(a,[]);
 assert.equal(b.generation,7);assert.equal(b.history.length,1);assert.equal(b.runs[0].finished,true);
 assert.equal(b.adaptation.oldObstacles.length,1);assert.equal(b.adaptation.oldFinished,47);
 assert.equal(b.adaptation.initialFinished,48);assert.equal(b.environment,2);assert.deepEqual(a,frozen);
});
test('a completely blocked route stays honestly unfinished after continuation and invalid edits do not mutate',()=>{
 assert.equal(typeof core.changeObstacles,'function');
 const race=fixture(),frozen=structuredClone(race);
 assert.throws(()=>core.changeObstacles(race,[{x:450,y:240,radius:NaN}]),/obstacle/i);
 assert.deepEqual(race,frozen);
 let changed=core.changeObstacles(race,[{x:450,y:240,radius:60}]);
 for(let i=0;i<3;i++)changed=core.nextGeneration(changed);
 assert.equal(changed.runs.filter(r=>r.finished).length,0);assert.equal(changed.adaptation.newRun.finished,false);
});
test('guided roadblock uses the actual old route, respects endpoints and cannot exceed the obstacle limit',()=>{
 assert.equal(typeof core.suggestRoadblock,'function');
 const race=fixture(),point=core.suggestRoadblock(race);
 assert.ok(Math.abs(point.x-450)<3);assert.equal(point.y,240);assert.equal(point.radius,16);
 const changed=core.changeObstacles(race,[point]);assert.equal(changed.adaptation.newRun.finished,false);
 assert.equal(core.suggestRoadblock({...race,obstacles:Array(12).fill(point)}),null);
 const stopped=core.changeObstacles(race,[{x:90,y:240,radius:16}]);assert.equal(core.suggestRoadblock(stopped),null);
});
