import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidualLesson,residualEvidence,setResidualShortcut} from '../neural-residual.mjs';
const api=await import('../neural-residual-view.mjs').catch(()=>({}));
function canvas(){const words=[],arcs=[];const ctx=new Proxy({fillText:t=>words.push(t),arc:(...v)=>arcs.push(v)},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});return {width:800,height:400,getContext:()=>ctx,words,arcs};}
test('signal renderer places actual zero or carried output while the input and origin remain fixed',()=>{
 assert.equal(typeof api.paintResidualSignal,'function','signal renderer must exist');
 const s=createResidualLesson(),a=canvas();api.paintResidualSignal(a,residualEvidence(s));
 setResidualShortcut(s,true);const b=canvas();api.paintResidualSignal(b,residualEvidence(s));
 assert.deepEqual(a.arcs[0],b.arcs[0],'same input signal must stay put');assert.notDeepEqual(a.arcs.at(-1),b.arcs.at(-1),'actual output follows the shortcut');
 assert.ok(a.words.includes('输入信号'));assert.ok(b.words.includes('输入 = 输出'));
});
test('classification rendering uses real predictions at fixed original coordinates, not moved samples',()=>{
 assert.equal(typeof api.paintResidualField,'function');const s=createResidualLesson(),a=canvas(),b=canvas();
 api.paintResidualField(a,s.models.plain,s.points);api.paintResidualField(b,s.models.residual,s.points);
 assert.deepEqual(a.arcs,b.arcs,'sample positions remain identical across architecture views');
 assert.ok(a.words.includes('原始样本位置不动'));
});
