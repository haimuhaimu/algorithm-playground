import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const rgb=hex=>{const s=hex.replace('#','');return (s.length===3?s.split('').map(c=>c+c).join(''):s).match(/../g).map(c=>parseInt(c,16));};
const luminance=hex=>rgb(hex).map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
async function material(){const m=await import('../home-core.mjs');assert.equal(typeof m.heroMaterial,'function','renderer needs a state-based material palette');return m.heroMaterial;}

test('pink path, current exploration and visited cells remain visually distinct in both themes',async()=>{
 const pick=await material();
 for(const dark of [false,true]){
  const path=pick({path:true},dark),active=pick({active:true,visited:true},dark),visited=pick({visited:true},dark);
  for(const value of [path,active,visited]){const [r,g,b]=rgb(value.top);assert.ok(r>b&&b>g,'hero color should stay in the requested pink family');}
  assert.notEqual(path.top,active.top);assert.notEqual(active.top,visited.top);assert.notEqual(path.top,visited.top);
  assert.ok(luminance(visited.top)>luminance(path.top),'exploration is softer/lighter than the final route');
  assert.ok(contrast('#fff',pick({endpoint:true},dark).top)>=4.5,'small S/G labels remain readable');
 }
});
test('material priority preserves solid walls, endpoints and final path above exploration',async()=>{
 const pick=await material();
 for(const dark of [false,true]){
  assert.deepEqual(pick({wall:true,path:true,active:true,visited:true},dark),pick({wall:true},dark));
  assert.deepEqual(pick({endpoint:true,active:true,visited:true},dark),pick({path:true},dark));
  assert.deepEqual(pick({path:true,active:true,visited:true},dark),pick({path:true},dark));
  assert.deepEqual(pick({active:true,visited:true},dark),pick({active:true},dark));
  const original=pick({path:true},dark);try{original.top='#000000';}catch{}
  assert.notEqual(pick({path:true},dark).top,'#000000','one render cannot mutate later cells');
 }
});
test('homepage gradient text, pink links and all CTA states keep readable contrast in light and dark',async()=>{
 const css=await readFile(new URL('../home.css',import.meta.url),'utf8');
 for(const selector of [':root',':root[data-theme=dark]']){
  const body=css.slice(css.indexOf(selector+'{')+selector.length+1).split('}')[0];
  const token=name=>{const value=body.match(new RegExp('--home-'+name+':(#[0-9a-f]+)'))?.[1];assert.ok(value,'missing semantic token '+name);return value;};
  const background=token('bg');
  assert.ok(contrast(token('accent'),background)>=4.5);
  for(const state of ['action','action-hover','action-pressed'])assert.ok(contrast(token(state),token('on-action'))>=4.5,state);
  for(const name of ['title-start','title-middle','title-end'])assert.ok(contrast(token(name),background)>=3,'large gradient text: '+name);
 }
});
test('forced-color text fallback is later in the cascade than gradient enhancement',async()=>{
 const css=await readFile(new URL('../home.css',import.meta.url),'utf8');
 assert.ok(css.indexOf('@media(forced-colors:active)')>css.indexOf('@supports'),'system text colors must win over transparent gradient text');
});
