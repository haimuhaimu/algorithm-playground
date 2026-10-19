import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../mining-core.mjs';

const observed=(counts,wins)=>({counts,wins,total:wins.reduce((a,b)=>a+b,0),history:[]});
test('decision evidence contains only observations available before choosing',()=>{
 assert.equal(typeof core.chooseDecision,'function');
 const record=observed([1,0,0,0,0],[1,0,0,0,0]);
 const decision=core.chooseDecision(record,'ucb',()=>{throw Error('cold start does not draw randomness');});
 assert.equal(decision.arm,1);assert.equal(decision.kind,'initial');
 assert.deepEqual(decision.counts,[1,0,0,0,0]);assert.deepEqual(decision.means,[1,null,null,null,null]);
 assert.deepEqual(decision.scores,[null,null,null,null,null]);
 record.counts[0]=90;record.wins[0]=80;
 assert.equal(decision.counts[0],1);assert.equal(decision.wins[0],1);
});
test('greedy explanation retains actual first-index ties, rather than using rounded scores',()=>{
 assert.equal(typeof core.chooseDecision,'function');
 const d=core.chooseDecision(observed([2,1,3,1,2],[1,1,2,1,0]),'greedy');
 assert.equal(d.kind,'exploit');assert.equal(d.arm,1);assert.deepEqual(d.ties,[1,3]);
 assert.deepEqual(d.means,[.5,1,2/3,1,0]);
});
test('epsilon records the random branch even if it happens to choose the empirical best',()=>{
 assert.equal(typeof core.chooseDecision,'function');
 const r=observed([1,1,1,1,1],[0,1,0,0,0]);let draws=[.1,.25];
 const explore=core.chooseDecision(r,'epsilon',()=>draws.shift());
 assert.equal(explore.kind,'explore');assert.equal(explore.arm,1);assert.deepEqual(explore.ties,[]);
 const exploit=core.chooseDecision(r,'epsilon',()=>.2);
 assert.equal(exploit.kind,'exploit');assert.equal(exploit.arm,1);
});
test('UCB evidence separates empirical reward and exploration bonus before the current reward',()=>{
 assert.equal(typeof core.chooseDecision,'function');
 const d=core.chooseDecision(observed([20,1,5,5,5],[20,0,2,2,2]),'ucb');
 assert.equal(d.kind,'ucb');assert.equal(d.arm,1);assert.equal(d.means[1],0);
 assert.ok(Math.abs(d.bonuses[1]-2.677132398091701)<1e-12);
 assert.equal(d.scores[1],d.bonuses[1]);assert.ok(d.scores[1]>d.scores[0]);
});
test('policy replay preserves the established seeded policy choices and final scores',()=>{
 assert.equal(typeof core.runPolicyTrace,'function');
 const fixtures={
  greedy:{arms:[0,1,2,3,4,1,1,1,1,4,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],total:21},
  epsilon:{arms:[0,1,2,3,4,1,1,1,1,4,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1],total:21},
  ucb:{arms:[0,1,2,3,4,1,4,1,4,1,4,0,2,3,1,0,2,4,1,4,1,4,1,0,2,3,3,1,1,1],total:17}
 };
 for(const [strategy,want]of Object.entries(fixtures)){
  const world=core.createWorld(42),trace=core.runPolicyTrace(world,strategy);
  assert.deepEqual(trace.steps.map(s=>s.arm),want.arms);assert.equal(trace.record.total,want.total);
  assert.deepEqual(trace.record,core.runPolicy(world,strategy));
  assert.deepEqual(trace.steps[5].counts,[1,1,1,1,1]);assert.deepEqual(trace.steps[5].wins,[0,1,0,0,1]);
  assert.equal(trace.steps[5].totalBefore,2);assert.equal(trace.steps[5].totalAfter,3);
  trace.steps.forEach((step,i)=>{assert.equal(step.round,i+1);assert.equal(step.counts.reduce((a,b)=>a+b,0),i);assert.equal(step.reward,world.outcomes[i][step.arm]);});
  assert.deepEqual(trace,core.runPolicyTrace({...world,probabilities:[1,0,0,0,0]},strategy));
  trace.record.counts[0]=999;assert.equal(trace.steps[0].counts[0],0);
 }
});
test('human replay reconstructs observed evidence without inventing decision intent',()=>{
 assert.equal(typeof core.traceChoices,'function');
 const history=[{arm:3,reward:1},{arm:3,reward:0},{arm:0,reward:1}];
 const steps=core.traceChoices(history);
 assert.equal(steps[0].kind,'human');assert.deepEqual(steps[0].counts,[0,0,0,0,0]);
 assert.deepEqual(steps[2].counts,[0,0,0,2,0]);assert.deepEqual(steps[2].means,[null,null,null,.5,null]);
 assert.equal(steps[2].totalBefore,1);assert.equal(steps[2].totalAfter,2);
 history[0].arm=0;assert.equal(steps[0].arm,3);
 assert.deepEqual(core.traceChoices([]),[]);
});
