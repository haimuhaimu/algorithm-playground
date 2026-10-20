import test from 'node:test';
import assert from 'node:assert/strict';
import * as lesson from '../firefly-core.mjs';

// These assertions catch conflating local and global order, changing anything
// besides radius, aliased evidence, and declaring success from a lucky frame.
test('two aligned but opposite groups are locally ordered without global order',()=>{
 assert.equal(typeof lesson.measureGroups,'function');
 const world={preset:'islands',time:0,settings:{radius:.32,coupling:2.4,spread:.6},points:[
  {x:.2,y:.4,phase:0},{x:.2,y:.6,phase:0},
  {x:.8,y:.4,phase:Math.PI},{x:.8,y:.6,phase:Math.PI}]};
 const m=lesson.measureGroups(world);
 assert.ok(m.left>.999&&m.right>.999);assert.ok(m.whole<1e-10);
 assert.equal(Math.round(m.gap),180);assert.equal(m.links,0);
 assert.equal(lesson.measureGroups({...world,preset:'chorus'}),null);
 const mixed=lesson.measureGroups({...world,points:world.points.map((p,i)=>({...p,phase:i%2*Math.PI}))});
 assert.equal(mixed.gap,null,'no meaningful mean phase for an internally scattered group');
});

test('a listening trial observes real dynamics and freezes a low-global, high-local baseline',()=>{
 assert.equal(typeof lesson.createListening,'function');
 const initial=lesson.createListening(),before=lesson.advanceListening(initial,900);
 assert.equal(initial.stage,'observing');assert.equal(initial.world.time,0);
 assert.equal(before.stage,'before');assert.ok(Math.abs(before.world.time-15)<1e-8);
 assert.ok(before.before.metrics.left>.99&&before.before.metrics.right>.99);
 assert.ok(before.before.metrics.whole<.25);assert.equal(before.before.metrics.links,0);
 assert.ok(before.before.range.max-before.before.range.min>.5);
 assert.equal(before.after,null);assert.equal(lesson.advanceListening(before,60),before);
});

test('changing hearing range preserves the same oscillators and produces stable measured improvement',()=>{
 assert.equal(typeof lesson.chooseListening,'function');
 const before=lesson.advanceListening(lesson.createListening(),900),saved=structuredClone(before.before);
 const chosen=lesson.chooseListening(before,'wide');
 assert.deepEqual(chosen.world.points,before.world.points);assert.equal(chosen.world.time,before.world.time);
 assert.deepEqual(chosen.world.settings,{...before.world.settings,radius:2});
 const done=lesson.advanceListening(chosen,600);
 assert.equal(done.stage,'after');assert.ok(done.after.metrics.whole>.95);
 assert.ok(done.after.range.max-done.after.range.min<.01);assert.ok(done.after.metrics.links>0);
 assert.deepEqual(done.before,saved);assert.deepEqual(before.before,saved);
 assert.notEqual(done.before.world.points,done.world.points);
 done.world.points[0].phase=99;assert.notEqual(done.before.world.points[0].phase,99);
 assert.notEqual(done.after.world.points[0].phase,99);
});

test('leaving groups disconnected can produce a high instant score but must not count as stable shared rhythm',()=>{
 assert.equal(typeof lesson.listeningOutcome,'function');
 const baseline=lesson.advanceListening(lesson.createListening(),900);
 const done=lesson.advanceListening(lesson.chooseListening(baseline,'near'),600);
 assert.ok(done.after.metrics.whole>.9,'the misleading instant is deliberately exercised');
 assert.ok(done.after.range.max-done.after.range.min>.4);assert.equal(done.after.metrics.links,0);
 assert.equal(lesson.listeningOutcome(done),'separate');
 const joined=lesson.advanceListening(lesson.chooseListening(done,'wide'),600);
 assert.equal(lesson.listeningOutcome(joined),'joined');
 assert.deepEqual(joined.before,baseline.before,'retry reuses the same baseline, not the latest end state');
});

test('judgment is gated by actual comparison and retry clears the old answer',()=>{
 assert.equal(typeof lesson.answerListening,'function');
 const initial=lesson.createListening();
 assert.throws(()=>lesson.chooseListening(initial,'wide'));
 assert.throws(()=>lesson.answerListening(initial,'separate'));
 const before=lesson.advanceListening(initial,900);
 assert.throws(()=>lesson.chooseListening(before,'missing'));
 const done=lesson.advanceListening(lesson.chooseListening(before,'wide'),600);
 const wrong=lesson.answerListening(done,'chaotic');assert.equal(wrong.answer.correct,false);
 const right=lesson.answerListening(wrong,'separate');assert.equal(right.answer.correct,true);
 assert.equal(lesson.chooseListening(right,'near').answer,null);
 assert.throws(()=>lesson.answerListening(done,'invalid'));
 assert.throws(()=>lesson.advanceListening(initial,-1));
 assert.throws(()=>lesson.advanceListening(initial,Infinity));
});
