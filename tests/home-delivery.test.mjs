import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAppServer} from '../scripts/serve.mjs';

const readPage=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

for(const [key,anchor] of [['recommendation','seat-lesson'],['firefly','listening-lesson']]){
 test(`the ${key} card lands on the visible start of the advertised activity`,async()=>{
  const home=await readPage('index.html'),page=key+'.html';
  const href=home.match(new RegExp('<a class="[^"]*\\b'+key+'-entry" href="([^"]+)"'))?.[1];
  assert.equal(href,`./${page}#${anchor}`);
  const target=(await readPage(page)).match(new RegExp('<[^>]+\\bid="'+anchor+'"[^>]*>'))?.[0];
  assert.ok(target,anchor);
  assert.doesNotMatch(target,/\shidden(?=\s|=|>)/,anchor);
 });
}

test('both homepage learning-route invitations open the same three-stop lesson',async()=>{
 const home=await readPage('index.html');
 const primary=home.match(/<a id="learning-route-entry"[^>]*href="([^"]+)"/)?.[1];
 const about=home.match(/<section class="home-about"[^>]*>[\s\S]*?<a href="([^"]+)">走一遍这条学习路线/)?.[1];
 assert.equal(primary,'./learn.html');
 assert.equal(about,primary);
});

test('the distribution lesson has a homepage link outside the ten main cards',async()=>{
 const home=await readPage('index.html');
 const entry=[...home.matchAll(/<a\b[^>]*href="\.\/distributions\.html#([^"]+)"[^>]*>[^<]*分布观察台/g)];
 assert.equal(entry.length,1,'one descriptive entry should be visible on the homepage');
 assert.doesNotMatch(entry[0][0],/\bexperiment-entry\b/);
 assert.ok((await readPage('distributions.html')).includes(`id="${entry[0][1]}"`));
});

test('showcase has ten usable experiment routes and preserves recommendation lesson entry points',async()=>{
 const server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}/`,home=await (await fetch(base)).text();
  const entries=[...home.matchAll(/<a class="experiment-entry[^"]*" href="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(entries.length,10);
  assert.equal(new Set(entries.map(h=>h.split('#')[0])).size,10);
  const neural=new URL(entries.find(h=>h.startsWith('./neural.html')),base);
  assert.equal(neural.hash,'#cat-lesson','the homepage opens the guided cat-label lesson');
  const neuralPage=await (await fetch(neural)).text();
  assert.match(neuralPage,/id="cat-lesson"/);
  assert.match(neuralPage,/id="first-lesson"/,'old circle/square deep links still have a target');
  for(const href of entries){const response=await fetch(new URL(href,base));assert.equal(response.status,200,href);const html=await response.text();assert.match(html,/<main(?:\s|>)/);assert.match(html,/href="\.\/recommendation\.html"/,href);}
  const rec=await (await fetch(base+'recommendation.html')).text();
  for(const id of ['feed-section','seat-lesson','feedback-story'])assert.ok(rec.includes(`id="${id}"`));
  for(const src of [...home.matchAll(/(?:src|href)="\.\/([^"#?]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]))assert.equal((await fetch(base+src)).status,200,src);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
