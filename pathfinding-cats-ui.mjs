import {CAT_ROUTE_SCENE,compareCatRoutes} from './pathfinding-cats.mjs?v=snack-routes-v1';

const {cols,rows,cats,goal,suggested}=CAT_ROUTE_SCENE;
const count=cols*rows,starts=new Map(cats.map(cat=>[cat.start,cat]));
const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
const position=index=>[index%cols,Math.floor(index/cols)];
const coordinates=index=>{const [x,y]=position(index);return `第 ${y+1} 行第 ${x+1} 列`;};
const steps=distance=>distance===null?'无路':`${distance} 步`;
const changeText=(before,after)=>{
 if(before===null||after===null)return before===after?'仍无路':after===null?'断开':'接通';
 const delta=after-before;return delta===0?'不变':`${delta>0?'+':'−'}${Math.abs(delta)} 步`;
};
function routeReason(cat,before,after,change){
 if(!change)return `现在看的是${cat.name}的路线。点改后图的一格，比较它走哪儿、要几步。`;
 const name=cat.name;
 if(before.distance===null)return after.distance===null?`${name}还是到不了零食点。`:`这一格让${name}有路可走了。`;
 if(after.distance===null)return `这格墙让${name}到不了零食点了。`;
 if(after.distance<before.distance)return `${name}从拆开的这一格抄近路，少走 ${before.distance-after.distance} 步。`;
 if(after.distance>before.distance)return `这格墙堵住了${name}原来的最短路，只能多绕 ${after.distance-before.distance} 步。`;
 if(before.path.every((cell,i)=>cell===after.path[i]))return `${name}原来的这条路还在，步数不变。`;
 return `${name}换了一条走法，但一样是 ${after.distance} 步。换路不一定要走更远。`;
}

export function mountCatRoutes(doc=globalThis.document){
 const $=id=>doc.getElementById(id),lab=$('cat-route-lab');
 if(!lab||lab.dataset.ready)return;
 lab.dataset.ready='true';
 const create=tag=>doc.createElement(tag);
 let selected=1,focusIndex=suggested,state=compareCatRoutes();
 const baseline=state.before;
 const editGrid=$('cat-route-after'),baseGrid=$('cat-route-before'),reset=$('cat-route-reset');
 const choices=cats.map(cat=>$('cat-route-'+cat.id));
 const cellSet=(grid,editable)=>{
  const list=Array.from({length:count},(_,index)=>{
   const el=create(editable?'button':'span'),cat=starts.get(index);
   if(editable){
    el.type='button';el.tabIndex=-1;
    el.addEventListener('click',()=>{
     if(cat||index===goal)return;
     moveFocus(index);setEdit(state.change?.index===index?null:index);
    });
    el.addEventListener('keydown',event=>{
     if(event.altKey||event.ctrlKey||event.metaKey||!Object.hasOwn(arrows,event.key))return;
     event.preventDefault();
     const [x,y]=position(index),[dx,dy]=arrows[event.key],nx=x+dx,ny=y+dy;
     if(nx>=0&&nx<cols&&ny>=0&&ny<rows)moveFocus(ny*cols+nx,true);
    });
   }
   if(cat){
    const img=create('img');img.src=`./studio-${cat.id}-portrait.png`;img.alt='';img.width=208;img.height=208;img.loading='lazy';el.append(img);
   }else if(index===goal){const mark=create('span');mark.textContent='★';el.append(mark);}
   return el;
  });
  grid.replaceChildren(...list);return list;
 };
 const oldCells=cellSet(baseGrid,false),newCells=cellSet(editGrid,true);
 function moveFocus(index,focus=false){
  newCells[focusIndex].tabIndex=-1;focusIndex=index;newCells[index].tabIndex=0;
  if(focus)newCells[index].focus();
 }
 function drawPath(container,path){
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox',`0 0 ${cols} ${rows}`);svg.setAttribute('focusable','false');
  if(path.length>1){
   const line=doc.createElementNS('http://www.w3.org/2000/svg','polyline');
   line.setAttribute('points',path.map(index=>position(index).map(value=>value+.5).join(',')).join(' '));svg.append(line);
  }
  container.replaceChildren(svg);
 }
 function paint(cells,world,editable){
  const walls=new Set(world.walls),path=new Set(world.routes[selected].path),change=state.change;
  for(let i=0;i<cells.length;i++){
   const el=cells[i],cat=starts.get(i),locked=Boolean(cat||i===goal),wall=walls.has(i),changed=change?.index===i;
   el.className=['cat-route-cell',wall?'wall':'',locked?'endpoint':'',i===goal?'snack':'',changed?'changed':'',editable&&!change&&i===suggested?'suggested':''].filter(Boolean).join(' ');
   if(!editable)continue;
   const kind=cat?`${cat.name}的起点`:i===goal?'零食点':wall?'墙':'空地';
   el.setAttribute('aria-label',`${coordinates(i)}，${kind}${path.has(i)?'，选中的路线经过':''}${locked?'，不能改':changed?'，再点恢复原图':wall?'，点按拆墙':'，点按加墙'}`);
   if(locked)el.setAttribute('aria-disabled','true');else el.setAttribute('aria-pressed',String(changed));
  }
 }
 function renderMaps(){
  const cat=cats[selected],old=baseline.routes[selected],current=state.after.routes[selected];
  paint(oldCells,baseline,false);paint(newCells,state.after,true);
  drawPath($('cat-route-before-track'),old.path);drawPath($('cat-route-after-track'),current.path);
  baseGrid.setAttribute('aria-label',`原图：${cat.name}走 ${steps(old.distance)}到零食点`);
  choices.forEach((button,index)=>button.setAttribute('aria-pressed',String(selected===index)));
  $('cat-route-reason').textContent=routeReason(cat,old,current,state.change);
 }
 function renderResults(){
  const winners=state.after.routes.filter(route=>route.distance!==null);
  const min=Math.min(...winners.map(route=>route.distance));
  const names=winners.filter(route=>route.distance===min).map(route=>cats.find(cat=>cat.id===route.id).name);
  $('cat-route-winner').textContent=names.length?`${state.change?'改后':'原图'}最短：${names.join('、')}${names.length>1?'并列':''} · ${steps(min)}`:'改后三只猫都到不了零食点。';
  $('cat-route-edit').textContent=state.change?`${state.change.kind==='added'?'加墙':'拆墙'}：${coordinates(state.change.index)}。`:'试试拆掉「改后」图里带虚线的墙。';
  const body=$('cat-route-results');
  body.replaceChildren(...cats.map((cat,i)=>{
   const row=create('tr'),name=create('th'),a=baseline.routes[i].distance,b=state.after.routes[i].distance;
   name.setAttribute('scope','row');name.textContent=cat.name;row.append(name);
   for(const text of [steps(a),steps(b),changeText(a,b)]){const cell=create('td');cell.textContent=text;row.append(cell);}
   return row;
  }));
  reset.disabled=!state.change;
 }
 function setEdit(index){state=compareCatRoutes(index);renderMaps();renderResults();}
 choices.forEach((button,index)=>button.addEventListener('click',()=>{selected=index;renderMaps();}));
 reset.addEventListener('click',()=>{moveFocus(suggested,true);setEdit(null);});
 // Main arena owns its global history only when working outside this case.
 lab.addEventListener('keydown',event=>{
  if(event.key==='Escape'||((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())))event.stopPropagation();
 });
 moveFocus(suggested);renderMaps();renderResults();
}

if(globalThis.document)mountCatRoutes();
