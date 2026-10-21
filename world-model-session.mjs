import {START,TARGET,STEPS,initialModel,makeActions,predict,learnModel,planFlight,trajectoryError,finite,validTarget} from './world-model-core.mjs';
import {stepWorld} from './world-model-environment.mjs';

export function createSession(){return {model:initialModel(),target:{...TARGET},controls:{angle:0,power:1},wind:0.6,worldVersion:0,flight:null,previous:null,samples:[],completed:0,learnedFlight:0,plan:null,comparison:null};}
export function startFlight(s){
 if(s.flight&&!s.flight.done)return s;
 const actions=makeActions(s.controls);
 return {...s,previous:s.flight?.done?s.flight:s.previous,samples:[],flight:{actions,predicted:predict(s.model,actions),actual:[{...START}],observations:[],step:0,done:false,modelVersion:s.model.version,worldVersion:s.worldVersion,wind:s.wind,controls:{...s.controls},target:{...s.target}}};
}
export function advanceFlight(s,count=1){
 if(!s.flight||s.flight.done)return s;
 let f={...s.flight,actual:[...s.flight.actual],observations:[...s.flight.observations]};
 for(let i=0;i<count&&f.step<STEPS;i++){
  const state=f.actual.at(-1),action=f.actions[f.step],next=stepWorld(state,action,f.wind);
  f.actual.push(next);f.observations.push({state,action,next});f.step++;
 }
 if(f.step<STEPS)return {...s,flight:f};
 f={...f,done:true,error:trajectoryError(f.predicted,f.actual),distance:Math.hypot(f.actual.at(-1).x-f.target.x,f.actual.at(-1).y-f.target.y),number:s.completed+1};
 return {...s,flight:f,samples:f.observations,completed:s.completed+1};
}
export function learnLatest(s){
 if(!s.flight?.done||s.flight.worldVersion!==s.worldVersion||s.learnedFlight===s.flight.number)return s;
 const model={...learnModel(s.samples,s.model),source:{number:s.flight.number,wind:s.flight.wind,worldVersion:s.flight.worldVersion}};
 // Re-evaluate the training flight, never silently plan or run a new flight.
 const f=s.flight,after=predict(model,f.actions,f.actual[0]);
 const comparison=structuredClone({number:f.number,beforeVersion:f.modelVersion,afterVersion:model.version,
  controls:f.controls,wind:f.wind,worldVersion:f.worldVersion,target:f.target,actions:f.actions,
  before:f.predicted,after,actual:f.actual,beforeError:f.error,afterError:trajectoryError(after,f.actual)});
 return {...s,model,learnedFlight:s.flight.number,plan:null,comparison};
}
export function changeWind(s,wind){
 finite(wind);if(wind< -1||wind>1)throw Error('Wind outside range');if(wind===s.wind)return s;
 return {...s,wind,worldVersion:s.worldVersion+1,flight:null,previous:s.flight?.done?s.flight:s.previous,samples:[],plan:null};
}
export function selectPlan(s){
 if(s.flight&&!s.flight.done)return s;
 const plan=planFlight(s.model,s.target);return {...s,plan,controls:{...plan.controls}};
}
export function moveTarget(s,target){
 validTarget(target);if(s.flight&&!s.flight.done)return s;
 return {...s,target:{...target},previous:s.flight?.done?s.flight:s.previous,flight:null,samples:[],plan:null};
}
