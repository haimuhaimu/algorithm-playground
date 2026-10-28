import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('firefly entry assets and every imported module resolve with one release key',async()=>{
 const html=await readFile(new URL('firefly.html',root),'utf8');
 const urls=[...html.matchAll(/<(?:link|script)\b[^>]*(?:src|href)="(\.\/firefly[^"]+)"/g)].map(m=>new URL(m[1],root));
 assert.equal(urls.length,3);const release=urls[0].searchParams.get('v');assert.ok(release);
 const seen=new Set();while(urls.length){
  const url=urls.shift();if(seen.has(url.href))continue;seen.add(url.href);assert.equal(url.searchParams.get('v'),release,url.pathname);
  const file=new URL(url);file.search='';const content=await readFile(file,'utf8');
  if(file.pathname.endsWith('.mjs'))for(const[,path]of content.matchAll(/from\s+['"]([^'"]+)['"]/g))urls.push(new URL(path,file));
 }
 assert.ok([...seen].some(url=>url.includes('firefly-beat-ui.mjs')),'actual user entry must reach the new controller');
});
