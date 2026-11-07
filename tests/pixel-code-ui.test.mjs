import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {preset} from '../pixel-core.mjs';
async function boot(){
 const html=await readFile(new URL('../pixel.html',import.meta.url),'utf8');
 class El extends EventTarget{
  constructor(){super();this.hidden=false;this.disabled=false;this.dataset={};this.attrs={};this.innerHTML='';this.textContent='';}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}
  focus(){doc.activeElement=this;}scrollIntoView(){doc.scrollTarget=this;}
 }
 const els=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new El()]));
 const doc={getElementById:id=>els.get(id)};let pixels=preset('cat'),enabled=true,cancels=0;
 assert.ok(els.has('code-start'),'postcard needs a real code-allocation entry');
 const {setupCodeLesson}=await import('../pixel-code-ui.mjs');
 const mounted=setupCodeLesson({document:doc,getPixels:()=>pixels,available:()=>enabled,cancelStroke:()=>cancels++});
 return {els,doc,click(id){const e=els.get('code-'+id);if(!e.disabled)e.dispatchEvent(new Event('click'));},
  setPixels(value){pixels=value;mounted.refresh();},block(){enabled=false;},cancels:()=>cancels};
}
test('two real group selections gate a merge, hint never merges, and undo restores the user choices',async()=>{
 const u=await boot(),e=id=>u.els.get('code-'+id);
 assert.equal(e('lab').hidden,true);u.click('start');assert.equal(e('lab').hidden,false);
 assert.equal(u.cancels(),1);assert.equal(e('merge').disabled,true);
 u.click('hint');assert.match(e('hint-copy').textContent,/18.*37/);assert.match(e('progress').textContent,/0.*3/);
 u.click('group-0');assert.equal(e('merge').disabled,true);u.click('group-3');assert.equal(e('merge').disabled,false);
 assert.match(e('selection').textContent,/201/);u.click('merge');assert.match(e('progress').textContent,/1.*3/);
 assert.match(e('last-copy').textContent,/201/);assert.match(e('codes').innerHTML,/米白/);
 u.click('undo');assert.match(e('progress').textContent,/0.*3/);assert.equal(e('group-3').hidden,false);
 assert.equal(e('merge').disabled,true);assert.equal(e('undo').disabled,true);
});
test('a worse but valid tree reaches real packet comparison, and retry does not replace the sealed picture',async()=>{
 const u=await boot(),e=id=>u.els.get('code-'+id);u.click('start');
 for(const slots of [[0,3],[0,1],[0,1]]){for(const i of slots)u.click('group-'+i);u.click('merge');}
 assert.equal(e('result').hidden,false);assert.match(e('user-cost').textContent,/66 B/);
 assert.match(e('huffman-cost').textContent,/54 B/);assert.match(e('integrity').textContent,/256.*256/);
 assert.match(e('difference').textContent,/99.*12/);assert.match(e('comparison').innerHTML,/154/);
 u.click('huffman-open');assert.match(e('huffman-step').textContent,/18.*37.*55/);
 u.click('huffman-next');assert.match(e('huffman-step').textContent,/47.*55.*102/);
 u.click('huffman-next');assert.match(e('huffman-step').textContent,/102.*154.*256/);
 u.click('answer-loss');assert.match(e('takeaway').textContent,/没删/);u.click('answer-code');assert.match(e('takeaway').textContent,/重复/);
 assert.ok(e('result-undo'),'finished result must allow returning to the same last merge');
 assert.equal(e('result-undo').hidden,false);u.click('result-undo');assert.equal(e('result').hidden,true);
 assert.match(e('progress').textContent,/2.*3/);u.click('group-0');u.click('group-1');u.click('merge');
 u.setPixels(preset('noise'));assert.match(e('snapshot').textContent,/画纸已改/);assert.match(e('user-cost').textContent,/66 B/);
 u.click('retry');assert.equal(e('result').hidden,true);assert.match(e('snapshot').textContent,/画纸已改/);
 u.click('current');assert.doesNotMatch(e('snapshot').textContent,/画纸已改/);
});
test('unavailable page cannot alter choices; one color completes honestly without hidden fake choices',async()=>{
 const u=await boot(),e=id=>u.els.get('code-'+id);u.setPixels(preset('blank'));u.click('start');
 assert.equal(e('build').hidden,true);assert.equal(e('result').hidden,false);assert.match(e('user-cost').textContent,/33 B/);
 assert.match(e('difference').textContent,/一种颜色.*1 bit/);u.click('huffman-open');assert.match(e('huffman-step').textContent,/不需要合并/);
 u.block();u.setPixels(preset('cat'));u.click('current');assert.match(e('user-cost').textContent,/33 B/);
});
