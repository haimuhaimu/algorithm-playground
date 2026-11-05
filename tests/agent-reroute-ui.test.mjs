import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const pageFile=new URL('../agent-reroute.html',import.meta.url);
const uiFile=new URL('../agent-reroute-ui.mjs',import.meta.url);
const html=existsSync(pageFile)?readFileSync(pageFile,'utf8'):'';
const mount=existsSync(uiFile)?(await import(uiFile)).mountAgentReroute:null;

function open({journey,clipboard}={}){
 assert.equal(typeof mount,'function','Level 02 must have a working controller');
 class Element extends EventTarget{
  hidden=false; disabled=false; dataset={}; textContent=''; innerHTML=''; value='';
  click(){if(!this.hidden&&!this.disabled)this.dispatchEvent(new Event('click'));}
  setAttribute(key,value){this[key]=String(value);}
  focus(){this.focused=true;}
  select(){this.selected=true;}
 }
 const nodes=new Map([...html.matchAll(/<[a-z][\w:-]*\b[^>]*\bid="([\w-]+)"[^>]*>/g)].map(([tag,id])=>[id,Object.assign(new Element(),{hidden:/\shidden(?:\s|>)/.test(tag),disabled:/\sdisabled(?:\s|>)/.test(tag)})]));
 function get(id){assert.ok(nodes.has(id),`missing actual control: ${id}`);return nodes.get(id);}
 const page=new URL('http://127.0.0.1:3103/agent-reroute.html#mission');
 if(journey){page.searchParams.set('genaiReturn','http://127.0.0.1:3102/');page.searchParams.set('genaiRequest','agent-reroute-0123456789');page.searchParams.set('genaiJourney',journey);}
 const sends=[],location={href:page.href,assign:url=>sends.push(url)};
 const document={getElementById:get,documentElement:{dataset:{}},hidden:false};
 const window={location,navigator:{clipboard},matchMedia:()=>Object.assign(new EventTarget(),{matches:false})};
 for(const context of [window,document])for(const key of ['localStorage','sessionStorage'])Object.defineProperty(context,key,{get(){throw Error('this level must not touch storage');}});
 mount({document,window});
 const e=name=>get(`reroute-${name}`),click=(...names)=>names.forEach(name=>e(name).click());
 return {e,click,sends,location,document};
}

test('only a complete caption changes the target; a changed target does not itself dispatch a new order',()=>{
 const {e,click}=open();
 assert.equal(e('scene').dataset.target,'07');
 assert.match(e('active-target').textContent,/07/);
 assert.match(e('caption').textContent,/07/);
 click('advance');
 assert.match(e('caption').textContent,/等等，改送/);
 assert.match(e('active-target').textContent,/07/);
 assert.equal(e('dispatch').hidden,true);
 click('advance');
 assert.match(e('caption').textContent,/改送 08 号站/);
 assert.match(e('active-target').textContent,/08/);
 assert.equal(e('scene').dataset.dispatched,'false');
 assert.match(e('new-receipt').textContent,/未派单/);
});

test('the late SUP-07 receipt cannot become SUP-08 evidence even when a player uses it to close',()=>{
 const {e,click}=open();
 click('advance','advance','dispatch');
 assert.equal(e('scene').dataset.dispatched,'true');
 assert.match(e('new-receipt').textContent,/已派单.*未核验/);
 click('advance');
 assert.match(e('old-receipt').textContent,/SUP-07.*07 号站/);
 assert.doesNotMatch(e('new-receipt').textContent,/已签收/);
 click('accept-old');
 assert.equal(e('scene').dataset.outcome,'misattributed');
 assert.equal(e('scene').dataset.newReceipt,'false');
 assert.match(e('status').textContent,/错配|误用/);
 assert.match(e('feedback').textContent,/08.*未核验/);
 assert.equal(e('share').hidden,false);
});

test('a player can dispatch in review, then verify the correct order independently of the old receipt',()=>{
 const {e,click}=open();click('advance','advance','keep-old','advance');
 assert.equal(e('verify-new').disabled,true);
 click('verify-new');
 assert.equal(e('scene').dataset.outcome,'in-progress');
 click('dispatch');
 assert.equal(e('scene').dataset.newReceipt,'false');
 click('verify-new');
 assert.equal(e('scene').dataset.outcome,'verified');
 assert.match(e('old-receipt').textContent,/SUP-07.*07 号站/);
 assert.match(e('new-receipt').textContent,/SUP-08.*08 号站/);
 assert.match(e('status').textContent,/08.*已核验/);
});

