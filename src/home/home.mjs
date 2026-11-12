import {createShowcaseScene,showcaseFrame,showcaseCats,legacyRecommendationTarget,createHeroClock,heroMaterial} from './home-core.mjs?v=cat-run-v1';
import {studioMotionAssets,studioPose} from '../shared/studio-cat-assets.mjs';
import {preset,POSTCARD_COLORS} from '../experiments/pixel/pixel-core.mjs?v=studio-postcards-v1';

const catColors={
 heim:{edge:'#303744',body:'#687a8f',shade:'#4c5d73',top:'#93a4b2',ears:'#a7848d',face:'#697989',muzzle:'#a3adba',eyes:'#ffcc79',nose:'#394150'},
 bobby:{edge:'#4e3e53',body:'#d0becb',shade:'#a38d9e',top:'#eadcd9',ears:'#a18ca5',face:'#8c7898',muzzle:'#e3cfd7',eyes:'#b9d9ee',nose:'#68546b'},
 chouchou:{edge:'#65515a',body:'#fff4dc',shade:'#d1bdb0',top:'#fff9ec',ears:'#b9959a',face:'#b5a2a1',muzzle:'#fff7e8',eyes:'#91b9df',nose:'#bd858e'},
};
const phaseLabel={
 searching:' · 三猫在起点等',
 running:' · 路线找到了，三猫出发',
 arrived:' · 三只猫都到了！',
 blocked:' · 没有可走的路线',
};
const lerp=(a,b,t)=>a+(b-a)*t;
function drawStudioCat(ctx,cat,unit,image,pose){
 const width=unit*pose.width,height=width*image.naturalHeight/image.naturalWidth;
 const tilt=pose.moving?Math.sin(cat.gait*Math.PI)*.048:0;
 ctx.save();
 ctx.translate(cat.x,cat.y);
 ctx.fillStyle='#21182735';
 ctx.beginPath();ctx.ellipse(0,unit*.025,unit*.75,unit*.095,0,0,Math.PI*2);ctx.fill();
 ctx.rotate(tilt);
 ctx.scale(pose.moving?cat.facing*pose.facing:1,1);
 ctx.drawImage(image,-width/2,-height,width,height);
 ctx.restore();
}


// A small code-native placeholder is only used until the studio art loads.
function drawCat(ctx,cat,unit){
 const p=catColors[cat.id],pixel=unit*.104;
 const step=cat.gait?Math.sin(cat.gait*Math.PI):0;
 ctx.save();
 ctx.translate(Math.round(cat.x),Math.round(cat.y));
 ctx.fillStyle='#21182735';
 ctx.beginPath();ctx.ellipse(0,unit*.025,unit*.66,unit*.095,0,0,Math.PI*2);ctx.fill();
 ctx.scale(pixel*cat.facing,pixel);
 const r=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
 const tailRise=step>.25?1:0;
 // A thin curled Siamese tail, a stocky blue cat, and a cream ruff.
 r(-12,-7-tailRise,3,2,p.edge);r(-10,-6-tailRise,4,3,p.edge);
 r(-11,-7-tailRise,2,1,p.top);r(-9,-5-tailRise,3,1,p.shade);
 if(cat.id==='chouchou')r(-12,-6-tailRise,4,2,p.body);
 const hind=Math.round(step*2),front=-hind;
 r(-6+hind,-4,3,4,p.edge);r(3+front,-4,3,4,p.edge);
 r(-6+hind,-3,2,2,p.shade);r(3+front,-3,2,2,p.shade);
 r(-6+hind,-2,2,1,p.top);r(3+front,-2,2,1,p.top);
 r(-8,-9,12,6,p.edge);r(-7,-10,9,6,p.body);r(-7,-9,10,2,p.top);
 r(-7,-5,11,1,p.shade);
 if(cat.id==='heim')r(-6,-8,8,3,p.body);
 if(cat.id==='chouchou'){r(-8,-7,3,2,p.body);r(-6,-4,5,1,p.top);}
 r(-1,-13,10,8,p.edge);r(0,-14,8,8,p.body);
 r(0,-16,2,4,p.edge);r(6,-16,2,4,p.edge);
 r(1,-15,1,2,p.ears);r(6,-15,1,2,p.ears);
 r(1,-13,6,1,p.top);r(0,-11,8,4,p.face);
 r(1,-11,2,1,p.eyes);r(6,-11,2,1,p.eyes);
 r(2,-11,1,1,p.edge);r(7,-11,1,1,p.edge);
 r(3,-9,5,2,p.muzzle);r(5,-9,2,1,p.nose);
 if(cat.id==='chouchou'){r(4,-12,2,3,p.muzzle);r(0,-7,7,2,p.top);r(1,-5,4,2,p.body);}
 if(cat.id==='heim'){r(1,-6,6,1,'#cf5379');r(3,-5,2,2,'#ac345e');}
 ctx.restore();
}

