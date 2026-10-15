import test from 'node:test';
import assert from 'node:assert/strict';
import {search,makeMap,editMap,lineCells,frameAt} from '../pathfinding-core.mjs';

const small={cols:5,rows:3,start:5,goal:9,walls:[7]};
function validPath(map,result){
 assert.equal(result.path[0],map.start);assert.equal(result.path.at(-1),map.goal);
 assert.equal(result.distance,result.path.length-1);
 for(let i=1;i<result.path.length;i++){
  const a=result.path[i-1],b=result.path[i];
  assert.equal(Math.abs(a%map.cols-b%map.cols)+Math.abs(Math.floor(a/map.cols)-Math.floor(b/map.cols)),1);
  assert.ok(!map.walls.includes(b));
 }
}
for(const algorithm of ['bfs','astar']){
 test(`${algorithm} finds the hand-calculated six-step detour without crossing walls`,()=>{
  const before=structuredClone(small),r=search(small,algorithm);
  assert.equal(r.found,true);assert.equal(r.distance,6);validPath(small,r);
  assert.deepEqual(small,before);assert.equal(new Set(r.visited).size,r.visited.length);
  assert.deepEqual(search(small,algorithm),r);
 });
 test(`${algorithm} reports unreachable, adjacent, and identical endpoints honestly`,()=>{
  const blocked=search({...small,walls:[2,7,12]},algorithm);
  assert.equal(blocked.found,false);assert.equal(blocked.distance,null);assert.deepEqual(blocked.path,[]);
  assert.equal(search({...small,goal:6},algorithm).distance,1);
  const same=search({...small,goal:5},algorithm);assert.equal(same.distance,0);assert.deepEqual(same.path,[5]);
 });
 test(`${algorithm} does not wrap row edges or visit blocked cells`,()=>{
  const map={cols:3,rows:2,start:2,goal:3,walls:[1,4]},r=search(map,algorithm);
  assert.equal(r.found,false);assert.deepEqual(r.visited,[2,5]);
 });
}
test('A* explores fewer cells on an open field while preserving shortest distance',()=>{
 const map=makeMap('empty'),a=search(map,'astar'),b=search(map,'bfs');
 assert.equal(a.distance,12);assert.equal(b.distance,12);assert.ok(a.visited.length<b.visited.length/2);
});
test('both algorithms agree on shortest distances across presets and generated walls',()=>{
 for(const preset of ['empty','detour','maze']){
  const map=makeMap(preset),b=search(map,'bfs'),a=search(map,'astar');
  assert.equal(b.found,true);assert.equal(a.distance,b.distance);validPath(map,a);validPath(map,b);
 }
 for(let seed=1;seed<=40;seed++){
  const map=makeMap('empty');let n=seed;
  for(let i=0;i<map.rows*map.cols;i++){n=(n*1664525+1013904223)>>>0;if(n/2**32<.32&&i!==map.start&&i!==map.goal)map.walls.push(i);}
  const a=search(map,'astar'),b=search(map,'bfs');assert.equal(a.distance,b.distance);assert.equal(a.found,b.found);
  if(a.found)validPath(map,a);
 }
});
test('replay hides future path and preserves all previous snapshots',()=>{
 const result=search(small,'bfs'),before=structuredClone(result);
 assert.deepEqual(frameAt(result,0).visited,[]);assert.deepEqual(frameAt(result,0).path,[]);
 const partial=frameAt(result,2);assert.equal(partial.visited.length,2);assert.equal(partial.done,false);assert.equal(partial.distance,null);
 assert.deepEqual(partial.path,[]);assert.equal(frameAt(result,999).distance,6);assert.equal(frameAt(result,999).done,true);
 partial.visited.push(100);assert.deepEqual(result,before);
});
test('map editing protects endpoints, preserves no-ops, and clears walls under moved endpoints',()=>{
 assert.strictEqual(editMap(small,5,'wall'),small);assert.strictEqual(editMap(small,9,'start'),small);
 assert.strictEqual(editMap(small,-1,'wall'),small);assert.strictEqual(editMap(small,1,'erase'),small);
 const moved=editMap(small,7,'start');assert.equal(moved.start,7);assert.deepEqual(moved.walls,[]);
 const painted=editMap(small,6,'wall');assert.deepEqual(painted.walls,[6,7]);assert.deepEqual(small.walls,[7]);
 assert.strictEqual(editMap(painted,6,'wall'),painted);assert.deepEqual(editMap(painted,6,'erase').walls,[7]);
});
test('fast drag strokes fill intervening cells in either direction',()=>{
 assert.deepEqual(lineCells(1,4,5),[1,2,3,4]);assert.deepEqual(lineCells(11,1,5),[11,6,1]);
 const diagonal=lineCells(0,14,5);assert.equal(diagonal[0],0);assert.equal(diagonal.at(-1),14);
 for(let i=1;i<diagonal.length;i++)assert.equal(Math.abs(diagonal[i]%5-diagonal[i-1]%5)+Math.abs(Math.floor(diagonal[i]/5)-Math.floor(diagonal[i-1]/5)),1);
});
test('invalid map contracts fail explicitly instead of inventing a route',()=>{
 for(const map of [{...small,cols:0},{...small,start:-1},{...small,goal:99},{...small,walls:[5]}])assert.throws(()=>search(map,'bfs'),/map/i);
 assert.throws(()=>search(small,'unknown'),/algorithm/i);
});