test('replay shows the player’s own sequence, including stopping without verification',()=>{
 const {e,click}=open();click('advance','advance','keep-old','advance','dispatch','stop');
 assert.match(e('timeline').innerHTML,/kept-old[\s\S]*old-receipt[\s\S]*reroute-accepted[\s\S]*stopped-unverified/);
 assert.match(e('status').textContent,/停止.*未核验/);
 click('replay');
 assert.match(e('replay-position').textContent,/0\s*\/\s*6/);
 assert.equal(e('scene').dataset.target,'07');
 assert.equal(e('share').hidden,true);
 click('replay-next');assert.match(e('caption').textContent,/等等，改送/);
 click('replay-next','replay-next','replay-next');
 assert.equal(e('scene').dataset.dispatched,'false');
 assert.equal(e('scene').dataset.oldReceipt,'true');
 click('replay-next');assert.equal(e('scene').dataset.dispatched,'true');
 click('replay-prev');assert.equal(e('scene').dataset.dispatched,'false');
 click('replay-exit');
 assert.equal(e('scene').dataset.outcome,'unverified');
 assert.equal(e('share').hidden,false);
});

test('standalone JSON exports only the current real run, and a fresh attempt clears the old view',()=>{
 const {e,click,sends}=open();click('advance','advance','dispatch','advance','accept-old');
 assert.equal(e('return').hidden,true);
 assert.equal(e('export-text').value,'');
 click('export');
 const record=JSON.parse(e('export-text').value);
 assert.equal(record.experimentId,'agent-reroute');
 assert.equal(record.producer,'browser-session');
 assert.deepEqual(record.actions.map(step=>step.action),['advance','advance','reroute','advance','accept-old']);
 assert.equal(record.result.evidence.outcome,'misattributed');
 assert.equal(record.result.evidence.newReceipt,null);
 assert.equal(record.result.mastery,'not-assessed');
 assert.deepEqual(sends,[]);
 click('restart');
 assert.equal(e('scene').dataset.target,'07');
 assert.equal(e('scene').dataset.oldReceipt,'false');
 assert.equal(e('share').hidden,true);
 assert.equal(e('export-text').value,'');
 assert.doesNotMatch(e('timeline').innerHTML,/old-receipt-misattributed/);
});

test('only an explicit complete Level 02 action returns a bound record to GenAI OS',()=>{
 const old=open({journey:'agent-learning'});old.click('advance','advance','dispatch','advance','verify-new','return');assert.deepEqual(old.sends,[]);
 const current=open({journey:'agent-reroute'});current.click('return');assert.deepEqual(current.sends,[]);
 current.click('advance','advance','dispatch','advance','verify-new');assert.deepEqual(current.sends,[]);
 current.click('return');
 const to=new URL(current.sends[0]),wire=JSON.parse(Buffer.from(to.hash.slice('#playground='.length),'base64url').toString('utf8'));
 assert.equal(to.origin,'http://127.0.0.1:3102');
 assert.equal(to.search,'?page=routes&section=agent-reroute-journey');
 assert.equal(wire.requestId,'agent-reroute-0123456789');
 assert.equal(wire.journeyId,'agent-reroute');
 assert.equal(wire.receipt.result.evidence.newReceipt.orderId,'SUP-08');
 current.location.href=current.location.href.replace('agent-reroute-0123456789','different-request-0123456789');
 current.click('return');assert.equal(current.sends.length,1);
 assert.match(current.e('share-status').textContent,/JSON/);
});

test('clipboard failure leaves the exact record available for manual copy',async()=>{
 const {e,click,document}=open({clipboard:{writeText:async()=>{throw Error('denied');}}});
 document.hidden=true;click('advance');assert.equal(e('scene').dataset.target,'07');
 document.hidden=false;click('advance','advance','keep-old','advance','stop','export');
 const json=e('export-text').value;
 click('copy');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(e('export-text').value,json);
 assert.equal(e('export-text').selected,true);
 assert.match(e('share-status').textContent,/手动/);
});
