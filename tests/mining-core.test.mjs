import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,createRecord,pull,chooseArm,runPolicy} from '../mining-core.mjs';

test('world is reproducible, bounded and uses all five hidden probabilities',()=>{
 const a=createWorld(42),b=createWorld(42);assert.deepEqual(a,b);assert.notDeepEqual(a,createWorld(43));
 assert.deepEqual([...a.probabilities].sort(),[.15,.3,.45,.6,.8]);assert.equal(a.outcomes.length,30);
 assert.ok(a.outcomes.every(row=>row.length===5&&row.every(x=>x===0||x===1)));
 a.outcomes[0][0]=9;assert.notEqual(b.outcomes[0][0],9);
 assert.throws(()=>createWorld(NaN),/seed/);
});
test('pull uses a shared round/planet table, records exact rewards and never mutates inputs',()=>{
 const w=createWorld(10),r=createRecord(),snapshot=structuredClone(w);
 const a=pull(w,r,3);assert.deepEqual(r,createRecord());assert.deepEqual(w,snapshot);
 assert.equal(a.total,w.outcomes[0][3]);assert.equal(a.counts[3],1);assert.equal(a.wins[3],a.total);
 assert.deepEqual(a.history,[{arm:3,reward:w.outcomes[0][3]}]);
 const b=pull(w,pull(w,r,1),3),c=pull(w,a,3);
 assert.equal(b.history[1].reward,c.history[1].reward);
 assert.notEqual(a.counts,r.counts);assert.notEqual(a.history,r.history);
});
test('invalid arms and a thirty-first probe cannot consume budget',()=>{
 const w=createWorld(1);let r=createRecord();
 for(const a of [-1,5,1.2,NaN])assert.throws(()=>pull(w,r,a),/arm/);
 for(let i=0;i<30;i++)r=pull(w,r,i%5);
 assert.throws(()=>pull(w,r,0),/complete/);assert.equal(r.history.length,30);
 assert.equal(r.total,r.history.reduce((n,x)=>n+x.reward,0));
});
test('all policies visit each unsampled planet first',()=>{
 const w=createWorld(3);
 for(const strategy of ['greedy','epsilon','ucb']){
  let r=createRecord();for(let i=0;i<5;i++){assert.equal(chooseArm(r,strategy),i);r=pull(w,r,i);}
 }
});
const observed=(counts,wins)=>({counts,wins,total:wins.reduce((a,b)=>a+b,0),history:Array.from({length:counts.reduce((a,b)=>a+b,0)},()=>({arm:0,reward:0}))});
test('greedy uses empirical means and stable first-index ties',()=>{
 assert.equal(chooseArm(observed([2,1,3,1,2],[1,1,2,1,0]),'greedy'),1);
});
test('epsilon explores uniformly only on its 20% branch; otherwise exploits',()=>{
 const r=observed([1,1,1,1,1],[0,1,0,0,0]);let draws=[.1,.85];
 assert.equal(chooseArm(r,'epsilon',()=>draws.shift()),4);
 assert.equal(chooseArm(r,'epsilon',()=>.2),1);
});
test('UCB follows the computed confidence index, not just the best observed mean',()=>{
 const r=observed([20,1,5,5,5],[20,0,2,2,2]);
 const scores=r.counts.map((n,i)=>r.wins[i]/n+Math.sqrt(2*Math.log(36)/n));
 assert.equal(scores.indexOf(Math.max(...scores)),1);assert.equal(chooseArm(r,'ucb'),1);
});
test('policies are deterministic and cannot inspect hidden probabilities to choose',()=>{
 for(const strategy of ['greedy','epsilon','ucb']){
  const w=createWorld(918),a=runPolicy(w,strategy);assert.deepEqual(a,runPolicy(w,strategy));
  assert.deepEqual(a,runPolicy({...w,probabilities:[1,0,0,0,0]},strategy));
  assert.equal(a.history.length,30);assert.equal(a.counts.reduce((x,y)=>x+y),30);
  a.history.forEach((x,i)=>assert.equal(x.reward,w.outcomes[i][x.arm]));
 }
 assert.throws(()=>chooseArm(createRecord(),'oracle'),/strategy/);
});
