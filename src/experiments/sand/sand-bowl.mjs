import {EMPTY,WALL,WATER,paintStroke} from './sand-core.mjs?v=chouchou-bowl-v1';

// The existing cat-bowl floor is three cells thick. Remove walls only:
// reopening must not erase a water/sand cell that has since entered the gap.
const outlet={x:36,top:41,bottom:43};
export function openBowl(world){
 let next=world;
 for(let y=outlet.top;y<=outlet.bottom;y++){
  if(next.cells[y*next.width+outlet.x]!==WALL)continue;
  const point={x:outlet.x,y};next=paintStroke(next,point,point,EMPTY,0);
 }
 return next;
}
export function observeBowl(world){
 let waterBelow=0,wallsRemaining=0;
 for(let y=outlet.bottom+1;y<world.height;y++)for(let x=0;x<world.width;x++){
  if(world.cells[y*world.width+x]===WATER)waterBelow++;
 }
 for(let y=outlet.top;y<=outlet.bottom;y++)if(world.cells[y*world.width+outlet.x]===WALL)wallsRemaining++;
 return {waterBelow,openingOpen:wallsRemaining===0,wallsRemaining};
}
