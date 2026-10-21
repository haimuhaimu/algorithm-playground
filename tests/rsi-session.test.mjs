import test from 'node:test';
import assert from 'node:assert/strict';
import * as session from '../rsi-session.mjs';
const act=(s,type,extra={})=>session.studioAction(s,{type,...extra});
const first=()=>act(session.createStudio(),'start');
const method=()=>act(first(),'next');
const watched=s=>{for(let i=0;i<6;i++)s=act(s,'trace-next');return s;};
function transfer(strategy='diagnose'){
 let s=method();s=act(s,'method',{method:strategy});s=act(s,'trial');return act(watched(s),'adopt');
}
test('repairs and curation use finite budget and preserve original for comparison',()=>{
 let s=first();s=act(s,'select',{index:1});s=act(s,'retouch',{issue:'identity'});
 assert.equal(s.credits,2);assert.equal(s.art[1].species,'fox');assert.equal(s.before[1].species,'rabbit');
 s=act(s,'curate');assert.equal(s.selected[1],true);
 s=act(s,'redraw');assert.equal(s.selected[1],false);assert.equal(s.art[1].coat,'coral');assert.equal(s.credits,1);
 s=act(s,'retouch',{issue:'outfit'});assert.equal(s.credits,0);assert.equal(act(s,'redraw'),s);
});
test('bad picks remain real picks and are not called qualified',()=>{
 let s=first();s=act(s,'select',{index:1});s=act(s,'curate');s=act(s,'next');
 assert.equal(s.firstRecord.picked,1);assert.equal(s.firstRecord.qualified,0);assert.equal(s.firstRecord.passed,1);
 assert.equal(s.stage,'method');assert.equal(s.methodReports.diagnose,undefined);
});
test('local fixes do not transfer into next batch and history stays immutable',()=>{
 let s=first();s=act(s,'select',{index:1});s=act(s,'retouch',{issue:'identity'});
 s=act(s,'select',{index:2});s=act(s,'retouch',{issue:'outfit'});
 const next=act(s,'next');assert.equal(next.firstRecord.passed,3);assert.equal(next.art[0].species,'rabbit');
 assert.equal(next.workflow.identity,'mixed');assert.equal(s.art[1].species,'fox');
});
test('trials do not install early and alternatives use identical baseline',()=>{
 let s=act(method(),'trial');assert.equal(s.workflow.identity,'mixed');assert.equal(s.candidate.after.passed,3);
 assert.equal(s.stage,'trial');s=act(s,'alternate');assert.equal(s.candidate.after.passed,1);
 assert.equal(s.methodReports.diagnose.before.passed,0);assert.equal(s.methodReports.cycle.before.passed,0);
 s=act(watched(s),'adopt');assert.equal(s.workflow.improver,'cycle');assert.equal(s.stage,'transfer');
 assert.equal(s.transferRecord,null);
});
test('method choices survive installation and change held-out outcomes',()=>{
 const good=act(transfer(),'repair-next'),old=act(transfer('cycle'),'repair-next');
 assert.equal(good.transferRecord.after.passed,3);assert.equal(old.transferRecord.after.passed,0);
 assert.equal(good.stage,'judgment');assert.equal(good.workflow.pose,'reference');assert.equal(good.candidate.workflow.pose,'brief');
});
test('independent adoption installs only the chosen version and leads to finite ending',()=>{
 const s=watched(act(transfer(),'repair-next'));
 const keep=act(s,'finish',{decision:'keep'}),adopt=act(s,'finish',{decision:'adopt'});
 assert.equal(keep.workflow.pose,'reference');assert.equal(keep.finalRecord.passed,0);
 assert.equal(adopt.workflow.pose,'brief');assert.equal(adopt.finalRecord.passed,3);
 assert.equal(adopt.stage,'ending');assert.equal(adopt.answer,null);
 assert.equal(act(adopt,'answer',{answer:'method'}).answer,'method');
 assert.equal(act(adopt,'retouch',{issue:'identity'}),adopt);
});
test('invalid and repeated actions cannot spend credits or skip evidence',()=>{
 const s=first();assert.equal(act(s,'select',{index:99}),s);assert.equal(act(s,'retouch',{issue:'bad'}),s);
 assert.equal(act(s,'adopt'),s);assert.equal(act(s,'finish',{decision:'adopt'}),s);
 const m=method();assert.equal(act(m,'adopt'),m);assert.equal(act(m,'method',{method:'oracle'}),m);
 const run=act(m,'trial');assert.equal(act(run,'trial'),run);
});
test('restart clears whole session',()=>{
 const s=act(act(transfer(),'repair-next'),'finish',{decision:'adopt'});
 assert.deepEqual(act(s,'reset'),session.createStudio());
});
test('spending a repair on an already-correct detail reports no visible change honestly',()=>{
 const s=first(),next=act(s,'retouch',{issue:'identity'});
 assert.deepEqual(next.art,s.art);assert.equal(next.credits,2);assert.match(next.notice,/原本.*符合.*没有变化/);
});
