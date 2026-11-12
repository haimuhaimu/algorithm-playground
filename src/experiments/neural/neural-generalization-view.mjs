import {predict} from './neural-core.mjs';
import {generalizationEvidence} from './neural-generalization.mjs';
const position=(canvas,p)=>[48+(p.x+1)/2*(canvas.width-96),48+(1-p.y)/2*(canvas.height-96)];
export function paintGeneralization(canvas,s,{dark=false,showRule=false}={}){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const w=canvas.width,h=canvas.height,ink=dark?'#f4f5f7':'#1d1d1f',paper=dark?'#1a1c21':'#ffffff',e=generalizationEvidence(s),showTest=!!e.test&&s.view==='test';
 ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
 for(let row=0;row<40;row++)for(let col=0;col<54;col++){
  const probability=predict(s.model,(col+.5)/27-1,1-(row+.5)/20);
  ctx.fillStyle=`rgba(${probability>=.5?'65,156,155':'220,114,95'},${(dark?.17:.09)+Math.abs(probability-.5)*.32})`;
  ctx.fillRect(48+col*(w-96)/54,48+row*(h-96)/40,Math.ceil((w-96)/54),Math.ceil((h-96)/40));
 }
 ctx.strokeStyle=dark?'#3b4049':'#e5e7eb';ctx.lineWidth=1;ctx.beginPath();
 for(let i=0;i<=4;i++){const x=48+i*(w-96)/4,y=48+i*(h-96)/4;ctx.moveTo(x,48);ctx.lineTo(x,h-48);ctx.moveTo(48,y);ctx.lineTo(w-48,y);}ctx.stroke();
 function line(weights,dashed){
  const [a,b,c]=weights,hits=[];
  if(b!==0)for(const x of [-1,1]){const y=-(a*x+c)/b;if(Math.abs(y)<=1)hits.push({x,y});}
  if(a!==0)for(const y of [-1,1]){const x=-(b*y+c)/a;if(Math.abs(x)<=1)hits.push({x,y});}
  if(hits.length<2)return;
  ctx.strokeStyle=ink;ctx.lineWidth=dashed?2.5:4;ctx.setLineDash(dashed?[12,9]:[]);ctx.beginPath();
  hits.slice(0,2).forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...position(canvas,p)));ctx.stroke();ctx.setLineDash([]);
 }
 if(showTest&&showRule)line([1,1,0],true);line(s.model.weights,false);
 function dot(p,filled,small=false){
  const [x,y]=position(canvas,p),r=small?10:15;ctx.strokeStyle=p.label?'#287d7c':'#bb5141';ctx.lineWidth=small?2:4;ctx.fillStyle=filled?ctx.strokeStyle:paper;
  ctx.beginPath();if(p.label)ctx.rect(x-r,y-r,2*r,2*r);else ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();return [x,y];
 }
 ctx.globalAlpha=showTest?.36:1;for(const p of s.train)dot(p,true,showTest);ctx.globalAlpha=1;
 if(showTest)for(const [index,p]of e.test.points.entries()){
  const [x,y]=dot(p,false),selected=index===s.selected;
  if(!p.correct||selected){ctx.strokeStyle=ink;ctx.lineWidth=selected?3.5:2;ctx.setLineDash(selected?[]:[5,4]);ctx.beginPath();ctx.arc(x,y,selected?29:23,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  ctx.fillStyle=paper;ctx.fillRect(x+15,y-37,48,38);ctx.fillStyle=ink;ctx.font=`${!p.correct||selected?'750':'550'} 29px system-ui`;ctx.textAlign='center';ctx.fillText(String(p.id),x+39,y-8);
 }
 ctx.textAlign='start';
}
export function hitGeneralizationPoint(canvas,event,s){
 if(!['reveal','done'].includes(s.phase)||s.view!=='test')return null;
 const rect=canvas.getBoundingClientRect();if(rect.width<=0||rect.height<=0||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return null;
 if(event.clientX<rect.left||event.clientY<rect.top||event.clientX>rect.left+rect.width||event.clientY>rect.top+rect.height)return null;
 let closest=null,distance=22;
 for(const [index,p]of s.test.entries()){
  const [x,y]=position(canvas,p),d=Math.hypot(rect.left+x/canvas.width*rect.width-event.clientX,rect.top+y/canvas.height*rect.height-event.clientY);
  if(d<distance){distance=d;closest=index;}
 }
 return closest;
}
