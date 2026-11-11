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
const reachTrial=b=>{b.click('story-next');b.click('story-next');b.click('story-next');};
const reachChallenge=b=>{reachTrial(b);b.click('story-next');};
const reachDecision=b=>{reachChallenge(b);b.click('predict-green');b.click('run-trial');};
test('poster reflects actual species clothing and pose without external assets',()=>{
 const a=poster({species:'rabbit',coat:'green',pose:'side',scene:'garden'});
 const b=poster({species:'fox',coat:'coral',pose:'jump',scene:'garden'});
 assert.notEqual(a,b);assert.match(a,/兔子/);assert.match(b,/狐狸/);assert.match(b,/跃起/);
 assert.doesNotMatch(a,/<script|<image|https?:/);
});
test('Bobby posters reuse the same untouched original artwork and change the scarf color only',()=>{
 const green=poster({species:'bobby',coat:'green',pose:'side',scene:'garden'});
 const coral=poster({species:'bobby',coat:'coral',pose:'side',scene:'garden'});
 const image=svg=>svg.match(/<image\b[^>]*>/)?.[0];
 assert.ok(image(green),'Bobby must use the original raster rather than a generic animal drawing');
 assert.match(image(green),/href="\.\/studio-bobby-idle\.png"/);
 assert.equal(image(green),image(coral),'the original image and geometry must remain identical');
 assert.doesNotMatch(image(green),/filter|mask|opacity/,'the fur must not be recolored');
 assert.match(green,/aria-label="波比，绿色围巾，侧身"/);
 assert.match(coral,/aria-label="波比，珊瑚色围巾，侧身"/);
 const scarf=svg=>svg.match(/<g data-part="scarf"[\s\S]*?<\/g>/)?.[0];
 assert.ok(scarf(green),'a distinct scarf layer is required');assert.notEqual(scarf(green),scarf(coral));
 assert.equal(scarf(green).replace(/#[a-f0-9]{6}/g,''),scarf(coral).replace(/#[a-f0-9]{6}/g,''),'only palette values may differ, not scarf placement');
});
test('Bobby is the visible subject of both briefs and the saved original, not only the client badge',()=>{
 const b=boot();
 assert.match(b.nodes.get('after-art').innerHTML,/波比，珊瑚色围巾/);
 assert.match(b.nodes.get('brief-copy').textContent,/波比.*绿色.*围巾/);
 reachDecision(b);assert.match(b.nodes.get('before-art').innerHTML,/波比，珊瑚色围巾/);
 assert.match(b.nodes.get('after-art').innerHTML,/波比，绿色围巾/);
 assert.match(b.nodes.get('art-status').textContent,/围巾/);
 b.click('withdraw-rule');assert.match(b.nodes.get('saved-poster-art').innerHTML,/波比，绿色围巾/);
 assert.match(b.nodes.get('after-art').innerHTML,/波比，珊瑚色围巾/);
});
test('one initial poster and local repair do not install a rule',()=>{
 const b=boot();assert.equal(b.ui.state.stage,'mistake');
 assert.equal(b.nodes.get('before-figure').hidden,true);assert.equal(b.nodes.get('story-next').hidden,false);
 assert.equal(b.nodes.get('choice-controls').hidden,true);assert.equal(b.nodes.get('challenge-controls').hidden,true);
 assert.match(b.nodes.get('after-art').innerHTML,/珊瑚色/);
 b.click('story-next');assert.match(b.nodes.get('after-art').innerHTML,/绿色/);assert.equal(b.ui.state.workflow.outfit,'mixed');
 b.click('story-next');assert.match(b.nodes.get('after-art').innerHTML,/珊瑚色/);
});
test('successful original commission only offers a new trial, never an early keep button',()=>{
 const b=boot();reachTrial(b);
 assert.equal(b.ui.state.stage,'trial');assert.equal(b.nodes.get('choice-controls').hidden,true);
 assert.equal(b.nodes.get('story-next').hidden,false);assert.equal(b.ui.state.decision,null);
 assert.match(b.nodes.get('before-art').innerHTML,/珊瑚色/);assert.match(b.nodes.get('after-art').innerHTML,/绿色/);
 assert.equal(b.ui.state.workflow.outfit,'mixed');
});
test('new commission target visibly changes; neutral predictions do not reveal a result or install the rule',()=>{
 const b=boot();reachChallenge(b);
 assert.equal(b.ui.state.stage,'challenge');assert.equal(b.nodes.get('run-trial').disabled,true);
 assert.equal(b.nodes.get('choice-controls').hidden,true);assert.equal(b.nodes.get('art-status').hidden,true);
 assert.match(b.nodes.get('brief-copy').textContent,/珊瑚色/);assert.match(b.nodes.get('master-art').innerHTML,/珊瑚色/);
 b.click('predict-brief');assert.equal(b.ui.state.prediction,'brief');assert.equal(b.nodes.get('predict-brief').attrs['aria-pressed'],'true');
 assert.equal(b.nodes.get('run-trial').disabled,false);assert.equal(b.ui.state.workflow.outfit,'mixed');
});
test('trial reveals same-input comparison and old/new task evidence before either decision',()=>{
 const b=boot();reachChallenge(b);b.click('predict-brief');b.click('run-trial');
 assert.equal(b.ui.state.stage,'decision');assert.equal(b.nodes.get('choice-controls').hidden,false);
 assert.equal(b.nodes.get('story-next').hidden,true);assert.equal(b.nodes.get('challenge-controls').hidden,true);
 assert.match(b.nodes.get('before-art').innerHTML,/珊瑚色/);assert.match(b.nodes.get('after-art').innerHTML,/绿色/);
 assert.equal(b.nodes.get('rule-evidence').hidden,false);assert.match(b.nodes.get('trial-summary').textContent,/通过.*未通过/s);
 assert.match(b.nodes.get('prediction-result').textContent,/绿色/);assert.equal(b.ui.state.decision,null);
});
test('both real choices produce truthful different drawings and replay retains the same evidence',()=>{
 for(const decision of ['keep','withdraw']){
  const b=boot();reachDecision(b);const evidence=structuredClone(b.ui.state.transfer);
  b.click(decision+'-rule');assert.equal(b.ui.state.stage,'ending');assert.equal(b.ui.state.decision,decision);
  assert.match(b.nodes.get('after-art').innerHTML,decision==='keep'?/绿色/:/珊瑚色/);
  assert.match(b.nodes.get('outcome-copy').textContent,decision==='keep'?/仍|依然/:/旧办法|未安装/);
  assert.match(b.nodes.get('saved-repair').textContent,/绿色/);
  b.click('revisit');assert.equal(b.ui.state.stage,'decision');assert.deepEqual(b.ui.state.transfer,evidence);
  b.click((decision==='keep'?'withdraw':'keep')+'-rule');assert.equal(b.ui.state.art.coat,decision==='keep'?'coral':'green');
 }
});
test('theme preserves state and reset clears decisions evidence and comparisons',()=>{
 const b=boot();reachDecision(b);b.click('keep-rule');b.click('theme');
 assert.equal(b.ui.state.stage,'ending');assert.equal(b.doc.documentElement.dataset.theme,'dark');
 b.click('reset');assert.equal(b.ui.state.stage,'mistake');assert.equal(b.ui.state.decision,null);assert.equal(b.ui.state.transfer,null);
 assert.equal(b.nodes.get('before-figure').hidden,true);assert.equal(b.nodes.get('choice-controls').hidden,true);
 assert.equal(b.nodes.get('ending-controls').hidden,true);assert.equal(b.nodes.get('rule-evidence').hidden,true);
 assert.match(b.nodes.get('brief-copy').textContent,/绿色/);
});
test('mobile transitions focus instructions; guessing does not steal focus from its own control',()=>{
 const b=boot(390);reachChallenge(b);
 assert.equal(b.doc.activeElement.id,'guide-title');assert.equal(b.nodes.get('guide-title').scrolls.at(-1).block,'start');
 b.nodes.get('predict-green').focus();b.click('predict-green');assert.equal(b.doc.activeElement.id,'predict-green');
 b.click('run-trial');assert.equal(b.doc.activeElement.id,'guide-title');
});
test('a mobile retest reports both outcomes beside the button without returning focus to the chapter title',()=>{
 const b=boot(320,568);reachDecision(b);
 const title=b.nodes.get('guide-title'),button=b.nodes.get('retest-rule'),status=b.nodes.get('rule-test-status');
 const scrolls=title.scrolls.length;
 b.click('rule-brief');button.focus();b.click('retest-rule');
 assert.equal(b.doc.activeElement,button);
 assert.equal(title.scrolls.length,scrolls);
 assert.match(status.textContent,/旧委托通过.*新委托通过.*尚未安装/);
 assert.equal(b.nodes.get('rule-retest-feedback').scrolls.at(-1)?.block,'nearest');
 assert.equal(b.ui.state.workflow.outfit,'mixed','previewing cannot install the rule');
 b.click('rule-fixed-green');button.focus();b.click('retest-rule');
 assert.equal(b.doc.activeElement,button);
 assert.match(status.textContent,/旧委托通过.*新委托未通过.*尚未安装/);
});
test('short landscape endings and replay bring the current instruction into view',()=>{
 const b=boot(844,390);reachDecision(b);b.click('withdraw-rule');b.click('revisit');
 assert.equal(b.doc.activeElement.id,'guide-title');assert.equal(b.nodes.get('guide-title').scrolls.at(-1)?.block,'start');
});
test('desktop decision and ending reveal the new instruction instead of retaining a scrolled-away title',()=>{
 const b=boot();reachDecision(b);
 assert.equal(b.nodes.get('guide-title').scrolls.at(-1)?.block,'start');
 b.click('keep-rule');assert.equal(b.nodes.get('guide-title').scrolls.at(-1)?.block,'start');
});
test('both endings let the player inspect the manually repaired poster without replacing the new commission output',()=>{
 for(const decision of ['keep','withdraw']){
  const b=boot();
  assert.equal(b.doc.getElementById('saved-poster')?.hidden,true);
  reachDecision(b);b.click(decision+'-rule');
  assert.equal(b.nodes.get('saved-poster').hidden,false);
  assert.equal(b.nodes.get('saved-poster').open,false);
  assert.match(b.nodes.get('saved-poster-art').innerHTML,/aria-label="波比，绿色围巾，侧身"/);
  assert.match(b.nodes.get('after-art').innerHTML,decision==='keep'?/绿色/:/珊瑚色/);
  assert.equal(b.ui.state.decision,decision);
 }
});
test('saved poster rendering reads the captured artwork rather than reconstructing a fixed green template',()=>{
 const b=boot();b.click('story-next');
 // A valid non-default snapshot catches renderers that hard-code the example.
 Object.assign(b.ui.state.repairRecord,{species:'rabbit',coat:'coral',pose:'jump',scene:'moon'});
 b.click('story-next');b.click('story-next');b.click('story-next');
 b.click('predict-green');b.click('run-trial');b.click('withdraw-rule');
 const saved=b.nodes.get('saved-poster-art')?.innerHTML||'';
 assert.match(saved,/aria-label="兔子，珊瑚色外套，跃起"/);
 assert.match(saved,/MOON WALK/);
 assert.match(b.nodes.get('after-art').innerHTML,/aria-label="波比，珊瑚色围巾，侧身"/);
});
test('opening the saved poster is read-only and theme changes preserve its disclosure state',()=>{
 const b=boot();reachDecision(b);b.click('withdraw-rule');
 const card=b.doc.getElementById('saved-poster');assert.ok(card,'missing saved artwork disclosure');
 const state=structuredClone(b.ui.state),art=b.nodes.get('saved-poster-art').innerHTML;
 card.open=true;card.dispatchEvent(new Event('toggle'));
 assert.deepEqual(b.ui.state,state);
 b.click('theme');assert.equal(card.open,true);assert.equal(b.nodes.get('saved-poster-art').innerHTML,art);
 card.open=false;card.dispatchEvent(new Event('toggle'));
 assert.deepEqual(b.ui.state,state);
});
test('revisiting a decision closes the saved card and the alternate ending keeps the same real artwork',()=>{
 const b=boot();reachDecision(b);b.click('keep-rule');
 const card=b.doc.getElementById('saved-poster');assert.ok(card,'missing saved artwork disclosure');
 const saved=b.nodes.get('saved-poster-art').innerHTML;card.open=true;
 b.click('revisit');assert.equal(card.hidden,true);assert.equal(card.open,false);
 assert.equal(b.nodes.get('saved-poster-art').innerHTML,'');
 b.click('withdraw-rule');assert.equal(card.hidden,false);assert.equal(card.open,false);
 assert.equal(b.nodes.get('saved-poster-art').innerHTML,saved);
 assert.match(b.nodes.get('after-art').innerHTML,/珊瑚色/);
});
test('restarting clears the old disclosure and a second round renders only its own captured poster',()=>{
 const b=boot();reachDecision(b);b.click('withdraw-rule');
 const card=b.doc.getElementById('saved-poster');assert.ok(card,'missing saved artwork disclosure');card.open=true;
 b.click('reset');assert.equal(b.ui.state.repairRecord,null);
 assert.equal(card.hidden,true);assert.equal(card.open,false);assert.equal(b.nodes.get('saved-poster-art').innerHTML,'');
 b.click('story-next');Object.assign(b.ui.state.repairRecord,{species:'rabbit',pose:'front',scene:'sea'});
 b.click('story-next');b.click('story-next');b.click('story-next');
 b.click('predict-brief');b.click('run-trial');b.click('keep-rule');
 assert.match(b.nodes.get('saved-poster-art').innerHTML,/aria-label="兔子，绿色外套，正面打招呼"/);
 assert.match(b.nodes.get('saved-poster-art').innerHTML,/SLOW SUNSET/);
 assert.equal(card.open,false);
});
test('the rule field appears only after the real failure and cannot keep an untested edit',()=>{
 const b=boot();assert.equal(b.doc.getElementById('rule-editor')?.hidden,true);
 reachDecision(b);assert.equal(b.nodes.get('rule-editor').hidden,false);
 b.click('rule-brief');assert.equal(b.ui.state.selectedRule,'brief');
 assert.equal(b.nodes.get('rule-brief').attrs['aria-pressed'],'true');
 assert.equal(b.nodes.get('rule-fixed-green').attrs['aria-pressed'],'false');
 assert.equal(b.nodes.get('keep-rule').disabled,true);
 assert.match(b.nodes.get('rule-test-status').textContent,/还没试|尚未/);
 assert.match(b.nodes.get('after-art').innerHTML,/绿色/,'selection alone does not fake a new drawing');
 assert.equal(b.ui.state.workflow.outfit,'mixed');
 b.click('withdraw-rule');assert.equal(b.ui.state.stage,'ending');
 assert.equal(b.nodes.get('rule-editor').hidden,true);
});
test('retesting renders both actual commission results then keeps precisely the tested rule',()=>{
 const b=boot();reachDecision(b);const saved=structuredClone(b.ui.state.repairRecord);
 b.click('rule-brief');b.click('retest-rule');
 assert.equal(b.nodes.get('keep-rule').disabled,false);
 assert.equal(b.nodes.get('rule-retest-results').hidden,false);
 assert.match(b.nodes.get('rule-first-art').innerHTML,/波比，绿色围巾/);
 assert.match(b.nodes.get('rule-second-art').innerHTML,/波比，珊瑚色围巾/);
 assert.match(b.nodes.get('rule-first-result').textContent,/通过/);assert.match(b.nodes.get('rule-second-result').textContent,/通过/);
 assert.match(b.nodes.get('after-art').innerHTML,/珊瑚色/);
 assert.match(b.nodes.get('keep-rule-copy').textContent,/当前委托/);
 assert.match(b.nodes.get('assistant-copy').textContent,/当前委托/);
 assert.equal(b.ui.state.workflow.outfit,'mixed');
 b.click('keep-rule');assert.equal(b.ui.state.workflow.outfit,'locked');
 assert.match(b.nodes.get('outcome-label').textContent,/当前委托/);
 assert.doesNotMatch(b.nodes.get('outcome-copy').textContent,/忽略珊瑚色|仍固定绿色/);
 assert.match(b.nodes.get('saved-poster-art').innerHTML,/波比，绿色围巾/);
 assert.deepEqual(b.ui.state.repairRecord,saved);
 b.click('revisit');assert.equal(b.nodes.get('keep-rule').disabled,false);
 b.click('withdraw-rule');assert.equal(b.ui.state.workflow.outfit,'mixed');
 assert.match(b.nodes.get('after-art').innerHTML,/珊瑚色/);
});
test('editing after a retest labels the visible old result and fixed-green retesting exposes the failure again',()=>{
 const b=boot();reachDecision(b);b.click('rule-brief');b.click('retest-rule');b.click('rule-fixed-green');
 assert.equal(b.nodes.get('keep-rule').disabled,true);
 assert.match(b.nodes.get('rule-test-status').textContent,/上次|还没试|尚未/);
 assert.match(b.nodes.get('after-art').innerHTML,/珊瑚色/);
 b.click('retest-rule');assert.match(b.nodes.get('rule-second-art').innerHTML,/绿色/);
 assert.match(b.nodes.get('rule-second-result').textContent,/未通过/);
 assert.equal(b.nodes.get('keep-rule').disabled,false);
 b.click('keep-rule');assert.equal(b.ui.state.workflow.outfit,'fixed-green');
 assert.match(b.nodes.get('outcome-copy').textContent,/仍|依然/);
});
test('theme and replay preserve the edited test while reset clears the editor and result cards',()=>{
 const b=boot(320,740);reachDecision(b);b.click('rule-brief');b.click('retest-rule');
 const evidence=structuredClone(b.ui.state.retest);b.click('theme');assert.deepEqual(b.ui.state.retest,evidence);
 b.click('keep-rule');b.click('revisit');assert.deepEqual(b.ui.state.retest,evidence);
 assert.equal(b.nodes.get('rule-brief').attrs['aria-pressed'],'true');
 b.click('reset');assert.equal(b.ui.state.retest,null);assert.equal(b.ui.state.selectedRule,'fixed-green');
 assert.equal(b.nodes.get('rule-editor').hidden,true);assert.equal(b.nodes.get('rule-retest-results').hidden,true);
 assert.equal(b.nodes.get('rule-first-art').innerHTML,'');assert.equal(b.nodes.get('rule-second-art').innerHTML,'');
});
