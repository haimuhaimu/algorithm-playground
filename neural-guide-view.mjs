import {predict} from './neural-core.mjs';
import {guideEvidence} from './neural-guide.mjs';

export function paintGuide(canvas,s,{dark=false,before=false}={}){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const w=canvas.width,h=canvas.height,model=before?s.baseline:s.model,e=guideEvidence(s);
 const ink=dark?'#f4f5f7':'#1d1d1f',paper=dark?'#1a1c21':'#ffffff';
 const pos=(x,y)=>[(x+1)*w/2,(1-y)*h/2];
 ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
 for(let row=0;row<40;row++)for(let col=0;col<64;col++){
  const p=predict(model,(col+.5)/32-1,1-(row+.5)/20);
  ctx.fillStyle=`rgba(${p>=.5?'65,156,155':'220,114,95'},${(dark?.14:.10)+Math.abs(p-.5)*(dark?.50:.30)})`;
  ctx.fillRect(col*w/64,row*h/40,Math.ceil(w/64),Math.ceil(h/40));
 }
 ctx.strokeStyle=dark?'#383e49':'#e5e7eb';ctx.lineWidth=1;ctx.beginPath();
 for(let i=1;i<8;i++){ctx.moveTo(i*w/8,0);ctx.lineTo(i*w/8,h);}
 for(let i=1;i<5;i++){ctx.moveTo(0,i*h/5);ctx.lineTo(w,i*h/5);}ctx.stroke();
 function boundary(m,dashed){
  const [a,b,c]=m.weights,hits=[];
  if(b!==0)for(const x of [-1,1]){const y=-(a*x+c)/b;if(Math.abs(y)<=1)hits.push([x,y]);}
  if(a!==0)for(const y of [-1,1]){const x=-(b*y+c)/a;if(Math.abs(x)<=1)hits.push([x,y]);}
  if(hits.length<2)return;
  ctx.strokeStyle=ink;ctx.lineWidth=dashed?2.5:4;ctx.globalAlpha=dashed?.35:1;ctx.setLineDash(dashed?[10,8]:[]);ctx.beginPath();
  hits.slice(0,2).forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](...pos(x,y)));ctx.stroke();ctx.globalAlpha=1;ctx.setLineDash([]);
 }
 if(s.model.epoch&&!before)boundary(s.baseline,true);boundary(model,false);
 const corners=[[-.77,.83],[.73,.83],[-.77,-.83],[.73,-.83]];
 const ranked=corners.map(([x,y])=>({x,y,p:predict(model,x,y)})).sort((a,b)=>a.p-b.p);
 for(const [p,text]of [[ranked[0],'圆区'],[ranked.at(-1),'方区']]){
  const [x,y]=pos(p.x,p.y);ctx.fillStyle=paper;ctx.fillRect(x-46,y-22,92,44);
  ctx.fillStyle=ink;ctx.font='700 30px system-ui';ctx.textAlign='center';ctx.fillText(text,x,y+10);
 }
 const wrong=before?e.mistakesBefore:e.mistakesNow;
 for(const [i,p]of s.points.entries()){
  const [x,y]=pos(p.x,p.y);ctx.fillStyle=p.label?'#287d7c':'#bb5141';ctx.strokeStyle=paper;ctx.lineWidth=3;
  ctx.beginPath();if(p.label)ctx.rect(x-15,y-15,30,30);else ctx.arc(x,y,16,0,Math.PI*2);ctx.fill();ctx.stroke();
  if(wrong.includes(i)){
   ctx.strokeStyle=ink;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,23,0,Math.PI*2);ctx.stroke();
   ctx.fillStyle=paper;ctx.fillRect(x+20,y-19,40,36);ctx.fillStyle=ink;ctx.font='700 28px system-ui';ctx.textAlign='center';ctx.fillText('错',x+40,y+8);
  }
 }
 if(['test','reveal','reflect','done'].includes(s.phase)){
  const p=e.probe,[x,y]=pos(p.x,p.y);
  // A neutral cross/question marker is not a circle/square category label.
  ctx.strokeStyle=ink;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x-10,y-10);ctx.lineTo(x+10,y+10);ctx.moveTo(x+10,y-10);ctx.lineTo(x-10,y+10);ctx.stroke();
  ctx.fillStyle=paper;ctx.fillRect(x-40,y-45,38,40);ctx.fillStyle=ink;ctx.textAlign='center';ctx.font='700 34px system-ui';ctx.fillText(s.phase==='test'?'?':p.id,x-21,y-13);
 }
 ctx.textAlign='start';
}
