// Small, genuine 2→4(tanh)→2 block + trainable logistic head.
// Plain: h=F(x). Residual: h=x+F(x). No post-add activation in this teaching block.
const sigmoid=z=>z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
function checkModel(m){if(typeof m?.skip!=='boolean'||!Array.isArray(m.weights)||m.weights.length!==25||!m.weights.every(Number.isFinite)||!Number.isInteger(m.epoch)||m.epoch<0||m.epoch>200)throw Error('Invalid model');}
function checkPoints(points){if(!Array.isArray(points)||!points.length||!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&[0,1].includes(p.label)))throw Error('Invalid points');}
export function createResidualModel(skip=true){
 if(typeof skip!=='boolean')throw Error('Invalid shortcut');
 let seed=73;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const weights=Array.from({length:25},(_,i)=>i<12?(i%3===2?0:(random()-.5)*1.4):i<20?(random()-.5)*.24:0);
 weights[22]=1;weights[23]=-1;
 return {skip,weights,epoch:0};
}
export function residualForward(m,x,y,{zeroBranch=false}={}){
 if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Invalid input');
 const w=m.weights,hidden=Array.from({length:4},(_,j)=>Math.tanh(w[j*3]*x+w[j*3+1]*y+w[j*3+2]));
 const change=zeroBranch?[0,0]:[0,1].map(k=>w[20+k]+hidden.reduce((sum,h,j)=>sum+h*w[12+k*4+j],0));
 const input=[x,y],output=change.map((v,k)=>v+(m.skip?input[k]:0));
 const logit=output[0]*w[22]+output[1]*w[23]+w[24];
 return {input,hidden,change,output,logit,probability:sigmoid(logit)};
}
export function residualMetrics(m,points){
 checkModel(m);checkPoints(points);let loss=0;const mistakes=[];
 points.forEach((p,i)=>{const {logit:z}=residualForward(m,p.x,p.y);loss+=Math.max(z,0)-p.label*z+Math.log1p(Math.exp(-Math.abs(z)));if(Number(z>=0)!==p.label)mistakes.push(i);});
 return {loss:loss/points.length,mistakes};
}
export function residualGradients(m,points){
 checkModel(m);checkPoints(points);const g=Array(25).fill(0),w=m.weights;
 for(const p of points){
  const f=residualForward(m,p.x,p.y),delta=f.probability-p.label,df=[delta*w[22],delta*w[23]];
  g[22]+=delta*f.output[0];g[23]+=delta*f.output[1];g[24]+=delta;
  for(let k=0;k<2;k++){g[20+k]+=df[k];for(let j=0;j<4;j++)g[12+k*4+j]+=df[k]*f.hidden[j];}
  for(let j=0;j<4;j++){
   const d=(df[0]*w[12+j]+df[1]*w[16+j])*(1-f.hidden[j]**2);
   g[j*3]+=d*p.x;g[j*3+1]+=d*p.y;g[j*3+2]+=d;
  }
 }
 return g.map(v=>v/points.length);
}
export function trainResidual(m,points,steps=1){
 checkModel(m);checkPoints(points);
 if(![1,20].includes(steps)||!points.some(p=>p.label===0)||!points.some(p=>p.label===1))throw Error('Invalid training settings');
 for(let i=0,n=Math.min(steps,200-m.epoch);i<n;i++){
  const g=residualGradients(m,points),next=m.weights.map((w,j)=>w-.15*g[j]);
  if(!next.every(Number.isFinite))throw Error('Non-finite update');m.weights=next;m.epoch++;
 }
}
