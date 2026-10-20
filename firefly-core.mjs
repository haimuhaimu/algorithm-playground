// Radius-limited Kuramoto phase oscillators, not a biological firefly model.
export const TAU=2*Math.PI;
const wrap=value=>((value%TAU)+TAU)%TAU;
const distance2=(a,b)=>((a.x-b.x)*1.6)**2+(a.y-b.y)**2;
const finite=value=>{if(typeof value!=='number'||!Number.isFinite(value))throw Error('Expected a finite number');return value;};
function random(seed){
 let state=seed>>>0;
 return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}

export function createSwarm(preset='chorus',seed=42){
 finite(seed);
 const presets={independent:{coupling:0,radius:2,spread:0.35},chorus:{coupling:2.4,radius:2,spread:0.12},islands:{coupling:2.4,radius:0.32,spread:0.6}};
 if(!Object.hasOwn(presets,preset))throw Error('Unknown preset');
 const rng=random(seed),points=[];
 for(let i=0;i<80;i++){
  const x=0.07+(i%10+rng()*0.65)*0.087,y=0.10+(Math.floor(i/10)+rng()*0.65)*0.098;
  const phase=rng()*TAU,offset=rng()*2-1;
  if(preset==='islands'){
   const side=i<40?-1:1,angle=rng()*TAU,rad=Math.sqrt(rng());
   points.push({x:0.5+side*0.28+Math.cos(angle)*rad*0.14,y:0.48+Math.sin(angle)*rad*0.32,phase,offset:side*0.8+offset*0.08});
  }else points.push({x,y,phase,offset});
 }
 return {points,settings:{...presets[preset]},time:0,seed:seed>>>0,preset};
}

export function coherence(points){
 if(!points.length)return 0;
 let x=0,y=0;for(const {phase} of points){x+=Math.cos(phase);y+=Math.sin(phase);}
 return Math.min(1,Math.hypot(x,y)/points.length);
}

export function configureSwarm(world,patch){
 const settings={...world.settings},bounds={coupling:[0,3],radius:[0.15,2],spread:[0,0.6]};
 for(const [key,value] of Object.entries(patch)){
  if(!Object.hasOwn(bounds,key))throw Error('Unknown setting');
  const [min,max]=bounds[key];settings[key]=Math.max(min,Math.min(max,finite(value)));
 }
 return {...world,settings};
}

export function stepSwarm(world,dt=1/60){
 finite(dt);if(dt<0||dt>0.1)throw Error('Time step must be within 0..0.1 seconds');
 if(dt===0)return world;
 const {coupling,radius,spread}=world.settings;
 const points=world.points.map(p=>{
  let influence=0,neighbors=1;
  if(coupling>0)for(const q of world.points){
   if(q===p||distance2(p,q)>radius*radius)continue;
   influence+=Math.sin(q.phase-p.phase);neighbors++;
  }
  const omega=TAU/3.2+p.offset*spread+coupling*influence/neighbors;
  return {...p,phase:wrap(p.phase+omega*dt)};
 });
 return {...world,points,time:world.time+dt};
}

export function perturbSwarm(world,point,mode='scatter',radius=0.22){
 finite(point?.x);finite(point?.y);finite(radius);
 if(radius<0||!['scatter','align'].includes(mode))throw Error('Invalid disturbance');
 const seed=(world.seed+1)>>>0,rng=random(seed);
 const points=world.points.map(p=>distance2(p,point)<=radius*radius?{...p,phase:mode==='align'?0:rng()*TAU}:p);
 return {...world,points,seed};
}

// Spatial membership is meaningful only for the fixed two-island preset.
export function measureGroups(world){
 if(world.preset!=='islands')return null;
 const left=world.points.filter(p=>p.x<.5),right=world.points.filter(p=>p.x>=.5);
 const l=coherence(left),r=coherence(right);
 const mean=points=>Math.atan2(points.reduce((s,p)=>s+Math.sin(p.phase),0),points.reduce((s,p)=>s+Math.cos(p.phase),0));
 const a=mean(left),b=mean(right);
 let links=0;
 if(world.settings.coupling>0)for(const p of left)for(const q of right)if(distance2(p,q)<=world.settings.radius**2)links++;
 return {left:l,right:r,whole:coherence(world.points),leftPhase:a,rightPhase:b,
  gap:l>=.1&&r>=.1?Math.acos(Math.max(-1,Math.min(1,Math.cos(a-b))))*180/Math.PI:null,links};
}

const copyWorld=world=>({...world,settings:{...world.settings},points:world.points.map(p=>({...p}))});
function listeningSnapshot(world,samples){
 const values=samples.filter(s=>s.time>=world.time-3-1e-8).map(s=>s.value);
 return {world:copyWorld(world),metrics:measureGroups(world),range:{min:Math.min(...values),max:Math.max(...values)}};
}
export function createListening(){
 const world=createSwarm('islands',42);
 return {stage:'observing',world,ticks:0,samples:[{time:0,value:coherence(world.points)}],before:null,after:null,choice:null,answer:null};
}
export function advanceListening(session,steps=1){
 if(!Number.isInteger(steps)||steps<0||steps>900)throw Error('Expected 0..900 simulation steps');
 if(!['observing','comparing'].includes(session.stage))return session;
 const limit=session.stage==='observing'?900:600;
 let world=session.world,ticks=session.ticks,samples=[...session.samples];
 for(let i=0;i<steps&&ticks<limit;i++){
  world=stepSwarm(world);ticks++;
  if(ticks%6===0)samples.push({time:world.time,value:coherence(world.points)});
 }
 samples=samples.filter(s=>s.time>=world.time-3-1e-8);
 const next={...session,world,ticks,samples};
 if(ticks===limit){
  const snapshot=listeningSnapshot(world,samples);
  if(session.stage==='observing'){next.stage='before';next.before=snapshot;}
  else{next.stage='after';next.after=snapshot;}
 }
 return next;
}
export function chooseListening(session,choice){
 if(!session.before||!['before','after'].includes(session.stage))throw Error('Observe before comparing');
 if(!['wide','near'].includes(choice))throw Error('Unknown listening choice');
 const world=configureSwarm(copyWorld(session.before.world),{radius:choice==='wide'?2:.32});
 return {...session,stage:'comparing',world,ticks:0,samples:[{time:world.time,value:coherence(world.points)}],after:null,choice,answer:null};
}
export function listeningOutcome(session){
 if(!session.after)return null;
 const {metrics,range}=session.after;
 if(metrics.left>.9&&metrics.right>.9&&metrics.links===0)return 'separate';
 if(metrics.links>0&&range.min>.9&&range.max-range.min<.02)return 'joined';
 return 'unsettled';
}
export function answerListening(session,choice){
 if(session.stage!=='after')throw Error('Complete the comparison first');
 if(!['separate','chaotic','everyone'].includes(choice))throw Error('Unknown judgment');
 return {...session,answer:{choice,correct:choice==='separate'}};
}
