import test from 'node:test';
import assert from 'node:assert/strict';
import {createShowcaseScene,showcaseFrame,legacyRecommendationTarget,createHeroClock} from '../home-core.mjs';
import {search} from '../pathfinding-core.mjs';
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
test('legacy recommendation bookmarks preserve query and hash without taking over showcase anchors',()=>{
 for(const hash of ['#feed-section','#seat-lesson','#feedback-story','#controls-title','#feed'])assert.equal(legacyRecommendationTarget(hash,'?v=old'),`./recommendation.html?v=old${hash}`);
 assert.equal(legacyRecommendationTarget('#%66eed-section'), './recommendation.html#%66eed-section');
 for(const hash of ['','#experiments','#about','#top','#unknown','#%E0%A4%A'])assert.equal(legacyRecommendationTarget(hash),null);
});
test('every preserved recommendation element bookmark remains reachable except the new about section',async()=>{
 const html=await readFile(new URL('../recommendation.html',import.meta.url),'utf8');
 for(const [,id] of html.matchAll(/\bid="([^"]+)"/g)){
  if(id==='about')continue;
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
