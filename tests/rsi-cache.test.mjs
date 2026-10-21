import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Removing a release key can combine the new trace UI with a cached session
// module that does not export studioTrace, preventing the whole page from booting.
test('RSI entry assets and module imports share one release key',async()=>{
 const root=new URL('../',import.meta.url),html=await readFile(new URL('rsi.html',root),'utf8');
 const entries=[...html.matchAll(/<(?:link|script)\b[^>]*(?:src|href)="(\.\/rsi[^"]+)"/g)].map(m=>new URL(m[1],root));
 assert.deepEqual(entries.map(u=>u.pathname.split('/').at(-1)).sort(),['rsi.css','rsi.mjs']);
 const urls=[...entries];
 for(const file of ['rsi.mjs','rsi-session.mjs']){
  const code=await readFile(new URL(file,root),'utf8');
  const imports=[...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>new URL(m[1],root));
  assert.equal(imports.length,file==='rsi.mjs'?2:1,file);urls.push(...imports);
 }
 const version=entries[0].searchParams.get('v');
 assert.ok(version,'RSI assets must not reuse the previous unversioned browser cache');
 for(const url of urls){
  assert.equal(url.searchParams.get('v'),version,url.pathname);
  const file=new URL(url);file.search='';assert.ok((await readFile(file)).length>0);
 }
});
