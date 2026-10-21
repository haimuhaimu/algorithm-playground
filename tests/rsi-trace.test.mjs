import test from 'node:test';
import assert from 'node:assert/strict';
import {briefs,createWorkflow,improve} from '../rsi-core.mjs';
import {createStudio,studioAction} from '../rsi-session.mjs';
const act=(s,type,extra={})=>studioAction(s,{type,...extra});
const method=()=>act(act(createStudio(),'start'),'next');
const complete=s=>{for(let i=0;i<6;i++)s=act(s,'trace-next');return s;};

test('choice evidence records the real error tie and recomputes after the accepted repair',()=>{
 const r=improve(createWorkflow(),briefs('method'),'diagnose',2);
 assert.deepEqual(r.attempts[0].selection?.counts,{identity:2,outfit:2,pose:0});
 assert.deepEqual(r.attempts[0].selection.tied,['identity','outfit']);
 assert.deepEqual(r.attempts[0].selection.order,['lockIdentity','lockOutfit']);
 assert.deepEqual(r.attempts[1].selection.counts,{identity:0,outfit:2,pose:0});
 assert.equal(r.attempts[1].currentWorkflow.identity,'locked');
 assert.equal(r.attempts[0].currentWorkflow.identity,'mixed');
});
test('fixed-order rejected candidate remains inspectable and is not the next baseline',()=>{
 const r=improve(createWorkflow(),briefs('method'),'cycle',2);
 assert.deepEqual(r.attempts[0].selection?.order,['frontPose','lockOutfit','lockIdentity','readPose']);
 assert.equal(r.attempts[0].after.art[0].pose,'front');
 assert.equal(r.attempts[0].accepted,false);
 assert.equal(r.attempts[1].before.art[0].pose,'side');
 assert.equal(r.attempts[1].currentWorkflow.pose,'reference');
});
test('walkthrough starts at finding errors and cannot install unseen final results',()=>{
 let s=act(method(),'trial');
 assert.equal(s.traceStep,0);
 assert.equal(act(s,'adopt'),s);
 assert.deepEqual(s.art,s.candidate.before.art);
 s=act(s,'trace-next');assert.equal(s.traceStep,1);
 assert.deepEqual(s.art,s.candidate.attempts[0].after.art);
 s=act(s,'trace-next');assert.equal(s.traceStep,2);
 assert.equal(act(s,'adopt'),s);
 s=complete(s);assert.equal(s.traceStep,6);
 assert.equal(act(s,'adopt').stage,'transfer');
});
test('rejection restores the retained work before the next diagnosis and replay never installs',()=>{
 let s=act(act(method(),'method',{method:'cycle'}),'trial');
 s=act(s,'trace-next');assert.equal(s.art[0].pose,'front');
 s=act(s,'trace-next');assert.equal(s.art[0].pose,'front'); // rejected sample is still visible
 s=act(s,'trace-next');assert.equal(s.art[0].pose,'side');
 s=complete(s);s=act(s,'trace-replay');assert.equal(s.traceStep,0);
 assert.equal(s.workflow.pose,'reference');assert.equal(s.workflow.outfit,'mixed');
 assert.equal(act(s,'trace-back'),s);
});
test('alternative starts a fresh evidence cursor with the identical originals',()=>{
 let s=complete(act(method(),'trial')),original=s.before;
 s=act(s,'alternate');assert.equal(s.traceStep,0);assert.equal(s.method,'cycle');
 assert.deepEqual(s.before,original);assert.deepEqual(s.art,original);
 assert.equal(act(s,'adopt'),s);
 s=act(s,'alternate');assert.equal(s.traceStep,0);assert.equal(s.method,'diagnose');
});
test('new commission prediction is independent of the algorithm and transfer adoption is gated',()=>{
 let s=act(complete(act(method(),'trial')),'adopt');
 s=act(s,'predict',{issue:'identity'});assert.equal(s.prediction,'identity');
 s=act(s,'repair-next');assert.equal(s.candidate.attempts[0].patch,'readPose');
 assert.equal(s.traceStep,0);assert.equal(act(s,'finish',{decision:'adopt'}),s);
 s=complete(s);assert.equal(s.traceStep,3);
 assert.equal(act(s,'finish',{decision:'keep'}).finalRecord.passed,0);
 assert.equal(act(s,'finish',{decision:'adopt'}).finalRecord.passed,3);
 assert.deepEqual(act(s,'reset'),createStudio());
});
test('error inspection selects an affected artwork without editing it',()=>{
 let s=act(method(),'trial');const art=structuredClone(s.art);
 s=act(s,'inspect-issue',{issue:'outfit'});assert.equal(s.active,1);
 assert.deepEqual(s.art,art);assert.equal(act(s,'inspect-issue',{issue:'pose'}),s);
 assert.equal(act(s,'inspect-issue',{issue:'unknown'}),s);
});
