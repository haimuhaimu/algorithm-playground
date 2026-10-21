import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../sand-core.mjs';

const world = rows => ({width:rows[0].length,height:rows.length,cells:Uint8Array.from(rows.flat()),tick:0});
test('a watched grain reports the actual rejected routes and chosen move without changing the simulation',()=>{
 assert.equal(typeof core.observeSandStep,'function','the engine must expose a real one-step decision');
 const before=world([[0,0,0,0,0],[0,0,1,3,0],[0,0,3,0,0],[3,3,3,3,3]]);
 const snapshot=before.cells.slice();
 const {world:after,decision}=core.observeSandStep(before,{x:2,y:1});
 assert.deepEqual(decision.from,{x:2,y:1});
 assert.deepEqual(decision.to,{x:1,y:2});
 assert.deepEqual(decision.attempts.map(a=>[a.to.x,a.to.y,a.reason]),[[2,2,'occupied'],[3,2,'corner'],[1,2,'empty']]);
 assert.equal(decision.outcome,'left');
 assert.equal(after.cells[11],core.SAND);assert.equal(after.cells[7],core.EMPTY);
 assert.deepEqual(after,core.stepWorld(before));assert.deepEqual(before.cells,snapshot);
});
test('tracing uses the neighborhood at execution time, after lower particles have moved',()=>{
 assert.equal(typeof core.observeSandStep,'function');
 const before=world([[3,1,3],[3,2,3],[3,0,3],[3,3,3]]);
 const result=core.observeSandStep(before,{x:1,y:0});
 assert.equal(result.decision.attempts[0].target,core.EMPTY);
 assert.equal(result.decision.outcome,'down');assert.equal(result.world.cells[4],core.SAND);
 assert.deepEqual(result.world,core.stepWorld(before));
});
test('trace distinguishes water exchange, already-moved water, edges and a trapped grain',()=>{
 assert.equal(typeof core.observeSandStep,'function');
 const swap=core.observeSandStep(world([[3,1,3],[3,2,3],[3,3,3]]),{x:1,y:0});
 assert.equal(swap.decision.attempts[0].reason,'swap');
 const moved=core.observeSandStep(world([[3,1,3],[3,0,2],[3,3,3]]),{x:1,y:0});
 assert.equal(moved.decision.attempts[0].reason,'water-moved');
 assert.equal(moved.decision.outcome,'stay');
 const edge=core.observeSandStep(world([[1]]),{x:0,y:0});
 assert.deepEqual(edge.decision.attempts.map(a=>a.reason),['edge','edge','edge']);
 assert.equal(edge.decision.outcome,'stay');
 assert.throws(()=>core.observeSandStep(world([[0]]),{x:0,y:0}),/sand/i);
 assert.throws(()=>core.observeSandStep(world([[1]]),{x:-1,y:0}),/point/i);
});
test('observing a grain does not alter any seeded scene or its tie-breaking order',()=>{
 assert.equal(typeof core.observeSandStep,'function');
 let w=core.createWorld();
 for(let tick=0;tick<80;tick++){
  const i=w.cells.indexOf(core.SAND);
  const result=core.observeSandStep(w,{x:i%w.width,y:Math.floor(i/w.width)});
  assert.deepEqual(result.world,core.stepWorld(w));
  assert.equal(result.world.cells[result.decision.to.y*w.width+result.decision.to.x],core.SAND);
  w=result.world;
 }
});
