import test from 'node:test';
import assert from 'node:assert/strict';
import {listLearningTools,describeLearningTool,runLearningTool,replayLearningReceipt} from '../learning-tool.mjs';
import {readGenaiHandoffContext,createGenaiReturnUrl} from '../genai-handoff.mjs';

const actions=[{action:'guess',value:'same'},{action:'reveal'},{action:'change-guess',value:'same'},{action:'update'},{action:'answer',value:'never'},{action:'answer',value:'evidence'}];
const run=(items=actions,producer='agent')=>runLearningTool({experimentId:'bayes-update',actions:items},{producer});
test('Bayes tool is discoverable and a fresh run does not reveal predictions or transfer answers',()=>{
 assert.ok(listLearningTools().runnables.some(item=>item.id==='bayes-update'));
 const description=describeLearningTool('bayes-update');assert.equal(description.engineVersion,'bayes-update-v1');assert.equal(description.mastery,'not-assessed');
 const receipt=run([]);assert.equal(receipt.result.workflowComplete,false);assert.equal(receipt.result.stage,'predict');
 assert.ok(receipt.result.evidence.baseline.every(row=>row.belief===null));assert.equal(receipt.result.evidence.after,null);assert.equal(receipt.result.evidence.transfer,null);
 assert.deepEqual(receipt.result.availableActions,[{action:'reset'},{action:'guess',values:['little','many','same']}]);
});
test('a real Bayes run preserves wrong guesses and derives before/after beliefs from fixed counts',()=>{
 const r=run(),e=r.result.evidence;assert.equal(r.engineVersion,'bayes-update-v1');assert.equal(r.result.workflowComplete,true);assert.equal(r.result.stage,'done');assert.equal(r.result.mastery,'not-assessed');
 assert.equal(e.guess,'same');assert.equal(e.changeGuess,'same');assert.deepEqual(e.attempts,['never','evidence']);assert.deepEqual(e.ending,{firstAttemptCorrect:false,attemptsCount:2});
 assert.deepEqual(e.baseline.map(row=>[row.successes,row.failures,row.belief.alpha,row.belief.beta,row.belief.mean]),[[3,2,4,3,.571428571429],[18,12,19,13,.59375]]);
 assert.deepEqual(e.after.map(row=>[row.successes,row.failures,row.belief.alpha,row.belief.beta,row.belief.mean]),[[3,3,4,4,.5],[18,13,19,14,.575757575758]]);
 assert.deepEqual(e.transfer.map(row=>row.belief.mean),[.333333333333,.0833333333333]);assert.ok(e.baseline[1].belief.interval[1]-e.baseline[1].belief.interval[0]<e.baseline[0].belief.interval[1]-e.baseline[0].belief.interval[0]);
 assert.equal(Object.hasOwn(e.baseline[0].belief,'curve'),false);assert.ok(JSON.stringify(r).length<10000);
 assert.deepEqual(replayLearningReceipt(r),{matches:true,authenticatesUser:false,receipt:r});
});
test('out-of-phase actions are rejected and reset remains in the real action journal',()=>{
 const r=run([{action:'reveal'},{action:'update'},{action:'answer',value:'evidence'},{action:'guess',value:'many'},{action:'reset'},...actions]);
 assert.deepEqual(r.steps.slice(0,3).map(item=>item.status),['rejected','rejected','rejected']);assert.equal(r.actions[4].action,'reset');assert.equal(r.steps[4].status,'applied');assert.equal(r.result.evidence.guess,'same');
 assert.equal(run([{action:'reset'}]).steps[0].status,'no-op');
});
test('Bayes replay rejects edited results, history, producer and unrelated payload fields',()=>{
 for(const edit of [r=>r.result.evidence.after[0].belief.mean=.9,r=>r.result.evidence.attempts.shift(),r=>r.actions[0].value='many',r=>r.producer='person',r=>r.privateDraft='secret',r=>r.fixture.prior.alpha=9]){
  const r=structuredClone(run());edit(r);assert.throws(()=>replayLearningReceipt(r));
 }
 for(const bad of [[{action:'update',value:1}],[{action:'guess',value:'bad'}],[{action:'guess',value:'same',note:'private'}],Array.from({length:257},()=>({action:'reset'}))])assert.throws(()=>run(bad));
 assert.throws(()=>runLearningTool({experimentId:'bayes-update',actions:[],storage:'secret'}));
});
test('Bayes action names cannot be coerced from arrays or boxed strings',()=>{
 for(const action of [['guess'],new String('guess'),['reset']])assert.throws(()=>run([{action,value:'same'}]));
});
test('Bayes handoff requires its own journey and a complete replayable record',()=>{
 const request='bayes_request_12345678',base='https://haimuhaimu.github.io/genai-learning-os/';
 const source='https://haimuhaimu.github.io/algorithm-playground/mining.html?'+new URLSearchParams({genaiReturn:base,genaiRequest:request,genaiJourney:'bayes-learning'});
 const context=readGenaiHandoffContext(source);assert.ok(context);assert.equal(context.returnURL,base+'?page=routes&section=bayes-journey');
 const url=createGenaiReturnUrl(context,run(actions,'browser-session'));assert.ok(url.startsWith(base+'?page=routes&section=bayes-journey#playground='));
 const payload=JSON.parse(Buffer.from(url.split('#playground=')[1],'base64url').toString());assert.equal(payload.journeyId,'bayes-learning');assert.equal(payload.receipt.experimentId,'bayes-update');
 assert.throws(()=>createGenaiReturnUrl(context,run([])));assert.throws(()=>createGenaiReturnUrl({...context,journeyId:'model-learning'},run()));
});
