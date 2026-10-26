// Whole-world edit checkpoints. Simulation ticks alone are not undo entries.
export function createHistory(limit=30){
 if(!Number.isInteger(limit)||limit<1)throw Error('History limit must be a positive integer');
 return {past:[],future:[],limit};
}
export function snapshot(scene,world){return {scene,world:{...world,cells:world.cells.slice()}};}
const copy=state=>snapshot(state.scene,state.world);
const equal=(a,b)=>a.scene===b.scene&&a.world.tick===b.world.tick&&a.world.width===b.world.width&&a.world.height===b.world.height&&a.world.cells.length===b.world.cells.length&&a.world.cells.every((v,i)=>v===b.world.cells[i]);
export function recordChange(history,before,after,label){
 if(equal(before,after))return history;
 return {...history,past:[...history.past,{state:copy(before),label}].slice(-history.limit),future:[]};
}
export function undoChange(history,current){
 const entry=history.past.at(-1);if(!entry)return null;
 return {state:copy(entry.state),label:entry.label,history:{...history,past:history.past.slice(0,-1),future:[...history.future,{state:copy(current),label:entry.label}]}};
}
export function redoChange(history,current){
 const entry=history.future.at(-1);if(!entry)return null;
 return {state:copy(entry.state),label:entry.label,history:{...history,future:history.future.slice(0,-1),past:[...history.past,{state:copy(current),label:entry.label}]}};
}
export function discardFuture(history){return history.future.length?{...history,future:[]}:history;}
