// Four-neighbor, unit-cost search. Counts are expanded nodes, not elapsed time.
function validateMap(map){
 const {cols,rows,start,goal,walls}=map;
 if(!Number.isInteger(cols)||!Number.isInteger(rows)||cols<1||rows<1||cols>64||rows>64||
  !Number.isInteger(start)||!Number.isInteger(goal)||start<0||goal<0||start>=cols*rows||goal>=cols*rows||
  !Array.isArray(walls)||walls.some(n=>!Number.isInteger(n)||n<0||n>=cols*rows||n===start||n===goal))throw new Error('Invalid map');
}
function neighbors(index,cols,rows){
 const x=index%cols,y=Math.floor(index/cols);
 return [[x+1,y],[x,y+1],[x-1,y],[x,y-1]].filter(([a,b])=>a>=0&&a<cols&&b>=0&&b<rows).map(([a,b])=>b*cols+a);
}
export function search(map,algorithm='bfs'){
 validateMap(map);
 if(!['bfs','astar'].includes(algorithm))throw new Error('Unknown algorithm');
 const {cols,rows,start,goal}=map,walls=new Set(map.walls),closed=new Set(),open=[start];
 const costs=new Map([[start,0]]),parents=new Map(),visited=[],frames=[];
 const h=n=>Math.abs(n%cols-goal%cols)+Math.abs(Math.floor(n/cols)-Math.floor(goal/cols));
 let found=false;
 while(open.length){
  // Stable sort retains insertion order when both f and h tie.
  if(algorithm==='astar')open.sort((a,b)=>(costs.get(a)+h(a))-(costs.get(b)+h(b))||h(a)-h(b));
  const current=open.shift();closed.add(current);visited.push(current);
  if(current===goal){found=true;frames.push({current,frontier:[...open]});break;}
  for(const next of neighbors(current,cols,rows)){
   if(walls.has(next)||closed.has(next))continue;
   const cost=costs.get(current)+1;
   if(!costs.has(next)||cost<costs.get(next)){
    costs.set(next,cost);parents.set(next,current);
    if(!open.includes(next))open.push(next);
   }
  }
  frames.push({current,frontier:[...open]});
 }
 const path=[];
 if(found){let at=goal;while(at!==undefined){path.push(at);at=parents.get(at);}path.reverse();}
 return {visited,frames,path,distance:found?path.length-1:null,found};
}
export function frameAt(result,step){
 const count=Math.min(result.visited.length,Math.max(0,Math.floor(Number(step)||0))),done=count===result.visited.length;
 const frame=result.frames[count-1];
 return {visited:result.visited.slice(0,count),frontier:done?[]:frame?[...frame.frontier]:[result.visited[0]],
  current:frame?.current??null,path:done?[...result.path]:[],done,distance:done?result.distance:null,found:done?result.found:null};
}
export function makeMap(preset='detour'){
 const map={cols:15,rows:11,start:76,goal:88,walls:[]};
 if(preset==='detour')for(let y=2;y<11;y++)map.walls.push(y*15+7);
 if(preset==='maze')for(const x of [4,8,11])for(let y=0;y<11;y++)if(x===8?y>1:y<9)map.walls.push(y*15+x);
 map.walls.sort((a,b)=>a-b);return map;
}
export function editMap(map,index,tool){
 if(!Number.isInteger(index)||index<0||index>=map.cols*map.rows)return map;
 const walls=new Set(map.walls);
 if(tool==='wall'||tool==='erase'){
  if(index===map.start||index===map.goal||walls.has(index)===(tool==='wall'))return map;
  if(tool==='wall')walls.add(index);else walls.delete(index);
  return {...map,walls:[...walls].sort((a,b)=>a-b)};
 }
 if(tool==='start'||tool==='goal'){
  if(index===map.start||index===map.goal)return map;
  walls.delete(index);return {...map,[tool]:index,walls:[...walls].sort((a,b)=>a-b)};
 }
 return map;
}
export function lineCells(from,to,cols){
 let x=from%cols,y=Math.floor(from/cols);const tx=to%cols,ty=Math.floor(to/cols),cells=[from];
 const dx=Math.abs(tx-x),dy=Math.abs(ty-y),sx=x<tx?1:-1,sy=y<ty?1:-1;let error=dx-dy;
 while(x!==tx||y!==ty){
  const twice=2*error;
  if(twice>-dy&&x!==tx){error-=dy;x+=sx;cells.push(y*cols+x);}
  if(twice<dx&&y!==ty){error+=dx;y+=sy;cells.push(y*cols+x);}
 }
 return cells;
}

