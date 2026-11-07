import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {build} from '../scripts/build.mjs';
import {startServer} from '../scripts/serve.mjs';
import {CAT_TRAIN,CAT_TEST} from '../neural-cat-lesson.mjs';
import {coachRound} from '../neural-cat-coach.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const modules=['neural-cat-lesson.mjs','neural-cat-lesson-ui.mjs','neural-cat-coach.mjs','neural-cat-coach-ui.mjs','neural-cat-quick-ui.mjs'];
const style='neural-cat-lesson.css';
const images=[...new Set([...CAT_TRAIN,...CAT_TEST,...coachRound('chouchou','first',18).points].map(sample=>sample.image.slice(2)))];
const types=Object.fromEntries([...modules.map(name=>[name,'text/javascript; charset=utf-8']),
 [style,'text/css; charset=utf-8'],...images.map(name=>[name,'image/jpeg'])]);
const assets=Object.keys(types);
const privateFiles=['neural-cat-source.png','neural-cat-source-manifest.md','neural-cat-contact-sheet.jpg'];

test('the static build includes the lesson and 20 distinct web crops byte for byte, not private source material',async()=>{
 const out=await mkdtemp(join(tmpdir(),'neural-cat-build-'));
 try{
  const names=await build(root,out);
  assert.deepEqual(names.filter(name=>name.startsWith('neural-cat-')).sort(),assets.sort());
  assert.ok(privateFiles.every(name=>!names.includes(name)));
  const files=await Promise.all(assets.map(async name=>{
   const bytes=await readFile(join(out,name));
   assert.deepEqual(bytes,await readFile(join(root,name)),name);
   if(images.includes(name)){
    assert.equal(bytes.readUInt16BE(0),0xffd8,name);
    assert.ok(bytes.length<70000,`${name} exceeds the local crop budget`);
    return bytes.toString('base64');
   }
   return null;
  }));
  assert.equal(new Set(files.filter(Boolean)).size,20,'do not reuse the same image across cards');
 }finally{await rm(out,{recursive:true,force:true});}
});

test('the local preview serves the lesson assets with their real types and refuses raw source and private notes',async()=>{
 const server=await startServer({port:0});
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const [name,type] of Object.entries(types)){
   const response=await fetch(`${base}/${name}`);
   assert.equal(response.status,200,name);
   assert.equal(response.headers.get('content-type'),type,name);
   await response.arrayBuffer();
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
 const temp=await mkdtemp(join(tmpdir(),'neural-cat-source-'));
 try{
  for(const name of privateFiles)await writeFile(join(temp,name),'not part of the preview');
  const server=await startServer({port:0,root:temp});
  try{
   for(const name of privateFiles)assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/${name}`)).status,404,name);
  }finally{await new Promise(resolve=>server.close(resolve));}
 }finally{await rm(temp,{recursive:true,force:true});}
});
