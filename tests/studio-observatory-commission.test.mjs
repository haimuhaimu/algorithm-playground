import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=file=>readFile(new URL('../'+file,import.meta.url),'utf8');

test('each main sampling machine keeps its distribution name and shows a different studio operator',async()=>{
 const page=await html('distributions.html');
 for(const [id,cat,name] of [['normal','heim','嘿姆'],['exponential','bobby','波比'],['pareto','chouchou','臭臭']]){
  const machine=page.match(new RegExp('<article[^>]*id="machine-'+id+'"[^>]*>([\\s\\S]*?)</article>'))?.[1]??'';
  assert.ok(machine.includes('./studio-'+cat+'-portrait.png')&&machine.includes(name+'值班'),id+' needs a distinct recognizable operator');
  assert.ok(machine.includes('id="model-'+id+'"')&&machine.includes('id="chart-'+id+'"'));
 }
});

test('the same Bobby client sits on the reference strip outside the two evaluated posters',async()=>{
 const page=await html('rsi.html');
 const reference=page.match(/<div class="reference-strip">[^\n]*/)?.[0]??'';
 assert.ok(reference.includes('studio-bobby-portrait.png')&&reference.includes('委托人：波比'));
 assert.equal((page.match(/studio-bobby-portrait\.png/g)||[]).length,1);
 assert.ok(reference.includes('id="master-art"')&&reference.includes('id="brief-copy"'));
});
