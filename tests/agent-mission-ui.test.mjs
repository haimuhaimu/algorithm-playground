import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {memoryStorage} from './storage-helper.mjs';

const source=new URL('../agent-mission.html',import.meta.url);
const html=existsSync(source)?readFileSync(source,'utf8'):'';
const api=await import('../agent-mission.mjs').catch(()=>({}));
const getPage=()=>new URL('http://127.0.0.1:3103/agent-mission.html#mission');
test('the live homepage links to the first mission and both levels link to each other',()=>{
 const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const next=readFileSync(new URL('../agent-reroute.html',import.meta.url),'utf8');
 assert.match(home, /id="home-agent-mission-entry" href="\.\/agent-mission\.html#mission"/);
 assert.match(html, /href="\.\/agent-reroute\.html#mission"/);
 assert.match(next, /href="\.\/agent-mission\.html#mission"/);
});
function setup({handoff=false,clipboard,storage}={}){
 assert.equal(typeof api.mountAgentMission,'function','the actual mission controller is required');
 class Element extends EventTarget{
  constructor(){super();this.hidden=false;this.disabled=false;this.dataset={};this.textContent='';this.innerHTML='';this.value='';}
  click(){if(!this.disabled&&!this.hidden)this.dispatchEvent(new Event('click'));}
  setAttribute(key,value){this[key]=String(value);}
  focus(){this.focused=true;}
  select(){this.selected=true;}
 }
 const page=getPage();
 if(handoff){page.searchParams.set('genaiReturn','http://127.0.0.1:3102/');page.searchParams.set('genaiRequest','agent-mission-0123456789');page.searchParams.set('genaiJourney','agent-learning');}
 const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const e=id=>{assert.ok(nodes.has(id),`missing actual page element: ${id}`);return nodes.get(id);};
 const document={hidden:false,documentElement:{dataset:{}},getElementById:e};
 const sends=[],location={href:page.href,assign:url=>sends.push(url)};
 const window={location,navigator:{clipboard},matchMedia:()=>Object.assign(new EventTarget(),{matches:false})};
 Object.defineProperty(window,'localStorage',{get(){if(storage)return storage;throw Error('storage blocked');}});
 Object.defineProperty(document,'localStorage',{get(){throw Error('must not access document storage');}});
 api.mountAgentMission({document,window});
 return {e,sends,location,document,click:(...names)=>names.forEach(name=>e(`mission-${name}`).click())};
}

test('acceptance and retry show tool feedback without claiming actual delivery',()=>{
 const r=setup();
 assert.equal(r.e('mission-tool').textContent,'已受理');
 assert.equal(r.e('mission-receipt').textContent,'未核验');
 assert.equal(r.e('mission-budget').textContent,'3 / 3');
 assert.equal(r.e('mission-scene').dataset.receipt,'unknown');
 r.click('retry');
 assert.match(r.e('mission-tool').textContent,/受理/);
 assert.equal(r.e('mission-receipt').textContent,'未核验');
 assert.equal(r.e('mission-budget').textContent,'2 / 3');
 r.click('check');
 assert.equal(r.e('mission-receipt').textContent,'已签收');
 assert.equal(r.e('mission-scene').dataset.receipt,'delivered');
 assert.equal(r.e('mission-restart').hidden,false);
});

test('two stopped rounds survive a page exit and only an explicit view restores their exact JSON',()=>{
 const storage=memoryStorage(),first=setup({storage});
 first.click('stop');assert.equal(storage.writes,0,'one round is not a completed pair');
 first.click('restart','stop','export');
 const original=first.e('mission-export-text').value;
 assert.match(first.e('mission-save-status').textContent,/已保留.*本机/);
 const next=setup({storage});
 assert.equal(next.e('mission-current').textContent,'第 1 轮','do not resume silently');
 assert.equal(next.e('mission-last-result').hidden,false);
 assert.equal(next.e('mission-share').hidden,true);
 next.click('view-last','export');
 assert.equal(next.e('mission-export-text').value,original);
 assert.match(next.e('mission-current').textContent,/上次/);
 assert.equal(next.e('mission-share').hidden,false);
 assert.deepEqual(next.sends,[]);
});

