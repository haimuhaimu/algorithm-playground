import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuide,teachGuide,openGuideTest} from '../neural-guide.mjs';
import {paintGuide} from '../neural-guide-view.mjs';
function paint(s,options){
 const words=[],dashes=[],arcs=[];const ctx=new Proxy({fillText:text=>words.push(text),setLineDash:value=>dashes.push(value),arc:(...args)=>arcs.push(args)},{get:(o,k)=>o[k]??(()=>{})});
 paintGuide({width:800,height:480,getContext:()=>ctx},s,options);return {words,dashes,arcs};
}
test('map labels the actual two prediction regions and marks only genuinely misclassified examples',()=>{
 const s=createGuide(),a=paint(s);assert.equal(a.words.filter(t=>t==='错').length,2);assert.ok(a.words.includes('圆区'));assert.ok(a.words.includes('方区'));
 teachGuide(s);const b=paint(s);assert.equal(b.words.filter(t=>t==='错').length,0);
 assert.ok(b.dashes.some(d=>d.length),'trained view retains the real original line as a dashed comparison');
 assert.equal(paint(s,{before:true}).words.filter(t=>t==='错').length,2);
});
test('new-position exercise lets the player apply the learned line rather than hiding the learned rule',()=>{
 const s=createGuide();teachGuide(s);const before=paint(s);openGuideTest(s);const a=paint(s);
 assert.ok(a.words.includes('圆区'));assert.ok(a.words.includes('方区'));assert.ok(a.words.includes('?'));
 assert.equal(a.arcs.length,before.arcs.length,'the unlabelled question point must not look like an already-labelled circle example');
});
test('painted boundaries follow the actual rule through rotation, including a vertical or horizontal line',()=>{
 function endpoints(s){
  let path=[];const lines=[];const ctx=new Proxy({beginPath:()=>{path=[];},moveTo:(x,y)=>path.push([x,y]),lineTo:(x,y)=>path.push([x,y]),stroke:()=>{if(ctx.lineWidth===4)lines.push(path);}},{get:(o,k)=>o[k]??(()=>{})});
  paintGuide({width:800,height:480,getContext:()=>ctx},s);assert.equal(lines.length,1);return lines[0];
 }
 const s=createGuide();
 for(let step=0;step<=120;step++){
  const line=endpoints(s),[a,b,c]=s.model.weights;assert.equal(line.length,2);
  for(const [px,py]of line){assert.ok(px>=0&&px<=800&&py>=0&&py<=480);assert.ok(Math.abs(a*(px/400-1)+b*(1-py/240)+c)<1e-8);}
  assert.ok(Math.hypot(line[0][0]-line[1][0],line[0][1]-line[1][1])>450,'the separator cannot collapse to a dot');
  if(step<120)teachGuide(s,1);
 }
 const vertical=createGuide();vertical.model.weights=[1,0,0];assert.deepEqual(endpoints(vertical).sort((a,b)=>a[1]-b[1]),[[400,0],[400,480]]);
 const horizontal=createGuide();horizontal.model.weights=[0,1,0];assert.deepEqual(endpoints(horizontal).sort((a,b)=>a[0]-b[0]),[[0,240],[800,240]]);
});
