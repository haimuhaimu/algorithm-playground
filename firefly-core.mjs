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