test('starting a new pair clears old visible evidence but retains the completed archive until a new completion',()=>{
 const storage=memoryStorage(),first=setup({storage});first.click('stop','restart','stop');
 const snapshot=[...storage.records];
 const r=setup({storage});r.click('view-last','export','new-run');
 assert.equal(r.e('mission-current').textContent,'第 1 轮');
 assert.equal(r.e('mission-export-text').value,'');
 assert.equal(r.e('mission-export-record').hidden,true);
 assert.doesNotMatch(r.e('mission-trial-2').innerHTML,/主动停止/);
 r.click('retry');assert.deepEqual([...storage.records],snapshot);
 r.click('check','restart','retry','check');
 const returned=setup({storage});returned.click('view-last','export');
 assert.deepEqual(JSON.parse(returned.e('mission-export-text').value).result.evidence.trials.map(t=>t.outcome),['verified','verified']);
});

test('archived results cannot bind to a new GenAI request but newly played results can',()=>{
 const storage=memoryStorage(),first=setup({storage});first.click('stop','restart','stop');
 const r=setup({storage,handoff:true});
 assert.equal(r.e('mission-share').hidden,true);
 r.click('view-last');assert.equal(r.e('mission-return').hidden,true);
 r.e('mission-return').dispatchEvent(new Event('click'));assert.deepEqual(r.sends,[]);
 r.click('new-run','stop','restart','retry','check','return');
 assert.equal(r.sends.length,1);
 const wire=JSON.parse(Buffer.from(new URL(r.sends[0]).hash.slice('#playground='.length),'base64url').toString('utf8'));
 assert.deepEqual(wire.receipt.actions.map(a=>a.action),['stop','restart','retry','check']);
});

test('a corrupt archive is explained without importing it or clearing unrelated records',()=>{
 const storage=memoryStorage(),r=setup({storage});r.click('stop','restart','stop');
 const [key]=storage.records.keys();storage.records.set(key,'{broken');storage.records.set('existing-progress','keep');
 const before=[...storage.records],fresh=setup({storage});
 assert.equal(fresh.e('mission-view-last').hidden,true);
 assert.match(fresh.e('mission-last-message').textContent,/无法核对/);
 assert.equal(fresh.e('mission-share').hidden,true);
 assert.deepEqual([...storage.records],before);
 fresh.click('new-run','stop');assert.deepEqual([...storage.records],before);
});

test('late clipboard completion cannot put old export feedback back into a fresh pair',async()=>{
 for(const reject of [false,true]){
  let settle;const pending=new Promise((resolve,fail)=>{settle=()=>reject?fail(Error('denied')):resolve();});
  const r=setup({clipboard:{writeText:()=>pending}});r.click('stop','restart','stop','export','copy','fresh');
  settle();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(r.e('mission-share-status').textContent,'');
  assert.equal(r.e('mission-export-text').value,'');
  assert.equal(r.e('mission-export-record').hidden,true);
 }
});

test('blocked saving leaves the completed result exportable and truthfully reports the failure',()=>{
 const r=setup();r.click('new-run');
 assert.doesNotMatch(r.e('mission-feedback').textContent,/上一份.*留到/,'no archive is promised when storage cannot be read');
 r.click('stop','restart','stop');
 assert.match(r.e('mission-save-status').textContent,/未能.*保留|无法.*保存/);
 assert.doesNotMatch(r.e('mission-save-status').textContent,/已保留/);
 assert.equal(r.e('mission-share').hidden,false);
 r.click('export');assert.equal(JSON.parse(r.e('mission-export-text').value).result.workflowComplete,true);
});

test('stopping ends the round without replacing the last tool reply',()=>{
 const r=setup();r.click('retry','stop');
 assert.equal(r.e('mission-tool').textContent,'备用单已受理');
 assert.match(r.e('mission-feedback').textContent,/主动停止/);
 assert.equal(r.e('mission-receipt').textContent,'未核验');
});

test('same-condition replay preserves first-round actual evidence and two identical outcomes',()=>{
 const r=setup();r.click('stop');
 const first=r.e('mission-trial-1').innerHTML;
 assert.match(first,/主动停止/);assert.match(first,/未核验/);
 assert.equal(r.e('mission-share').hidden,true);
 r.click('restart');assert.equal(r.e('mission-budget').textContent,'3 / 3');
 assert.equal(r.e('mission-tool').textContent,'已受理');
 assert.equal(r.e('mission-trial-1').innerHTML,first);
 r.click('stop');
 assert.match(r.e('mission-trial-2').innerHTML,/主动停止/);
 assert.match(r.e('mission-comparison').textContent,/相同/);
 assert.equal(r.e('mission-share').hidden,false);
 assert.equal(r.e('mission-export-text').value,'','nothing is exported implicitly');
});

