import {createWorld,createRecord,pull,chooseDecision} from './mining-core.mjs?v=feedback-20261029';

// Curated reproducible teaching case, not the player's current mission.
const SEED=265;
const HISTORY=[0,1,2,3,4,0,2,3,0,4,0,2,3,0,1,0,2,3,0,0];
function recordedCase(){
 const world=createWorld(SEED);
 let record=createRecord();
 for(const arm of HISTORY)record=pull(world,record,arm);
 return {world,record};
}
function validateChoice(arm){
 if(!Number.isInteger(arm)||arm<0||arm>=5)throw new RangeError('请选择一颗有效星球');
}
export function createSharedCase(){
 const {record}=recordedCase();
 return {seed:SEED,round:record.history.length+1,record};
}
export function compareSharedChoice(arm){
 validateChoice(arm);
 const {record}=recordedCase();
 return {choice:arm,before:record,greedy:chooseDecision(record,'greedy'),ucb:chooseDecision(record,'ucb')};
}
export function resolveSharedChoice(arm){
 const comparison=compareSharedChoice(arm),{world}=recordedCase();
 // Independent counterfactual flights: all start at round 21, never sequential.
 return {you:pull(world,comparison.before,arm),
  greedy:pull(world,comparison.before,comparison.greedy.arm),
  ucb:pull(world,comparison.before,comparison.ucb.arm)};
}
function rankedDecision(record,strategy){
 const decision=chooseDecision(record,strategy);
 const ranking=decision.scores.map((score,arm)=>({arm,score,mean:decision.means[arm],bonus:decision.bonuses[arm]}))
  .sort((a,b)=>b.score-a.score||a.arm-b.arm).map((row,index)=>({...row,rank:index+1}));
 return {...decision,ranking};
}
export function compareObservedFeedback(record,feedback){
 if(!record||!Array.isArray(record.counts)||!Array.isArray(record.wins)||record.counts.length!==5||record.wins.length!==5||
  record.counts.some(n=>!Number.isSafeInteger(n)||n<1)||record.wins.some((n,i)=>!Number.isSafeInteger(n)||n<0||n>record.counts[i])||
  !Array.isArray(record.history)||record.history.length!==record.counts.reduce((a,b)=>a+b,0)||record.total!==record.wins.reduce((a,b)=>a+b,0))throw new Error('无效的共同观测记录');
 const counts=[0,0,0,0,0],wins=[0,0,0,0,0];
 for(const move of record.history){
  if(!move||!Number.isInteger(move.arm)||move.arm<0||move.arm>4||![0,1].includes(move.reward))throw new Error('无效的共同观测记录');
  counts[move.arm]++;wins[move.arm]+=move.reward;
 }
 if(counts.some((n,i)=>n!==record.counts[i]||wins[i]!==record.wins[i]))throw new Error('观测与历史不一致');
 if(!feedback||!Number.isInteger(feedback.arm)||feedback.arm<0||feedback.arm>4||![0,1].includes(feedback.reward))throw new Error('无效的新反馈');
 const beforeRecord=structuredClone(record),afterRecord=structuredClone(record),observation={arm:feedback.arm,reward:feedback.reward};
 afterRecord.counts[observation.arm]++;afterRecord.wins[observation.arm]+=observation.reward;
 afterRecord.total+=observation.reward;afterRecord.history.push({...observation});
 const snapshot=r=>({record:r,greedy:rankedDecision(r,'greedy'),ucb:rankedDecision(r,'ucb')});
 return {feedback:observation,before:snapshot(beforeRecord),after:snapshot(afterRecord)};
}
