import {predict} from './neural-core.mjs';

// Both views use identical coordinates, samples and 50% contours.
export function paintStep(canvas,model,points,probes,baseline,dark=false){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const w=canvas.width,h=canvas.height,nx=80,ny=50,cw=w/nx,ch=h/ny;
 const ink=dark?'#f5efe3':'#302e29',paper=dark?'#222622':'#fcfaf4';
 const grid=m=>Array.from({length:ny+1},(_,y)=>Array.from({length:nx+1},(_,x)=>predict(m,x/nx*2-1,1-y/ny*2)));
 const values=grid(model);
 ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const p=values[y][x];ctx.fillStyle=`rgba(${p>=.5?'65,156,155':'220,114,95'},${.08+Math.abs(p-.5)*(dark?.65:.48)})`;
  const left=Math.floor(x*cw),top=Math.floor(y*ch);
  ctx.fillRect(left,top,Math.floor((x+1)*cw)-left,Math.floor((y+1)*ch)-top);
 }
 function boundary(v,dashed){
  ctx.strokeStyle=ink;ctx.lineWidth=dashed?1.8:2.3;ctx.setLineDash(dashed?[6,5]:[]);ctx.globalAlpha=dashed?.55:1;ctx.beginPath();
  // Linear edge interpolation makes small real boundary movements visible without exaggerating them.
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   const corners=[[x*cw,y*ch,v[y][x]],[(x+1)*cw,y*ch,v[y][x+1]],[(x+1)*cw,(y+1)*ch,v[y+1][x+1]],[x*cw,(y+1)*ch,v[y+1][x]]],hits=[];
   for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4];
    if((a[2]>=.5)!==(b[2]>=.5)){const t=(.5-a[2])/(b[2]-a[2]);hits.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
   }
   for(let i=0;i+1<hits.length;i+=2){ctx.moveTo(...hits[i]);ctx.lineTo(...hits[i+1]);}
  }ctx.stroke();ctx.globalAlpha=1;ctx.setLineDash([]);
 }
 if(baseline)boundary(grid(baseline),true);boundary(values,false);
 for(const p of points){
  const x=(p.x+1)*w/2,y=(1-p.y)*h/2;
  ctx.fillStyle=p.label?'#287d7c':'#bb5141';ctx.strokeStyle=paper;ctx.lineWidth=1.4;ctx.beginPath();
  if(p.label)ctx.rect(x-4,y-4,8,8);else ctx.arc(x,y,4.5,0,Math.PI*2);ctx.fill();ctx.stroke();
 }
 for(const p of probes){
  const x=(p.x+1)*w/2,y=(1-p.y)*h/2;
  ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.stroke();
  const lx=Math.max(15,Math.min(w-15,x+18)),ly=Math.max(25,Math.min(h-5,y-14));
  ctx.fillStyle=paper;ctx.fillRect(lx-11,ly-20,22,24);ctx.fillStyle=ink;ctx.font='bold 19px system-ui';ctx.textAlign='center';ctx.fillText(p.id,lx,ly-2);
 }
 ctx.textAlign='start';
}