test('two stopped rounds expose the next lesson beside the result without navigating or exporting',()=>{
 const r=setup(),share=r.e('mission-share');
 assert.equal(share.hidden,true);
 r.click('stop');assert.equal(share.hidden,true,'one finished round is not enough');
 r.click('restart','stop');
 assert.equal(share.hidden,false);
 assert.match(r.e('mission-comparison').textContent,/都没有核验到货/);
 const actions=html.match(/id="mission-share"[\s\S]*?<div class="mission-share-actions">([\s\S]*?)<\/div>/)?.[1]??'';
 assert.match(actions,/<a\b[^>]*id="mission-next-level"[^>]*href="\.\/agent-reroute\.html#mission"/);
 assert.equal(r.e('mission-share-title').focused,true,'keyboard reading starts before the next and export actions');
 assert.equal(r.location.href,getPage().href);
 assert.deepEqual(r.sends,[]);
 assert.equal(r.e('mission-export-text').value,'');
});

test('three fruitless checks exhaust only the budget, not the task',()=>{
 const r=setup();r.click('check','check','check');
 assert.equal(r.e('mission-budget').textContent,'0 / 3');
 assert.equal(r.e('mission-receipt').textContent,'未签收');
 assert.match(r.e('mission-feedback').textContent,/次数用尽/);
 assert.match(r.e('mission-trial-1').innerHTML,/用尽.*未核验到货|用尽.*未签收/);
 assert.equal(r.e('mission-check').disabled,true);
});

test('manual export without handoff contains the actual independent rounds and no fabricated completion',async()=>{
 const r=setup();r.click('stop','restart','check','retry','check');
 assert.equal(r.e('mission-return').hidden,true);
 assert.equal(r.e('mission-os-fallback').hidden,true,'standalone preview must not send the user to the unpublished public route');
 assert.equal(r.e('mission-os-manual').hidden,false);
 r.click('export');
 const receipt=JSON.parse(r.e('mission-export-text').value);
 assert.equal(receipt.producer,'browser-session');
 assert.deepEqual(receipt.actions.map(step=>step.action),['stop','restart','check','retry','check']);
 assert.deepEqual(receipt.result.evidence.trials.map(trial=>trial.outcome),['stopped','verified']);
 assert.equal(receipt.result.mastery,'not-assessed');
 assert.equal((await import('../agent-tool.mjs')).replayAgentToolReceipt(receipt).matches,true);
});

test('GenAI return is explicit, verifies the initial request and keeps the record in the fragment',()=>{
 const r=setup({handoff:true});r.click('return');assert.deepEqual(r.sends,[]);
 r.click('stop','restart','check','retry','check');
 assert.equal(r.e('mission-return').hidden,false);assert.deepEqual(r.sends,[]);
 r.click('return');
 const target=new URL(r.sends[0]),data=JSON.parse(Buffer.from(target.hash.slice('#playground='.length),'base64url').toString('utf8'));
 assert.equal(target.origin,'http://127.0.0.1:3102');
 assert.equal(target.search,'?page=routes&section=agent-journey');
 assert.equal(data.requestId,'agent-mission-0123456789');
 assert.equal(data.receipt.result.evidence.trials[1].receipt,'delivered');
 r.location.href=r.location.href.replace('agent-mission-0123456789','another-request-0123456789');
 r.click('return');assert.equal(r.sends.length,1);
 assert.match(r.e('mission-share-status').textContent,/保留/);
 assert.equal(r.e('mission-os-fallback').href,'http://127.0.0.1:3102/?page=routes&section=agent-journey','failure fallback returns to the same verified origin');
 assert.equal(r.e('mission-os-fallback').hidden,false);
});

test('a hidden page cannot spend tools; blocked clipboard leaves the exact JSON ready for manual copy',async()=>{
 const r=setup({clipboard:{writeText:async()=>{throw Error('denied');}}});
 r.document.hidden=true;r.click('check','stop');assert.equal(r.e('mission-budget').textContent,'3 / 3');
 r.document.hidden=false;r.click('stop','restart','stop','export');
 const before=r.e('mission-export-text').value;r.click('copy');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(r.e('mission-export-text').value,before);
 assert.equal(r.e('mission-export-text').selected,true);
 assert.match(r.e('mission-share-status').textContent,/手动/);
});
