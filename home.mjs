import {createShowcaseScene,showcaseFrame,legacyRecommendationTarget,createHeroClock,heroMaterial} from './home-core.mjs';

function legacyRoute(){
 const target=legacyRecommendationTarget(location.hash,location.search);
 if(target){location.replace(target);return true;}return false;
}
if(!legacyRoute()){
 window.addEventListener('hashchange',legacyRoute);
 const theme=document.querySelector('#home-theme');
 const color=matchMedia('(prefers-color-scheme: dark)');let explicitTheme=false;
 const updateTheme=dark=>{document.documentElement.dataset.theme=dark?'dark':'light';theme.setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');};
 updateTheme(color.matches);theme.hidden=false;
 color.addEventListener('change',()=>{if(!explicitTheme)updateTheme(color.matches);});
 theme.addEventListener('click',()=>{explicitTheme=true;updateTheme(document.documentElement.dataset.theme!=='dark');});
 const canvas=document.querySelector('#hero-canvas'),fallback=document.querySelector('#hero-fallback'),motion=document.querySelector('#hero-motion');
 const ctx=canvas.getContext?.('2d');
 if(ctx){
  const scene=createShowcaseScene(),clock=createHeroClock(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let raf=0,epoch=0,disposed=false,lastPaint=-Infinity;
  const walls=new Set(scene.map.walls),cells=Array.from({length:scene.map.cols*scene.map.rows},(_,i)=>i).sort((a,b)=>(a%scene.map.cols+Math.floor(a/scene.map.cols))-(b%scene.map.cols+Math.floor(b/scene.map.cols)));
  const polygon=(points,fill)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();};
  function draw(elapsed){
   const bounds=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),width=Math.round(bounds.width*dpr),height=Math.round(bounds.height*dpr);
   if(width<1||height<1)return;
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,bounds.width,bounds.height);
   const dark=document.documentElement.dataset.theme==='dark',frame=showcaseFrame(scene,elapsed),visited=new Set(frame.visited),path=new Set(frame.path);
   const unit=Math.min(bounds.width/28,bounds.height/12.4),half=unit*.98,rise=unit*.35,ox=bounds.width/2-(scene.map.cols-scene.map.rows)*half/2,oy=(bounds.height-(scene.map.cols+scene.map.rows)*rise)/2+unit*.9;
   ctx.save();ctx.translate(bounds.width/2,bounds.height*.82);ctx.scale(1,.2);const shade=ctx.createRadialGradient(0,0,0,0,0,bounds.width*.39);shade.addColorStop(0,dark?'#00000090':'#53314624');shade.addColorStop(1,'#00000000');ctx.fillStyle=shade;ctx.beginPath();ctx.arc(0,0,bounds.width*.39,0,Math.PI*2);ctx.fill();ctx.restore();
   for(const i of cells){
    const x=i%scene.map.cols,y=Math.floor(i/scene.map.cols),px=ox+(x-y)*half,py=oy+(x+y)*rise,isWall=walls.has(i),endpoint=i===scene.map.start||i===scene.map.goal,onPath=path.has(i),active=i===frame.current;
    const h=isWall?unit*1.2:endpoint?unit*.55:active?unit*.3:unit*.13;
    const {top,left,right}=heroMaterial({wall:isWall,endpoint,path:onPath,active,visited:visited.has(i)},dark);
    const gap=unit*.055,w=half-gap,r=rise-gap;
    polygon([[px-w,py],[px,py+r],[px,py+r-h],[px-w,py-h]],left);
    polygon([[px,py+r],[px+w,py],[px+w,py-h],[px,py+r-h]],right);
    polygon([[px,py-r-h],[px+w,py-h],[px,py+r-h],[px-w,py-h]],top);
    if(endpoint){ctx.fillStyle='#ffffff';ctx.font=`600 ${Math.max(8,unit*.4)}px -apple-system,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(i===scene.map.start?'S':'G',px,py-h);}
   }
   canvas.dataset.frame=String(frame.visited.length);canvas.dataset.finished=String(frame.done);
  }
  function sync(){
   epoch++;cancelAnimationFrame(raf);raf=0;lastPaint=-Infinity;
   const state=clock.read();canvas.dataset.motion=state.running?'playing':state.reduced?'reduced':'paused';
   motion.disabled=state.reduced;motion.setAttribute('aria-pressed',String(state.paused));motion.innerHTML=state.reduced?'静态展示 · 已减少动态效果':state.paused?'<span aria-hidden="true">▶</span> 播放动画':'<span aria-hidden="true">Ⅱ</span> 暂停动画';
   draw(state.reduced?scene.duration-1:state.elapsed);
   if(state.running&&!disposed){const token=epoch;const tick=now=>{if(token!==epoch||disposed)return;const elapsed=clock.tick(now);if(now-lastPaint>=33){draw(elapsed);lastPaint=now;}raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);}
  }
  const visibility=()=>{clock.set({visible:!document.hidden});sync();};
  const preference=()=>{clock.set({reduced:reduced.matches});sync();};
  const resize=()=>draw(clock.read().reduced?scene.duration-1:clock.read().elapsed);
  motion.addEventListener('click',()=>{clock.set({paused:!clock.read().paused});sync();});
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',preference);
  let observer;
  if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{clock.set({inView:entries[0].isIntersecting});sync();},{threshold:0});observer.observe(canvas);}
  const sizeObserver='ResizeObserver' in window?new ResizeObserver(resize):null;
  sizeObserver?.observe(canvas);window.addEventListener('resize',resize);theme.addEventListener('click',resize);color.addEventListener('change',resize);
  window.addEventListener('pagehide',()=>{disposed=true;epoch++;cancelAnimationFrame(raf);observer?.disconnect();sizeObserver?.disconnect();});
  window.addEventListener('pageshow',()=>{if(disposed){disposed=false;observer?.observe(canvas);sizeObserver?.observe(canvas);clock.set({visible:!document.hidden});sync();}});
  fallback.hidden=true;canvas.hidden=false;motion.hidden=false;clock.set({visible:!document.hidden,reduced:reduced.matches});sync();
 }
}
