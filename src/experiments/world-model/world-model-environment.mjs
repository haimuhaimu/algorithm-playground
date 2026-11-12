import {START,finite} from './world-model-core.mjs';

// Simulator truth belongs here, never in the learner or route planner.
export function stepWorld(state,action,wind){
 finite(state.x,state.y,state.vx,state.vy,action.x,action.y,wind);
 const vx=0.93*state.vx+0.16*action.x,vy=0.93*state.vy+0.16*action.y+0.035*wind;
 return {x:state.x+vx,y:state.y+vy,vx,vy};
}
export function observeFlight(actions,wind,start=START){
 let state={...start};return actions.map(action=>{const next=stepWorld(state,action,wind),sample={state,action:{...action},next};state=next;return sample;});
}
