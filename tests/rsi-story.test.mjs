import test from 'node:test';
import assert from 'node:assert/strict';
import * as session from '../rsi-session.mjs';
const fresh=()=>{assert.equal(typeof session.createPosterStory,'function','single-poster story is not implemented');return session.createPosterStory();};
const act=(s,type,extra={})=>session.posterStoryAction(s,{type,...extra});
const decision=()=>act(act(act(fresh(),'fix'),'redraw'),'propose');
const proof=choice=>act(decision(),'decide',{decision:choice});

test('repair changes only this poster, redrawing the same brief repeats the old mistake',()=>{
 const original=fresh(),fixed=act(original,'fix'),again=act(fixed,'redraw');
 assert.equal(original.art.species,'rabbit');assert.equal(fixed.art.species,'fox');
 assert.equal(fixed.workflow.identity,'mixed');assert.equal(again.art.species,'rabbit');
 assert.deepEqual(original.job,again.job);assert.equal(again.job.scene,'garden');
 assert.equal(again.job.target.pose,'side');assert.equal(again.repairRecord.species,'fox');
 assert.equal(original.stage,'mistake');assert.equal(again.stage,'repeat');
});
test('proposal is computed from the same work and is not applied before the player chooses',()=>{
 const s=decision();
 assert.equal(s.stage,'decision');assert.equal(s.proposal.attempts[0].patch,'lockIdentity');
 assert.equal(s.proposal.before.art[0].species,'rabbit');assert.equal(s.proposal.after.art[0].species,'fox');
 assert.equal(s.workflow.identity,'mixed');assert.equal(s.workflow.improver,'cycle');
 assert.equal(s.art.species,'rabbit');assert.equal(s.decision,null);
 assert.deepEqual(s.proposal.before.art[0],s.art);
});
test('keep and withdraw produce different next drawings and improvement methods without forcing success',()=>{
 const s=decision(),keep=act(s,'decide',{decision:'keep'}),withdraw=act(s,'decide',{decision:'withdraw'});
 assert.equal(keep.stage,'proof');assert.equal(withdraw.stage,'proof');
 assert.equal(keep.art.species,'fox');assert.equal(withdraw.art.species,'rabbit');
 assert.equal(keep.workflow.improver,'diagnose');assert.equal(withdraw.workflow.improver,'cycle');
 assert.equal(keep.workflow.identity,'locked');assert.equal(withdraw.workflow.identity,'mixed');
 assert.deepEqual(keep.job,withdraw.job);assert.equal(s.decision,null);
 assert.equal(act(keep,'decide',{decision:'withdraw'}),keep);
});
test('same poster receives a new clothing error; guessing does not change the algorithm result',()=>{
 const kept=act(proof('keep'),'challenge'),rejected=act(proof('withdraw'),'challenge');
 assert.equal(kept.art.coat,'coral');assert.equal(kept.art.species,'fox');assert.equal(kept.art.pose,'side');
 assert.deepEqual(kept.art,rejected.art);assert.deepEqual(kept.job.target,rejected.job.target);
 const wrong=act(kept,'predict',{issue:'identity'}),right=act(kept,'predict',{issue:'outfit'});
 assert.deepEqual(wrong.art,right.art);assert.equal(wrong.transfer,null);
 const a=act(wrong,'run'),b=act(right,'run'),c=act(act(rejected,'predict',{issue:'outfit'}),'run');
 assert.deepEqual(a.transfer,b.transfer);assert.equal(b.transfer.attempts[0].patch,'lockOutfit');
 assert.equal(b.transfer.after.passed,1);assert.equal(c.transfer.after.passed,0);
 assert.equal(c.transfer.attempts[0].patch,'frontPose');assert.equal(c.art.coat,'coral');assert.equal(c.art.pose,'side');
 assert.equal(b.art.coat,'green');assert.equal(b.stage,'ending');
});
test('invalid actions cannot skip the choice or the independent prediction',()=>{
 let s=fresh();for(const type of ['decide','run','challenge','propose','redraw','revisit'])assert.equal(act(s,type),s);
 s=decision();assert.equal(act(s,'decide',{decision:'auto'}),s);assert.equal(act(s,'challenge'),s);
 s=act(proof('keep'),'challenge');assert.equal(act(s,'run'),s);
 assert.equal(act(s,'predict',{issue:'all'}),s);assert.equal(act(s,'fix'),s);
});
test('returning to the same decision clears later evidence but preserves the manual repair',()=>{
 const end=act(act(act(proof('keep'),'challenge'),'predict',{issue:'outfit'}),'run');
 const back=act(end,'revisit');
 assert.equal(back.stage,'decision');assert.equal(back.workflow.identity,'mixed');
 assert.equal(back.prediction,null);assert.equal(back.transfer,null);assert.equal(back.decision,null);
 assert.equal(back.repairRecord.species,'fox');assert.deepEqual(back.proposal,decision().proposal);
 assert.equal(act(back,'decide',{decision:'withdraw'}).art.species,'rabbit');
 assert.deepEqual(act(end,'reset'),fresh());assert.equal(end.art.coat,'green');
});
test('view keeps the same scene, exposes the pending pair and never reports a withdrawn rule as learned',()=>{
 const s=decision(),v=session.posterStoryView(s);
 assert.equal(v.before.species,'rabbit');assert.equal(v.after.species,'fox');assert.equal(v.chapter,2);
 for(const choice of ['keep','withdraw']){
  let state=proof(choice);
  const view=session.posterStoryView(state);
  assert.equal(view.after.species,choice==='keep'?'fox':'rabbit');assert.equal(view.before.scene,'garden');
  assert.equal(view.after.scene,'garden');assert.equal(view.decision,choice);
 }
});
