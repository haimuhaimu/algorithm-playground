import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Reverting a new entry or transitive import to an old unversioned URL
// can mix the new feedback renderer with a cached core lacking scorePost.
test('recommendation feedback entries load one fresh complete module graph',async()=>{
 const root=new URL('../',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
 const entries=[...html.matchAll(/(?:src|href)="(\.\/(?:app\.mjs|feedback-story\.css)[^"]*)"/g)].map(m=>new URL(m[1],root));
 assert.equal(entries.length,2);
 const version=entries[0].searchParams.get('v');assert.ok(version,'entry URL must bypass the previous unversioned browser cache');
 const queue=entries.filter(u=>u.pathname.endsWith('.mjs')),seen=new Set();
 for(const entry of entries)assert.equal(entry.searchParams.get('v'),version);
 while(queue.length){
  const url=queue.shift();if(seen.has(url.href))continue;seen.add(url.href);
  assert.equal(url.searchParams.get('v'),version,url.pathname);
  const file=new URL(url);file.search='';
  const code=await readFile(file,'utf8');
  for(const match of code.matchAll(/from\s+['"]([^'"]+)['"]/g))queue.push(new URL(match[1],url));
 }
 assert.ok([...seen].some(u=>new URL(u).pathname.endsWith('/feedback-story-ui.mjs')));
 assert.ok([...seen].some(u=>new URL(u).pathname.endsWith('/core.mjs')));
});
