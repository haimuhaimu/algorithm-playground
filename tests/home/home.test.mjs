import test from 'node:test';
import assert from 'node:assert/strict';
import {createShowcaseScene,showcaseFrame,legacyRecommendationTarget,createHeroClock,showcaseCats} from '../../dist/home-core.mjs';
import {search} from '../../dist/pathfinding-core.mjs';
import {readFile} from 'node:fs/promises';

test('hero replays the existing A* search and its real shortest route, without changing the map',()=>{
 const scene=createShowcaseScene(),before=structuredClone(scene.map);
 assert.deepEqual(scene.trace,search(scene.map,'astar'));
 assert.ok(scene.trace.found);
 const first=showcaseFrame(scene,0),finished=showcaseFrame(scene,scene.duration-1);
 assert.equal(first.visited.length,0);
 assert.deepEqual(finished.path,scene.trace.path);
 assert.deepEqual(finished.visited,scene.trace.visited);
 for(let i=1;i<finished.path.length;i++){
  const a=finished.path[i-1],b=finished.path[i];
  assert.equal(Math.abs(a%scene.map.cols-b%scene.map.cols)+Math.abs(Math.floor(a/scene.map.cols)-Math.floor(b/scene.map.cols)),1);
  assert.ok(!scene.map.walls.includes(b));
 }
 assert.deepEqual(scene.map,before);
 assert.deepEqual(showcaseFrame(scene,scene.duration),first);
});
test('the three cats wait for A*, follow consecutive solved cells, then reach the goal',()=>{
 const scene=createShowcaseScene(),route=search(scene.map,'astar').path;
 const start=scene.delay+scene.trace.visited.length*scene.interval;
 const before=showcaseCats(scene,start-1);
 assert.equal(before.phase,'searching');
 assert.deepEqual(before.cats.map(cat=>[cat.id,cat.from,cat.to]),[
  ['heim',76,76],['bobby',76,76],['chouchou',76,76],
 ]);
 let separated=false;
 const moved=new Set();
 for(let elapsed=start;elapsed<scene.duration;elapsed+=17){
  const shot=showcaseCats(scene,elapsed);
  const positions=shot.cats.map(({id,from,to,progress})=>{
   const index=route.indexOf(from);
   assert.ok(index>=0 && (to===from || to===route[index+1]),id);
   assert.ok(progress>=0 && progress<=1,id);
   if(to!==from)moved.add(id);
   return index+progress;
  });
  assert.ok(positions[0]>=positions[1] && positions[1]>=positions[2]);
  separated ||= positions[0]>positions[1] && positions[1]>positions[2];
 }
 assert.equal(moved.size,3);
 assert.ok(separated,'cats must run in a line, not all occupy the same cell');
 const end=showcaseCats(scene,scene.duration-1);
 assert.equal(end.phase,'arrived');
 assert.deepEqual(end.cats.map(({from,to})=>[from,to]),[[88,88],[88,88],[88,88]]);
 assert.deepEqual(showcaseCats(scene,scene.duration),showcaseCats(scene,0));
});
test('a failed search never launches the cats',()=>{
 const scene=createShowcaseScene();
 const map={...scene.map,walls:[...new Set([...scene.map.walls,61,75,77,91])]};
 const trace=search(map,'astar');
 assert.equal(trace.found,false);
 const noRoute=showcaseCats({...scene,map,trace},scene.duration-1);
 assert.equal(noRoute.phase,'blocked');
 assert.ok(noRoute.cats.every(cat=>cat.from===map.start && cat.to===map.start));
});
test('legacy recommendation bookmarks preserve query and hash without taking over showcase anchors',()=>{
 for(const hash of ['#feed-section','#seat-lesson','#feedback-story','#controls-title','#feed'])assert.equal(legacyRecommendationTarget(hash,'?v=old'),`./recommendation.html?v=old${hash}`);
 assert.equal(legacyRecommendationTarget('#%66eed-section'), './recommendation.html#%66eed-section');
 for(const hash of ['','#experiments','#about','#top','#unknown','#%E0%A4%A'])assert.equal(legacyRecommendationTarget(hash),null);
});
test('legacy recommendation bookmarks remain reachable without claiming newly introduced controls were homepage anchors',async()=>{
 const html=await readFile(new URL('../../dist/recommendation.html',import.meta.url),'utf8');
 for(const [,id] of html.matchAll(/\bid="([^"]+)"/g)){
  if(id==='about')continue;
  // This optional flow was introduced after recommendation moved to its own URL.
  // Do not extend the homepage redirect surface for controls that never lived there.
  if(id.startsWith('feedback-prediction-')){assert.equal(legacyRecommendationTarget('#'+id),null);continue;}
  assert.equal(legacyRecommendationTarget('#'+id,'?v=saved'),`./recommendation.html?v=saved#${id}`,id);
 }
});
test('animation time excludes pauses, hidden/offscreen time, and resumes without a catch-up jump',()=>{
 const clock=createHeroClock();
 assert.equal(clock.tick(100),0);assert.equal(clock.tick(200),100);
 clock.set({paused:true});assert.equal(clock.tick(5000),100);
 clock.set({paused:false});assert.equal(clock.tick(6000),100);assert.equal(clock.tick(6100),200);
 clock.set({visible:false});clock.tick(9000);clock.set({visible:true});assert.equal(clock.tick(10000),200);
 clock.set({inView:false});clock.tick(11000);clock.set({inView:true});assert.equal(clock.tick(12000),200);
 clock.set({reduced:true});assert.equal(clock.read().running,false);assert.equal(clock.tick(13000),200);
 clock.set({reduced:false,paused:true});assert.equal(clock.read().running,false);
});
test('manual pause survives visibility changes and stale/non-monotonic ticks cannot advance time',()=>{
 const clock=createHeroClock();clock.tick(100);clock.tick(200);clock.set({paused:true,visible:false});clock.set({visible:true});
 assert.equal(clock.read().running,false);assert.equal(clock.tick(9000),100);
 clock.set({paused:false});clock.tick(10000);assert.equal(clock.tick(9000),100);assert.equal(clock.tick(10100),200);
});
