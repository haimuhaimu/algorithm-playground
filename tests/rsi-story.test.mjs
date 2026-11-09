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
 assert.deepEqual(s.job,again.job);assert.equal(s.art.species,'bobby');assert.equal(s.art.pose,'side');
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
 assert.equal(s.job.target.species,'bobby');assert.equal(s.job.target.pose,'side');assert.equal(s.job.scene,'garden');
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
test('the whole scarf lesson keeps Bobby and the same pose while only color changes',()=>{
 for(const decision of ['keep','withdraw']){
  let s=createPosterStory();
  const inspect=()=>{
   assert.equal(s.job.target.species,'bobby');assert.equal(s.job.reference.species,'bobby');
   const artworks=[s.art,s.original,s.repairRecord,s.proposal?.before.art[0],s.proposal?.after.art[0],s.transfer?.before.art[0],s.transfer?.after.art[0]].filter(Boolean);
   for(const art of artworks){assert.equal(art.species,'bobby');assert.equal(art.pose,'side');assert.equal(art.scene,'garden');}
  };
  inspect();
  for(const type of ['fix','redraw','propose','challenge']){s=act(s,type);inspect();}
  s=act(s,'predict',{prediction:'green'});s=act(s,'run');inspect();
  s=act(s,'decide',{decision});inspect();
  assert.equal(s.art.coat,decision==='keep'?'green':'coral');assert.equal(s.repairRecord.coat,'green');
  s=act(s,'revisit');inspect();s=act(s,'decide',{decision:decision==='keep'?'withdraw':'keep'});inspect();
  s=act(s,'reset');inspect();assert.equal(s.repairRecord,null);
 }
});
test('editing a candidate does not install it and an untested selection cannot be kept',()=>{
 const s=tested(),next=act(s,'select-rule',{rule:'brief'});
 assert.equal(next.selectedRule,'brief');assert.deepEqual(next.workflow,s.workflow);
 assert.deepEqual(next.art,s.art);assert.deepEqual(next.proposal,s.proposal);assert.deepEqual(next.transfer,s.transfer);
 assert.equal(posterStoryView(next).pendingRule,true);
 assert.equal(act(next,'decide',{decision:'keep'}),next);
 assert.equal(act(next,'decide',{decision:'withdraw'}).workflow.outfit,'mixed');
 for(const state of [createPosterStory(),trial(),challenge(),ending('keep')]){
  assert.equal(act(state,'select-rule',{rule:'brief'}),state);assert.equal(act(state,'retest'),state);
 }
 assert.equal(act(s,'select-rule',{rule:'automatic'}),s);
});
test('reading the brief is tested against both actual commissions without rewriting the initial failure',()=>{
 const s=tested(),next=act(act(s,'select-rule',{rule:'brief'}),'retest');
 assert.equal(next.retest.rule,'brief');assert.equal(next.retest.workflow.outfit,'locked');
 assert.deepEqual(next.retest.jobs,[s.proposal.job,s.job]);
 assert.deepEqual(next.retest.jobs.map(j=>[j.id,j.target.coat,j.reference.coat]),[
  ['bobby-garden','green','coral'],['bobby-garden','coral','coral']
 ]);
 assert.deepEqual([next.retest.first.before.passed,next.retest.second.before.passed],[0,1]);
 assert.deepEqual([next.retest.first.after.passed,next.retest.second.after.passed],[1,1]);
 assert.deepEqual([next.retest.first.after.art[0].coat,next.retest.second.after.art[0].coat],['green','coral']);
 assert.deepEqual(next.proposal,s.proposal);assert.deepEqual(next.transfer,s.transfer);
 assert.deepEqual(next.workflow,s.workflow);assert.deepEqual(next.repairRecord,s.repairRecord);
 assert.equal(posterStoryView(next).after.coat,'coral');assert.deepEqual(posterStoryView(next).issues,[]);
 assert.equal(posterStoryView(next).pendingRule,false);
});
test('switching away from a tested rule blocks keep until that selection has matching results',()=>{
 const brief=act(act(tested(),'select-rule',{rule:'brief'}),'retest');
 const selected=act(brief,'select-rule',{rule:'fixed-green'});
 assert.equal(posterStoryView(selected).pendingRule,true);
 assert.equal(act(selected,'decide',{decision:'keep'}),selected);
 assert.equal(posterStoryView(selected).after.coat,'coral','an edit must not fabricate an unrun green output');
 const fixed=act(selected,'retest');
 assert.deepEqual([fixed.retest.first.after.art[0].coat,fixed.retest.second.after.art[0].coat],['green','green']);
 assert.deepEqual([fixed.retest.first.after.passed,fixed.retest.second.after.passed],[1,0]);
 assert.equal(act(fixed,'decide',{decision:'keep'}).workflow.outfit,'fixed-green');
});
test('keep installs the tested brief-reading candidate while withdraw preserves the baseline and saved work',()=>{
 const s=act(act(tested(),'select-rule',{rule:'brief'}),'retest');
 for(const decision of ['keep','withdraw']){
  const end=act(s,'decide',{decision});
  assert.equal(end.stage,'ending');assert.equal(end.workflow.outfit,decision==='keep'?'locked':'mixed');
  assert.equal(end.art.coat,'coral');assert.equal(end.workflow.improver,'cycle');
  assert.deepEqual(end.repairRecord,s.repairRecord);assert.deepEqual(end.original,s.original);
  assert.deepEqual(end.retest,s.retest);assert.deepEqual(end.transfer,s.transfer);
  const back=act(end,'revisit');
  assert.equal(back.selectedRule,'brief');assert.equal(back.workflow.outfit,'mixed');
  assert.deepEqual(back.retest,s.retest);assert.equal(posterStoryView(back).pendingRule,false);
  assert.equal(act(back,'decide',{decision:decision==='keep'?'withdraw':'keep'}).workflow.outfit,decision==='keep'?'mixed':'locked');
  assert.deepEqual(act(end,'reset'),createPosterStory());
 }
});
test('retests retain the original non-default brief instead of rebuilding a hard-coded example',()=>{
 let s=createPosterStory();s.job.id='another-brief';s.job.scene='moon';
 s.job.target.pose='front';s.job.reference.pose='front';
 s.art=draw(s.workflow,s.job);s.original={...s.art};
 for(const type of ['fix','redraw','propose','challenge'])s=act(s,type);
 s=act(act(s,'predict',{prediction:'brief'}),'run');
 const expected=structuredClone(s.proposal.job),next=act(act(s,'select-rule',{rule:'brief'}),'retest');
 assert.deepEqual(next.retest.jobs[0],expected);
 assert.equal(next.retest.first.after.art[0].id,'another-brief');
 for(const report of [next.retest.first,next.retest.second]){
  assert.equal(report.after.art[0].scene,'moon');assert.equal(report.after.art[0].pose,'front');
  assert.equal(report.after.art[0].species,'bobby');assert.equal(report.after.art[0].variation,0);
 }
 next.retest.jobs[0].target.coat='coral';
 assert.equal(s.proposal.job.target.coat,'green','captured retest jobs must not alias the original evidence');
});
