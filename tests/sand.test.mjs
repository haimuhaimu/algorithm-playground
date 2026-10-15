import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY,SAND,WATER,WALL,createWorld,stepWorld,paintStroke,countMaterials} from '../sand-core.mjs';

const world=rows=>({width:rows[0].length,height:rows.length,cells:Uint8Array.from(rows.flat()),tick:0});
const rows=w=>Array.from({length:w.height},(_,y)=>Array.from(w.cells.slice(y*w.width,(y+1)*w.width)));

test('sand falls exactly one cell per tick without mutating its input',()=>{
 const w=world([[0,1,0],[0,0,0],[0,0,0],[0,0,0]]),before=w.cells.slice(),next=stepWorld(w);
 assert.deepEqual(rows(next),[[0,0,0],[0,1,0],[0,0,0],[0,0,0]]);
 assert.deepEqual(w.cells,before);assert.equal(w.tick,0);assert.equal(next.tick,1);
});
test('sand uses an open diagonal around a blocked cell',()=>{
 const next=stepWorld(world([[3,1,0],[3,3,0],[3,3,3]]));
 assert.deepEqual(rows(next),[[3,0,0],[3,3,1],[3,3,3]]);
});
test('walls and finite edges are solid and horizontal moves cannot wrap',()=>{
 const w=world([[0,3,2],[3,3,3],[1,3,2]]);
 assert.deepEqual(rows(stepWorld(w)),rows(w));
});
test('water flows one lateral cell when blocked below',()=>{
 const next=stepWorld(world([[3,2,0,0],[3,3,3,3]]));
 assert.deepEqual(rows(next),[[3,0,2,0],[3,3,3,3]]);
});
test('sand displaces trapped water once while preserving both particles',()=>{
 const w=world([[3,1,3],[3,2,3],[3,3,3]]),next=stepWorld(w);
 assert.deepEqual(rows(next),[[3,2,3],[3,1,3],[3,3,3]]);
 assert.deepEqual(countMaterials(next),{sand:1,water:1,wall:7});
});
test('sand cannot displace water that already moved this tick',()=>{
 const next=stepWorld(world([[3,1,3],[3,2,3],[3,2,3],[3,0,3],[3,3,3]]));
 assert.deepEqual(rows(next),[[3,0,3],[3,1,3],[3,2,3],[3,2,3],[3,3,3]]);
});
test('neither sand nor water can cut diagonally through a wall corner',()=>{
 for(const material of [SAND,WATER]){
  const w=world([[3,material,3],[0,3,0],[3,3,3]]);
  assert.deepEqual(rows(stepWorld(w)),rows(w));
 }
});
test('splitter actually guides falling sand into both side basins',()=>{
 let w=createWorld('splitter');
 for(let i=0;i<180;i++)w=stepWorld(w);
 let left=0,right=0;
 w.cells.forEach((cell,i)=>{
  if(cell!==SAND)return;
  const x=i%w.width,y=Math.floor(i/w.width);
  if(y<33){
   const roof=Array.from(w.cells.slice(y*w.width,(y+1)*w.width),(c,x)=>c===WALL?x:-1).filter(x=>x>=0);
   assert.ok(roof.length&&((x<Math.min(...roof))||(x>Math.max(...roof))),'grains may rest above the roof, never inside it');
   return;
  }
  assert.ok(y>=33&&y<44,'sand must rest inside a basin');
  assert.ok((x>7&&x<29)||(x>42&&x<64),'sand cannot leak through the roof');
  if(x<36)left++;else right++;
 });
 assert.ok(left>20&&right>20,'both basins receive sand');
});
test('closing the hourglass neck holds all sand above the seal',()=>{
 let w=createWorld('hourglass');
 w=paintStroke(w,{x:32,y:25},{x:39,y:25},WALL,0);
 for(let i=0;i<300;i++)w=stepWorld(w);
 assert.equal(countMaterials(w).sand,280);
 w.cells.forEach((cell,i)=>{if(cell===SAND)assert.ok(Math.floor(i/w.width)<25);});
});
test('fixed initial states replay identically and conserve every material',()=>{
 let a=createWorld('splitter'),b=createWorld('splitter');
 a=paintStroke(a,{x:12,y:4},{x:60,y:6},WATER,2);b=paintStroke(b,{x:12,y:4},{x:60,y:6},WATER,2);
 const initial=countMaterials(a),original=a.cells.slice();
 for(let i=0;i<240;i++){a=stepWorld(a);b=stepWorld(b);assert.deepEqual(countMaterials(a),initial);}
 assert.deepEqual(a,b);assert.notDeepEqual(a.cells,original);
});
test('painting is continuous, clipped, immutable and respects existing materials',()=>{
 const w=world(Array.from({length:6},()=>Array(10).fill(0)));
 const drawn=paintStroke(w,{x:1,y:1},{x:8,y:1},WALL,0);
 for(let x=1;x<=8;x++)assert.equal(drawn.cells[10+x],WALL);
 assert.equal(countMaterials(w).wall,0);
 const sand=paintStroke(drawn,{x:0,y:1},{x:9,y:1},SAND,0);
 assert.deepEqual(countMaterials(sand),{sand:2,water:0,wall:8});
 const erased=paintStroke(sand,{x:0,y:1},{x:9,y:1},EMPTY,0);
 assert.deepEqual(countMaterials(erased),{sand:0,water:0,wall:0});
 const corner=paintStroke(w,{x:0,y:0},{x:0,y:0},SAND,2);
 assert.equal(countMaterials(corner).sand,6);assert.equal(corner.cells[9],0);
});
test('reverse and diagonal strokes leave a continuous wall',()=>{
 const w=world(Array.from({length:10},()=>Array(10).fill(0)));
 const a=paintStroke(w,{x:0,y:0},{x:9,y:9},WALL,0);
 const b=paintStroke(w,{x:9,y:9},{x:0,y:0},WALL,0);
 assert.deepEqual(a.cells,b.cells);
 for(let i=0;i<10;i++)assert.equal(a.cells[i*10+i],WALL);
});
test('crossing strokes clip the segment geometrically, not each endpoint independently',()=>{
 const w=world(Array.from({length:10},()=>Array(10).fill(0)));
 const clipped=paintStroke(w,{x:2,y:6},{x:12,y:-14},WALL,0);
 assert.equal(clipped.cells[5],WALL,'crosses the top edge at column 5');
 assert.equal(clipped.cells[9],EMPTY,'does not bend toward a clamped corner');
 const outside=paintStroke(w,{x:-5,y:-5},{x:-1,y:-1},WALL,2);
 assert.equal(countMaterials(outside).wall,0,'an outside stroke does not stamp a corner');
 const exit=paintStroke(w,{x:5,y:4},{x:20,y:4},WALL,0);
 for(let x=5;x<10;x++)assert.equal(exit.cells[40+x],WALL);
});
test('scenes are fresh, valid and empty starts empty',()=>{
 for(const name of ['splitter','hourglass','empty']){
  const w=createWorld(name);assert.equal(w.width,72);assert.equal(w.height,48);assert.equal(w.cells.length,3456);
  assert.ok([...w.cells].every(c=>[EMPTY,SAND,WATER,WALL].includes(c)));
  assert.notEqual(w.cells,createWorld(name).cells);assert.equal(w.tick,0);
 }
 assert.deepEqual(countMaterials(createWorld('empty')),{sand:0,water:0,wall:0});
 assert.ok(countMaterials(createWorld('hourglass')).sand>100);
 assert.throws(()=>createWorld('unknown'),/scene/i);
});
