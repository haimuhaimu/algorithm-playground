// A genetic route optimizer: genes are lateral offsets, not a trained driver.
export const WIDTH=900,HEIGHT=480,GENES=24,POPULATION=48,ROAD_RADIUS=42,CAR_RADIUS=4;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
function randomSource(seed){
 let state=seed>>>0;
 return {next(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},get state(){return state;}};
}
export function makeTrack(input){
 if(!Array.isArray(input)||input.length<2||input.length>1024)throw Error('Invalid track points');
 const raw=[];
 for(const p of input){
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<45||p.x>WIDTH-45||p.y<45||p.y>HEIGHT-45)throw Error('Track must stay inside the field');
  if(!raw.length||distance(raw.at(-1),p)>.1)raw.push({x:p.x,y:p.y});
 }
 const lengths=[0];
 for(let i=1;i<raw.length;i++)lengths.push(lengths.at(-1)+distance(raw[i-1],raw[i]));
 const length=lengths.at(-1);
 if(length<250||length>4000)throw Error('Track length must be between 250 and 4000');
 const points=[];let segment=1;
 for(let i=0;i<GENES+2;i++){
  const target=length*i/(GENES+1);
  while(segment<raw.length-1&&lengths[segment]<target)segment++;
  points.push(lerp(raw[segment-1],raw[segment],(target-lengths[segment-1])/(lengths[segment]-lengths[segment-1])));
 }
 // Recompute the polyline's actual length after resampling corners.
 const actual=points.slice(1).reduce((n,p,i)=>n+distance(points[i],p),0);
 if(actual<250)throw Error('Resampled track must be at least 250 units long');
 return {points,length:actual};
}
export function presetTrack(name='sweep'){
 if(name==='sweep')return makeTrack(Array.from({length:81},(_,i)=>({x:80+740*i/80,y:240+120*Math.sin(i/80*Math.PI*2)})));
 if(name==='slalom')return makeTrack(Array.from({length:101},(_,i)=>({x:80+740*i/100,y:240+105*Math.sin(i/100*Math.PI*4)})));
 if(name==='hairpin')return makeTrack([
  {x:80,y:360},{x:650,y:360},...Array.from({length:31},(_,i)=>({x:650+100*Math.sin(i/30*Math.PI),y:260+100*Math.cos(i/30*Math.PI)})),{x:120,y:160}
 ]);
 throw Error('Unknown track preset');
}
function segmentDistance(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
 const t=den?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1):0;
 return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
}
function validateObstacles(obstacles){
 if(!Array.isArray(obstacles)||obstacles.length>12||obstacles.some(o=>!o||![o.x,o.y,o.radius].every(Number.isFinite)||o.x<0||o.x>WIDTH||o.y<0||o.y>HEIGHT||o.radius<=0||o.radius>60))throw Error('Invalid obstacle');
}
function blocked(p,track,obstacles){
 // Sampling is <=2 units apart. One unit of extra clearance is conservative:
 // distance-to-obstacle/road-boundary is 1-Lipschitz, including between samples.
 if(obstacles.some(o=>distance(p,o)<=o.radius+CAR_RADIUS+1))return true;
 return !track.points.slice(1).some((b,i)=>segmentDistance(p,track.points[i],b)<=ROAD_RADIUS-CAR_RADIUS-1);
}
export function evaluateGenome(track,genes,obstacles=[]){
 if(!Array.isArray(genes)||genes.length!==GENES||genes.some(n=>!Number.isFinite(n)||Math.abs(n)>1))throw Error('Invalid genome');
 validateObstacles(obstacles);
 const route=track.points.map((p,i)=>{
  if(i===0||i===track.points.length-1)return {...p};
  const a=track.points[i-1],b=track.points[i+1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
  const offset=genes[i-1]*(ROAD_RADIUS-CAR_RADIUS-3);
  return {x:p.x-dy/len*offset,y:p.y+dx/len*offset};
 });
 const samples=[{...route[0],t:0,progress:0}];
 let time=0,progress=0,finished=true,previousAngle=null;
 if(blocked(route[0],track,obstacles))finished=false;
 outer:for(let i=1;finished&&i<route.length;i++){
  const a=route[i-1],b=route[i],len=distance(a,b),angle=Math.atan2(b.y-a.y,b.x-a.x);
  const turn=previousAngle===null?0:Math.abs(Math.atan2(Math.sin(angle-previousAngle),Math.cos(angle-previousAngle)));
  previousAngle=angle;
  const speed=100/(1+turn*1.8),steps=Math.max(1,Math.ceil(len/2)),dt=len/speed/steps;
  for(let j=1;j<=steps;j++){
   const p=lerp(a,b,j/steps);
   if(blocked(p,track,obstacles)){finished=false;break outer;}
   time+=dt;progress=(i-1+j/steps)/(route.length-1);
   samples.push({...p,t:time,progress});
  }
 }
 const score=finished?2+1/(1+time/20):progress;
 return {samples,time,progress,finished,score};
}
export function positionAt(run,time){
 if(!Number.isFinite(time))throw Error('Invalid playback time');
 const points=run.samples;
 if(time<=0)return {x:points[0].x,y:points[0].y};
 if(time>=run.time)return {x:points.at(-1).x,y:points.at(-1).y};
 let low=0,high=points.length-1;
 while(high-low>1){const mid=(low+high)>>1;if(points[mid].t<=time)low=mid;else high=mid;}
 return lerp(points[low],points[high],(time-points[low].t)/(points[high].t-points[low].t));
}
function evaluated(track,obstacles,population,generation,seed,mutation,history=[]){
 const runs=population.map(g=>evaluateGenome(track,g,obstacles));
 let bestIndex=0;for(let i=1;i<runs.length;i++)if(runs[i].score>runs[bestIndex].score)bestIndex=i;
 const best=runs[bestIndex],entry={generation,score:best.score,time:best.finished?best.time:null,progress:best.progress,finished:runs.filter(r=>r.finished).length};
 return {track,obstacles,population,runs,bestIndex,best,generation,seed,mutation,history:[...history,entry].slice(-80)};
}
function validateMutation(mutation){if(!Number.isFinite(mutation)||mutation<0||mutation>1)throw Error('Invalid mutation probability');}
export function createRace(track=presetTrack(),{seed=42,mutation=.18,obstacles=[]}={}){
 validateMutation(mutation);validateObstacles(obstacles);
 if(!Number.isInteger(seed))throw Error('Invalid seed');
 const random=randomSource(seed);
 const population=Array.from({length:POPULATION},()=>Array.from({length:GENES},()=>random.next()*2-1));
 return evaluated({points:track.points.map(p=>({...p})),length:track.length},obstacles.map(o=>({...o})),population,1,random.state,mutation);
}
export function nextGeneration(race){
 validateMutation(race.mutation);
 const random=randomSource(race.seed),ranked=race.runs.map((run,i)=>({score:run.score,i})).sort((a,b)=>b.score-a.score);
 const population=ranked.slice(0,2).map(({i})=>[...race.population[i]]);
 function parent(){
  let winner=Math.floor(random.next()*POPULATION);
  for(let i=0;i<3;i++){const candidate=Math.floor(random.next()*POPULATION);if(race.runs[candidate].score>race.runs[winner].score)winner=candidate;}
  return race.population[winner];
 }
 while(population.length<POPULATION){
  const a=parent(),b=parent();
  population.push(a.map((value,i)=>{
   let gene=random.next()<.5?value:b[i];
   if(random.next()<race.mutation)gene+= (random.next()+random.next()-1)*.65;
   return clamp(gene,-1,1);
  }));
 }
 return evaluated(race.track,race.obstacles,population,race.generation+1,random.state,race.mutation,race.history);
}
