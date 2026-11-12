import {CAT_ROUTE_SCENE,compareCatRoutes} from './pathfinding-cats.mjs?v=snack-predict-v1';

const {cols,rows,cats,goal}=CAT_ROUTE_SCENE;
const count=cols*rows,starts=new Map(cats.map(cat=>[cat.start,cat]));
const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
const position=index=>[index%cols,Math.floor(index/cols)];
const coordinates=index=>{const [x,y]=position(index);return `第 ${y+1} 行第 ${x+1} 列`;};
const steps=distance=>distance===null?'无路':`${distance} 步`;
const changeText=(before,after)=>{
 if(before===null||after===null)return before===after?'仍无路':after===null?'断开':'接通';
 const delta=after-before;return delta===0?'不变':`${delta>0?'+':'−'}${Math.abs(delta)} 步`;
};
const samePath=(before,after)=>before.length===after.length&&before.every((cell,i)=>cell===after[i]);
function routeImpact(name,before,after){
 const a=before.distance,b=after.distance;
 if(a===b)return samePath(before.path,after.path)?'':`${name}改道，仍走 ${steps(b)}`;
 if(a===null||b===null)return `${name} ${steps(a)} → ${steps(b)}`;
 return `${name} ${a} → ${steps(b)}（${b<a?'少':'多'}走 ${Math.abs(b-a)} 步）`;
}
function routeReason(cat,before,after,change){
 if(!change)return `现在看的是${cat.name}的路线。点改后图的一格，比较它走哪儿、要几步。`;
 const name=cat.name;
 if(before.distance===null)return after.distance===null?`${name}还是到不了零食点。`:`这一格让${name}有路可走了。`;
 if(after.distance===null)return `这格墙让${name}到不了零食点了。`;
 if(after.distance<before.distance)return `${name}从拆开的这一格抄近路，少走 ${before.distance-after.distance} 步。`;
 if(after.distance>before.distance)return `这格墙堵住了${name}原来的最短路，只能多绕 ${after.distance-before.distance} 步。`;
 if(samePath(before.path,after.path))return `${name}原来的这条路还在，步数不变。`;
 return `${name}换了一条走法，但一样是 ${after.distance} 步。换路不一定要走更远。`;
}

function challengeResult(state,selected){
 const routes=state.after.routes,bobby=routes[1].distance,old=state.before.routes[1].distance;
 const others=routes.filter((_,i)=>i!==1).map(route=>route.distance).filter(distance=>distance!==null);
 const best=Math.min(...others);
 if(bobby!==null&&bobby<best)return `做到了：波比 ${old} → ${bobby} 步，比另外两只的路都短。换另一格试试：拆墙一定能抄近路吗？`;
 if(bobby!==null&&bobby===best)return `这次只是并列最短：波比 ${old} → ${bobby} 步，另外也有猫只走 ${bobby} 步。变短了，不一定就比别人短。再换一格试试。`;
 if(bobby===old)return `波比仍要走 ${old} 步，这一格没有缩短它的路。${selected===1?'看看波比原图的粉线':'先切到波比，看看它原图的粉线'}，再选另一格检验。`;
 if(bobby===null)return '这次波比到不了零食点。改动的位置比“加墙还是拆墙”更重要，换一格再试。';
 return `波比 ${old} → ${bobby} 步，还不是最短。看看它绕去了哪里，再选另一格检验。`;
}

