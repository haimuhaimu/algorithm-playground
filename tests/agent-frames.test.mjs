import test from 'node:test';
import assert from 'node:assert/strict';
import {describeLearningTool,listLearningTools,replayLearningReceipt,runLearningTool} from '../learning-tool.mjs';
import {createGenaiReturnUrl,readGenaiHandoffContext} from '../genai-handoff.mjs';
import {AGENT_FRAME_CLIP} from '../agent-frames-tool.mjs';

const id='agent-frames';
const next=n=>Array(n).fill('advance');
const start=[...next(8),'start-manual'];
const actions=names=>names.map(action=>({action}));
const run=(...names)=>runLearningTool({experimentId:id,actions:actions(names)},{producer:'browser-session'});
const choose=frame=>run(...start,...next(frame),'pin',...next(8-frame));

test('third Agent experiment is discoverable and leaves both earlier levels available',()=>{
 const tool=describeLearningTool(id);
 assert.equal(tool.engineVersion,'agent-frames-v1');
 assert.match(tool.url,/agent-frames\.html#mission$/);
 for(const expected of ['agent-tool-loop','agent-reroute',id])assert.ok(listLearningTools().runnables.some(x=>x.id===expected));
});

test('the fixed interval retains exactly three frames and misses the transient sign',()=>{
 const {result}=run(...next(8));
 assert.equal(result.stage,'baseline-done');
 assert.deepEqual(result.evidence.fixed,{frameIds:[0,4,8],signFrame:null,conclusion:'insufficient-evidence'});
 assert.equal(result.evidence.manual,null);
 assert.equal(result.workflowComplete,false);
});

test('only the arrived clear frame carries an answer; subtitles carry a cue, not permission',()=>{
 assert.deepEqual(AGENT_FRAME_CLIP.map(f=>f.timeMs),[0,1000,2000,3000,4000,5000,6000,7000,8000]);
 assert.deepEqual(AGENT_FRAME_CLIP.filter(f=>f.sign==='unload').map(f=>f.id),[5]);
 assert.match(AGENT_FRAME_CLIP[4].caption,/看门边的牌子/);
 assert.equal(AGENT_FRAME_CLIP[4].caption,AGENT_FRAME_CLIP[5].caption);
 assert.notEqual(AGENT_FRAME_CLIP[5].caption,AGENT_FRAME_CLIP[8].caption);
});

test('manual round restarts the same clip and can replace only the middle frame',()=>{
 const rewound=run(...start);
 assert.equal(rewound.result.evidence.frame,0);
 assert.deepEqual(rewound.result.availableActions,actions(['advance']));
 const {result,steps}=choose(5);
 assert.deepEqual(result.evidence.fixed.frameIds,[0,4,8]);
 assert.deepEqual(result.evidence.manual,{frameIds:[0,5,8],signFrame:5,conclusion:'clear-to-unload'});
 assert.equal(result.evidence.manualPick,5);
 assert.deepEqual(steps.find(x=>x.action==='pin'),{action:'pin',phase:'manual',frame:5});
 assert.equal(result.mastery,'not-assessed');
});

test('picking a non-evidence frame is a real completed comparison, not a scripted success',()=>{
 for(const frame of [1,2,3,4,6,7]){
  const receipt=choose(frame);
  assert.equal(receipt.result.workflowComplete,true);
  assert.deepEqual(receipt.result.evidence.manual,{frameIds:[0,frame,8],signFrame:null,conclusion:'insufficient-evidence'});
  assert.equal(replayLearningReceipt(receipt).matches,true);
 }
});

test('pin is an action on the arrived frame only; no late, extra or duplicate pin',()=>{
 assert.throws(()=>run('pin'),/unavailable/i);
 assert.throws(()=>run(...start,'pin'),/unavailable/i);
 assert.throws(()=>run(...start,'advance','pin','advance','pin'),/unavailable/i);
 assert.throws(()=>run(...start,...next(8),'pin'),/unavailable/i);
 assert.throws(()=>runLearningTool({experimentId:id,actions:[{action:'pin',frame:5}]}),/invalid/i);
 assert.throws(()=>run(...next(19)),/invalid/i);
 const skipped=run(...start,...next(8));
 assert.equal(skipped.result.stage,'manual-empty');
 assert.equal(skipped.result.workflowComplete,false);
 assert.equal(skipped.result.evidence.manual,null);
});

test('replay rederives both frame selections and conclusion, rejecting forged evidence',()=>{
 const receipt=choose(5);
 assert.deepEqual(replayLearningReceipt(JSON.parse(JSON.stringify(receipt))),{matches:true,authenticatesUser:false,receipt});
 for(const change of [
  r=>{r.result.evidence.manual.frameIds[1]=6;},
  r=>{r.result.evidence.fixed.signFrame=5;},
  r=>{r.result.evidence.manual.conclusion='insufficient-evidence';},
  r=>{r.steps[14].frame=4;},
  r=>{r.fixture.fixedFrames[1]=5;},
  r=>{r.result.evidence.other=true;},
 ]){const modified=structuredClone(receipt);change(modified);assert.throws(()=>replayLearningReceipt(modified),/mismatch/i);}
});

test('third-level return carries both actual rounds only after a complete comparison',()=>{
 const link=new URL('http://127.0.0.1:3157/agent-frames.html');
 link.search=new URLSearchParams({genaiJourney:id,genaiRequest:'frame-session-123456789',genaiReturn:'http://localhost:3156/?page=wrong#other'}).toString();
 const context=readGenaiHandoffContext(link.href);
 assert.deepEqual(context,{journeyId:id,requestId:'frame-session-123456789',returnURL:'http://localhost:3156/?page=routes&section=agent-frames-journey'});
 assert.throws(()=>createGenaiReturnUrl(context,run(...start),link));
 const receipt=choose(3);
 const result=new URL(createGenaiReturnUrl(context,receipt,link));
 assert.equal(result.search,'?page=routes&section=agent-frames-journey');
 const payload=JSON.parse(Buffer.from(result.hash.slice(12),'base64url').toString('utf8'));
 assert.deepEqual(payload.receipt,receipt);
 assert.equal(payload.journeyId,id);
 assert.throws(()=>createGenaiReturnUrl(context,{...receipt,experimentId:'agent-reroute'},link));
});
