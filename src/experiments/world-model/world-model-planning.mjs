import {makeActions,predict,planFlight} from './world-model-core.mjs';

// Explanatory snapshots, not a second optimiser. No real-world simulator is available here.
export function comparePlanningRoutes(model,target,originalControls){
 const best=planFlight(model,target);
 const candidate=(key,controls)=>{
  const path=predict(model,makeActions(controls)),end=path.at(-1);
  return {key,controls:{...controls},path,distance:Math.hypot(end.x-target.x,end.y-target.y)};
 };
 const alternatives=[candidate('original',originalControls),
  candidate('direction',{angle:best.controls.angle,power:originalControls.power}),
  candidate('best',best.controls)];
 return {...best,alternatives,selectedKey:'best',target:{...target}};
}
