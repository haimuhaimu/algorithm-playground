import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,symlink,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAppServer} from '../scripts/serve.mjs';
import {build} from '../scripts/build.mjs';

const root=new URL('../',import.meta.url).pathname;
test('changed legacy neural entry modules have fresh request URLs and still serve exact JavaScript bytes',async()=>{
 const server=createAppServer(root);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`,html=await(await fetch(base+'/neural.html')).text();
  const sources=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match=>new URL(match[1],base+'/neural.html'));
  for(const name of ['neural.mjs','neural-lesson-ui.mjs']){
   const url=sources.find(source=>source.pathname==='/'+name);assert.ok(url,`${name} is loaded`);
   assert.ok(url.searchParams.get('v'),`${name} must not reuse the previously cached entry URL`);
   const response=await fetch(url);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);
   assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(join(root,name)));
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('decorative mining orbits are clipped without a programmatically scrollable game board',async()=>{
 const css=await readFile(join(root,'mining.css'),'utf8');
 assert.match(css,/\.starfield\{[^}]*overflow:clip/);
});
const files=['app.mjs','core.mjs','data.mjs','evolution-core.mjs','evolution.css','evolution.html','evolution.mjs','firefly-core.mjs','firefly.css','firefly.html','firefly.mjs','index.html','mining-core.mjs','mining.css','mining.html','mining.mjs','navigation.css','navigation.mjs','neural-core.mjs','neural.css','neural.html','neural.mjs','pathfinding-core.mjs','pathfinding.css','pathfinding.html','pathfinding.mjs','pixel-core.mjs','pixel.css','pixel.html','pixel.mjs','sand-core.mjs','sand.css','sand.html','sand.mjs','style.css'];
files.push('neural-lesson.mjs','neural-lesson-ui.mjs','neural-lesson.css');
files.push('neural-step.mjs','neural-step-view.mjs');
files.push('neural-guide.mjs','neural-guide-ui.mjs','neural-guide-view.mjs','neural-guide.css');
files.push('neural-gradient.mjs','neural-gradient-ui.mjs');
files.push('neural-residual-core.mjs','neural-residual.mjs','neural-residual-ui.mjs','neural-residual-view.mjs','neural-residual.css');
files.push('neural-generalization.mjs','neural-generalization-ui.mjs','neural-generalization-view.mjs','neural-generalization.css');
files.push('space-theme.css');
files.push('learn.html','learning-route.mjs','learning-route-ui.mjs','learning-route.css');
files.push('Silkscreen-Regular.ttf','Silkscreen-OFL.txt');
files.push('pixel-recipient.mjs','pixel-recipient-ui.mjs','pixel-recipient.css');
files.push('pixel-code.mjs','pixel-code-ui.mjs','pixel-code.css');
files.push('sand-lesson.mjs','sand-lesson-ui.mjs');
files.push('mining-shared-evidence.mjs','mining-shared-ui.mjs');
files.push('feedback-story.mjs','feedback-story-ui.mjs','feedback-story.css');
files.push('seat-lesson.mjs','seat-lesson-ui.mjs','seat-lesson.css');
files.push('evolution-birth.mjs','local-drafts.mjs','world-model.html','world-model.css','world-model.mjs','world-model-core.mjs','world-model-environment.mjs','world-model-session.mjs','world-model-lesson.mjs');
files.push('world-model-planning.mjs');
files.push('firefly-beat.mjs','firefly-beat-ui.mjs','firefly-beat.css');
files.push('rsi.html','rsi.css','rsi.mjs','rsi-core.mjs','rsi-session.mjs');files.push('recommendation.html','home.css','home.mjs','home-core.mjs','home-preview-sand.jpg','home-preview-neural.jpg','home-preview-recommendation.jpg','home-preview-pathfinding.jpg','home-preview-firefly.jpg','home-preview-evolution.jpg','home-preview-mining.jpg','home-preview-pixel.jpg','home-preview-world-model.jpg','home-preview-rsi.jpg');files.sort();
test('server serves only runtime assets with correct types, headers and methods',async()=>{
 const server=createAppServer(root);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const home=await fetch(base+'/?v=test');assert.equal(home.status,200);assert.match(await home.text(),/算法游乐场/);
  assert.match(home.headers.get('content-type'),/text\/html/);assert.equal(home.headers.get('x-content-type-options'),'nosniff');
  const module=await fetch(base+'/core.mjs');assert.match(module.headers.get('content-type'),/javascript/);
  const font=await fetch(base+'/Silkscreen-Regular.ttf');
  assert.equal(font.status,200,'pixel font must be available without a third-party request');
  assert.match(font.headers.get('content-type'),/font\/ttf/);
  assert.match(home.headers.get('content-security-policy'),/font-src 'self'/);
  for(const file of files){const asset=await fetch(base+'/'+file);assert.equal(asset.status,200,file);assert.deepEqual(Buffer.from(await asset.arrayBuffer()),await readFile(join(root,file)));}
  const head=await fetch(base+'/style.css',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(base+'/index.html',{method:'POST'})).status,405);
  for(const path of ['/package.json','/docs/spec.md','/.git/config','/%2e%2e%2fpackage.json','/%252e%252e/package.json','/%zz'])assert.equal((await fetch(base+path)).status,404,path);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('build ships all ten experiments and all runtime files with byte-for-byte source parity',async()=>{
 const out=await mkdtemp(join(tmpdir(),'algorithm-build-'));
 try{
  const result=await build(root,out);assert.deepEqual(result.sort(),files);
  assert.deepEqual((await readdir(out)).sort(),files);
  for(const file of files)assert.deepEqual(await readFile(join(out,file)),await readFile(join(root,file)));
 }finally{await rm(out,{recursive:true,force:true});}
});
test('server rejects runtime-name symlinks outside its root',async()=>{
 const outside=await mkdtemp(join(tmpdir(),'algorithm-outside-')),inside=await mkdtemp(join(tmpdir(),'algorithm-inside-'));
 await writeFile(join(outside,'private.txt'),'PRIVATE');await symlink(join(outside,'private.txt'),join(inside,'index.html'));
 const server=createAppServer(inside);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/`)).status,404);}
 finally{await new Promise(resolve=>server.close(resolve));await rm(outside,{recursive:true,force:true});await rm(inside,{recursive:true,force:true});}
});
test('build refuses unrelated files and output symlinks without deleting them',async()=>{
 const out=await mkdtemp(join(tmpdir(),'algorithm-guard-'));
 try{
  await writeFile(join(out,'keep.txt'),'KEEP');
  await assert.rejects(build(root,out),/unexpected/);
  assert.equal(await readFile(join(out,'keep.txt'),'utf8'),'KEEP');
  await rm(join(out,'keep.txt'));
  await symlink(join(root,'index.html'),join(out,'index.html'));
  await assert.rejects(build(root,out),/regular/);
 }finally{await rm(out,{recursive:true,force:true});}
});
test('secondary text has readable contrast on each light and dark surface',async()=>{
 const css=await readFile(join(root,'style.css'),'utf8');
 const luminance=hex=>{const c=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 for(const declaration of css.match(/:root(?:\[data-theme=dark\])?\{[^}]+\}/g)){
  const color=key=>luminance(declaration.match(new RegExp(`--${key}:#([0-9a-f]{6})`))[1]);
  for(const key of ['paper','surface','soft']){
   const a=color('muted'),b=color(key),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   assert.ok(ratio>=4.5,`${key} contrast ${ratio.toFixed(2)} must reach 4.5`);
  }
 }
});
