import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,createRecord,pull,chooseDecision} from '../mining-core.mjs';
import * as lesson from '../mining-shared-evidence.mjs';
const requireLesson=()=>assert.equal(typeof lesson.createSharedCase,'function','shared-evidence lesson must expose a reproducible case');
test('the common case is a real recorded history, not a hand-waved scoreboard',()=>{
 requireLesson();
 const c=lesson.createSharedCase();let record=createRecord();
 for(const arm of [0,1,2,3,4,0,2,3,0,4,0,2,3,0,1,0,2,3,0,0])record=pull(createWorld(265),record,arm);
 assert.deepEqual(c.record,record);assert.equal(c.round,21);assert.equal(c.seed,265);
 assert.deepEqual(c.record.counts,[8,2,4,4,2]);assert.deepEqual(c.record.wins,[6,1,1,0,0]);
 assert.equal('outcomes' in c,false);assert.equal('probabilities' in c,false);
});
test('human, greedy and UCB compare one identical snapshot without using the next reward',()=>{
 requireLesson();const c=lesson.createSharedCase(),before=structuredClone(c.record);
 for(let arm=0;arm<5;arm++){
  const comparison=lesson.compareSharedChoice(arm);
  assert.equal(comparison.choice,arm);assert.deepEqual(comparison.before,before);
  assert.deepEqual(comparison.greedy,chooseDecision(before,'greedy'));
  assert.deepEqual(comparison.ucb,chooseDecision(before,'ucb'));
  assert.equal(comparison.greedy.arm,0);assert.equal(comparison.ucb.arm,1);
  assert.equal('reward' in comparison,false);assert.equal('after' in comparison,false);
 }
});
test('each flight branches from the same twenty samples and never rerolls on retry',()=>{
 requireLesson();
 for(let arm=0;arm<5;arm++){
  const result=lesson.resolveSharedChoice(arm),world=createWorld(265),before=lesson.createSharedCase().record;
  assert.deepEqual(result.you,pull(world,before,arm));
  assert.deepEqual(result.greedy,pull(world,before,0));assert.deepEqual(result.ucb,pull(world,before,1));
  assert.equal(result.you.history.length,21);assert.equal(result.greedy.history.length,21);
  assert.deepEqual(lesson.resolveSharedChoice(arm),result);
 }
 assert.equal(lesson.resolveSharedChoice(0).you.history.at(-1).reward,0);
 assert.equal(lesson.resolveSharedChoice(1).you.history.at(-1).reward,1);
});
test('callers cannot mutate the fixed teaching evidence and invalid choices are rejected',()=>{
 requireLesson();const c=lesson.createSharedCase();c.record.counts[0]=999;c.record.history[0].arm=4;
 const comparison=lesson.compareSharedChoice(2);comparison.before.wins[0]=999;comparison.ucb.scores[1]=999;
 assert.equal(lesson.createSharedCase().record.counts[0],8);assert.equal(lesson.compareSharedChoice(2).before.wins[0],6);
 for(const bad of [-1,5,1.5,NaN,'1',null])assert.throws(()=>lesson.compareSharedChoice(bad),/星球/);
});
test('one observed empty trip updates both policies from the same record without forcing a switch',()=>{
 assert.equal(typeof lesson.compareObservedFeedback,'function');
 const record=lesson.createSharedCase().record,snapshot=structuredClone(record);
 const c=lesson.compareObservedFeedback(record,{arm:0,reward:0});
 assert.deepEqual(c.before.record.counts,[8,2,4,4,2]);assert.deepEqual(c.after.record.counts,[9,2,4,4,2]);
 assert.deepEqual(c.after.record.wins,[6,1,1,0,0]);assert.equal(c.after.record.history.length,21);
 assert.deepEqual(c.feedback,{arm:0,reward:0});assert.equal(c.before.greedy.arm,0);assert.equal(c.after.greedy.arm,0);
 assert.equal(c.before.ucb.arm,1);assert.equal(c.after.ucb.arm,1);
 assert.equal(c.before.greedy.means[0],.75);assert.equal(c.after.greedy.means[0],2/3);
 assert.equal(c.after.greedy.means[1],.5);assert.equal(c.after.ucb.means[1],.5,'do not use UCB branch reward');
 assert.deepEqual(c.before.greedy.ranking.map(p=>p.arm),[0,1,2,3,4]);
 assert.deepEqual(c.after.ucb.ranking.map(p=>p.arm),[1,4,0,2,3]);
 assert.ok(Math.abs(c.before.ucb.bonuses[1]-Math.sqrt(Math.log(20)))<1e-12);
 assert.ok(Math.abs(c.after.ucb.bonuses[1]-Math.sqrt(Math.log(21)))<1e-12,'global n changes bonuses even for unvisited planets');
 assert.deepEqual(record,snapshot);
 c.after.record.counts[0]=99;c.before.ucb.ranking[0].score=99;
 assert.equal(lesson.compareObservedFeedback(record,{arm:0,reward:0}).after.record.counts[0],9);
});
test('a positive observation and genuine rank changes are reported rather than scripted',()=>{
 assert.equal(typeof lesson.compareObservedFeedback,'function');
 const positive=lesson.compareObservedFeedback(lesson.createSharedCase().record,{arm:1,reward:1});
 assert.deepEqual(positive.after.record.wins,[6,2,1,0,0]);assert.equal(positive.after.ucb.means[1],2/3);
 const record={counts:[1,1,1,1,1],wins:[1,1,0,0,0],total:2,history:[{arm:0,reward:1},{arm:1,reward:1},{arm:2,reward:0},{arm:3,reward:0},{arm:4,reward:0}]};
 const flip=lesson.compareObservedFeedback(record,{arm:0,reward:0});
 assert.equal(flip.before.greedy.arm,0);assert.equal(flip.after.greedy.arm,1);
 assert.equal(flip.before.ucb.arm,0);assert.equal(flip.after.ucb.arm,1);
 assert.deepEqual(flip.after.greedy.ranking.map(p=>p.arm),[1,0,2,3,4]);
 assert.equal(flip.after.greedy.ranking[1].rank,2);
 assert.equal(flip.after.greedy.ranking[1].score,.5);
});
test('malformed observations cannot poison a shared comparison or mutate the original',()=>{
 assert.equal(typeof lesson.compareObservedFeedback,'function');const r=lesson.createSharedCase().record;
 for(const feedback of [{arm:-1,reward:0},{arm:5,reward:1},{arm:0,reward:2},{arm:0,reward:NaN},{arm:0,reward:'0'},null])assert.throws(()=>lesson.compareObservedFeedback(r,feedback));
 for(const record of [null,{...r,counts:[0,2,4,4,2]},{...r,wins:[9,1,1,0,0]},{...r,counts:[8.5,2,4,4,2]}])assert.throws(()=>lesson.compareObservedFeedback(record,{arm:0,reward:0}));
});
