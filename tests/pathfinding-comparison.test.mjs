import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../pathfinding-core.mjs';

const compare=(before,after)=>model.compareRuns(model.captureRun(before),model.captureRun(after));
const small=walls=>({cols:5,rows:3,start:5,goal:9,walls});

test('completed runs own their map and cannot change when an editor mutates its input',()=>{
 assert.equal(typeof model.captureRun,'function');
 const map=model.makeMap(),run=model.captureRun(map);
 map.walls.length=0;map.start=0;
 assert.equal(run.map.start,76);assert.equal(run.map.walls.length,9);
 assert.equal(run.traces.bfs.distance,20);assert.equal(run.traces.astar.visited.length,60);
});

test('opening the central gap explains the measured shortcut, not just the winning algorithm',()=>{
 const before=model.makeMap(),after=model.editMap(before,82,'erase'),c=compare(before,after);
 assert.deepEqual(c.changes.removed,[82]);assert.deepEqual(c.changes.added,[]);
 assert.deepEqual(c.distance,{before:20,after:12,delta:-8});
 assert.deepEqual(c.bfs,{before:130,after:106,delta:-24});
 assert.deepEqual(c.astar,{before:60,after:13,delta:-47});
 assert.equal(c.reason,'direct');assert.match(c.explanation,/直达/);assert.match(c.searchExplanation,/没有额外/);
});

test('putting a wall on the old shortest path explains an actual detour',()=>{
 const c=compare(small([]),small([7]));
 assert.equal(c.reason,'detour');assert.deepEqual(c.distance,{before:4,after:6,delta:2});
 assert.match(c.explanation,/原来/);
});

test('removing an isolated obstacle does not invent a continuous wall in the explanation',()=>{
 const c=compare(small([7]),small([]));
 assert.equal(c.reason,'direct');assert.deepEqual(c.distance,{before:6,after:4,delta:-2});
 assert.doesNotMatch(c.explanation,/整道墙/);
});

test('blocking one shortest route does not claim a longer route when an equal alternative exists',()=>{
 const base={cols:3,rows:3,start:0,goal:8,walls:[]},c=compare(base,{...base,walls:[1]});
 assert.equal(c.reason,'alternative');assert.equal(c.distance.delta,0);
});

test('a single-cell disconnection and reconnection never calculate a fake numeric distance',()=>{
 const open=small([2,12]),closed=small([2,7,12]);
 const blocked=compare(open,closed),reopened=compare(closed,open);
 assert.equal(blocked.reason,'blocked');assert.deepEqual(blocked.distance,{before:4,after:null,delta:null});
 assert.equal(reopened.reason,'reconnected');assert.deepEqual(reopened.distance,{before:null,after:4,delta:null});
});

test('changes to multiple cells or endpoints do not attribute all effects to one wall',()=>{
 const base=model.makeMap();
 assert.equal(compare(base,{...base,walls:[]}).reason,'multiple');
 const c=compare(base,model.editMap(base,0,'start'));
 assert.equal(c.reason,'endpoints');assert.equal(c.changes.startMoved,true);assert.match(c.explanation,/任务/);
});

test('unchanged, irrelevant and still-disconnected edits have honest explanations',()=>{
 assert.equal(compare(small([]),small([])).reason,'unchanged');
 assert.equal(compare(small([]),small([0])).reason,'same-distance');
 const closed=small([2,7,12]);
 assert.equal(compare(closed,{...closed,walls:[0,2,7,12]}).reason,'still-blocked');
});

test('changed-cell markers include both old and new endpoint positions, without duplicates',()=>{
 const c=compare(small([7]),model.editMap(small([7]),7,'start'));
 assert.deepEqual(c.changes.indices,[5,7]);assert.deepEqual(c.changes.removed,[7]);
 assert.equal(c.reason,'endpoints');
});

test('old-route claims follow the displayed algorithm when equally short BFS and A* routes differ',()=>{
 const map={cols:15,rows:11,start:76,goal:88,walls:[66,78,82,93]};
 const before=model.captureRun(map),after=model.captureRun(model.editMap(map,62,'wall'));
 assert.equal(before.traces.astar.path.includes(62),true);
 assert.equal(before.traces.bfs.path.includes(62),false);
 assert.equal(model.compareRuns(before,after,'astar').reason,'alternative');
 assert.equal(model.compareRuns(before,after,'bfs').reason,'same-distance');
});
