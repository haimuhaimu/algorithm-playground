import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {POSTS,PRESETS,INITIAL_PROFILE} from '../../../dist/data.mjs';
import {captureFeedback} from '../../../dist/feedback-story.mjs';
import {mountFeedbackPrediction} from '../../../dist/feedback-prediction-ui.mjs';

class Element extends EventTarget {
 constructor(){super();this.hidden=false;this.disabled=false;this.textContent='';this.innerHTML='';this.attributes={};}
 setAttribute(name,value){this.attributes[name]=value;}
 focus(){this.focused=true;}
 scrollIntoView(){this.scrolled=true;}
 click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
}
async function setup({weights=PRESETS.click.weights,profile=INITIAL_PROFILE}={}){
 const html=await readFile(new URL('../../../dist/recommendation.html',import.meta.url),'utf8');
 const els=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const state={posts:POSTS,weights:{...weights},profile:{...profile}},applied=[],returned=[];
 const ui=mountFeedbackPrediction({document:{getElementById:id=>{assert.ok(els[id],`missing real markup ${id}`);return els[id];}},
  getInputs:()=>state,applyFeedback:evidence=>{applied.push(evidence);state.profile={...evidence.after.profile};ui.sync();},
  returnToCard:action=>returned.push(action),reducedMotion:()=>true});
 return {ui,state,applied,returned,els,click:id=>els[id].click()};
}
test('direct feedback remains the default; preparing and guessing do not send or reveal feedback',async()=>{
 const s=await setup(),before=structuredClone(s.state);
 assert.equal(s.ui.request('0-0',-1),false);
 assert.equal(s.els['feedback-prediction-panel'].hidden,true);
 s.click('feedback-prediction-mode');assert.equal(s.ui.request('0-0',-1),true);
 assert.match(s.els['feedback-prediction-card'].innerHTML,/波比/);
 assert.equal(s.els['feedback-prediction-result'].hidden,true);
 assert.equal(s.els['feedback-prediction-apply'].disabled,true);
 s.click('feedback-prediction-stays');
 assert.equal(s.els['feedback-prediction-apply'].disabled,false);
 assert.equal(s.els['feedback-prediction-result'].hidden,true);
 assert.deepEqual(s.state,before);assert.equal(s.applied.length,0);
 assert.match(s.els['feedback-prediction-status'].textContent,/还没发送/);
});
test('one explicit check applies the real feedback exactly once and reports a truthful staying card',async()=>{
 const s=await setup(),expected=captureFeedback(POSTS,s.state.weights,s.state.profile,'0-0',-1);
 s.click('feedback-prediction-mode');s.ui.request('0-0',-1);s.click('feedback-prediction-stays');s.click('feedback-prediction-apply');
 s.click('feedback-prediction-apply');
 assert.equal(s.applied.length,1);assert.deepEqual(s.applied[0],expected);assert.deepEqual(s.state.profile,expected.after.profile);
 assert.equal(s.els['feedback-prediction-result'].hidden,false);
 assert.match(s.els['feedback-prediction-verdict'].textContent,/你猜.*仍在.*实际.*第 1 位/);
 assert.match(s.els['feedback-prediction-position'].textContent,/第 1 位 → 第 1 位/);
 assert.match(s.els['feedback-prediction-interest'].textContent,/100 → 88/);
 assert.match(s.els['feedback-prediction-reason'].textContent,/不是屏蔽/);
 assert.match(s.els['feedback-prediction-reason'].textContent,/规则没变/);
});
test('a card leaving six seats is not described as blocked, and a wrong prediction is preserved',async()=>{
 const s=await setup();s.click('feedback-prediction-mode');s.ui.request('1-0',-1);
 s.click('feedback-prediction-stays');s.click('feedback-prediction-apply');
 assert.equal(s.applied[0].action.afterRank,null);
 assert.match(s.els['feedback-prediction-verdict'].textContent,/你猜.*仍在.*实际.*离开/);
 assert.match(s.els['feedback-prediction-position'].textContent,/→ 六席外/);
 assert.match(s.els['feedback-prediction-card'].innerHTML,/反馈前第 5 位/);
 assert.match(s.els['feedback-prediction-reason'].textContent,/候选.*没.*屏蔽/);
});
test('cancel, mode-off and reset never send a pending feedback; repeated selection replaces without applying',async()=>{
 const s=await setup(),before=structuredClone(s.state);
 s.click('feedback-prediction-mode');s.ui.request('0-0',-1);s.click('feedback-prediction-stays');
 s.ui.request('1-0',1);assert.equal(s.els['feedback-prediction-apply'].disabled,true);
 s.click('feedback-prediction-cancel');assert.equal(s.returned.at(-1).postId,'1-0');
 assert.match(s.els['feedback-prediction-status'].textContent,/取消.*没.*发送/);
 s.ui.request('0-0',-1);s.click('feedback-prediction-mode');
 assert.equal(s.ui.request('0-0',-1),false);
 s.click('feedback-prediction-mode');s.ui.request('0-0',-1);s.ui.reset();s.click('feedback-prediction-apply');
 assert.equal(s.applied.length,0);assert.deepEqual(s.state,before);
 assert.equal(s.ui.request('0-0',-1),false);
});
test('effective setting changes cancel a pending guess while identical values do not; late clicks cannot apply it',async()=>{
 const s=await setup();s.click('feedback-prediction-mode');s.ui.request('0-0',-1);s.click('feedback-prediction-stays');
 s.state.weights={...s.state.weights};s.ui.sync();assert.equal(s.els['feedback-prediction-apply'].disabled,false);
 s.state.weights.click=99;s.ui.sync();s.click('feedback-prediction-apply');assert.equal(s.applied.length,0);
 assert.match(s.els['feedback-prediction-status'].textContent,/规则或口味.*取消.*未发送/);
 s.ui.request('0-0',-1);s.click('feedback-prediction-stays');s.state.profile.cat=.5;
 // Guard the final check too, even if no render/sync happened between interactions.
 s.click('feedback-prediction-apply');assert.equal(s.applied.length,0);
});
test('boundary feedback and zero click weight show unchanged results rather than forcing a rank movement',async()=>{
 for(const options of [{profile:{...INITIAL_PROFILE,cat:0}},{weights:{click:0,diversity:80,newcomer:20}}]){
  const s=await setup(options);s.click('feedback-prediction-mode');s.ui.request('0-0',-1);
  s.click('feedback-prediction-leaves');s.click('feedback-prediction-apply');
  const e=s.applied[0];assert.equal(e.action.beforeRank,e.action.afterRank);
  assert.match(s.els['feedback-prediction-reason'].textContent,options.profile?/下限.*没有变化/:/点击优先.*0.*不参与排序/);
 }
});
test('completed prediction stays frozen and is clearly history after later changes',async()=>{
 const s=await setup();s.click('feedback-prediction-mode');s.ui.request('0-0',-1);s.click('feedback-prediction-stays');s.click('feedback-prediction-apply');
 const verdict=s.els['feedback-prediction-verdict'].textContent,interest=s.els['feedback-prediction-interest'].textContent;
 s.state.weights.click=50;s.ui.sync();
 assert.equal(s.els['feedback-prediction-verdict'].textContent,verdict);assert.equal(s.els['feedback-prediction-interest'].textContent,interest);
 assert.match(s.els['feedback-prediction-result-state'].textContent,/上次.*当前/);
});
