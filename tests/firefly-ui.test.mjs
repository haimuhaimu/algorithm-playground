import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Execute the actual controller and model. Only browser I/O is represented here;
// this checks lifecycle state, not canvas pixels or real browser backgrounding.
const html=await readFile(new URL('../firefly.html',import.meta.url),'utf8');
let bootNumber=0;
async function boot({hidden=false,reducedMotion=false}={}){
 const frames=new Map();let nextFrame=0;
 const context={createRadialGradient:()=>({addColorStop(){}})};
 for(const name of ['fillRect','beginPath','arc','fill','stroke','setLineDash','ellipse','moveTo','lineTo','clearRect'])context[name]=()=>{};
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attributes=new Map();this.width=960;this.height=600;this.checked=false;}
  setAttribute(name,value){this.attributes.set(name,value);}
  getAttribute(name){return this.attributes.get(name);}
  getContext(){return context;}
 }
 const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const presets=['chorus','independent','islands'].map(preset=>Object.assign(new Element(),{dataset:{preset}}));
 const modes=['scatter','align'].map(mode=>Object.assign(new Element(),{dataset:{mode}}));
 const document=Object.assign(new EventTarget(),{hidden,documentElement:new Element(),
  getElementById:id=>elements.get(id),querySelectorAll:selector=>selector==='[data-preset]'?presets:modes});
 const globals={document,window:new EventTarget(),
  matchMedia:query=>Object.assign(new EventTarget(),{matches:query.includes('reduced-motion')&&reducedMotion}),
  getComputedStyle:()=>({getPropertyValue:()=>'#25271f'}),
  requestAnimationFrame:callback=>{const id=++nextFrame;frames.set(id,callback);return id;},
  cancelAnimationFrame:id=>frames.delete(id)};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const restore=()=>{for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];};
 Object.assign(globalThis,globals);
 try{await import(new URL(`../firefly.mjs?lifecycle-test=${++bootNumber}`,import.meta.url));}
 catch(error){restore();throw error;}
 return {document,frames,elements,restore,visible(value){document.hidden=!value;document.dispatchEvent(new Event('visibilitychange'));}};
}

test('a hidden initial load stays truthfully paused after foregrounding until Continue',async()=>{
 const ui=await boot({hidden:true});
 try{
  assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'false');
  assert.match(ui.elements.get('play-status').textContent,/已暂停/);assert.equal(ui.frames.size,0);
  ui.visible(true);assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('play').textContent,'继续');
  ui.elements.get('play').dispatchEvent(new Event('click'));
  assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'true');assert.equal(ui.frames.size,1);
 }finally{ui.restore();}
});
test('hiding a running experiment cancels its frame and foregrounding does not resume',async()=>{
 const ui=await boot();
 try{
  assert.equal(ui.frames.size,1);assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'true');
  ui.visible(false);assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'false');
  ui.visible(true);assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('play').textContent,'继续');
 }finally{ui.restore();}
});
test('reduced motion starts paused even when the document is visible',async()=>{
 const ui=await boot({reducedMotion:true});
 try{assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'false');}
 finally{ui.restore();}
});
