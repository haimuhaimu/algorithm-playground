import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Reverting any entry URL or import to an unversioned path reintroduces
// the observed new-HTML / cached-old-engine failure on GitHub Pages.
test('sand entries and their module graph share one release key',async()=>{
 const root=new URL('../',import.meta.url);
 const html=await readFile(new URL('sand.html',root),'utf8');
 const entries=[...html.matchAll(/<(?:link|script)\b[^>]*(?:src|href)="(\.\/sand[^"]+)"/g)].map(m=>new URL(m[1],root));
 assert.deepEqual(entries.map(u=>u.pathname.split('/').at(-1)).sort(),['sand-lesson-ui.mjs','sand.css','sand.mjs']);
 const version=entries[0].searchParams.get('v');
 assert.ok(version,'entry assets must avoid the old unversioned browser cache');
 const urls=[...entries],visited=new Set();
 while(urls.length){
  const url=urls.shift();if(visited.has(url.href))continue;visited.add(url.href);
  assert.equal(url.searchParams.get('v'),version,url.pathname);
  const file=new URL(url);file.search='';
  const source=await readFile(file,'utf8');assert.ok(source.length>0,'versioned assets must resolve to shipped files');
  if(file.pathname.endsWith('.mjs'))for(const [,path]of source.matchAll(/from\s+['"]([^'"]+)['"]/g))urls.push(new URL(path,file));
 }
});
