import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeneralizationLesson,trainGeneralization,revealGeneralization,setGeneralizationView} from '../neural-generalization.mjs';
const api=await import('../neural-generalization-view.mjs').catch(()=>({}));
function record(s,options={}){
 assert.equal(typeof api.paintGeneralization,'function','held-out view must exist');
 const words=[],strokes=[];let path=[];
 const ctx=new Proxy({fillText:t=>words.push(t),beginPath:()=>{path=[];},moveTo:(...p)=>path.push(p),lineTo:(...p)=>path.push(p),stroke:()=>{if(ctx.lineWidth===4&&path.length===2)strokes.push(path);}},{get:(o,k)=>o[k]??(()=>{})});
 api.paintGeneralization({width:800,height:600,getContext:()=>ctx},s,options);return {words,strokes};
}
test('test positions are concealed until reveal while the same real decision line remains fixed',()=>{
 const s=createGeneralizationLesson();assert.equal(record(s).words.includes('4'),false);trainGeneralization(s);
 const frozen=record(s);revealGeneralization(s,'all');const shown=record(s,{showRule:true});
 assert.ok(shown.words.includes('4'));assert.ok(shown.words.includes('14'));assert.equal(shown.words.filter(t=>/^\d+$/.test(t)).length,16);
 assert.deepEqual(shown.strokes,frozen.strokes,'revealing points does not redraw a different model boundary');
 setGeneralizationView(s,'training');assert.equal(record(s).words.includes('4'),false);
});
test('new-point hit testing uses displayed canvas geometry and cannot target unrevealed or hidden points',()=>{
 assert.equal(typeof api.hitGeneralizationPoint,'function','visible point geometry must exist');
 const s=createGeneralizationLesson(),canvas={width:800,height:600,getBoundingClientRect:()=>({left:10,top:20,width:400,height:300})};
 const point1={clientX:78,clientY:277.1}; // (136,514.2) internal /2 plus origin.
 assert.equal(api.hitGeneralizationPoint(canvas,point1,s),null);trainGeneralization(s);revealGeneralization(s,'all');
 assert.equal(api.hitGeneralizationPoint(canvas,point1,s),0);assert.equal(api.hitGeneralizationPoint(canvas,{clientX:-1,clientY:20},s),null);
 setGeneralizationView(s,'training');assert.equal(api.hitGeneralizationPoint(canvas,point1,s),null);
});
