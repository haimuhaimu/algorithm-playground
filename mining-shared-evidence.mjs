import {createWorld,createRecord,pull,chooseDecision} from './mining-core.mjs';

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
