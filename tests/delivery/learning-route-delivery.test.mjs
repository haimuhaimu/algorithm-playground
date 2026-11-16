import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAppServer} from '../../scripts/serve.mjs';
import {build} from '../../scripts/build.mjs';
test('homepage learning route serves real assets, valid legacy exits and exact build bytes',async()=>{
 const root=new URL('../../dist/',import.meta.url),server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const out=await mkdtemp(join(tmpdir(),'learning-route-'));
 try{
  const base=`http://127.0.0.1:${server.address().port}/`,home=await(await fetch(base)).text();
  const href=home.match(/id="learning-route-entry"[^>]*href="([^"]+)"/)?.[1];assert.equal(href,'./learn.html');
  const response=await fetch(new URL(href,base));assert.equal(response.status,200);const page=await response.text();
  const releaseUrls=[home,page].flatMap(doc=>[...doc.matchAll(/(?:href|src)="(\.\/(?:home\.css|learning-route(?:-ui)?\.(?:css|mjs))[^" ]*)"/g)].map(m=>new URL(m[1],base)));
  assert.equal(releaseUrls.length,4,'both pages must ship the route styling and focused entry');
  const version=releaseUrls.find(u=>u.pathname.endsWith('learning-route-ui.mjs')).searchParams.get('v');assert.ok(version,'changed route must not reuse an unversioned controller cache');
  for(const url of releaseUrls)assert.ok(url.searchParams.get('v'),'page entry scripts and styles remain versioned');
  const ui=await(await fetch(releaseUrls.find(u=>u.pathname.endsWith('learning-route-ui.mjs')))).text();
  const model=ui.match(/from\s+['"]([^'"]*learning-route\.mjs[^'"]*)['"]/)?.[1];assert.ok(model);releaseUrls.push(new URL(model,base));
  const trials=ui.match(/from\s+['"]([^'"]*learning-route-trials\.mjs[^'"]*)['"]/)?.[1];assert.ok(trials);const trialsUrl=new URL(trials,base);
  assert.ok(trialsUrl.searchParams.get('v'),'changed trial consumer remains versioned');releaseUrls.push(trialsUrl);
  // Assets need not share one cache key: unchanged styles keep their URL, and
  // the engine shares its canonical URL with replay/trial consumers. Actual
  // engine instantiation counts are covered by learning-route-loading.test.
  for(const url of releaseUrls){const asset=await fetch(url);assert.equal(asset.status,200);assert.deepEqual(Buffer.from(await asset.arrayBuffer()),await readFile(new URL(url.pathname.slice(1),root)));}
  for(const match of page.matchAll(/(?:href|src)="\.\/([^"#?]+)(?:[?#][^"]*)?"/g)){const name=match[1],asset=await fetch(base+name);assert.equal(asset.status,200,name);assert.deepEqual(Buffer.from(await asset.arrayBuffer()),await readFile(new URL(name,root)));}
  const files=await build(undefined,out);for(const name of ['learn.html','learning-route.mjs','learning-route-ui.mjs','learning-route.css']){assert.ok(files.includes(name));assert.deepEqual(await readFile(join(out,name)),await readFile(new URL(name,root)));}
  const neural=await(await fetch(base+'neural.html')).text();for(const id of ['first-lesson','gradient-lesson','generalization-lesson','field'])assert.ok(neural.includes(`id="${id}"`));
 }finally{await new Promise(r=>server.close(r));await rm(out,{recursive:true,force:true});}
});
