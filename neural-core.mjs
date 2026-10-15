// Original, deterministic teaching model. No remote model or training library.
const HIDDEN=8;
export const MAX_POINTS=160,MAX_EPOCHS=4000;
function random(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const sigmoid=z=>z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&(p.label===0||p.label===1);
function validate(points){if(!Array.isArray(points)||!points.every(valid))throw Error('Invalid points');}

export function createModel(kind='network',seed=41){
 if(!['linear','network'].includes(kind))throw Error('Unknown model');
 const rand=random(seed),weights=kind==='linear'?[0,0,0]:Array.from({length:HIDDEN*4+1},(_,i)=>i===HIDDEN*4||i%4===2?0:(rand()-.5)*(i%4===3?1.2:3.6));
 return {kind,weights,epoch:0};
}
function forward(model,x,y){
 const w=model.weights;
 if(model.kind==='linear')return {z:w[0]*x+w[1]*y+w[2],hidden:[]};
 const hidden=Array.from({length:HIDDEN},(_,i)=>Math.tanh(w[i*4]*x+w[i*4+1]*y+w[i*4+2]));
 return {z:w[HIDDEN*4]+hidden.reduce((sum,h,i)=>sum+h*w[i*4+3],0),hidden};
}
export function predict(model,x,y){return sigmoid(forward(model,x,y).z);}
export function metrics(model,points){
 validate(points);if(!points.length)return null;
 let loss=0,correct=0;
 for(const p of points){
  const {z}=forward(model,p.x,p.y);
  loss+=Math.max(z,0)-p.label*z+Math.log1p(Math.exp(-Math.abs(z)));
  if(Number(z>=0)===p.label)correct++;
 }
 return {loss:loss/points.length,accuracy:correct/points.length};
}
export function gradients(model,points){
 validate(points);if(!points.length)throw Error('No points');
 const g=model.weights.map(()=>0),w=model.weights;
 for(const p of points){
  const {z,hidden}=forward(model,p.x,p.y),delta=sigmoid(z)-p.label;
  if(model.kind==='linear'){g[0]+=delta*p.x;g[1]+=delta*p.y;g[2]+=delta;}
  else{
   for(let i=0;i<HIDDEN;i++){
    const d=delta*w[i*4+3]*(1-hidden[i]**2);
    g[i*4]+=d*p.x;g[i*4+1]+=d*p.y;g[i*4+2]+=d;g[i*4+3]+=delta*hidden[i];
   }
   g[HIDDEN*4]+=delta;
  }
 }
 return g.map(v=>v/points.length);
}
export function train(model,points,rate=.15,steps=1){
 validate(points);
 if(!points.some(p=>p.label===0)||!points.some(p=>p.label===1))throw Error('Two classes required');
 if(!Number.isFinite(rate)||rate<.01||rate>.6||!Number.isInteger(steps)||steps<1||steps>500)throw Error('Invalid training settings');
 const count=Math.min(steps,MAX_EPOCHS-model.epoch);
 for(let step=0;step<count;step++){
  const g=gradients(model,points);
  model.weights=model.weights.map((w,i)=>w-rate*g[i]);
  model.epoch++;
 }
 return model;
}
export function makeDataset(name,seed=19){
 if(!['diagonal','islands','ring'].includes(name))throw Error('Unknown preset');
 const rand=random(seed);
 function sample(count){
  const points=[],quota=[0,0];
  while(points.length<count){
   let x=rand()*1.8-.9,y=rand()*1.8-.9;
   if(name==='islands'){x=(x<0?-1:1)*(.25+Math.abs(x)*.72);y=(y<0?-1:1)*(.25+Math.abs(y)*.72);}
   const label=name==='diagonal'?Number(x+y>0):name==='ring'?Number(x*x+y*y<.38):Number(x*y>0);
   if(quota[label]>=count/2)continue;
   quota[label]++;points.push({x,y,label});
  }
  return points;
 }
 return {train:sample(48),test:sample(120)};
}
export function editPoints(points,point,tool){
 if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||Math.abs(point.x)>1||Math.abs(point.y)>1)return points;
 if(tool==='erase')return points.filter(p=>Math.hypot(p.x-point.x,p.y-point.y)>.09);
 if(!['0','1'].includes(tool)||points.length>=MAX_POINTS)return points;
 if(points.some(p=>p.label===Number(tool)&&Math.hypot(p.x-point.x,p.y-point.y)<.035))return points;
 return [...points,{x:point.x,y:point.y,label:Number(tool)}];
}
