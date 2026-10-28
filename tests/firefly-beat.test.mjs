import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
async function api(){
 const url=new URL('../firefly-beat.mjs',import.meta.url);
 assert.ok(await access(url).then(()=>true,()=>false),'the microscope needs a real lesson model');
 return import(url);
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} must equal ${b}`);
test('neighbors ahead accelerate this same oscillator, behind slow it, and unheard neighbors cannot adjust it',async()=>{
 const {createBeatLesson,guessBeat,runBeat}=await api();
 for(const [scenario,guess,extra]of [['ahead','faster',.03],['behind','slower',-.03],['out','same',0]]){
  const initial=createBeatLesson(scenario),predicted=guessBeat(initial,guess),done=runBeat(predicted),c=done.comparison;
  assert.equal(initial.guess,null);assert.equal(initial.comparison,null);
  assert.equal(c.frames.length,31);assert.equal(c.soloFrames.length,31);
  close(c.frames[1].points[0].phase,Math.PI/96+extra); // own speed + 3/4 × K × sin(±π/2), for 1/60 s
  close(c.soloAdvance,Math.PI*5/16);close(c.frames[30].time,.5);
  assert.equal(c.outcome,guess);assert.equal(c.correct,true);assert.equal(c.neighborCount,scenario==='out'?0:3);
  if(scenario==='ahead')assert.ok(c.difference>.6);
  if(scenario==='behind'){assert.ok(c.difference<-.6);assert.ok(c.actualAdvance>0,'slowing down is still forward, not rewinding');}
  if(scenario==='out')close(c.actualAdvance,c.soloAdvance);
  close(c.difference,c.actualAdvance-c.soloAdvance);
  assert.notEqual(c.frames[30].points[1].phase,c.frames[0].points[1].phase,'neighbors must also run, not act as fixed conductors');
  assert.equal(c.frames[0].settings.coupling,2.4);assert.equal(c.soloFrames[0].settings.coupling,0);
  assert.deepEqual(c.frames[0].points,c.soloFrames[0].points,'control changes coupling only');
  assert.equal(runBeat(done),done,'run cannot duplicate an already sealed comparison');
 }
});
test('guess gates simulation, each case preserves its record, and retry returns to the identical initial situation',async()=>{
 const {createBeatLesson,selectBeatCase,guessBeat,runBeat,retryBeat}=await api();
 const start=createBeatLesson();assert.throws(()=>runBeat(start),/guess/i);
 const first=runBeat(guessBeat(start,'slower'));assert.equal(first.comparison.correct,false);
 const changed=selectBeatCase(first,'behind');assert.equal(changed.comparison,null);assert.equal(changed.guess,null);
 const second=runBeat(guessBeat(changed,'slower'));assert.equal(Object.keys(second.records).length,2);
 const back=selectBeatCase(second,'ahead');assert.deepEqual(back.comparison,first.comparison);
 const retry=retryBeat(back);assert.equal(retry.comparison,null);assert.equal(retry.guess,null);
 assert.equal(Object.keys(retry.records).length,1);assert.equal(Object.keys(second.records).length,2);
 const again=runBeat(guessBeat(retry,'faster'));assert.deepEqual(again.comparison.frames,first.comparison.frames);
 assert.throws(()=>guessBeat(again,'same'),/retry/i);
});
test('evidence has independent frame and control cells, and invalid lesson inputs fail explicitly',async()=>{
 const {createBeatLesson,selectBeatCase,guessBeat,runBeat}=await api();
 const state=runBeat(guessBeat(createBeatLesson(),'faster')),c=state.comparison;
 c.frames[1].points[0].phase=5;
 assert.equal(c.frames[0].points[0].phase,0);assert.equal(c.soloFrames[0].points[0].phase,0);
 assert.notEqual(c.frames[2].points[0].phase,5);
 assert.throws(()=>createBeatLesson('unknown'),/scenario/i);
 assert.throws(()=>selectBeatCase(state,'unknown'),/scenario/i);
 assert.throws(()=>guessBeat(createBeatLesson(),'maybe'),/guess/i);
});