// Comparison uses completed, independent runs; animation frames never become evidence.
export function captureRun(map){
 const saved={...map,walls:[...map.walls]};
 return {map:saved,traces:{bfs:search(saved,'bfs'),astar:search(saved,'astar')}};
}
export function mapChanges(before,after){
 if(before.cols!==after.cols||before.rows!==after.rows)throw Error('Comparison requires equal grid dimensions');
 const oldWalls=new Set(before.walls),newWalls=new Set(after.walls);
 const added=after.walls.filter(i=>!oldWalls.has(i)),removed=before.walls.filter(i=>!newWalls.has(i));
 const startMoved=before.start!==after.start,goalMoved=before.goal!==after.goal;
 const indices=[...new Set([...added,...removed,...(startMoved?[before.start,after.start]:[]),...(goalMoved?[before.goal,after.goal]:[])])].sort((a,b)=>a-b);
 return {added,removed,startMoved,goalMoved,indices};
}
export function compareRuns(before,after,algorithm='astar'){
 const changes=mapChanges(before.map,after.map),old=before.traces.bfs,now=after.traces.bfs;
 const measure=(a,b)=>({before:a,after:b,delta:a===null||b===null?null:b-a});
 const distance=measure(old.distance,now.distance);
 const bfs=measure(old.visited.length,now.visited.length),astar=measure(before.traces.astar.visited.length,after.traces.astar.visited.length);
 let reason,explanation;
 const wallCount=changes.added.length+changes.removed.length;
 if(!changes.indices.length){
  reason='unchanged';explanation='地图和起终点没有变化，两次搜索结果一致。试着只改一格墙，再跑一次，才能看清这一步的影响。';
 }else if(changes.startMoved||changes.goalMoved){
  reason='endpoints';explanation='起点或终点变了，找路任务也变了。可以比较两轮结果，但不能把变化只归因于墙；保持起终点不动再改一格，会更容易验证原因。';
 }else if(wallCount>1){
  reason='multiple';explanation=`这次一共加了 ${changes.added.length} 格墙、去掉 ${changes.removed.length} 格墙。下面是这些修改共同带来的结果，不能单独归因于某一格。可以撤销到只改一格，再验证。`;
 }else if(!old.found&&now.found){
  reason='reconnected';explanation='这个缺口把原本断开的起点和终点重新接通了。之前没有任何通路，现在两种算法都能找到出口。';
 }else if(old.found&&!now.found){
  reason='blocked';explanation='这格新增的墙切断了起点到终点的连接。原来的路线经过这里；现在两种算法找遍可达区域，也无法到达出口。';
 }else if(!old.found&&!now.found){
  reason='still-blocked';explanation='改完这一格，起点与终点仍然不连通。探索格数反映可达区域的大小，不能当成已经找到更短的路。';
 }else if(distance.delta<0){
  const {cols,start,goal}=after.map;
  const lowerBound=Math.abs(start%cols-goal%cols)+Math.abs(Math.floor(start/cols)-Math.floor(goal/cols));
  const aligned=start%cols===goal%cols||Math.floor(start/cols)===Math.floor(goal/cols);
  reason=now.distance===lowerBound?'direct':'shortcut';
  explanation=reason==='direct'&&aligned?
   `你打开了起终点之间的直达通道。新路线经过这个缺口，不必再绕过障碍：从 ${old.distance} 步变成 ${now.distance} 步，少走 ${-distance.delta} 步。`:
   `新路线经过你打开的缺口，因此可以抄近路：从 ${old.distance} 步变成 ${now.distance} 步，少走 ${-distance.delta} 步。${reason==='direct'?'现在已达到不考虑墙时的最短步数。':''}`;
 }else if(distance.delta>0){
  reason='detour';explanation=`这格墙挡住了原来的最短路线。现在仍有通路，但必须绕行：从 ${old.distance} 步变成 ${now.distance} 步，多走 ${distance.delta} 步。`;
 }else if(changes.added.some(i=>before.traces[algorithm].path.includes(i))){
  reason='alternative';explanation=`这格墙挡住了一条旧路线，但还有同样短的其他走法。路线形状可以变化，最短距离仍是 ${now.distance} 步。`;
 }else{
  reason='same-distance';explanation=changes.removed.length?
   `你打开了一个新位置，但它没有提供更短的通路。最短距离仍是 ${now.distance} 步；多一个选择，不一定少走一步。`:
   `这格墙没有挡住图中原来的最短路线，那条路仍然可走。所以最短距离保持 ${now.distance} 步；探索范围却可能变化。`;
 }
 const a=after.traces.astar;
 const searchExplanation=a.found&&a.visited.length===a.path.length?
  `A* 这轮探索的 ${a.visited.length} 格都在最终路径上，没有额外探索其他格子（包含起终点）。方向估计在这张图上恰好一路引向出口。`:
  'BFS 按离起点的距离逐层展开，A* 还考虑到终点的预计余程。路口改变会影响可探索的格子与展开顺序；探索量变了，不代表最短路线一定变了。';
 return {changes,distance,bfs,astar,reason,explanation,searchExplanation};
}
