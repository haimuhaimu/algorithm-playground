// A tiny learned transition model. This module has no access to the real world.
export const START=Object.freeze({x:12,y:45,vx:0,vy:0});
export const TARGET=Object.freeze({x:88,y:45,radius:5});
export const STEPS=60;
export function finite(...values){if(!values.every(Number.isFinite))throw Error('Expected finite numbers');}
export function initialModel(){return {x:[0.87,0.18,0],y:[0.87,0.18,0],version:0,samples:0};}
export function makeActions({angle,power}){
 finite(angle,power);
 if(angle< -40||angle>40||power<0.4||power>1.6)throw Error('Controls outside flight range');
 const r=angle*Math.PI/180;
 return Array.from({length:STEPS},(_,i)=>({x:i<36?Math.cos(r)*power:0,y:i<36?Math.sin(r)*power:0}));
}
const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
export function predict(model,actions,start=START){
 let state={...start};const path=[state];
 for(const action of actions){
  const vx=dot(model.x,[state.vx,action.x,1]),vy=dot(model.y,[state.vy,action.y,1]);
  state={x:state.x+vx,y:state.y+vy,vx,vy};path.push(state);
 }
 return path;
}
function solve(matrix,values){
 const a=matrix.map((row,i)=>[...row,values[i]]);
 for(let col=0;col<3;col++){
  let pivot=col;for(let row=col+1;row<3;row++)if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row;
  [a[col],a[pivot]]=[a[pivot],a[col]];
  const divisor=a[col][col];for(let j=col;j<4;j++)a[col][j]/=divisor;
  for(let row=0;row<3;row++)if(row!==col){const factor=a[row][col];for(let j=col;j<4;j++)a[row][j]-=factor*a[col][j];}
 }
 return a.map(row=>row[3]);
}
export function learnModel(observations,prior=initialModel()){
 if(!observations.length)throw Error('Completed observations required');
 for(const {state,action,next} of observations)finite(state.x,state.y,state.vx,state.vy,action.x,action.y,next.x,next.y,next.vx,next.vy);
 const fit=axis=>{
  const lambda=0.02,matrix=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>i===j?lambda:0));
  const values=prior[axis].map(n=>n*lambda);
  for(const {state,action,next} of observations){
   const features=[state['v'+axis],action[axis],1],target=next['v'+axis];
   for(let i=0;i<3;i++){values[i]+=features[i]*target;for(let j=0;j<3;j++)matrix[i][j]+=features[i]*features[j];}
  }
  return solve(matrix,values);
 };
 return {x:fit('x'),y:fit('y'),version:prior.version+1,samples:observations.length};
}
export function trajectoryError(predicted,actual){
 if(predicted.length!==actual.length||!actual.length)throw Error('Matching nonempty paths required');
 return Math.sqrt(actual.reduce((sum,p,i)=>sum+(p.x-predicted[i].x)**2+(p.y-predicted[i].y)**2,0)/actual.length);
}
export function validTarget(target){finite(target.x,target.y,target.radius);if(target.radius<=0)throw Error('Positive target radius required');}
export function planFlight(model,target=TARGET){
 validTarget(target);
 let best=null,candidates=0;
 for(let angle=-40;angle<=40;angle+=2)for(let p=16;p<=64;p++){
  const controls={angle,power:p/40},path=predict(model,makeActions(controls)),end=path.at(-1);
  const distance=Math.hypot(end.x-target.x,end.y-target.y);candidates++;
  if(!best||distance<best.distance)best={controls,path,distance,modelVersion:model.version};
 }
 return {...best,candidates};
}
