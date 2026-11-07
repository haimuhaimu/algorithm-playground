import test from 'node:test';
import assert from 'node:assert/strict';
import {draw,createWorkflow} from '../rsi-core.mjs';
import {createPosterStory,posterStoryAction,posterStoryView} from '../rsi-session.mjs';
const act=(s,type,extra={})=>posterStoryAction(s,{type,...extra});
const trial=()=>act(act(act(createPosterStory(),'fix'),'redraw'),'propose');
const challenge=()=>act(trial(),'challenge');
const tested=(prediction='green')=>act(act(challenge(),'predict',{prediction}),'run');
const ending=decision=>act(tested(),'decide',{decision});

test('a fixed-green candidate ignores a coral target while the original workflow reads its reference',()=>{
 const job={id:'new',scene:'garden',target:{species:'fox',coat:'coral',pose:'side'},reference:{species:'fox',coat:'coral',pose:'side'}};
 const original=createWorkflow(),candidate={...original,outfit:'fixed-green'};
 assert.equal(draw(original,job).coat,'coral');assert.equal(draw(candidate,job).coat,'green');
 assert.equal(original.outfit,'mixed');
});
test('manual clothing repair changes this poster only and the old mistake returns on redraw',()=>{
 const s=createPosterStory(),fixed=act(s,'fix'),again=act(fixed,'redraw');
 assert.equal(s.art.coat,'coral');assert.equal(fixed.art.coat,'green');assert.equal(again.art.coat,'coral');
 assert.equal(fixed.workflow.outfit,'mixed');assert.equal(again.repairRecord.coat,'green');
 assert.deepEqual(s.job,again.job);assert.equal(s.art.species,'fox');assert.equal(s.art.pose,'side');
});
test('first commission succeeds in a trial but no rule or improvement method is installed',()=>{
 const s=trial();
 assert.equal(s.stage,'trial');assert.equal(s.proposal.before.passed,0);assert.equal(s.proposal.after.passed,1);
 assert.equal(s.proposal.workflow.outfit,'fixed-green');assert.equal(s.proposal.workflow.improver,'cycle');
 assert.equal(s.workflow.outfit,'mixed');assert.equal(s.workflow.improver,'cycle');assert.equal(s.decision,null);
 assert.equal(posterStoryView(s).after.coat,'green');
});
test('new commission preserves the scene and pose but visibly asks for coral, before the player decides',()=>{
 const s=challenge();assert.equal(s.stage,'challenge');assert.equal(s.job.target.coat,'coral');
 assert.equal(s.job.target.species,'fox');assert.equal(s.job.target.pose,'side');assert.equal(s.job.scene,'garden');
 assert.equal(s.workflow.outfit,'mixed');assert.equal(s.repairRecord.coat,'green');assert.equal(s.transfer,null);
 assert.equal(posterStoryView(s).before,null);assert.equal(s.decision,null);
});
test('identical new commission exposes a real side effect; predictions cannot steer the drawing',()=>{
 const wrong=tested('brief'),right=tested('green');
 assert.equal(right.stage,'decision');assert.deepEqual(wrong.transfer,right.transfer);
 assert.equal(right.transfer.before.passed,1);assert.equal(right.transfer.after.passed,0);
 assert.equal(right.transfer.before.art[0].coat,'coral');assert.equal(right.transfer.after.art[0].coat,'green');
 assert.equal(right.workflow.outfit,'mixed');assert.equal(right.decision,null);
 const v=posterStoryView(right);assert.equal(v.before.coat,'coral');assert.equal(v.after.coat,'green');assert.deepEqual(v.issues,['outfit']);
});
test('decision is gated on the trial result and invalid or repeated actions do not advance it',()=>{
 for(const s of [createPosterStory(),trial(),challenge()]){
  for(const decision of ['keep','withdraw'])assert.equal(act(s,'decide',{decision}),s);
 }
 const s=challenge();assert.equal(act(s,'run'),s);assert.equal(act(s,'predict',{prediction:'auto'}),s);
 assert.equal(act(tested(),'decide',{decision:'auto'}).stage,'decision');
 const end=ending('keep');assert.equal(act(end,'decide',{decision:'withdraw'}),end);
 assert.equal(act(end,'run'),end);assert.equal(act(trial(),'revisit').stage,'trial');
});
test('keep really installs the flawed rule, withdraw preserves the old rule, both retain the repaired original',()=>{
 const s=tested(),keep=act(s,'decide',{decision:'keep'}),withdraw=act(s,'decide',{decision:'withdraw'});
 assert.equal(keep.stage,'ending');assert.equal(withdraw.stage,'ending');
 assert.equal(keep.art.coat,'green');assert.equal(withdraw.art.coat,'coral');assert.deepEqual(keep.job,withdraw.job);
 assert.equal(keep.workflow.outfit,'fixed-green');assert.equal(withdraw.workflow.outfit,'mixed');
 assert.equal(keep.workflow.improver,'cycle');assert.equal(withdraw.workflow.improver,'cycle');
 assert.equal(keep.repairRecord.coat,'green');assert.equal(withdraw.repairRecord.coat,'green');
 assert.equal(s.workflow.outfit,'mixed');assert.equal(s.decision,null);
});
test('revisit from either ending preserves the same test evidence and allows the opposite genuine outcome',()=>{
 for(const decision of ['keep','withdraw']){
  const end=ending(decision),back=act(end,'revisit');
  assert.equal(back.stage,'decision');assert.equal(back.workflow.outfit,'mixed');assert.equal(back.decision,null);
  assert.deepEqual(back.transfer,end.transfer);assert.deepEqual(back.job,end.job);assert.equal(back.repairRecord.coat,'green');
  const other=act(back,'decide',{decision:decision==='keep'?'withdraw':'keep'});
  assert.equal(other.art.coat,decision==='keep'?'coral':'green');
  assert.deepEqual(act(end,'reset'),createPosterStory());
 }
});
