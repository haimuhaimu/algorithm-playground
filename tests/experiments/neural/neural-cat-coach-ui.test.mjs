import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../../../dist/neural.html',import.meta.url),'utf8');
const controller=await import('../../../dist/neural-cat-coach-ui.mjs').catch(error=>{
 if(error.code==='ERR_MODULE_NOT_FOUND'&&error.url?.endsWith('/neural-cat-coach-ui.mjs'))return {};
 throw error;
});

function fixture(hash='#cat-lesson'){
 assert.equal(typeof controller.mountCatCoach,'function','the guided lesson is not wired yet');
 class Element extends EventTarget{
  attrs=new Map();
  children=[];
  hidden=false;
  textContent='';
  constructor(tag){super();this.tagName=tag;}
  setAttribute(name,value){this.attrs.set(name,String(value));}
  getAttribute(name){return this.attrs.get(name);}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  click(){this.dispatchEvent(new Event('click'));}
  focus(){this.focused=true;}
 }
 const ids=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const e=id=>{assert.ok(ids.has(id),'missing HTML element: '+id);return ids.get(id);};
 const window=Object.assign(new EventTarget(),{location:{hash}});
 Object.defineProperty(window,'localStorage',{get(){throw Error('the coached exercise cannot access doodle drafts');}});
 controller.mountCatCoach({document:{getElementById:e,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)},window});
 return e;
}

test('one tag immediately changes the model response and trying both tags preserves the fair comparison',()=>{
 const e=fixture();
 assert.match(e('cat-coach-before').textContent,/波比/);
 assert.equal(e('cat-coach-pair').hidden,true);
 e('cat-coach-label-chouchou').click();
 assert.match(e('cat-coach-first-outcome').textContent,/波比.*臭臭/);
 assert.equal(e('cat-coach-pair').hidden,false);
 e('cat-coach-label-bobby').click();
 assert.match(e('cat-coach-first-outcome').textContent,/仍.*波比/);
 assert.equal(e('cat-coach-tag-comparison').hidden,false);
 assert.match(e('cat-coach-tag-chouchou').textContent,/臭臭/);
 assert.match(e('cat-coach-tag-bobby').textContent,/波比/);
});

test('the pair reveals independent interventions and changing the training tag retires both old results',()=>{
 const e=fixture();
 e('cat-coach-more').click();
 assert.equal(e('cat-coach-more-result').hidden,true);
 e('cat-coach-label-chouchou').click();
 e('cat-coach-more').click();
 assert.match(e('cat-coach-more-outcome').textContent,/同一个答案/);
 assert.equal(e('cat-coach-fluff-result').hidden,true);
 e('cat-coach-fluff').click();
 assert.match(e('cat-coach-fluff-outcome').textContent,/波比.*臭臭/);
 assert.match(e('cat-coach-fluff-evidence').textContent,/波比卡：脸颊 6，耳尖 6，蓬松度 2.*臭臭卡：脸颊 6，耳尖 6，蓬松度 9/);
 assert.equal(e('cat-coach-more-result').hidden,false);
 e('cat-coach-transfer-more').click();
 assert.match(e('cat-coach-transfer-feedback').textContent,/相同.*相同/);
 e('cat-coach-label-bobby').click();
 for(const id of ['cat-coach-more-result','cat-coach-fluff-result','cat-coach-transfer']){
  assert.equal(e(id).hidden,true,id+' should not show obsolete results');
 }
});

test('the added clue can leave the six-card reversed-label model unable to distinguish the pair',()=>{
 const e=fixture();
 e('cat-coach-label-bobby').click();
 e('cat-coach-size-6').click();
 e('cat-coach-fluff').click();
 assert.match(e('cat-coach-fluff-outcome').textContent,/都叫「波比」/);
 assert.match(e('cat-coach-fluff-note').textContent,/分数有差别.*仍没分开/);
});

test('guided reset leaves free practice alone and the same-hash exit reopens doodling',()=>{
 const e=fixture('#field');
 let opened=0;
 e('guide-open-free').addEventListener('click',()=>opened++);
 e('cat-practice').open=true;
 e('cat-coach-label-chouchou').click();
 e('cat-coach-reset').click();
 assert.equal(e('cat-coach-pair').hidden,true);
 assert.equal(e('cat-practice').open,true);
 e('cat-coach-free').click();
 assert.equal(opened,1);
});

test('one tag immediately plots the expanded group and the original and learned boundaries',()=>{
 const e=fixture();
 e('cat-coach-label-chouchou').click();
 const marks=e('cat-coach-population-points').children;
 assert.equal(marks.length,18);
 assert.equal(e('cat-coach-size-18').getAttribute('aria-pressed'),'true');
 assert.equal(marks.filter(mark=>mark.getAttribute('data-label')==='bobby').length,9);
 assert.equal(marks.filter(mark=>mark.getAttribute('data-label')==='chouchou').length,9);
 assert.equal(e('cat-coach-sample').value,'03');
 assert.match(e('cat-coach-population-score').textContent,/13\s*\/\s*18.*17\s*\/\s*18/);
 const line=id=>['x1','y1','x2','y2'].map(key=>e('cat-coach-boundary-'+id).getAttribute(key));
 assert.notDeepEqual(line('before'),line('after'),'the solid line must show a real update');
});

test('switching sample size preserves the six shared point coordinates and clears stale test-card outcomes',()=>{
 const e=fixture();
 e('cat-coach-label-chouchou').click();
 e('cat-coach-more').click();
 e('cat-coach-fluff').click();
 assert.equal(e('cat-coach-transfer').hidden,false);
 const positions=()=>Object.fromEntries(e('cat-coach-population-points').children.map(mark=>
  [mark.getAttribute('data-id'),mark.getAttribute('transform')]));
 const expanded=positions();
 e('cat-coach-size-6').click();
 const small=positions();
 assert.deepEqual(Object.keys(small).sort(),['01','02','03','04','05','06']);
 for(const [id,point] of Object.entries(small))assert.equal(point,expanded[id],id+' changed coordinates');
 assert.match(e('cat-coach-population-score').textContent,/4\s*\/\s*6.*6\s*\/\s*6/);
 assert.equal(e('cat-coach-label-chouchou').getAttribute('aria-pressed'),'true');
 assert.equal(e('cat-coach-size-6').getAttribute('aria-pressed'),'true');
 for(const id of ['cat-coach-more-result','cat-coach-fluff-result','cat-coach-transfer'])assert.equal(e(id).hidden,true);
 e('cat-coach-more').click();
 assert.equal(e('cat-coach-more-result').hidden,false);
 assert.match(e('cat-coach-more-evidence').textContent,/6\s*张/);
});

test('the accessible picker and plot points select the same original sample',()=>{
 const e=fixture();
 e('cat-coach-label-chouchou').click();
 e('cat-coach-sample').value='11';
 e('cat-coach-sample').dispatchEvent(new Event('change'));
 assert.match(e('cat-coach-sample-image').getAttribute('src'),/neural-cat-11\.jpg$/);
 assert.match(e('cat-coach-status').textContent,/11 号原画.*脸颊 3.*耳尖 6.*模型/);
 const marks=e('cat-coach-population-points').children;
 marks.find(mark=>mark.getAttribute('data-id')==='10').click();
 assert.equal(e('cat-coach-sample').value,'10');
 assert.match(e('cat-coach-sample-image').getAttribute('src'),/neural-cat-10\.jpg$/);
 e('cat-coach-size-6').click();
 assert.equal(e('cat-coach-sample').value,'03','a removed point must not remain selected');
});
