import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {createWorld,paintStroke,stepWorld,WALL} from '../sand-core.mjs';
async function api(){
 const file=new URL('../sand-history.mjs',import.meta.url);
 assert.ok(await access(file).then(()=>true,()=>false),'reversible edits need a snapshot history module');
 return import(file);
}
test('undo and redo restore isolated cell, tick and scene snapshots, including the evolved state at undo time',async()=>{
 const {createHistory,snapshot,recordChange,undoChange,redoChange}=await api();
 const world=createWorld('empty'),before=snapshot('empty',world);
 let after=paintStroke(world,{x:4,y:5},{x:10,y:5},WALL,0);after=stepWorld(after);
 let history=recordChange(createHistory(),before,snapshot('empty',after),'筑墙');
 const evolved=snapshot('empty',stepWorld(after)),undone=undoChange(history,evolved);
 assert.equal(undone.state.world.tick,0);assert.equal(undone.state.world.cells[5*72+4],0);assert.equal(undone.label,'筑墙');
 const redone=redoChange(undone.history,undone.state);
 assert.equal(redone.state.world.tick,2);assert.equal(redone.state.world.cells[5*72+4],3);
 redone.state.world.cells[5*72+4]=0;
 assert.equal(after.cells[5*72+4],3);assert.equal(evolved.world.cells[5*72+4],3,'restored state cannot mutate stored worlds');
 const switched=snapshot('hourglass',createWorld('hourglass'));
 history=recordChange(history,snapshot('empty',after),switched,'切换沙漏');
 const back=undoChange(history,switched);assert.equal(back.state.scene,'empty');assert.equal(back.state.world.tick,1);
 assert.equal(redoChange(back.history,back.state).state.scene,'hourglass');
});
test('no-op edits preserve redo, while a real branch discards it',async()=>{
 const {createHistory,snapshot,recordChange,undoChange,discardFuture}=await api();
 const before=snapshot('empty',createWorld('empty')),after=snapshot('empty',paintStroke(before.world,{x:4,y:5},{x:4,y:5},WALL,0));
 const h=recordChange(createHistory(),before,after,'筑墙'),u=undoChange(h,after);
 assert.equal(recordChange(u.history,u.state,snapshot('empty',u.state.world),'空笔'),u.history);
 assert.equal(u.history.future.length,1);
 const different=snapshot('empty',paintStroke(u.state.world,{x:7,y:5},{x:7,y:5},WALL,0));
 assert.equal(recordChange(u.history,u.state,different,'新墙').future.length,0);
 assert.equal(discardFuture(u.history).future.length,0);assert.equal(u.history.future.length,1);
 assert.equal(undoChange(createHistory(),before),null);
});
test('bounded history drops only oldest edits and returns snapshots without sharing cells',async()=>{
 const {createHistory,snapshot,recordChange,undoChange,redoChange}=await api();
 let history=createHistory(2),state=snapshot('empty',createWorld('empty'));
 for(const x of [2,4,6]){const next=snapshot('empty',paintStroke(state.world,{x,y:4},{x,y:4},WALL,0));history=recordChange(history,state,next,'墙');state=next;}
 assert.equal(history.past.length,2);
 const a=undoChange(history,state),b=undoChange(a.history,a.state);
 assert.equal(b.state.world.cells[4*72+2],3);assert.equal(b.state.world.cells[4*72+4],0);assert.equal(b.state.world.cells[4*72+6],0);
 assert.equal(undoChange(b.history,b.state),null);
 assert.equal(redoChange(b.history,b.state).history.past.length,1);
 const copy=snapshot(state.scene,state.world);state.world.cells[4*72+2]=0;assert.equal(copy.world.cells[4*72+2],3);
});
