import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,stepWorld,countMaterials,WALL,WATER} from '../../../dist/sand-core.mjs';
import {createHistory,snapshot,recordChange,undoChange,redoChange} from '../../../dist/sand-history.mjs';
const api=await import('../../../dist/sand-bowl.mjs').catch(()=>({}));
const requireApi=()=>{assert.equal(typeof api.openBowl,'function');assert.equal(typeof api.observeBowl,'function');return api;};

test('opening the bowl erases only its three wall cells without losing water or changing the clock',()=>{
 const {openBowl,observeBowl}=requireApi(),before=createWorld('cat-bowl'),cells=new Uint8Array(before.cells),opened=openBowl(before);
 assert.deepEqual(observeBowl(before),{waterBelow:0,openingOpen:false,wallsRemaining:3});
 assert.deepEqual(before.cells,cells);
 assert.equal(opened.tick,0);assert.equal(countMaterials(opened).water,140);
 const changed=[...opened.cells].flatMap((v,i)=>v!==cells[i]?[i]:[]);
 assert.deepEqual(changed,[41*72+36,42*72+36,43*72+36]);
 assert.deepEqual(changed.map(i=>cells[i]),[WALL,WALL,WALL]);
 assert.deepEqual(observeBowl(opened),{waterBelow:0,openingOpen:true,wallsRemaining:0});
});
test('water below the bowl comes from the existing evolution, not from opening it',()=>{
 const {openBowl,observeBowl}=requireApi();let closed=createWorld('cat-bowl'),opened=openBowl(closed);
 for(let i=0;i<60;i++){closed=stepWorld(closed);opened=stepWorld(opened);}
 assert.equal(observeBowl(closed).waterBelow,0);assert.ok(observeBowl(opened).waterBelow>0);
 assert.equal(countMaterials(opened).water,140);assert.equal(countMaterials(closed).water,140);
});
test('reopening cannot erase water or sand already in the outlet',()=>{
 const {openBowl}=requireApi();let world=openBowl(createWorld('cat-bowl'));
 world.cells[41*72+36]=WATER;
 assert.equal(openBowl(world),world);assert.equal(countMaterials(world).water,141);
});
test('bowl undo restores the closed world and redo restores the evolved leaked world',()=>{
 const {openBowl}=requireApi(),before=snapshot('cat-bowl',createWorld('cat-bowl'));
 let world=openBowl(before.world),history=recordChange(createHistory(),before,snapshot('cat-bowl',world),'打开碗底小口');
 for(let i=0;i<20;i++)world=stepWorld(world);
 const current=snapshot('cat-bowl',world),undo=undoChange(history,current),redo=redoChange(undo.history,undo.state);
 assert.deepEqual(undo.state,before);assert.deepEqual(redo.state,current);
});
