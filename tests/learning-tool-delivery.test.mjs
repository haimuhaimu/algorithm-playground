import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../scripts/build.mjs';
import {createAppServer} from '../scripts/serve.mjs';
test('built public contract is discoverable and its delivered library runs the actual route',async()=>{
 const out=await mkdtemp(join(tmpdir(),'learning-tool-delivery-')),server=createAppServer(out);
 try{
  const files=await build(undefined,out);await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done);});
  const base='http://127.0.0.1:'+server.address().port;
  const manifest=await fetch(base+'/learning-tool-manifest.json');assert.equal(manifest.status,200);assert.match(manifest.headers.get('content-type'),/application\/json/);
  const m=await manifest.json();assert.equal(m.runnable.id,'learning-route');assert.equal(m.runnable.transport,'local-cli-or-library');assert.equal(m.hostedExecution,false);
  const doc=await fetch(base+'/AI_USAGE.md');assert.equal(doc.status,200);assert.match(doc.headers.get('content-type'),/text\/plain/);
  assert.ok(files.includes('learning-tool.mjs'));
  const api=await import(pathToFileURL(join(out,'learning-tool.mjs')));
  const r=api.runLearningRoute([{action:'train'}]);assert.equal(r.result.evidence.guide.steps,120);assert.equal(r.result.workflowComplete,false);
 }finally{await new Promise(done=>server.close(done));await rm(out,{recursive:true,force:true});}
});
test('discovered browser entries resolve to anchors in the independently built release',async()=>{
 const out=await mkdtemp(join(tmpdir(),'learning-tool-links-'));
 try{
  await build(undefined,out);
  const api=await import(pathToFileURL(join(out,'learning-tool.mjs')));
  const catalog=api.listLearningTools();
  for(const entry of [...catalog.experiments,...catalog.runnables]){
   const url=new URL(entry.url),file=url.pathname.split('/').at(-1),anchor=decodeURIComponent(url.hash.slice(1));
   const html=await readFile(join(out,file),'utf8');
   assert.ok(anchor&&html.includes('id="'+anchor+'"'),entry.id+' must land on an existing release section: '+url.hash);
  }
 }finally{await rm(out,{recursive:true,force:true});}
});
