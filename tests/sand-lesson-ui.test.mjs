import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Browser primitives only; use the real HTML, controller, transitions and engine.
async function harness(id,check){
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
  scrollIntoView(){this.scrolled=true;}
 }
 const els=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const group=(attr,key)=>[...html.matchAll(new RegExp(attr+'="([^"]+)"','g'))].map(([,value])=>Object.assign(new Element(),{dataset:{[key]:value}}));
 const guesses=group('data-grain-guess','grainGuess'),materialGuesses=group('data-material-guess','materialGuess'),materials=group('data-grain-material','grainMaterial');
 const groups={'[data-grain-guess]':guesses,'[data-material-guess]':materialGuesses,'[data-grain-material]':materials};
 doc=Object.assign(new EventTarget(),{getElementById:id=>els.get(id),createElement:()=>new Element(),querySelectorAll:selector=>groups[selector]||[]});
 const old=Object.getOwnPropertyDescriptor(globalThis,'document');globalThis.document=doc;
 try{
  await import('../sand-lesson-ui.mjs?'+id);
  await check({doc,els,guesses,materialGuesses,materials});
 }finally{if(old)Object.defineProperty(globalThis,'document',old);else delete globalThis.document;}
}
test('guided UI keeps baseline evidence, invalidates stale results, resets and hands keyboard focus to the next step',()=>harness('wall-regression',({doc,els,guesses})=>{
  els.get('grain-mode-wall')?.click();
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
}));

test('material UI runs the displayed condition, preserves all comparisons and exposes actual water positions',()=>harness('material-regression',({doc,els,materialGuesses,materials})=>{
 const run=els.get('grain-run'),board=els.get('grain-board'),guess=value=>materialGuesses.find(e=>e.dataset.materialGuess===value).click(),choose=value=>materials.find(e=>e.dataset.grainMaterial===String(value)).click();
 assert.equal(board.children[12].dataset.cellMaterial,0,'default is empty-space condition, not the previous wall course');
 assert.equal(run.disabled,true);guess('swap');assert.equal(run.disabled,false);run.click();
 assert.equal(board.children[12].dataset.cellMaterial,1);assert.equal(board.children[7].dataset.cellMaterial,0);
 assert.equal(run.disabled,true);const first=els.get('grain-material-0').textContent;assert.match(first,/空格/);
 els.get('grain-material-next').click();assert.equal(board.children[12].dataset.cellMaterial,2);assert.equal(run.disabled,true);
 assert.equal(els.get('grain-material-0').textContent,first);assert.equal(els.get('grain-frame').hidden,true);
 guess('swap');run.click();assert.equal(board.children[7].dataset.cellMaterial,2);assert.equal(board.children[12].dataset.cellMaterial,1);
 assert.match(els.get('grain-material-motion').textContent,/水.*第3行第3列.*第2行第3列/);
 assert.match(els.get('grain-material-counts').textContent,/水.*1.*1/);
 assert.equal(els.get('grain-material-inline')?.children.length,2,'the active result must include both real pictures beside its explanation on narrow screens');
 const pair=els.get('grain-material-2').children[1].children;
 assert.match(pair[0].children[1].getAttribute('aria-label'),/沙在第2行第3列.*水在第3行第3列/,'before image must describe pre-step positions, not the whole movement');
 assert.match(pair[1].children[1].getAttribute('aria-label'),/沙在第3行第3列.*水在第2行第3列/,'after image must describe final positions');
 assert.equal(doc.activeElement,els.get('grain-material-evidence'),'keyboard result focus must include the pictures as well as the explanation');
 assert.equal(els.get('grain-material-evidence').scrolled,true,'result pictures must be brought into view, not left below old choices');
 els.get('grain-frame').click();assert.equal(board.children[7].dataset.cellMaterial,1);assert.equal(board.children[12].dataset.cellMaterial,2);
 els.get('grain-frame').click();assert.equal(board.children[7].dataset.cellMaterial,2);
 const water=els.get('grain-material-2').textContent;
 choose(3);assert.equal(board.children[12].dataset.cellMaterial,3);assert.equal(els.get('grain-trace').children.length,0);
 guess('stay');run.click();assert.equal(board.children[7].dataset.cellMaterial,1);assert.equal(els.get('grain-trace').children.length,3);
 assert.equal(els.get('grain-material-ending').hidden,false);assert.equal(els.get('grain-material-2').textContent,water);
 els.get('grain-material-next').click();assert.equal(doc.activeElement,els.get('grain-material-ending'));assert.equal(els.get('grain-material-ending').scrolled,true);
 els.get('grain-material-retry').click();assert.equal(run.disabled,true);assert.equal(els.get('grain-frame').hidden,true);
 assert.equal(doc.activeElement,els.get('grain-board-title'),'short-screen retry must return to the visible starting picture, not only the lower prompt');
 assert.equal(els.get('grain-board-title').scrolled,true);
 assert.equal(els.get('grain-material-2').textContent,water);assert.equal(board.children[12].dataset.cellMaterial,3);
 els.get('grain-restart').click();assert.equal(board.children[12].dataset.cellMaterial,0);assert.equal(els.get('grain-material-ending').hidden,true);
 assert.doesNotMatch(els.get('grain-material-2').textContent,/第3行第3列/);
}));
test('switching observation modes preserves their separate progress and pause events never target the free canvas',()=>harness('mode-regression',({doc,els,guesses,materialGuesses,materials})=>{
 let pauses=0;doc.addEventListener('sand-lesson-start',()=>pauses++);
 els.get('grain-lab').dispatchEvent(new Event('focusin'));assert.equal(pauses,1);
 materials.find(e=>e.dataset.grainMaterial==='2').click();materialGuesses.find(e=>e.dataset.materialGuess==='swap').click();els.get('grain-run').click();
 const water=els.get('grain-material-2').textContent;
 els.get('grain-mode-wall').click();guesses.find(e=>e.dataset.grainGuess==='left').click();els.get('grain-run').click();
 const baseline=els.get('grain-before').textContent;
 els.get('grain-mode-material').click();assert.equal(els.get('grain-material-2').textContent,water);assert.equal(els.get('grain-board').children[7].dataset.cellMaterial,2);
 els.get('grain-mode-wall').click();assert.equal(els.get('grain-before').textContent,baseline);assert.equal(els.get('grain-board').children[12].disabled,false);
}));
