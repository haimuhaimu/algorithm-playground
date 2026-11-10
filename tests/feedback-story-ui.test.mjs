import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {captureFeedback} from '../feedback-story.mjs';
import {POSTS,PRESETS,INITIAL_PROFILE} from '../data.mjs';
const ui=await import('../feedback-story-ui.mjs').catch(()=>({}));
class Element extends EventTarget{
 constructor(){super();this.hidden=false;this.textContent='';this.innerHTML='';this.attributes={};}
 setAttribute(key,value){this.attributes[key]=value;}
 click(){this.dispatchEvent(new Event('click'));}
}
async function setup(){
 assert.equal(typeof ui.mountFeedbackStory,'function','feedback renderer must be implemented');
 const html=await readFile(new URL('../recommendation.html',import.meta.url),'utf8');
 const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const story=ui.mountFeedbackStory({document:{getElementById:id=>{assert.ok(elements[id],`missing real HTML target ${id}`);return elements[id];}}});
 return {story,elements};
}
const evidence=()=>captureFeedback(POSTS,PRESETS.click.weights,INITIAL_PROFILE,'0-0',-1);
test('first feedback renders both six-card snapshots and keeps the action-specific explanation',async()=>{
 const {story,elements:e}=await setup();assert.equal(story.shouldRecord(),true);
 story.record(evidence());assert.equal(story.shouldRecord(),false);
 assert.equal(e['feedback-story-content'].hidden,false);
 assert.equal((e['feedback-before'].innerHTML.match(/<li /g)||[]).length,6);
 assert.equal((e['feedback-after'].innerHTML.match(/<li /g)||[]).length,6);
 assert.match(e['feedback-action'].textContent,/少一点/);
 assert.match(e['feedback-interest'].textContent,/100 → 88/);
 assert.match(e['feedback-reason'].textContent,/仍在第 1/);
 assert.match(e['feedback-reason'].textContent,/第 4.*席位|第 4.*席/);
 assert.match(e['feedback-reason'].textContent,/0\.7983/);
 assert.match(e['feedback-reason'].textContent,/0\.7763/);
 assert.match(e['feedback-after'].innerHTML,/新进入/);
});
test('an illustrated food post keeps its title, image and creator on both sides of feedback',async()=>{
 const {story,elements:e}=await setup();
 story.record(captureFeedback(POSTS,PRESETS.balanced.weights,INITIAL_PROFILE,'1-0',1));
 assert.match(e['feedback-action'].textContent,/嘿姆盯上了那碗面/);
 for(const side of ['before','after']){
  const card=e['feedback-'+side].innerHTML.match(/<li[^>]*data-post="1-0"[\s\S]*?<\/li>/)?.[0];
  assert.ok(card);
  assert.match(card,/嘿姆盯上了那碗面/);
  assert.match(card,/src="\.\/studio-heim-idle\.png"/);
  assert.match(card,/三餐研究所/);
 }
});
test('later taste or rule changes mark a pinned snapshot as history without rewriting it',async()=>{
 const {story,elements:e}=await setup(),r=evidence();story.record(r);
 const old=e['feedback-after'].innerHTML,oldScores=e['feedback-score-comparison'].innerHTML;
 story.sync({...r.weights,diversity:85},r.after.profile);
 assert.match(e['feedback-record-state'].textContent,/已继续变化/);
 assert.equal(e['feedback-after'].innerHTML,old);
 assert.equal(e['feedback-score-comparison'].innerHTML,oldScores);
 story.record(captureFeedback(POSTS,r.weights,r.after.profile,'1-0',1));
 assert.equal(e['feedback-after'].innerHTML,old,'unarmed later feedback must not replace evidence');
 story.sync(r.weights,r.after.profile);assert.match(e['feedback-record-state'].textContent,/一致/);
});
test('arming preserves old evidence until the next feedback and resets independent judgment',async()=>{
 const {story,elements:e}=await setup(),r=evidence();story.record(r);
 e['feedback-answer-card'].click();assert.match(e['feedback-judgment'].textContent,/不是屏蔽/);
 e['feedback-answer-topic'].click();assert.match(e['feedback-judgment'].textContent,/答对/);
 const old=e['feedback-before'].innerHTML;e['feedback-arm'].click();
 assert.equal(story.shouldRecord(),true);assert.equal(e['feedback-before'].innerHTML,old);
 story.record(captureFeedback(POSTS,r.weights,r.after.profile,'1-0',1));
 assert.equal(story.shouldRecord(),false);assert.equal(e['feedback-judgment'].textContent,'');
 assert.notEqual(e['feedback-before'].innerHTML,old);
});
test('no-op and zero weight feedback are explained without claiming a ranking change',async()=>{
 const {story,elements:e}=await setup();
 story.record(captureFeedback(POSTS,PRESETS.click.weights,INITIAL_PROFILE,'0-0',1));
 assert.match(e['feedback-cause'].textContent,/上限/);assert.match(e['feedback-summary'].textContent,/名次都没变/);
 story.reset();story.record(captureFeedback(POSTS,{click:0,diversity:100,newcomer:100},INITIAL_PROFILE,'0-0',-1));
 assert.match(e['feedback-cause'].textContent,/点击优先为 0/);assert.match(e['feedback-summary'].textContent,/名次都没变/);
 story.reset();assert.equal(story.shouldRecord(),true);assert.equal(e['feedback-story-content'].hidden,true);
 assert.equal(e['feedback-story-empty'].hidden,false);
});
test('close candidate scores stay visibly distinguishable when the explanation says higher',async()=>{
 const {story,elements:e}=await setup();
 story.record(captureFeedback(POSTS,{click:82,diversity:0,newcomer:4},INITIAL_PROFILE,'0-4',-1));
 const values=[...e['feedback-reason'].textContent.matchAll(/得 ([0-9.]+) 分/g)].map(m=>Number(m[1]));
 assert.equal(values.length,2);assert.ok(values[0]>values[1],`displayed scores must differ: ${values}`);
});
test('the changed-seat explanation preserves the two real card identities and literal before/after scores',async()=>{
 const {story,elements:e}=await setup();story.record(evidence());
 assert.match(e['feedback-decision-title'].textContent,/第 4.*席/);
 const table=e['feedback-score-comparison'].innerHTML;
 const food=table.match(/<tr[^>]*data-post="1-0"[\s\S]*?<\/tr>/)?.[0];
 const cat=table.match(/<tr[^>]*data-post="0-3"[\s\S]*?<\/tr>/)?.[0];
 assert.ok(food&&cat,'both actual competitors at the changed seat are visible');
 assert.match(food,/嘿姆盯上了那碗面/);assert.match(food,/studio-heim-idle\.png/);
 assert.equal((food.match(/0\.7983/g)||[]).length,2);
 assert.match(cat,/今天也被猫拒绝了/);assert.match(cat,/0\.8195/);assert.match(cat,/0\.7763/);
 assert.match(table,/这一席/);
 assert.match(e['feedback-before'].innerHTML,/<li[^>]*is-focus[^>]*data-post="0-3"/);
 assert.match(e['feedback-after'].innerHTML,/<li[^>]*is-focus[^>]*data-post="1-0"/);
});
