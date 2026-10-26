import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const pages=['index','pathfinding','sand','firefly','evolution','neural','mining','pixel','world-model','rsi'];

test('every experiment loads the shared visual system after its lesson styles',async()=>{
 for(const page of pages){
  const html=await readFile(new URL(page+'.html',root),'utf8');
  const sheets=[...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(match=>match[1].split('?')[0]);
  assert.equal(sheets.at(-1),'./space-theme.css',page+' must apply shared presentation last');
  assert.equal(sheets.filter(name=>name==='./space-theme.css').length,1);
 }
});

test('light and dark theme text and actions meet readable contrast on all surfaces',async()=>{
 const css=await readFile(new URL('space-theme.css',root),'utf8');
 const luminance=hex=>{
  const c=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return .2126*c[0]+.7152*c[1]+.0722*c[2];
 };
 const ratio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 for(const selector of [':root',':root[data-theme="dark"]']){
  const block=css.slice(css.indexOf(selector+' {')).split('}')[0];
  const color=name=>luminance(block.match(new RegExp('--'+name+':\\s*#([0-9a-f]{6})'))[1]);
  for(const surface of ['paper','surface','soft'])for(const foreground of ['ink','muted','good']){
   assert.ok(ratio(color(surface),color(foreground))>=4.5,selector+' '+foreground+' on '+surface);
  }
  assert.ok(ratio(color('accent'),color('accent-ink'))>=4.5,selector+' action contrast');
  assert.ok(ratio(color('action'),color('on-action'))>=4.5,selector+' primary action contrast');
  // Page-level rules use the shared tokens; these states previously retained
  // dark literal labels or a pale hover color after changing the global palette.
  for(const [file,rule,fallbackForeground] of [
   ['feedback-story.css','.feedback-mini-card.is-changed .feedback-movement',''],
   ['seat-lesson.css','.seat-lesson .seat-primary',''],
   ['firefly.css','.chorus-transport .primary:hover','var(--on-action)'],
   ['sand.css','.transport .sand-play:hover','var(--on-action)'],
  ]){
   const sheet=await readFile(new URL(file,root),'utf8');
   const declaration=sheet.slice(sheet.indexOf(rule+'{')+rule.length+1).split('}')[0];
   const property=name=>declaration.match(new RegExp('(?:^|;)'+name+':([^;]+)'))?.[1]?.trim();
   const resolve=value=>value.startsWith('var(')?color(value.match(/var\(--([a-z-]+)/)[1]):luminance(value.slice(1));
   assert.ok(ratio(resolve(property('background')),resolve(property('color')||fallbackForeground))>=4.5,selector+' '+rule+' contrast');
  }
 }
});
