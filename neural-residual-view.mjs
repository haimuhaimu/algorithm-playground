import {residualForward} from './neural-residual-core.mjs';
const colors=dark=>({ink:dark?'#f4f5f7':'#1d1d1f',paper:dark?'#1a1c21':'#ffffff',grid:dark?'#383e49':'#e5e7eb',signal:dark?'#9ec1fa':'#2b60be'});
export function paintResidualSignal(canvas,e,{dark=false}={}){
 const ctx=canvas.getContext('2d');if(!ctx)return;const {ink,paper,grid,signal}=colors(dark),w=canvas.width,h=canvas.height;
 const pos=([x,y])=>[w/2+x*w/3,h/2-y*h/3];
 ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);ctx.strokeStyle=grid;ctx.lineWidth=1;
 ctx.beginPath();for(const x of [-1,-.5,0,.5,1]){ctx.moveTo(pos([x,-1.2])[0],h*.1);ctx.lineTo(pos([x,1.2])[0],h*.9);}
 for(const y of [-1,-.5,0,.5,1]){ctx.moveTo(w*.1,pos([0,y])[1]);ctx.lineTo(w*.9,pos([0,y])[1]);}ctx.stroke();
 ctx.fillStyle=ink;ctx.font='600 28px system-ui';ctx.textAlign='center';ctx.fillText('0',w/2+15,h/2-12);
 const a=pos(e.signal.input),b=pos(e.signal.output);
 ctx.strokeStyle=dark?'#c0c4cd':'#666b76';ctx.lineWidth=4;ctx.beginPath();ctx.arc(...a,22,0,Math.PI*2);ctx.stroke();
 const distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
 if(distance>3){
  ctx.strokeStyle=signal;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
  const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);ctx.fillStyle=signal;ctx.beginPath();ctx.moveTo(...b);ctx.lineTo(b[0]-18*Math.cos(angle-.4),b[1]-18*Math.sin(angle-.4));ctx.lineTo(b[0]-18*Math.cos(angle+.4),b[1]-18*Math.sin(angle+.4));ctx.closePath();ctx.fill();
 }
 ctx.fillStyle=signal;ctx.strokeStyle=paper;ctx.lineWidth=3;ctx.beginPath();ctx.arc(...b,13,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.font='700 32px system-ui';ctx.textAlign='left';ctx.fillStyle=ink;
 if(distance<3)ctx.fillText('输入 = 输出',a[0]+30,a[1]+12);
 else{ctx.fillText('输入信号',a[0]+30,a[1]+12);ctx.fillText('输出信号',b[0]+26,b[1]-20);}
}
export function paintResidualField(canvas,model,points,{dark=false}={}){
 const ctx=canvas.getContext('2d');if(!ctx)return;const {ink,paper}=colors(dark),w=canvas.width,h=canvas.height,n=32;
 const samples=Array.from({length:n},(_,row)=>Array.from({length:n},(_,col)=>residualForward(model,(col+.5)*2/n-1,1-(row+.5)*2/n).probability));
 ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
 for(let row=0;row<n;row++)for(let col=0;col<n;col++){
  const p=samples[row][col];ctx.fillStyle=`rgba(${p>=.5?'65,156,155':'220,114,95'},${.12+Math.abs(p-.5)*(dark?.55:.35)})`;
  ctx.fillRect(col*w/n,row*h/n,Math.ceil(w/n),Math.ceil(h/n));
 }
 // Sampled real prediction boundary, intentionally pixel-stepped, not an invented curve.
 ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.beginPath();
 for(let row=0;row<n;row++)for(let col=0;col<n;col++){
  const label=samples[row][col]>=.5;
  if(col<n-1&&label!==(samples[row][col+1]>=.5)){ctx.moveTo((col+1)*w/n,row*h/n);ctx.lineTo((col+1)*w/n,(row+1)*h/n);}
  if(row<n-1&&label!==(samples[row+1][col]>=.5)){ctx.moveTo(col*w/n,(row+1)*h/n);ctx.lineTo((col+1)*w/n,(row+1)*h/n);}
 }ctx.stroke();
 for(const p of points){
  const x=(p.x+1)*w/2,y=(1-p.y)*h/2;ctx.fillStyle=p.label?'#287d7c':'#bb5141';ctx.strokeStyle=paper;ctx.lineWidth=3;
  ctx.beginPath();if(p.label)ctx.rect(x-12,y-12,24,24);else ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();ctx.stroke();
  if(Number(residualForward(model,p.x,p.y).probability>=.5)!==p.label){ctx.fillStyle=ink;ctx.font='700 24px system-ui';ctx.fillText('错',x+18,y+8);}
 }
 ctx.fillStyle=ink;ctx.font='20px system-ui';ctx.fillText('原始样本位置不动',12,h-12);
}
