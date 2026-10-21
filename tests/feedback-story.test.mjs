import test from 'node:test';
import assert from 'node:assert/strict';
import {POSTS,INITIAL_PROFILE,PRESETS} from '../data.mjs';
const story=await import('../feedback-story.mjs').catch(()=>({}));
const capture=(...args)=>{assert.equal(typeof story.captureFeedback,'function','feedback evidence must be implemented');return story.captureFeedback(...args);};
const base=()=>capture(POSTS,PRESETS.click.weights,INITIAL_PROFILE,'0-0',-1);

test('a negative cat feedback preserves six cards and reports literal entering, leaving and movement',()=>{
 const r=base();
 assert.equal(r.before.profile.cat,1);assert.equal(r.after.profile.cat,.88);
 assert.deepEqual(r.before.feed.map(p=>p.id),['0-0','0-1','0-2','0-3','1-0','0-4']);
 assert.deepEqual(r.after.feed.map(p=>p.id),['0-0','0-1','0-2','1-0','0-3','1-1']);
 assert.deepEqual(r.changes.filter(c=>c.kind==='entered').map(c=>c.id),['1-1']);
 assert.deepEqual(r.changes.filter(c=>c.kind==='exited').map(c=>c.id),['0-4']);
 assert.deepEqual(r.changes.find(c=>c.id==='1-0'),{id:'1-0',beforeRank:5,afterRank:4,kind:'up'});
 assert.equal(r.action.beforeRank,1);assert.equal(r.action.afterRank,1);
 assert.equal(r.decision.slot,1);assert.equal(r.decision.selected.id,'0-0');
 assert.equal(r.decision.alternative.id,'0-1');
 assert.ok(Math.abs(r.decision.selected.score-.8468)<1e-10);
 assert.ok(Math.abs(r.decision.alternative.score-.8233)<1e-10);
});
test('evidence is deeply independent of caller changes and cannot be rewritten',()=>{
 const posts=structuredClone(POSTS),w={...PRESETS.click.weights},p={...INITIAL_PROFILE};
 const r=capture(posts,w,p,'0-0',-1),before=JSON.stringify(r);
 posts[0].title='changed';w.click=0;p.cat=0;
 assert.equal(JSON.stringify(r),before);assert.equal(r.weights.click,100);
 assert.throws(()=>{r.after.feed[0].parts.click=0;},TypeError);
 assert.equal(INITIAL_PROFILE.cat,1);
});
test('bounded feedback reports a no-op without inventing card changes',()=>{
 const r=capture(POSTS,PRESETS.click.weights,INITIAL_PROFILE,'0-0',1);
 assert.equal(r.effect,'limit');assert.equal(r.action.interestDelta,0);
 assert.ok(r.changes.every(c=>c.kind==='same'));
 const low=capture(POSTS,PRESETS.click.weights,{...INITIAL_PROFILE,cat:0},'0-0',-1);
 assert.equal(low.effect,'limit');
});
test('zero click weight distinguishes changed taste from unchanged ranking',()=>{
 const r=capture(POSTS,{click:0,diversity:100,newcomer:100},INITIAL_PROFILE,'0-4',-1);
 assert.equal(r.effect,'unweighted');assert.equal(r.after.profile.cat,.88);
 assert.ok(r.changes.every(c=>c.kind==='same'));
});
test('removing a card from six seats does not call it deleted and uses same-slot evidence',()=>{
 const r=capture(POSTS,PRESETS.click.weights,INITIAL_PROFILE,'0-4',-1);
 assert.equal(r.action.beforeRank,6);assert.equal(r.action.afterRank,null);
 assert.equal(r.decision.slot,6);assert.equal(r.decision.selected.id,'1-1');
 assert.equal(r.decision.alternative.id,'0-4');
 assert.ok(r.decision.selected.score>r.decision.alternative.score);
});
test('same-slot evidence includes topic repetition and fixed ID tie breaking',()=>{
 const posts=[{id:'b',topic:'cat',appeal:1},{id:'a',topic:'cat',appeal:1},{id:'c',topic:'food',appeal:1}];
 const r=capture(posts,{click:0,diversity:100,newcomer:0},{cat:.5,food:.5},'b',1);
 assert.deepEqual(r.after.feed.map(p=>p.id),['a','c','b']);
 assert.equal(r.decision.selected.score,.25);assert.equal(r.decision.slot,3);
 const tied=capture(posts,{click:0,diversity:0,newcomer:0},{cat:.5,food:.5},'a',1);
 assert.equal(tied.decision.tied,true);assert.equal(tied.decision.selected.id,'a');
 assert.equal(tied.decision.alternative.id,'b');
});
test('record match includes every taste and rule input but tolerates identical settings',()=>{
 const r=base();assert.equal(story.recordMatches(r,{...r.weights},{...r.after.profile}),true);
 assert.equal(story.recordMatches(r,{...r.weights,diversity:1},r.after.profile),false);
 assert.equal(story.recordMatches(r,r.weights,{...r.after.profile,food:.5}),false);
});
test('invalid actions fail before producing misleading evidence',()=>{
 assert.throws(()=>capture(POSTS,PRESETS.click.weights,INITIAL_PROFILE,'missing',-1),/action/i);
 assert.throws(()=>capture(POSTS,PRESETS.click.weights,INITIAL_PROFILE,'0-0',0),/action/i);
});
