import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Actual controller/model, with only canvas and browser scheduling represented.
test('near-canvas brush hint follows material, radius, keyboard and pause without painting',async()=>{
 const html=await readFile(new URL('../sand.html',import.meta.url),'utf8');
 const context=new Proxy({},{get:(object,key)=>object[key]??(()=>{})});
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.width=864;this.height=576;this.value='2';this.attributes=new Map();}
  set textContent(value){this.text=value;this.textUpdates=(this.textUpdates||0)+1;}
  get textContent(){return this.text;}
  getContext(){return context;}setAttribute(k,v){this.attributes.set(k,v);}
  getBoundingClientRect(){return {left:0,top:0,width:864,height:576};}
 }
 const els=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 const materials=[1,2,3,0].map(material=>Object.assign(new Element(),{dataset:{material:String(material)}}));
 const scenes=['splitter','hourglass','empty'].map(scene=>Object.assign(new Element(),{dataset:{scene}}));
 const stage=new Element();
 const doc=Object.assign(new EventTarget(),{hidden:false,documentElement:new Element(),getElementById:id=>els.get(id),querySelector:()=>stage,querySelectorAll:s=>s==='[data-material]'?materials:scenes});
 const globals={document:doc,window:new EventTarget(),matchMedia:q=>Object.assign(new EventTarget(),{matches:q.includes('reduced-motion')}),requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));Object.assign(globalThis,globals);
 try{
  await import('../sand.mjs?brush-hint-test');
  const counts=()=>['sand','water','wall'].map(k=>els.get(k+'-count').textContent);
  const before=counts();
  assert.match(els.get('brush-preview')?.textContent||'',/沙子.*中/);
  materials[1].dispatchEvent(new Event('click'));
  assert.match(els.get('brush-preview').textContent,/水.*中/);
  els.get('brush').value='4';els.get('brush').dispatchEvent(new Event('input'));
  assert.match(els.get('brush-preview').textContent,/水.*很大/);
  els.get('sandbox').dispatchEvent(Object.assign(new Event('keydown'),{key:'4'}));
  assert.match(els.get('brush-preview').textContent,/橡皮.*很大/);
  els.get('play').dispatchEvent(new Event('click'));els.get('play').dispatchEvent(new Event('click'));
  assert.match(els.get('brush-preview').textContent,/橡皮.*很大/);
  assert.deepEqual(counts(),before,'tool selection must not alter the scene');
  const announcements=els.get('brush-preview').textUpdates;
  els.get('step').dispatchEvent(new Event('click'));els.get('step').dispatchEvent(new Event('click'));
  assert.equal(els.get('brush-preview').textUpdates,announcements,'simulation redraws must not repeat the live brush announcement');
 }finally{for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});
