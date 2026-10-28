import {TAU,stepSwarm,configureSwarm} from './firefly-core.mjs?v=one-beat-1';

const copy=world=>({...world,settings:{...world.settings},points:world.points.map(p=>({...p}))});
const scenarios=new Set(['ahead','behind','out']),guesses=new Set(['faster','slower','same']);
function initialWorld(scenario){
 if(!scenarios.has(scenario))throw Error('Unknown beat scenario');
 const phase=scenario==='behind'?TAU*3/4:TAU/4;
 return {points:[{x:.25,y:.5,phase:0,offset:0},...[.25,.5,.75].map(y=>({x:.65,y,phase,offset:0}))],
  settings:{coupling:2.4,radius:scenario==='out'?.15:2,spread:0},time:0,seed:42,preset:'chorus'};
}
export function createBeatLesson(scenario='ahead'){
 return {scenario,before:initialWorld(scenario),guess:null,comparison:null,records:{}};
}
export function selectBeatCase(state,scenario){
 const next=createBeatLesson(scenario),record=state.records[scenario];
 return {...next,records:{...state.records},guess:record?.guess??null,comparison:record??null};
}
export function guessBeat(state,guess){
 if(!guesses.has(guess))throw Error('Unknown beat guess');
 if(state.comparison)throw Error('Retry before changing a sealed guess');
 return {...state,guess};
}
export function runBeat(state){
 if(state.comparison)return state;
 if(!guesses.has(state.guess))throw Error('Choose a guess before running');
 const frames=[copy(state.before)],soloFrames=[configureSwarm(copy(state.before),{coupling:0})];
 for(let i=0;i<30;i++){
  frames.push(stepSwarm(frames.at(-1),1/60));
  soloFrames.push(stepSwarm(soloFrames.at(-1),1/60));
 }
 // These half-second fixtures advance less than one full cycle; no modulo subtraction is needed.
 const actualAdvance=frames[30].points[0].phase-frames[0].points[0].phase,
  soloAdvance=soloFrames[30].points[0].phase-soloFrames[0].points[0].phase,difference=actualAdvance-soloAdvance;
 const outcome=Math.abs(difference)<1e-9?'same':difference>0?'faster':'slower';
 const comparison={frames,soloFrames,actualAdvance,soloAdvance,difference,outcome,guess:state.guess,
  correct:state.guess===outcome,neighborCount:state.scenario==='out'?0:3};
 return {...state,comparison,records:{...state.records,[state.scenario]:comparison}};
}
export function retryBeat(state){
 const records={...state.records};delete records[state.scenario];
 return {...createBeatLesson(state.scenario),records};
}
