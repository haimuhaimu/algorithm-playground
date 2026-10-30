import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cli=new URL('../scripts/learning-tool.mjs',import.meta.url);
function call(command,input='',extra=[]){
 const r=spawnSync(process.execPath,[cli.pathname,command,...extra],{input,encoding:'utf8',timeout:5000,maxBuffer:200000});
 assert.equal(r.error,undefined);assert.ok(r.stdout.trim(),'the CLI must emit a structured JSON response');return {...r,json:JSON.parse(r.stdout)};
}
test('a fresh external process can discover, describe and actually run the same core without a browser',()=>{
 const list=call('list');assert.equal(list.status,0);assert.equal(list.json.data.experiments.length,10);
 const detail=call('describe','',['learning-route']);assert.equal(detail.status,0);assert.equal(detail.json.data.fixture.trainingExamples,6);
 const run=call('run',JSON.stringify({actions:[{action:'train'}]}));assert.equal(run.status,0);assert.equal(run.json.data.result.evidence.guide.steps,120);
 assert.equal(run.json.data.producer,'agent');assert.equal(run.json.data.result.workflowComplete,false);
 const replay=call('replay',JSON.stringify(run.json.data));assert.equal(replay.status,0);assert.equal(replay.json.data.matches,true);assert.equal(replay.json.data.authenticatesUser,false);
});
test('CLI malformed, excessive, unsupported and unexpected inputs fail in structured form',()=>{
 for(const [command,input,extra]of [
  ['run','not-json',[]],['run',JSON.stringify({actions:[],state:{}}),[]],['execute','',[]],
  ['run',JSON.stringify({actions:[{action:'train',url:'https://example.org'}]}),[]],['run',' '.repeat(65537)+'{}',[]],['run','{}',['/etc/passwd']]
 ]){const r=call(command,input,extra);assert.equal(r.status,1);assert.equal(r.json.ok,false);assert.ok(r.json.error);assert.equal(r.stderr,'');}
});
test('CLI replay never trusts an edited score',()=>{
 const run=call('run',JSON.stringify({actions:[{action:'train'}]}));run.json.data.result.evidence.guide.steps=999;
 const replay=call('replay',JSON.stringify(run.json.data));assert.equal(replay.status,1);assert.match(replay.json.error,/mismatch/i);
});