export function mountCatRoutes(doc=globalThis.document){
 const $=id=>doc.getElementById(id),lab=$('cat-route-lab');
 if(!lab||lab.dataset.ready)return;
 lab.dataset.ready='true';
 const create=tag=>doc.createElement(tag);
 let selected=1,focusIndex=0,state=compareCatRoutes(),challenge=false,freeIndex=null;
 const baseline=state.before;
 const editGrid=$('cat-route-after'),baseGrid=$('cat-route-before'),reset=$('cat-route-reset');
 const challengeButton=$('cat-route-challenge'),run=$('cat-route-run');
 const choices=cats.map(cat=>$('cat-route-'+cat.id));
 const cellSet=(grid,editable)=>{
  const list=Array.from({length:count},(_,index)=>{
   const el=create(editable?'button':'span'),cat=starts.get(index);
   if(editable){
    el.type='button';el.tabIndex=-1;
    el.addEventListener('click',()=>{
     if(cat||index===goal)return;
     moveFocus(index);setEdit(state.change?.index===index?null:index);
     revealEditNotice(el);
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
  const walls=new Set(world.walls),path=new Set(world.routes?.[selected].path||[]),change=state.change;
  for(let i=0;i<cells.length;i++){
   const el=cells[i],cat=starts.get(i),locked=Boolean(cat||i===goal),wall=walls.has(i),changed=change?.index===i;
   el.className=['cat-route-cell',wall?'wall':'',locked?'endpoint':'',i===goal?'snack':'',changed?'changed':''].filter(Boolean).join(' ');
   if(!editable)continue;
   const kind=cat?`${cat.name}的起点`:i===goal?'零食点':wall?'墙':'空地';
   el.setAttribute('aria-label',`${coordinates(i)}，${kind}${path.has(i)?'，选中的路线经过':''}${locked?'，不能改':changed?'，再点恢复原图':wall?'，点按拆墙':'，点按加墙'}`);
   if(locked)el.setAttribute('aria-disabled','true');else el.setAttribute('aria-pressed',String(changed));
  }
 }
 function renderMaps(){
  const cat=cats[selected],old=baseline.routes[selected],current=state.after.routes?.[selected];
  paint(oldCells,baseline,false);paint(newCells,state.after,true);
  drawPath($('cat-route-before-track'),old.path);drawPath($('cat-route-after-track'),current?.path||[]);
  baseGrid.setAttribute('aria-label',`原图：${cat.name}走 ${steps(old.distance)}到零食点`);
  choices.forEach((button,index)=>button.setAttribute('aria-pressed',String(selected===index)));
  $('cat-route-reason').textContent=current?routeReason(cat,old,current,state.change):`原图里${cat.name}要走 ${old.distance} 步。改后会怎样？选好一格，再亲手检验。`;
  $('cat-route-after-title').textContent=challenge?(current?'检验结果':'你选的改法'):'改后';
  $('cat-route-after-hint').textContent=challenge?(current?'点另一格再试':'还没检验'):'在这张图点一格';
 }
 function renderResults(restored=false){
  const pending=state.after.routes===null;
  const winners=(state.after.routes||[]).filter(route=>route.distance!==null);
  const min=Math.min(...winners.map(route=>route.distance));
  const names=winners.filter(route=>route.distance===min).map(route=>cats.find(cat=>cat.id===route.id).name);
  $('cat-route-winner').textContent=pending?'目标：波比的路比另外两只都短':names.length?`${state.change?'改后':'原图'}最短：${names.join('、')}${names.length>1?'并列':''} · ${steps(min)}`:'改后三只猫都到不了零食点。';
  const impacts=state.change&&!pending?cats.map((cat,i)=>routeImpact(cat.name,baseline.routes[i],state.after.routes[i])).filter(Boolean):[];
  $('cat-route-edit').textContent=pending
   ?state.change?`已选${state.change.kind==='added'?'加墙':'拆墙'}，还没有检验；换一格会替换这次选择。`:'原图波比要走 11 步，另外两只各 9 步。你会改哪一格？'
   :state.change
   ?`${state.change.kind==='added'?'加墙':'拆墙'} · ${impacts.join('；')||'三只猫图上的路线和步数都没变'}。`
   :restored?'已恢复原图，可以再试一格。':'点「改后」图的一格，看看谁的路线会变。';
  $('cat-route-edit-position').textContent=state.change?`改动位置：${coordinates(state.change.index)}。`:'';
  const body=$('cat-route-results');
  body.replaceChildren(...cats.map((cat,i)=>{
   const row=create('tr'),name=create('th'),a=baseline.routes[i].distance,b=state.after.routes?.[i].distance;
   name.setAttribute('scope','row');name.textContent=cat.name;row.append(name);
   for(const text of [steps(a),pending?'待检验':steps(b),pending?'—':changeText(a,b)]){const cell=create('td');cell.textContent=text;row.append(cell);}
   return row;
  }));
  reset.disabled=!state.change;
  $('cat-route-trial').hidden=!challenge;
  run.disabled=!state.change||!pending;
  run.textContent=pending?'检验这一步':'已检验 · 换一格再试';
  $('cat-route-trial-status').textContent=!challenge?'':pending
   ?state.change?`${coordinates(state.change.index)}${state.change.kind==='added'?'加墙':'拆墙'}。选定了？点按钮看三只猫各走几步。`:'先点地图选一格，改后路线暂时不公布。'
   :challengeResult(state,selected);
  challengeButton.setAttribute('aria-pressed',String(challenge));
  challengeButton.textContent=challenge?'退出挑战，回到自由改图':'挑战：帮波比找近路';
  $('cat-route-help').textContent=challenge?'只改一格，让波比比另外两只都少走几步。每次从同一张原图出发，不叠加改动。方向键移动，空格或 Enter 选一格。':'每次只改一格，不叠加。点墙拆开，点空地加墙，再比较三只猫的路。键盘用方向键移动，空格或 Enter 改一格。';
 }
 function setEdit(index){state=compareCatRoutes(index,{reveal:!challenge});renderMaps();renderResults(index===null);}
 function revealEditNotice(cell){
  const view=doc.defaultView;
  if(!view?.scrollBy)return;
  const {top}=$('cat-route-notice').getBoundingClientRect();
  if(top>=0)return;
  const square=cell.getBoundingClientRect(),shift=Math.ceil(8-top);
  // Only nudge the viewport when the receipt and the edited square can both stay in view.
  if(square.top>=0&&square.bottom+shift<=view.innerHeight)view.scrollBy({top:-shift,behavior:'instant'});
 }
 choices.forEach((button,index)=>button.addEventListener('click',()=>{selected=index;renderMaps();renderResults();}));
 reset.addEventListener('click',()=>{moveFocus(0,true);setEdit(null);});
 challengeButton.addEventListener('click',()=>{
  if(!challenge)freeIndex=state.change?.index??null;
  challenge=!challenge;
  moveFocus(0);setEdit(challenge?null:freeIndex);
 });
 run.addEventListener('click',()=>{
  if(!challenge||!state.change||state.after.routes)return;
  state=compareCatRoutes(state.change.index);renderMaps();renderResults();
 });
 // Main arena owns its global history only when working outside this case.
 lab.addEventListener('keydown',event=>{
  if(event.key==='Escape'||((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())))event.stopPropagation();
 });
 moveFocus(0);renderMaps();renderResults();
}

if(globalThis.document)mountCatRoutes();
