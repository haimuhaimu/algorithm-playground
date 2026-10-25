import test from 'node:test';
import assert from 'node:assert/strict';
import {search,makeMap,editMap,lineCells,frameAt} from '../pathfinding-core.mjs';
import * as core from '../pathfinding-core.mjs';

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

test('each decision records the real pre-expansion frontier, costs and chosen node',()=>{
 assert.equal(typeof core.decisionAt,'function');
 for(const algorithm of ['bfs','astar'])for(const preset of ['empty','detour','maze']){
  const map=makeMap(preset),trace=search(map,algorithm);
  for(let step=0;step<trace.visited.length;step++){
   const d=core.decisionAt(trace,step);
   assert.equal(d.algorithm,algorithm);assert.equal(d.current,trace.visited[step]);
   const frontier=step?trace.frames[step-1].frontier:[map.start];
   assert.deepEqual(d.candidates.map(c=>c.index),frontier);
   assert.deepEqual(d.candidates.map(c=>c.queuePosition),frontier.map((_,i)=>i+1));
   for(const c of d.candidates){
    assert.equal(c.f,c.g+c.h);
    assert.equal(c.h,Math.abs(c.index%map.cols-map.goal%map.cols)+Math.abs(Math.floor(c.index/map.cols)-Math.floor(map.goal/map.cols)));
    assert.ok(!trace.visited.slice(0,step).includes(c.index));
   }
   const ordered=[...d.candidates].sort((a,b)=>algorithm==='bfs'?a.queuePosition-b.queuePosition:a.f-b.f||a.h-b.h||a.queuePosition-b.queuePosition);
   assert.equal(d.current,ordered[0].index);
  }
  assert.equal(core.decisionAt(trace,trace.visited.length),null);
 }
});

test('decision explanations distinguish score, heuristic tie, queue tie and BFS FIFO',()=>{
 assert.equal(typeof core.explainDecision,'function');
 const map={cols:3,rows:3,start:4,goal:8,walls:[]},a=search(map,'astar'),b=search(map,'bfs');
 assert.equal(core.decisionAt(a,1).current,5);
 assert.match(core.explainDecision(core.decisionAt(a,1),1,3),/分数.*2.*4/);
 assert.match(core.explainDecision(core.decisionAt(a,1),7,3),/同为 2.*余程同为 1.*队列/);
 assert.equal(core.decisionAt(a,2).current,8);
 assert.match(core.explainDecision(core.decisionAt(a,2),7,3),/同为 2.*余程.*0.*1/);
 assert.equal(core.decisionAt(b,2).current,7);
 // After expanding 4 then 5, FIFO is [7,3,1,8,2].
 assert.match(core.explainDecision(core.decisionAt(b,2),8,3),/队列第 1.*第 4.*不按/);
 assert.match(core.explainDecision(core.decisionAt(a,1),5,3),/猜中了/);
 assert.match(core.explainDecision(core.decisionAt(a,1),7,3),/尚不能判断/);
 assert.equal(core.explainDecision(core.decisionAt(a,1),4,3),'');
});

test('tied estimates never promise equal route quality when a candidate is a dead end',()=>{
 const map={cols:5,rows:5,start:6,goal:18,walls:[10,12,16]},trace=search(map,'astar'),d=core.decisionAt(trace,1);
 assert.equal(d.current,7);assert.deepEqual(trace.path,[6,7,8,13,18]);
 assert.deepEqual(d.candidates.filter(c=>[7,11].includes(c.index)).map(c=>[c.g,c.h,c.f]),[[1,3,4],[1,3,4]]);
 const explanation=core.explainDecision(d,11,5);
 assert.doesNotMatch(explanation,/不是更差|同样好|路线相同/);
 assert.match(explanation,/尚不能判断.*路线/);
});

test('decisions are independent snapshots and unavailable beyond terminated searches',()=>{
 assert.equal(typeof core.decisionAt,'function');
 const trace=search(small,'astar'),copy=structuredClone(trace),d=core.decisionAt(trace,1);
 d.candidates[0].g=999;d.candidates.pop();d.current=-1;
 assert.deepEqual(trace,copy);assert.deepEqual(core.decisionAt(trace,1),copy.frames[1].decision);
 for(const step of [-1,1.5,NaN,Infinity,999])assert.equal(core.decisionAt(trace,step),null);
 for(const map of [{...small,goal:5},{...small,walls:[0,6,10]}]){
  const t=search(map);assert.equal(t.visited.length,1);assert.equal(core.decisionAt(t,1),null);
 }
});
