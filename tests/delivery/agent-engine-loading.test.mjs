import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

for(const [entry,ownEngine] of [
 ['agent-mission.mjs','agent-tool.mjs'],
 ['agent-reroute-ui.mjs','agent-reroute-tool.mjs'],
 ['agent-frames-ui.mjs','agent-frames-tool.mjs']
]){
 test(`${entry} loads each real Agent engine only once across play, saved results and GenAI return`,()=>{
  // Trace actual module loading in a fresh process, not import-string spelling.
  // A second query-string identity would otherwise fetch/instantiate the same
  // engine again in the browser, even though its algorithms are unchanged.
  const url=new URL('../../dist/'+entry,import.meta.url).href;
  const output=execFileSync(process.execPath,['--input-type=module','-e',`
   import {registerHooks} from 'node:module';
   registerHooks({load(url,context,next){
    const result=next(url,context),name=new URL(url).pathname.split('/').at(-1);
    if(['agent-tool.mjs','agent-reroute-tool.mjs','agent-frames-tool.mjs'].includes(name))console.log(JSON.stringify({name,url}));
    return result;
   }});
   await import(${JSON.stringify(url)});
  `],{encoding:'utf8'});
  const loaded=output.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  assert.ok(loaded.some(item=>item.name===ownEngine),'the playable entry must load its actual engine');
  for(const name of new Set(loaded.map(item=>item.name))){
   assert.equal(loaded.filter(item=>item.name===name).length,1,`${name} must not load under multiple URL identities`);
  }
 });
}
