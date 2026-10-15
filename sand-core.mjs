// A deterministic cellular automaton, intentionally not a fluid solver.
export const EMPTY=0, SAND=1, WATER=2, WALL=3;
const WIDTH=72, HEIGHT=48;

export function countMaterials(world){
 const counts={sand:0,water:0,wall:0};
 for(const cell of world.cells){
  if(cell===SAND)counts.sand++;else if(cell===WATER)counts.water++;else if(cell===WALL)counts.wall++;
 }
 return counts;
}

export function stepWorld(world){
 const {width,height,tick}=world,cells=world.cells.slice(),moved=new Uint8Array(cells.length);
 const reverse=tick%2===1;
 // Bottom-up traversal prevents a falling particle from moving twice.
 for(let y=height-1;y>=0;y--)for(let n=0;n<width;n++){
  const x=reverse?width-1-n:n,i=y*width+x,material=cells[i];
  if(moved[i]||(material!==SAND&&material!==WATER))continue;
  const direction=((x*13+y*7+tick)&1)?1:-1;
  const candidates=[[x,y+1],[x+direction,y+1],[x-direction,y+1]];
  if(material===WATER)candidates.push([x+direction,y],[x-direction,y]);
  for(const [nx,ny] of candidates){
   if(nx<0||nx>=width||ny>=height)continue;
   // A diagonal must have an open side passage, not tunnel through a wall corner.
   if(nx!==x&&ny!==y&&cells[y*width+nx]===WALL)continue;
   const j=ny*width+nx,target=cells[j];
   if(target!==EMPTY&&!(material===SAND&&target===WATER&&!moved[j]))continue;
   cells[j]=material;cells[i]=target;
   moved[i]=1;moved[j]=1;
   break;
  }
 }
 return {...world,cells,tick:tick+1};
}

export function paintStroke(world,from,to,material,radius=2){
 if(![EMPTY,SAND,WATER,WALL].includes(material))throw Error('Unknown material');
 if(!Number.isFinite(radius)||radius<0)throw Error('Invalid brush radius');
 const {width,height}=world,cells=world.cells.slice(),r=Math.min(8,Math.floor(radius));
 for(const p of [from,to])if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Invalid brush point');
 // Liang–Barsky clipping preserves the actual exit angle of a fast stroke.
 let enter=0,leave=1;
 const vx=to.x-from.x,vy=to.y-from.y;
 for(const [p,q] of [[-vx,from.x],[vx,width-1-from.x],[-vy,from.y],[vy,height-1-from.y]]){
  if(p===0){if(q<0)return {...world,cells};continue;}
  const t=q/p;if(p<0)enter=Math.max(enter,t);else leave=Math.min(leave,t);
  if(enter>leave)return {...world,cells};
 }
 const at=t=>({x:Math.round(from.x+t*vx),y:Math.round(from.y+t*vy)});
 const a=at(enter),b=at(leave);
 const stamp=(x,y)=>{
  for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
   if(dx*dx+dy*dy>r*r)continue;
   const nx=x+dx,ny=y+dy;
   if(nx<0||nx>=width||ny<0||ny>=height)continue;
   const i=ny*width+nx;
   if(material===EMPTY||material===WALL||cells[i]===EMPTY)cells[i]=material;
  }
 };
 let x=a.x,y=a.y,dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1,error=dx+dy;
 for(;;){
  stamp(x,y);if(x===b.x&&y===b.y)break;
  const e=2*error;if(e>=dy){error+=dy;x+=sx;}if(e<=dx){error+=dx;y+=sy;}
 }
 return {...world,cells};
}

export function createWorld(scene='splitter'){
 if(!['splitter','hourglass','empty'].includes(scene))throw Error('Unknown scene');
 const world={width:WIDTH,height:HEIGHT,cells:new Uint8Array(WIDTH*HEIGHT),tick:0};
 const set=(x,y,material)=>{world.cells[y*WIDTH+x]=material;};
 const line=(x1,y1,x2,y2)=>{world.cells=paintStroke(world,{x:x1,y:y1},{x:x2,y:y2},WALL,0).cells;};
 if(scene==='splitter'){
  // A roof splits a central pour into two open catch basins.
  line(36,15,19,31);line(36,15,53,31);
  line(7,33,7,44);line(7,44,29,44);line(29,44,29,37);
  line(42,37,42,44);line(42,44,64,44);line(64,44,64,33);
  for(let y=3;y<10;y++)for(let x=31;x<42;x++)set(x,y,SAND);
  for(let y=37;y<44;y++)for(let x=8;x<21;x++)set(x,y,WATER);
 }else if(scene==='hourglass'){
  line(14,4,14,12);line(14,12,33,25);line(38,25,57,12);line(57,12,57,4);
  line(33,27,14,40);line(38,27,57,40);line(14,40,14,45);line(57,40,57,45);line(14,45,57,45);
  for(let y=5;y<12;y++)for(let x=16;x<56;x++)set(x,y,SAND);
 }
 return world;
}
