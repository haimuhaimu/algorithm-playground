import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppServer} from '../scripts/serve.mjs';
test('showcase has ten usable experiment routes and preserves recommendation lesson entry points',async()=>{
 const server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}/`,home=await (await fetch(base)).text();
  const entries=[...home.matchAll(/<a class="experiment-entry[^"]*" href="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(entries.length,10);
  assert.equal(new Set(entries.map(h=>h.split('#')[0])).size,10);
  for(const href of entries){const response=await fetch(new URL(href,base));assert.equal(response.status,200,href);const html=await response.text();assert.match(html,/<main(?:\s|>)/);assert.match(html,/href="\.\/recommendation\.html"/,href);}
  const rec=await (await fetch(base+'recommendation.html')).text();
  for(const id of ['feed-section','seat-lesson','feedback-story'])assert.ok(rec.includes(`id="${id}"`));
  for(const src of [...home.matchAll(/(?:src|href)="\.\/([^"#?]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]))assert.equal((await fetch(base+src)).status,200,src);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
