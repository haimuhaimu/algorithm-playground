import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const api=await import('../../../dist/neural-cat-lesson-ui.mjs').catch(error=>{
 if(error.code==='ERR_MODULE_NOT_FOUND')return {};
 throw error;
});
const html=await readFile(new URL('../../../dist/neural.html',import.meta.url),'utf8');

function fixture(hash=''){
 assert.equal(typeof api.mountCatLesson,'function','the original lab has no cat lesson controller yet');
 class Element extends EventTarget{
  attrs=new Map();
  children=[];
  dataset={};
  hidden=false;
  disabled=false;
  open=false;
  textContent='';
  setAttribute(name,value){this.attrs.set(name,String(value));}
  getAttribute(name){return this.attrs.get(name);}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
  focus(){this.focused=true;}
 }
 const ids=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const document={
  getElementById(id){assert.ok(ids.has(id),'missing actual HTML target: '+id);return ids.get(id);},
  createElement:()=>new Element(),createElementNS:()=>new Element(),
 };
 const window=Object.assign(new EventTarget(),{location:{hash}});
 Object.defineProperty(window,'localStorage',{get(){throw Error('the cat lesson must not read or overwrite drafts');}});
 api.mountCatLesson({document,window});
 return {window,e:document.getElementById};
}
function tag(f,labels){
 labels.forEach((label,i)=>{
  f.e('cat-sample-0'+(i+1)).click();
  f.e('cat-label-'+label).click();
 });
}
const tags=['bobby','chouchou','chouchou','bobby','bobby','chouchou'];

test('deep link opens only the cat lesson while the default entry stays collapsed',()=>{
 const f=fixture();
 assert.equal(f.e('cat-lesson').open,false);
 assert.equal(f.e('neural-advanced').open,false);
 f.window.location.hash='#cat-lesson';
 f.window.dispatchEvent(new Event('hashchange'));
 assert.equal(f.e('cat-lesson').open,true);
 assert.equal(f.e('neural-advanced').open,false);
 assert.equal(fixture('#cat-lesson').e('cat-lesson').open,true);
});

test('comic descriptions provide visual clues without naming the training or test answers',()=>{
 const f=fixture('#cat-lesson'),{e}=f;
 assert.match(e('cat-image').alt,/靠垫.*大尖耳/);
 assert.doesNotMatch(e('cat-image').alt,/波比|臭臭/);
 tag(f,tags);e('cat-train-guess-moves').click();e('cat-train').click();
 assert.match(e('cat-test-image-08').alt,/白毛/);
 assert.doesNotMatch(e('cat-test-image-08').alt,/波比|臭臭/);
});

test('the free doodle exit opens its existing guide even when the field hash already matches',()=>{
 const {e}=fixture('#field');
 let opened=0;
 e('guide-open-free').addEventListener('click',()=>{opened++;});
 e('cat-free').click();
 assert.equal(opened,1);
});

test('the first original mistake is focused and can be compared with another actual card',()=>{
 const f=fixture('#cat-lesson'),{e}=f;
 tag(f,tags);
 assert.match(e('cat-compare-title').textContent,/03/);
 assert.match(e('cat-compare-reading').textContent,/原来.*波比.*你贴.*臭臭/);
 assert.equal(e('cat-compare-03').getAttribute('aria-pressed'),'true');
 e('cat-train-guess-moves').click();e('cat-train').click();
 assert.match(e('cat-compare-reading').textContent,/波比.*臭臭/);
 e('cat-compare-04').click();
 assert.match(e('cat-compare-title').textContent,/04/);
 assert.match(e('cat-compare-reading').textContent,/臭臭.*波比/);
});

test('when training puts the entire graph on one side the note names that class',()=>{
 const f=fixture('#cat-lesson'),{e}=f;
 tag(f,['chouchou','chouchou','bobby','bobby','bobby','bobby']);
 e('cat-train-guess-moves').click();e('cat-train').click();
 assert.equal(e('cat-plot-after').getAttribute('visibility'),'hidden');
 assert.match(e('cat-map-notes').textContent,/整个图.*波比/);
});

test('only the player labels are learned, the prediction is gated, and a changed label retires old evidence',()=>{
 const f=fixture('#cat-lesson'),{e}=f;
 assert.equal(e('cat-train-stage').hidden,true);
 tag(f,Array(6).fill('bobby'));
 assert.equal(e('cat-train-stage').hidden,true,'all one label cannot train');
 assert.match(e('cat-status').textContent,/两种/);
 tag(f,tags);
 assert.equal(e('cat-train').disabled,true,'six labels are not yet a guess');
 e('cat-train-guess-moves').click();
 e('cat-train').click();
 assert.equal(e('cat-results').hidden,false);
 assert.match(e('cat-score').textContent,/4\s*\/\s*6.*6\s*\/\s*6/);
 assert.notEqual(e('cat-plot-before').getAttribute('x1'),e('cat-plot-after').getAttribute('x1'));
 assert.equal(e('cat-reveal').hidden,true,'test outputs are hidden before a guess');
 e('cat-test-guess-same').click();
 assert.equal(e('cat-reveal').hidden,false);
 e('cat-takeaway').open=true;
 assert.match(e('cat-test-result-07').textContent,/波比/);
 assert.match(e('cat-test-result-08').textContent,/臭臭/);
 e('cat-sample-01').click();
 e('cat-label-chouchou').click();
 assert.equal(e('cat-results').hidden,true);
 assert.equal(e('cat-reveal').hidden,true);
 assert.equal(e('cat-takeaway').open,false,'old reflection should close with invalidated evidence');
 assert.equal(e('cat-train').disabled,true,'old guess must not unlock a new training run');
 e('cat-train-guess-stays').click();
 e('cat-train').click();
 assert.match(e('cat-mislabels').textContent,/01/);
 e('cat-reset').click();
 assert.equal(e('cat-train-stage').hidden,true);
 assert.match(e('cat-label-count').textContent,/0\s*\/\s*6/);
});
