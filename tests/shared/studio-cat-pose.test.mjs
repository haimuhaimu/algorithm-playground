import test from 'node:test';
import assert from 'node:assert/strict';
import {createShowcaseScene,showcaseCats} from '../../dist/home-core.mjs';
import {studioPose,studioPortrait} from '../../dist/studio-cat-assets.mjs';

test('comic pose follows each individual A* runner, including one waiting for its turn',()=>{
 const scene=createShowcaseScene();
 const before=showcaseCats(scene,0);
 const set=shot=>shot.cats.map(cat=>studioPose(cat).src);
 assert.deepEqual(set(before),['./studio-heim-idle.png','./studio-bobby-idle.png','./studio-chouchou-idle.png']);
 const firstRun=scene.delay+scene.trace.visited.length*scene.interval+40;
 assert.deepEqual(set(showcaseCats(scene,firstRun)),['./studio-heim-run.png','./studio-bobby-idle.png','./studio-chouchou-idle.png']);
 assert.deepEqual(set(showcaseCats(scene,firstRun+scene.stagger*2)),['./studio-heim-run.png','./studio-bobby-run.png','./studio-chouchou-run.png']);
 assert.deepEqual(set(showcaseCats(scene,scene.duration-1)),set(before));
});

test('homepage portraits are separate assets and unknown roles do not load an image',()=>{
 assert.equal(studioPortrait('bobby'),'./studio-bobby-portrait.png');
 assert.equal(studioPose({id:'other',from:5,to:6}),null);
 assert.equal(studioPortrait('other'),null);
});
