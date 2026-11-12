import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {memoryStorage} from '../helpers/storage-helper.mjs';

const pageFile=new URL('../../dist/agent-reroute.html',import.meta.url);
const uiFile=new URL('../../dist/agent-reroute-ui.mjs',import.meta.url);
const html=existsSync(pageFile)?readFileSync(pageFile,'utf8'):'';
const mount=existsSync(uiFile)?(await import(uiFile)).mountAgentReroute:null;

function open({journey,clipboard,storage}={}){
 assert.equal(typeof mount,'function','Level 02 must have a working controller');
 class Element extends EventTarget{
  hidden=false; disabled=false; dataset={}; textContent=''; innerHTML=''; value='';
  click(){if(!this.hidden&&!this.disabled)this.dispatchEvent(new Event('click'));}
  setAttribute(key,value){this[key]=String(value);}
  focus(){this.focused=true;}
  getBoundingClientRect(){return {top:20,bottom:150};}
  scrollIntoView(){this.scrolled=true;}
  select(){this.selected=true;}
 }
 const nodes=new Map([...html.matchAll(/<[a-z][\w:-]*\b[^>]*\bid="([\w-]+)"[^>]*>/g)].map(([tag,id])=>[id,Object.assign(new Element(),{hidden:/\shidden(?:\s|>)/.test(tag),disabled:/\sdisabled(?:\s|>)/.test(tag)})]));
 function get(id){assert.ok(nodes.has(id),`missing actual control: ${id}`);return nodes.get(id);}
 const page=new URL('http://127.0.0.1:3103/agent-reroute.html#mission');
 if(journey){page.searchParams.set('genaiReturn','http://127.0.0.1:3102/');page.searchParams.set('genaiRequest','agent-reroute-0123456789');page.searchParams.set('genaiJourney',journey);}
 const sends=[],location={href:page.href,assign:url=>sends.push(url)};
 const document={getElementById:get,documentElement:{dataset:{}},hidden:false};
 const window={location,innerHeight:568,navigator:{clipboard},matchMedia:()=>Object.assign(new EventTarget(),{matches:false})};
 Object.defineProperty(window,'localStorage',{get(){if(storage)return storage;throw Error('storage blocked');}});
 for(const context of [window,document])Object.defineProperty(context,'sessionStorage',{get(){throw Error('must not touch other storage');}});
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

test('a completed misattributed result survives reload with exact export and step replay',()=>{
 const storage=memoryStorage(),r=open({storage});r.click('advance','advance','dispatch','advance');
 assert.equal(storage.writes,0);
 r.click('accept-old','export');const original=r.e('export-text').value;
 assert.match(r.e('save-status').textContent,/已保留.*本机/);
 const fresh=open({storage});assert.equal(fresh.e('scene').dataset.target,'07');
 assert.equal(fresh.e('last-result').hidden,false);
 fresh.click('view-last','export');assert.equal(fresh.e('export-text').value,original);
 assert.match(fresh.e('review-title').textContent,/上次/);
 fresh.click('replay');assert.equal(fresh.e('scene').dataset.target,'07');
 fresh.click('replay-next','replay-next','replay-next','replay-next','replay-next');
 assert.equal(fresh.e('scene').dataset.outcome,'misattributed');
 fresh.click('replay-exit','restart');assert.equal(fresh.e('scene').dataset.target,'07');
 assert.equal(fresh.e('export-text').value,'');
 const again=open({storage});again.click('view-last','export');assert.equal(again.e('export-text').value,original);
});

test('an old reroute run is not a fresh GenAI task and a new run can still return normally',()=>{
 const storage=memoryStorage(),old=open({storage});old.click('advance','advance','keep-old','advance','stop');
 const r=open({storage,journey:'agent-reroute'});
 r.click('view-last');assert.equal(r.e('return').hidden,true);
 r.e('return').dispatchEvent(new Event('click'));assert.deepEqual(r.sends,[]);
 r.click('new-run','advance','advance','dispatch','advance','verify-new','return');
 assert.equal(r.sends.length,1);
 const wire=JSON.parse(Buffer.from(new URL(r.sends[0]).hash.slice('#playground='.length),'base64url').toString('utf8'));
 assert.equal(wire.receipt.result.evidence.outcome,'verified');
});

test('corrupt reroute archives stay untouched and do not masquerade as completed tasks',()=>{
 const storage=memoryStorage(),r=open({storage});r.click('advance','advance','keep-old','advance','stop');
 const [key]=storage.records.keys();storage.records.set(key,'{broken');storage.records.set('existing-progress','keep');
 const before=[...storage.records],fresh=open({storage});
 assert.equal(fresh.e('view-last').hidden,true);assert.match(fresh.e('last-message').textContent,/无法核对/);
 assert.equal(fresh.e('share').hidden,true);assert.deepEqual([...storage.records],before);
 fresh.click('new-run','advance');assert.deepEqual([...storage.records],before);
});

test('late clipboard resolution or rejection does not restore old export feedback after restart',async()=>{
 for(const reject of [false,true]){
  let settle;const pending=new Promise((resolve,fail)=>{settle=()=>reject?fail(Error('denied')):resolve();});
  const r=open({clipboard:{writeText:()=>pending}});r.click('advance','advance','keep-old','advance','stop','export','copy','restart');
  settle();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(r.e('share-status').textContent,'');assert.equal(r.e('export-text').value,'');
  assert.equal(r.e('export-record').hidden,true);
 }
});

test('reroute storage failure never blocks completion, export, replay or a new challenge',()=>{
 const r=open();r.click('new-run');
 assert.doesNotMatch(r.e('feedback').textContent,/上一份.*留到/,'no archive is promised when storage cannot be read');
 r.click('advance','advance','keep-old','advance','stop');
 assert.match(r.e('save-status').textContent,/未能.*保留|无法.*保存/);
 r.click('export');assert.equal(JSON.parse(r.e('export-text').value).result.evidence.outcome,'unverified');
 r.click('replay','replay-exit','restart');assert.equal(r.e('scene').dataset.target,'07');
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

test('the result offers Level 03 without navigating away or gating on successful verification',()=>{
 const firstResultAction=html.match(/<div\b[^>]*\bid="reroute-share"[^>]*>\s*(<a\b[^>]*>[^<]*<\/a>)/)?.[1];
 assert.ok(firstResultAction,'the result must start with a real next-level link');
 assert.match(firstResultAction,/\bid="reroute-next-level"/);
 assert.match(firstResultAction,/\bhref="\.\/agent-frames\.html#mission"/);
 assert.match(firstResultAction,/>[^<]*第三关[^<]*只留三帧/);
 for(const decisions of [
  ['dispatch','advance','verify-new'],
  ['dispatch','advance','accept-old'],
  ['keep-old','advance','stop'],
 ]){
  const {e,click,sends}=open();
  assert.equal(e('share').hidden,true);
  click('advance','advance',...decisions.slice(0,-1));
  assert.equal(e('share').hidden,true);
  click(decisions.at(-1));
  assert.equal(e('share').hidden,false);
  assert.equal(e('status').focused,true);
  assert.deepEqual(sends,[]);
  click('replay');assert.equal(e('share').hidden,true);
  click('replay-exit');assert.equal(e('share').hidden,false);
  click('restart');assert.equal(e('share').hidden,true);
 }
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

test('Chouchou responds to the actual receipt without changing the instruction or exported evidence',()=>{
 for(const [decisions,pattern,newReceipt] of [
  [['dispatch','advance','verify-new'],/SUP-08.*08 号站.*可以结案/,true],
  [['dispatch','advance','accept-old'],/07 的回执.*08.*还没核验/,false],
  [['keep-old','advance','stop'],/08.*还没派单.*不能算送到/,false],
  [['dispatch','advance','stop'],/08.*派出.*还没核对签收/,false],
 ]){
  const {e,click}=open();click('advance','advance',...decisions.slice(0,-1));
  assert.equal(e('response').hidden,true,'no response before a decision ends the run');
  e('status').getBoundingClientRect=()=>({top:-50,bottom:25});
  click(decisions.at(-1));
  assert.equal(e('response').hidden,false);assert.match(e('response-text').textContent,pattern);
  assert.equal(e('status').scrolled,true,'offscreen outcome is brought into view');
  assert.equal(e('caption').textContent,'「改送 08 号站。」');
  click('export');
  const json=JSON.parse(e('export-text').value);
  assert.equal(Boolean(json.result.evidence.newReceipt),newReceipt);
  assert.equal(json.steps.length,5);
  assert.doesNotMatch(e('export-text').value,/臭臭|可以结案/);
  click('restart');assert.equal(e('response').hidden,true);assert.equal(e('response-text').textContent,'');
 }
});

test('replay shows Chouchou’s response and its terminal event only once that step is reached',()=>{
 const {e,click}=open();click('advance','advance','dispatch','advance','accept-old','replay');
 assert.equal(e('response').hidden,true);
 assert.doesNotMatch(e('timeline').innerHTML,/old-receipt-misattributed/);
 click('replay-next','replay-next','replay-next','replay-next');
 assert.equal(e('response').hidden,true);
 assert.match(e('timeline').innerHTML,/old-receipt/);
 assert.doesNotMatch(e('timeline').innerHTML,/old-receipt-misattributed/);
 click('replay-next');assert.match(e('response-text').textContent,/07 的回执.*08.*还没核验/);
 assert.match(e('timeline').innerHTML,/old-receipt-misattributed/);
 click('replay-prev');assert.equal(e('response').hidden,true);assert.equal(e('response-text').textContent,'');
 click('replay-exit');assert.equal(e('response').hidden,false);
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