function legacyRoute(){
 const target=legacyRecommendationTarget(location.hash,location.search);
 if(target){location.replace(target);return true;}return false;
}
function showPostcardPreviews(){
 const cards=document.querySelector('.home-postcards');
 if(!cards)return;
 for(const canvas of cards.querySelectorAll('canvas[data-postcard]')){
  const ctx=canvas.getContext?.('2d');
  if(!ctx)return; // Preserve the existing image if the preview cannot draw.
  preset(canvas.dataset.postcard).forEach((color,i)=>{
   ctx.fillStyle=POSTCARD_COLORS[color];
   ctx.fillRect(i%16,Math.floor(i/16),1,1);
  });
 }
 cards.previousElementSibling.hidden=true;
 cards.hidden=false;
}
if(!legacyRoute()){
 window.addEventListener('hashchange',legacyRoute);
 showPostcardPreviews();
 const theme=document.querySelector('#home-theme');
 const color=matchMedia('(prefers-color-scheme: dark)');let explicitTheme=false;
 const updateTheme=dark=>{document.documentElement.dataset.theme=dark?'dark':'light';theme.setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');};
 updateTheme(color.matches);theme.hidden=false;
 color.addEventListener('change',()=>{if(!explicitTheme)updateTheme(color.matches);});
 theme.addEventListener('click',()=>{explicitTheme=true;updateTheme(document.documentElement.dataset.theme!=='dark');});
 const canvas=document.querySelector('#hero-canvas'),fallback=document.querySelector('#hero-fallback'),motion=document.querySelector('#hero-motion'),catStage=document.querySelector('#hero-cat-stage');
 const ctx=canvas.getContext?.('2d');
 if(ctx){
  const scene=createShowcaseScene(),clock=createHeroClock(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const studioImages=new Map();
  const observesHero='IntersectionObserver' in window;
  // Keep the animation clock unchanged; only image requests wait for the viewport signal.
  let heroInViewport=!observesHero;
  let raf=0,epoch=0,disposed=false,lastPaint=-Infinity;
  const col=i=>i%scene.map.cols,row=i=>Math.floor(i/scene.map.cols),depth=i=>col(i)+row(i);
  const walls=new Set(scene.map.walls),cells=Array.from({length:scene.map.cols*scene.map.rows},(_,i)=>i).sort((a,b)=>depth(a)-depth(b));
  const polygon=(points,fill)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();};
  function draw(elapsed){
   const bounds=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),width=Math.round(bounds.width*dpr),height=Math.round(bounds.height*dpr);
   if(width<1||height<1)return;
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,bounds.width,bounds.height);
   const dark=document.documentElement.dataset.theme==='dark',frame=showcaseFrame(scene,elapsed),visited=new Set(frame.visited),path=new Set(frame.path);
   const pack=showcaseCats(scene,elapsed);
   const unit=Math.min(bounds.width/28,bounds.height/12.4),half=unit*.98,rise=unit*.35,ox=bounds.width/2-(scene.map.cols-scene.map.rows)*half/2,oy=(bounds.height-(scene.map.cols+scene.map.rows)*rise)/2+unit*.9;
   const isEndpoint=i=>i===scene.map.start||i===scene.map.goal;
   const tileHeight=i=>unit*(walls.has(i)?1.2:isEndpoint(i) ? .55 : i===frame.current ? .3 : .13);
   const actors=pack.cats.map((cat,i)=>{
    const {from,to,progress,spread}=cat;
    const x=lerp(col(from),col(to),progress),y=lerp(row(from),row(to),progress);
    const ground=lerp(tileHeight(from),tileHeight(to),progress);
    return {...cat,
     x:ox+(x-y)*half+(i-1)*unit*1.13*spread,
     y:oy+(x+y)*rise-ground-unit*(.08+Math.sin(progress*Math.PI)*.18+(i===1 ? .38 : 0)*spread),
     depth:x+y+(i===1?-.2:0)*spread,
    };
   }).sort((a,b)=>a.depth-b.depth);
   ctx.save();ctx.translate(bounds.width/2,bounds.height*.82);ctx.scale(1,.2);const shade=ctx.createRadialGradient(0,0,0,0,0,bounds.width*.39);shade.addColorStop(0,dark?'#00000090':'#53314624');shade.addColorStop(1,'#00000000');ctx.fillStyle=shade;ctx.beginPath();ctx.arc(0,0,bounds.width*.39,0,Math.PI*2);ctx.fill();ctx.restore();
   let actor=0;
   for(let tile=0;tile<cells.length;tile++){
    const i=cells[tile],x=col(i),y=row(i),px=ox+(x-y)*half,py=oy+(x+y)*rise,isWall=walls.has(i),endpoint=isEndpoint(i),onPath=path.has(i),active=i===frame.current;
    const h=tileHeight(i);
    const {top,left,right}=heroMaterial({wall:isWall,endpoint,path:onPath,active,visited:visited.has(i)},dark);
    const gap=unit*.055,w=half-gap,r=rise-gap;
    polygon([[px-w,py],[px,py+r],[px,py+r-h],[px-w,py-h]],left);
    polygon([[px,py+r],[px+w,py],[px+w,py-h],[px,py+r-h]],right);
    polygon([[px,py-r-h],[px+w,py-h],[px,py+r-h],[px-w,py-h]],top);
    if(endpoint){ctx.fillStyle='#ffffff';ctx.font=`600 ${Math.max(8,unit*.4)}px -apple-system,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(i===scene.map.start?'S':'G',px,py-h);}
    const nextDepth=tile+1<cells.length?depth(cells[tile+1]):Infinity;
    while(actor<actors.length&&actors[actor].depth<nextDepth){
     const cat=actors[actor++];
     const pose=studioPose(cat),art=studioImages.get(pose?.src);
     if(art?.complete&&art.naturalWidth)drawStudioCat(ctx,cat,unit,art,pose);
     else drawCat(ctx,cat,unit);
    }
   }
   canvas.dataset.frame=String(frame.visited.length);canvas.dataset.finished=String(frame.done);
   if(canvas.dataset.catPhase!==pack.phase){
    canvas.dataset.catPhase=pack.phase;
    catStage.textContent=phaseLabel[pack.phase];
   }
  }
  function sync(){
   epoch++;cancelAnimationFrame(raf);raf=0;lastPaint=-Infinity;
   const state=clock.read();canvas.dataset.motion=state.running?'playing':state.reduced?'reduced':'paused';
   motion.disabled=state.reduced;motion.setAttribute('aria-pressed',String(state.paused));motion.innerHTML=state.reduced?'静态展示 · 已减少动态效果':state.paused?'<span aria-hidden="true">▶</span> 播放动画':'<span aria-hidden="true">Ⅱ</span> 暂停动画';
   draw(state.reduced?scene.duration-1:state.elapsed);
   if(state.running&&!disposed){
    // Prewarm during the search, before any cat needs its running pose.
    if(heroInViewport&&!document.hidden&&!reduced.matches)loadArt('run');
    const token=epoch;const tick=now=>{if(token!==epoch||disposed)return;const elapsed=clock.tick(now);if(now-lastPaint>=33){draw(elapsed);lastPaint=now;}raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
   }
  }
  const visibility=()=>{clock.set({visible:!document.hidden});sync();};
  const preference=()=>{clock.set({reduced:reduced.matches});sync();};
  const resize=()=>draw(clock.read().reduced?scene.duration-1:clock.read().elapsed);
  let artReady=0;
  function loadArt(pose){
   for(const src of studioMotionAssets){
    if(!src.endsWith(`-${pose}.png`)||studioImages.has(src))continue;
    const image=new Image();
    studioImages.set(src,image);
    image.addEventListener('load',()=>{
     if(++artReady===studioMotionAssets.length)canvas.dataset.catArt='studio';
     if(!disposed)resize();
    },{once:true});
    image.src=src;
   }
  }
  loadArt('idle');
  motion.addEventListener('click',()=>{clock.set({paused:!clock.read().paused});sync();});
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',preference);
  let observer;
  if(observesHero){observer=new IntersectionObserver(entries=>{
   if(disposed)return;
   heroInViewport=entries.at(-1).isIntersecting;clock.set({inView:heroInViewport});sync();
  },{threshold:0});observer.observe(canvas);}
  const sizeObserver='ResizeObserver' in window?new ResizeObserver(resize):null;
  sizeObserver?.observe(canvas);window.addEventListener('resize',resize);theme.addEventListener('click',resize);color.addEventListener('change',resize);
  window.addEventListener('pagehide',()=>{
   disposed=true;heroInViewport=!observesHero;epoch++;cancelAnimationFrame(raf);
   observer?.disconnect();observer?.takeRecords();sizeObserver?.disconnect();
  });
  window.addEventListener('pageshow',()=>{if(disposed){disposed=false;observer?.observe(canvas);sizeObserver?.observe(canvas);clock.set({visible:!document.hidden});sync();}});
  fallback.hidden=true;canvas.hidden=false;motion.hidden=false;clock.set({visible:!document.hidden,reduced:reduced.matches});sync();
 }
}
