import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// A real returning browser loaded new lesson HTML with a cached old mining.mjs,
// leaving all shared evidence blank. Entry and import URLs must change together.
test('mining entry assets and lesson module graph share a release key',async()=>{
 const root=new URL('../',import.meta.url),html=await readFile(new URL('mining.html',root),'utf8');
 const entries=[...html.matchAll(/<(?:link|script)\b[^>]*(?:src|href)="(\.\/mining[^"]+)"/g)].map(m=>new URL(m[1],root));
 assert.deepEqual(entries.map(u=>u.pathname.split('/').at(-1)).sort(),['mining.css','mining.mjs']);
 const urls=[...entries];
 for(const file of ['mining.mjs','mining-shared-ui.mjs','mining-shared-evidence.mjs']){
  const code=await readFile(new URL(file,root),'utf8');
  const imports=[...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>new URL(m[1],root));
  assert.equal(imports.length,file==='mining.mjs'?2:1,file);urls.push(...imports);
 }
 const version=entries[0].searchParams.get('v');
 assert.ok(version,'new mining HTML must not reuse the previous unversioned browser cache');
 for(const url of urls){
  assert.equal(url.searchParams.get('v'),version,url.pathname);
  const file=new URL(url);file.search='';assert.ok((await readFile(file)).length>0);
 }
});
