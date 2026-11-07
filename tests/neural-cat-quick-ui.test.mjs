import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../neural.html',import.meta.url),'utf8');
const controller=await import('../neural-cat-quick-ui.mjs').catch(error=>{
 if(error.code==='ERR_MODULE_NOT_FOUND'&&error.url?.endsWith('/neural-cat-quick-ui.mjs'))return {};
 throw error;
});

function fixture(){
 assert.equal(typeof controller.mountCatQuick,'function','the compact lesson is not wired yet');
 let focused=null;
 class Element extends EventTarget{
  attrs=new Map();
  textContent='';
  constructor(markup){
   super();
   this.hidden=/\shidden(?=\s|>)/.test(markup);
   this.open=/\sopen(?=\s|>)/.test(markup);
  }
  setAttribute(key,value){this.attrs.set(key,String(value));}
  getAttribute(key){return this.attrs.get(key);}
  click(){this.dispatchEvent(new Event('click'));}
  focus(){focused=this;}
 }
 const ids=new Map([...html.matchAll(/<[^<>]+\bid="([^"]+)"[^<>]*>/g)].map(([markup,id])=>[id,new Element(markup)]));
 const e=id=>{assert.ok(ids.has(id),'missing HTML element: '+id);return ids.get(id);};
 const window={location:{hash:'#cat-lesson'}};
 Object.defineProperty(window,'localStorage',{get(){throw Error('the compact lesson cannot access doodle drafts');}});
 controller.mountCatQuick({document:{getElementById:e},window});
 return {e,focused:()=>focused};
}

test('the first screen accepts a new label immediately without exposing the plot or the new cards',()=>{
 const {e}=fixture();
 assert.equal(e('cat-quick').hidden,false);
 assert.equal(e('cat-quick-teach').hidden,false);
 assert.equal(e('cat-coach-details').open,false);
 assert.equal(e('cat-quick-test').hidden,true);
 e('cat-quick-next').click();
 assert.equal(e('cat-quick-test').hidden,true,'testing is unavailable until a choice');
 e('cat-quick-tag-chouchou').click();
 assert.match(e('cat-quick-feedback').textContent,/练习卡.*臭臭/);
 assert.equal(e('cat-quick-next').hidden,false);
 e('cat-quick-tag-bobby').click();
 assert.match(e('cat-quick-feedback').textContent,/练习卡.*波比/);
 assert.equal(e('cat-quick-test').hidden,true,'test is a separate screen');
});

test('adding and removing the third clue preserves both original scores and both card images',()=>{
 const {e,focused}=fixture();
 e('cat-quick-tag-chouchou').click();
 e('cat-quick-next').click();
 assert.equal(e('cat-quick-teach').hidden,true);
 assert.equal(e('cat-quick-test').hidden,false);
 assert.equal(focused(),e('cat-quick-test-title'));
 const images=['07','08'].map(id=>e('cat-quick-image-'+id).getAttribute('src'));
 assert.deepEqual(images,['./neural-cat-07.jpg','./neural-cat-08.jpg']);
 const originalInputs=['07','08'].map(id=>e('cat-quick-input-'+id).textContent);
 assert.deepEqual(originalInputs,['脸颊 6 · 耳尖 6','脸颊 6 · 耳尖 6']);
 for(const id of ['07','08']){
  assert.equal(e('cat-quick-fluff-'+id).hidden,true);
  assert.match(e('cat-quick-call-'+id).textContent,/波比/);
 }
 const toggle=e('cat-quick-clue-toggle');
 assert.match(toggle.textContent,/加上蓬松度/);
 toggle.focus();
 toggle.click();
 assert.equal(focused(),toggle);
 assert.deepEqual(['07','08'].map(id=>e('cat-quick-image-'+id).getAttribute('src')),images);
 assert.deepEqual(['07','08'].map(id=>e('cat-quick-input-'+id).textContent),originalInputs);
 assert.deepEqual(['07','08'].map(id=>e('cat-quick-fluff-'+id).textContent),['蓬松 2','蓬松 9']);
 assert.deepEqual(['07','08'].map(id=>e('cat-quick-fluff-'+id).hidden),[false,false]);
 assert.match(e('cat-quick-call-07').textContent,/波比/);
 assert.match(e('cat-quick-call-08').textContent,/臭臭/);
 assert.match(e('cat-quick-status').textContent,/蓬松度.*2.*9/);
 assert.equal(toggle.getAttribute('aria-pressed'),'true');
 assert.match(toggle.textContent,/撤掉蓬松度/);
 toggle.click();
 assert.equal(focused(),toggle);
 assert.equal(toggle.getAttribute('aria-pressed'),'false');
 assert.deepEqual(['07','08'].map(id=>e('cat-quick-fluff-'+id).hidden),[true,true]);
 assert.deepEqual(['07','08'].map(id=>e('cat-quick-input-'+id).textContent),originalInputs);
 assert.match(e('cat-quick-call-08').textContent,/波比/);
});

test('back preserves the teaching choice, new teaching resets the clue, and reset touches no advanced mode',()=>{
 const {e,focused}=fixture();
 e('cat-quick-tag-chouchou').click();
 e('cat-quick-next').click();
 e('cat-quick-clue-toggle').click();
 e('cat-quick-back').click();
 assert.equal(e('cat-quick-teach').hidden,false);
 assert.equal(focused(),e('cat-quick-teach-title'));
 assert.equal(e('cat-quick-tag-chouchou').getAttribute('aria-pressed'),'true');
 e('cat-quick-tag-bobby').click();
 e('cat-quick-next').click();
 assert.equal(e('cat-quick-input-08').textContent,'脸颊 6 · 耳尖 6');
 assert.equal(e('cat-quick-fluff-08').hidden,true);
 assert.match(e('cat-quick-call-08').textContent,/波比/);
 e('cat-practice').open=true;
 e('cat-coach-details').open=true;
 e('cat-quick-reset').click();
 assert.equal(e('cat-quick-next').hidden,true);
 assert.equal(e('cat-quick-test').hidden,true);
 assert.equal(e('cat-practice').open,true);
 assert.equal(e('cat-coach-details').open,true);
});
