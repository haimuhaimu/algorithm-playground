import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAppServer} from '../scripts/serve.mjs';
import {build} from '../scripts/build.mjs';
test('homepage learning route serves real assets, valid legacy exits and exact build bytes',async()=>{
 const root=new URL('../',import.meta.url),server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const out=await mkdtemp(join(tmpdir(),'learning-route-'));
 try{
  const base=`http://127.0.0.1:${server.address().port}/`,home=await(await fetch(base)).text();
  const href=home.match(/id="learning-route-entry"[^>]*href="([^"]+)"/)?.[1];assert.equal(href,'./learn.html');
  const response=await fetch(new URL(href,base));assert.equal(response.status,200);const page=await response.text();
  const releaseUrls=[home,page].flatMap(doc=>[...doc.matchAll(/(?:href|src)="(\.\/(?:home\.css|learning-route(?:-ui)?\.(?:css|mjs))[^" ]*)"/g)].map(m=>new URL(m[1],base)));
  assert.equal(releaseUrls.length,4,'both pages must ship the route styling and focused entry');
  const version=releaseUrls[0].searchParams.get('v');assert.ok(version,'new homepage route must not reuse the pre-release unversioned stylesheet cache');
  const ui=await(await fetch(releaseUrls.find(u=>u.pathname.endsWith('learning-route-ui.mjs')))).text();
  const model=ui.match(/from\s+['"]([^'"]*learning-route\.mjs[^'"]*)['"]/)?.[1];assert.ok(model);releaseUrls.push(new URL(model,base));
  for(const url of releaseUrls){assert.equal(url.searchParams.get('v'),version,'the new route graph must use one release key');const asset=await fetch(url);assert.equal(asset.status,200);assert.deepEqual(Buffer.from(await asset.arrayBuffer()),await readFile(new URL(url.pathname.slice(1),root)));}
  for(const match of page.matchAll(/(?:href|src)="\.\/([^"#?]+)(?:[?#][^"]*)?"/g)){const name=match[1],asset=await fetch(base+name);assert.equal(asset.status,200,name);assert.deepEqual(Buffer.from(await asset.arrayBuffer()),await readFile(new URL(name,root)));}
  const files=await build(root.pathname,out);for(const name of ['learn.html','learning-route.mjs','learning-route-ui.mjs','learning-route.css']){assert.ok(files.includes(name));assert.deepEqual(await readFile(join(out,name)),await readFile(new URL(name,root)));}
  const neural=await(await fetch(base+'neural.html')).text();for(const id of ['first-lesson','gradient-lesson','generalization-lesson','field'])assert.ok(neural.includes(`id="${id}"`));
 }finally{await new Promise(r=>server.close(r));await rm(out,{recursive:true,force:true});}
});
