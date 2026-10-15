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
