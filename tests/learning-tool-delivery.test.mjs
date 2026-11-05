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
  assert.equal(m.runnables.find(entry=>entry.id==='pixel-decode').transport,'local-cli-or-library');
  const pixel=api.runLearningTool({experimentId:'pixel-decode',preset:'cat',mode:'slow-replay',actions:[{action:'read',value:1},{action:'read',value:2}]});
  assert.equal(pixel.result.evidence.sentBits,53);assert.equal(pixel.result.evidence.decodedCount,36);
  assert.equal(api.replayLearningReceipt(pixel).matches,true);
  for(const file of ['pixel-tool.mjs','pixel-tool-ui.mjs','learning-route-trials.mjs']){
   assert.ok(files.includes(file));
   const response=await fetch(base+'/'+file);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);
  }
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

test('Agent mission can be loaded and replayed from the built, allowlisted files',async()=>{
 const out=await mkdtemp(join(tmpdir(),'agent-mission-delivery-')),server=createAppServer(out);
 try{
  await build(undefined,out);
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done);});
  const base='http://127.0.0.1:'+server.address().port,origin='http://127.0.0.1:3130';
  const manifest=await (await fetch(base+'/learning-tool-manifest.json')).json();
  assert.equal(manifest.runnables.find(x=>x.id==='agent-tool-loop')?.engineVersion,'agent-tool-loop-v1');
  assert.equal(manifest.runnables.find(x=>x.id==='agent-reroute')?.engineVersion,'agent-reroute-v1');
  for(const [name,type] of [['agent-mission.html','text/html'],['agent-mission.css','text/css'],['agent-mission.mjs','text/javascript'],['agent-tool.mjs','text/javascript'],['agent-reroute.html','text/html'],['agent-reroute.css','text/css'],['agent-reroute-ui.mjs','text/javascript'],['agent-reroute-tool.mjs','text/javascript']]){
   const response=await fetch(base+'/'+name,{headers:{Origin:origin}});
   assert.equal(response.status,200,name);assert.ok(response.headers.get('content-type')?.startsWith(type),name);
   if(name.endsWith('.mjs'))assert.equal(response.headers.get('access-control-allow-origin'),origin);
  }
  const api=await import(pathToFileURL(join(out,'learning-tool.mjs')));
  const receipt=api.runLearningTool({experimentId:'agent-tool-loop',actions:['stop','restart','retry','check'].map(action=>({action}))});
  assert.deepEqual(receipt.result.evidence.trials.map(t=>t.outcome),['stopped','verified']);
  assert.equal(api.replayLearningReceipt(receipt).matches,true);
  const reroute=api.runLearningTool({experimentId:'agent-reroute',actions:['advance','advance','reroute','advance','verify-new'].map(action=>({action}))});
  assert.equal(reroute.result.evidence.newReceipt.orderId,'SUP-08');
  assert.equal(api.replayLearningReceipt(reroute).matches,true);
  const foreign=await fetch(base+'/agent-tool.mjs',{headers:{Origin:'https://example.org'}});
  assert.equal(foreign.headers.get('access-control-allow-origin'),null);
 }finally{await new Promise(done=>server.close(done));await rm(out,{recursive:true,force:true});}
});
