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
