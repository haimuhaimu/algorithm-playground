import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../evolution-core.mjs';

test('every non-elite child records the real tournament winners and inherited alleles',()=>{
 const parent=core.createRace(),next=core.nextGeneration(parent);
 assert.ok(Array.isArray(next.births),'birth records must accompany the actual population');
 assert.equal(next.births.length,48);
 assert.equal(next.births[0].kind,'elite');
 for(let i=2;i<48;i++){
  const birth=next.births[i];assert.equal(birth.kind,'child');
  for(const p of birth.parents){
   assert.equal(p.candidates.length,4);
   assert.ok(p.candidates.includes(p.index));
   assert.ok(p.candidates.every(j=>parent.runs[j].score<=parent.runs[p.index].score));
   assert.deepEqual(p.genes,parent.population[p.index]);
  }
  assert.equal(birth.sources.length,24);
  birth.sources.forEach((source,j)=>assert.equal(birth.inherited[j],birth.parents[source].genes[j]));
  const reconstructed=[...birth.inherited];
  for(const mutation of birth.mutations){assert.equal(mutation.before,reconstructed[mutation.index]);reconstructed[mutation.index]=mutation.after;}
  assert.deepEqual(reconstructed,next.population[i]);
 }
 // Instrumentation must not consume extra RNG or silently change this existing race.
 assert.equal(next.seed,3880559920);
 assert.deepEqual(next.population[2].slice(0,4),[.28169643180444837,-.7747147548943758,.7639907873235643,.17977458118693904]);
});

test('zero mutation reports no changes and does not fabricate a mutation for the lesson',()=>{
 const next=core.nextGeneration(core.createRace(undefined,{mutation:0}));
 assert.ok(next.births);
 for(let i=2;i<48;i++){assert.deepEqual(next.births[i].mutations,[]);assert.deepEqual(next.births[i].inherited,next.population[i]);}
});

test('birth evidence does not alias the old population or accumulate ancestor trees',()=>{
 const race=core.createRace(),next=core.nextGeneration(race);assert.ok(next.births);
 const first=next.births[2].parents[0],value=first.genes[0];
 race.population[first.index][0]=value===0?1:0;assert.equal(first.genes[0],value);
 const later=core.nextGeneration(next);assert.equal(later.births[2].parentGeneration,2);
 assert.equal(later.births[2].parents[0].births,undefined);
});

test('inspection evaluates parents, inherited route and child under the same obstacles',()=>{
 assert.equal(typeof core.inspectBirth,'function');
 const track=core.makeTrack([{x:80,y:240},{x:820,y:240}]);
 const race=core.nextGeneration(core.createRace(track,{obstacles:[{x:450,y:240,radius:50}]}));
 const view=core.inspectBirth(race,2);
 assert.equal(view.childRun.finished,false);
 assert.deepEqual(view.childRun,race.runs[2]);
 assert.equal(view.inheritedRun.finished,false);
 assert.ok(view.parents.every(p=>p.run.finished===false));
 assert.equal(view.childRun.route.length,26);
 assert.ok(view.childRun.samples.at(-1).progress<.6);
 assert.throws(()=>core.inspectBirth(race,0),/child/i);
 assert.throws(()=>core.inspectBirth(race,48),/child/i);
 assert.throws(()=>core.inspectBirth(core.createRace(),2),/child/i);
});

test('run comparisons never label an early crash as a faster finish',()=>{
 assert.equal(typeof core.compareRuns,'function');
 const finish={finished:true,time:10,progress:1,score:2.6};
 const crash={finished:false,time:1,progress:.2,score:.2};
 assert.deepEqual(core.compareRuns(finish,{...finish,time:8}),{outcome:'faster',seconds:2});
 assert.deepEqual(core.compareRuns(finish,{...finish,time:12}),{outcome:'slower',seconds:2});
 assert.equal(core.compareRuns(finish,crash).outcome,'lost-finish');
 assert.equal(core.compareRuns(crash,finish).outcome,'gained-finish');
 assert.deepEqual(core.compareRuns(crash,{...crash,progress:.4}),{outcome:'further',progress:.2});
 assert.equal(core.compareRuns(crash,crash).outcome,'same-progress');
});
