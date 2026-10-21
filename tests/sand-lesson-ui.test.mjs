import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Browser primitives only; use the real controller, state transitions and sand engine.
test('guided UI keeps baseline evidence, invalidates stale results, resets and hands keyboard focus to the next step',async()=>{
 const html=await readFile(new URL('../sand.html',import.meta.url),'utf8');
 let doc;
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.children=[];this.attributes=new Map();this.disabled=false;}
  set textContent(value){this.text=String(value);this.children=[];}
  get textContent(){return (this.text||'')+this.children.map(c=>c.textContent).join('');}
  append(...elements){this.children.push(...elements);}
  replaceChildren(...elements){this.text='';this.children=elements;}
  setAttribute(k,v){this.attributes.set(k,v);}
  getAttribute(k){return this.attributes.get(k);}
  click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
  focus(){doc.activeElement=this;}
 }
 const els=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const guesses=[...html.matchAll(/data-grain-guess="([^"]+)"/g)].map(([,value])=>Object.assign(new Element(),{dataset:{grainGuess:value}}));
 doc=Object.assign(new EventTarget(),{getElementById:id=>els.get(id),createElement:()=>new Element(),querySelectorAll:()=>guesses});
 const old=Object.getOwnPropertyDescriptor(globalThis,'document');globalThis.document=doc;
 try{
  await import('../sand-lesson-ui.mjs?ui-regression');
  const run=els.get('grain-run'),board=els.get('grain-board');
  assert.equal(run.disabled,true);assert.ok(board.children.filter(c=>c.type==='button').every(c=>c.disabled));
  guesses.find(g=>g.dataset.grainGuess==='down').click();assert.equal(run.disabled,false);run.click();
  assert.match(els.get('grain-before').textContent,/左下/);assert.equal(els.get('grain-trace').children.length,3);
  assert.equal(doc.activeElement,board.children[12],'first result must hand focus to an editable wall');
  const baseline=els.get('grain-before').textContent;
  board.children[12].click();assert.equal(run.disabled,true);assert.equal(els.get('grain-trace').children.length,0);
  guesses.find(g=>g.dataset.grainGuess==='down').click();run.click();
  assert.match(els.get('grain-after').textContent,/往下/);assert.equal(els.get('grain-conclusion').hidden,false);
  assert.equal(doc.activeElement,els.get('grain-conclusion'),'second result must expose its ending to keyboard users');
  assert.equal(els.get('grain-before').textContent,baseline);
  board.children[13].click();assert.equal(run.disabled,true);assert.equal(els.get('grain-conclusion').hidden,true);
  assert.doesNotMatch(els.get('grain-after').textContent,/往下/,'old outcome must not describe newly edited world');
  guesses.find(g=>g.dataset.grainGuess==='left').click();run.click();
  assert.match(els.get('grain-summary-title').textContent,/没变/);
  els.get('grain-restart').click();assert.equal(run.disabled,true);assert.equal(els.get('grain-conclusion').hidden,true);
  assert.doesNotMatch(els.get('grain-before').textContent,/左下/);assert.ok(guesses.every(g=>!g.disabled));
 }finally{if(old)Object.defineProperty(globalThis,'document',old);else delete globalThis.document;}
});
