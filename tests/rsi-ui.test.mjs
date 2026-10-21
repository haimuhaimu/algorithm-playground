import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initStudio,poster} from '../rsi.mjs';
const htmlIds=new Set([...readFileSync(new URL('../rsi.html',import.meta.url),'utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
function boot(width=1280,height=720){
 const doc=new EventTarget(),nodes=new Map();
 class Element extends EventTarget{
  constructor(id){super();this.id=id;this.hidden=false;this.disabled=false;this.dataset={};this.attrs={};this.innerHTML='';this.textContent='';this.scrolls=[];}
  setAttribute(k,v){this.attrs[k]=String(v);}removeAttribute(k){delete this.attrs[k];}
  focus(){doc.activeElement=this;}scrollIntoView(o){this.scrolls.push(o);}
 }
 doc.getElementById=id=>{if(!htmlIds.has(id))return null;if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
 doc.documentElement={dataset:{}};doc.querySelectorAll=()=>[];
 const ui=initStudio(doc,{innerWidth:width,innerHeight:height});
 return {ui,doc,nodes,click(id){const n=doc.getElementById(id);assert.ok(n,'missing real HTML control '+id);assert.equal(n.hidden,false,id);assert.equal(n.disabled,false,id);n.dispatchEvent(new Event('click'));}};
}
const reachDecision=b=>{b.click('story-next');b.click('story-next');b.click('story-next');};
test('poster still reflects actual species, clothing and pose',()=>{
 const a=poster({species:'rabbit',coat:'green',pose:'side',scene:'garden'});
 const b=poster({species:'fox',coat:'coral',pose:'jump',scene:'garden'});
 assert.notEqual(a,b);assert.match(a,/兔子/);assert.match(b,/狐狸/);assert.match(b,/跃起/);
 assert.doesNotMatch(a,/<script|<image|https?:/);
});
test('first view starts with one wrong poster and one action, no duplicate comparison',()=>{
 const b=boot();assert.equal(b.ui.state.stage,'mistake');
 assert.equal(b.nodes.get('before-figure').hidden,true);assert.equal(b.nodes.get('story-next').hidden,false);
 assert.equal(b.nodes.get('choice-controls').hidden,true);assert.equal(b.nodes.get('challenge-controls').hidden,true);
 assert.match(b.nodes.get('after-art').innerHTML,/兔子/);
});
test('the same poster visibly goes rabbit to fox to rabbit without changing its brief',()=>{
 const b=boot();b.click('story-next');assert.equal(b.ui.state.stage,'repaired');
 assert.match(b.nodes.get('before-art').innerHTML,/兔子/);assert.match(b.nodes.get('after-art').innerHTML,/狐狸/);
 b.click('story-next');assert.match(b.nodes.get('before-art').innerHTML,/狐狸/);assert.match(b.nodes.get('after-art').innerHTML,/兔子/);
 assert.equal(b.ui.state.job.scene,'garden');
});
test('visible keep and withdraw controls, not Next, determine the next drawing',()=>{
 for(const decision of ['keep','withdraw']){
  const b=boot();reachDecision(b);assert.equal(b.nodes.get('choice-controls').hidden,false);
  assert.equal(b.nodes.get('story-next').hidden,true);assert.equal(b.ui.state.decision,null);
  b.click(decision+'-rule');assert.equal(b.ui.state.stage,'proof');
  assert.equal(b.ui.state.decision,decision);
  assert.match(b.nodes.get('after-art').innerHTML,decision==='keep'?/狐狸/:/兔子/);
  assert.match(b.nodes.get('evidence-copy').textContent,decision==='keep'?/已保留/:/未保留/);
  assert.equal(b.nodes.get('choice-controls').hidden,true);
 }
});
test('challenge requires a prediction, keeps it neutral, and its run uses the chosen method',()=>{
 const b=boot();reachDecision(b);b.click('keep-rule');b.click('story-next');
 assert.equal(b.ui.state.stage,'challenge');assert.equal(b.nodes.get('run-assistant').disabled,true);
 assert.equal(b.nodes.get('art-status').hidden,true,'must not reveal which detail is wrong before guessing');
 b.click('guess-identity');assert.equal(b.ui.state.prediction,'identity');
 assert.equal(b.nodes.get('guess-identity').attrs['aria-pressed'],'true');
 assert.equal(b.nodes.get('run-assistant').disabled,false);
 b.click('run-assistant');assert.equal(b.ui.state.stage,'ending');
 assert.equal(b.ui.state.transfer.attempts[0].patch,'lockOutfit');assert.equal(b.ui.state.art.coat,'green');
 assert.match(b.nodes.get('outcome-copy').textContent,/衣服/);
});
test('withdraw route honestly ends without fixing the new problem and allows changing the real earlier choice',()=>{
 const b=boot();reachDecision(b);b.click('withdraw-rule');b.click('story-next');b.click('guess-outfit');b.click('run-assistant');
 assert.equal(b.ui.state.transfer.after.passed,0);assert.equal(b.ui.state.art.coat,'coral');
 assert.match(b.nodes.get('outcome-copy').textContent,/没有|仍|没/);
 b.click('revisit');assert.equal(b.ui.state.stage,'decision');assert.equal(b.ui.state.transfer,null);
 b.click('keep-rule');assert.equal(b.ui.state.art.species,'fox');
});
test('theme changes preserve the story and reset clears choice, predictions and evidence',()=>{
 const b=boot();reachDecision(b);b.click('keep-rule');b.click('theme');
 assert.equal(b.ui.state.stage,'proof');assert.equal(b.doc.documentElement.dataset.theme,'dark');
 b.click('reset');assert.equal(b.ui.state.stage,'mistake');assert.equal(b.ui.state.decision,null);
 assert.equal(b.nodes.get('before-figure').hidden,true);assert.equal(b.nodes.get('choice-controls').hidden,true);
 assert.equal(b.nodes.get('ending-controls').hidden,true);
});
test('mobile stage transitions focus one instruction while a prediction keeps focus on its control',()=>{
 const b=boot(390);reachDecision(b);
 assert.equal(b.doc.activeElement.id,'guide-title');assert.equal(b.nodes.get('guide-title').scrolls.at(-1).block,'start');
 b.click('keep-rule');b.click('story-next');b.nodes.get('guess-pose').focus();b.click('guess-pose');
 assert.equal(b.doc.activeElement.id,'guess-pose');
});
test('short landscape screens bring the new instruction back into view after each action',()=>{
 const b=boot(844,390);reachDecision(b);b.click('keep-rule');b.click('story-next');b.click('guess-outfit');b.click('run-assistant');
 assert.equal(b.doc.activeElement.id,'guide-title');
 assert.equal(b.nodes.get('guide-title').scrolls.at(-1)?.block,'start');
});
