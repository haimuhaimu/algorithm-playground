import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../rsi-core.mjs';
test('reference mixing creates visible character errors',()=>{
 const w=core.createWorkflow(),jobs=core.briefs('first'),art=core.produce(w,jobs);
 assert.deepEqual(art.map(a=>[a.species,a.coat,a.pose]),[['fox','green','front'],['rabbit','green','side'],['fox','coral','jump']]);
 assert.deepEqual(core.assess(art,jobs).issues,[[],['identity'],['outfit']]);
 assert.equal(core.assess(art,jobs).passed,1);
});
test('local repair changes only chosen attribute, not original or future workflow',()=>{
 const w=core.createWorkflow(),jobs=core.briefs('first'),art=core.produce(w,jobs);
 const fixed=core.retouch(art[1],jobs[1],'identity');
 assert.equal(fixed.species,'fox');assert.equal(fixed.pose,'side');assert.equal(art[1].species,'rabbit');
 assert.equal(core.produce(w,jobs)[1].species,'rabbit');
 assert.throws(()=>core.retouch(art[1],jobs[1],'unknown'));
});
test('redrawing replaces the image and can undo previously correct details',()=>{
 const w=core.createWorkflow(),job=core.briefs('first')[1];
 const original=core.draw(w,job,0),redraw=core.draw(w,job,1);
 assert.equal(original.species,'rabbit');assert.equal(redraw.species,'fox');
 assert.equal(original.coat,'green');assert.equal(redraw.coat,'coral');
 assert.deepEqual(core.draw(w,job,1),redraw);
});
test('all initial posters have a visibly different first redraw, including the moon scene',()=>{
 const w=core.createWorkflow();
 for(const job of core.briefs('first')){
  const first=core.draw(w,job),again=core.draw(w,job,1);
  assert.notDeepEqual([first.species,first.coat,first.pose],[again.species,again.coat,again.pose],job.id);
 }
});
test('equal-budget methods create different candidates and reject regressions',()=>{
 const w=core.createWorkflow(),jobs=core.briefs('method');
 const old=core.improve(w,jobs,'cycle',2),smart=core.improve(w,jobs,'diagnose',2);
 assert.equal(old.before.passed,0);assert.equal(old.after.passed,1);assert.equal(smart.after.passed,3);
 assert.equal(old.attempts.length,2);assert.equal(smart.attempts.length,2);
 assert.equal(old.attempts[0].accepted,false);assert.equal(old.workflow.pose,'reference');
 assert.deepEqual(smart.attempts.map(a=>a.patch),['lockIdentity','lockOutfit']);
 assert.equal(w.identity,'mixed');assert.equal(smart.workflow.improver,'diagnose');
});
test('inherited diagnosis selects a different repair on held-out pose tasks',()=>{
 const w=core.improve(core.createWorkflow(),core.briefs('method'),'diagnose',2).workflow;
 const next=core.improve(w,core.briefs('transfer'),w.improver,1);
 assert.equal(next.before.passed,0);assert.equal(next.attempts[0].patch,'readPose');assert.equal(next.after.passed,3);
 assert.deepEqual(next.after.issues,[[],[],[]]);assert.equal(w.pose,'reference');
});
test('fixed method cannot secretly borrow diagnostic solution on next task',()=>{
 const w=core.improve(core.createWorkflow(),core.briefs('method'),'cycle',2).workflow;
 const next=core.improve(w,core.briefs('transfer'),w.improver,1);
 assert.equal(next.before.passed,0);assert.equal(next.after.passed,0);assert.equal(next.attempts[0].patch,'frontPose');
});
test('bounded budgets and invalid groups are rejected',()=>{
 for(const n of [-1,1.5,5,NaN])assert.throws(()=>core.improve(core.createWorkflow(),core.briefs('first'),'cycle',n));
 assert.throws(()=>core.briefs('unknown'));assert.throws(()=>core.improve(core.createWorkflow(),core.briefs('first'),'magic',1));
 const zero=core.improve(core.createWorkflow(),core.briefs('first'),'diagnose',0);
 assert.equal(zero.attempts.length,0);assert.equal(zero.after.passed,1);
});
