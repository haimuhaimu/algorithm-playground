import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

for(const name of ['learning-route.mjs','learning-tool.mjs']){
 test(`learning route loads ${name} once across play, trial comparison and GenAI return`,()=>{
  const entry=new URL('../../dist/learning-route-ui.mjs',import.meta.url).href;
  // Observe actual module instantiation in a fresh process. Different query
  // strings must not make the built page load the same engine more than once.
  const output=execFileSync(process.execPath,['--input-type=module','-e',`
   import {registerHooks} from 'node:module';
   registerHooks({load(url,context,next){
    const result=next(url,context);
    if(new URL(url).pathname.split('/').at(-1)===${JSON.stringify(name)})console.log(JSON.stringify(url));
    return result;
   }});
   await import(${JSON.stringify(entry)});
  `],{encoding:'utf8'});
  const loaded=output.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  assert.equal(loaded.length,1,`${name}: expected one actual load, got ${loaded.join(', ')}`);
 });
}
