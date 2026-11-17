import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('the public learning API shares one codec between pixel replay and delivery',()=>{
 const entry=new URL('../../dist/learning-tool.mjs',import.meta.url).href;
 const output=execFileSync(process.execPath,['--input-type=module','-e',`
  import {registerHooks} from 'node:module';
  registerHooks({load(url,context,next){
   const result=next(url,context);
   if(new URL(url).pathname.endsWith('/pixel-core.mjs'))console.log(JSON.stringify(url));
   return result;
  }});
  const {runLearningTool,replayLearningReceipt}=await import(${JSON.stringify(entry)});
  const receipt=runLearningTool({experimentId:'pixel-decode',preset:'bobby',mode:'slow-replay',actions:[{action:'read',value:1}]});
  const saved=JSON.stringify(receipt);
  runLearningTool({experimentId:'pixel-decode',preset:'noise',actions:[{action:'read',value:528}]});
  if(JSON.stringify(receipt)!==saved||!replayLearningReceipt(receipt).matches)throw Error('Shared codec changed earlier pixel evidence');
 `],{encoding:'utf8'});
 const loaded=output.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
 assert.equal(loaded.length,1,`expected one actual codec load, got ${loaded.join(', ')}`);
});
