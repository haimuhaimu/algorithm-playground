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
 const urls=[...entries];
 for(const file of ['sand.mjs','sand-lesson.mjs','sand-lesson-ui.mjs']){
  const code=await readFile(new URL(file,root),'utf8');
  const imports=[...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>new URL(m[1],root));
  assert.equal(imports.length,file==='sand-lesson-ui.mjs'?2:1,file);
  urls.push(...imports);
 }
 const version=entries[0].searchParams.get('v');
 assert.ok(version,'entry assets must avoid the old unversioned browser cache');
 for(const url of urls){
  assert.equal(url.searchParams.get('v'),version,url.pathname);
  const file=new URL(url);file.search='';
  assert.ok((await readFile(file)).length>0,'versioned assets must resolve to shipped files');
 }
});
