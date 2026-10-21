import test from 'node:test';
import assert from 'node:assert/strict';
const lesson=await import('../sand-lesson.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const create=()=>{assert.equal(typeof lesson.createSandLesson,'function');return lesson.createSandLesson();};
const run=(s,guess)=>lesson.runSandLesson(lesson.predictSandLesson(s,guess));

test('a first prediction records a real result, and repeated runs do not advance the grain',()=>{
 const start=create();assert.throws(()=>lesson.runSandLesson(start),/prediction/i);
 const first=run(start,'down');
 assert.equal(first.baseline.decision.outcome,'left');
 assert.equal(first.baseline.correct,false);assert.equal(first.baseline.guess,'down');
 assert.equal(first.baseline.after.tick,1);assert.equal(first.before.tick,0);
 assert.deepEqual(lesson.runSandLesson(first),first);
 assert.equal(start.baseline,null);
});
test('one edited wall changes the result while preserving the first snapshot and tick',()=>{
 const first=run(create(),'left'),saved=structuredClone(first.baseline);
 const edited=lesson.editSandLesson(first,{x:2,y:2});
 assert.equal(edited.prediction,null);assert.equal(edited.current,null);
 const changed=run(edited,'down');
 assert.equal(changed.current.decision.outcome,'down');assert.equal(changed.current.correct,true);
 assert.deepEqual(changed.baseline,saved);assert.equal(changed.current.before.tick,0);
 assert.equal([...changed.current.before.cells].filter((c,i)=>c!==saved.before.cells[i]).length,1);
 assert.equal(lesson.summarizeSandLesson(changed).changed,true);
});
test('selecting another wall replaces the edit instead of accumulating changes; same-result edits are honest',()=>{
 const first=run(create(),'left');
 let edited=lesson.editSandLesson(first,{x:2,y:2});
 edited=lesson.editSandLesson(edited,{x:1,y:1});
 assert.equal(edited.before.cells[12],3,'previously removed wall is restored');
 assert.equal([...edited.before.cells].filter((c,i)=>c!==first.before.cells[i]).length,1);
 const result=run(edited,'stay');
 assert.equal(result.current.decision.outcome,'stay');
 // This right-hand landing cell is never reached: the right side wall rejects the turn first.
 const unchanged=run(lesson.editSandLesson(result,{x:3,y:2}),'left');
 assert.equal(unchanged.current.decision.outcome,'left');
 assert.equal(lesson.summarizeSandLesson(unchanged).changed,false);
 assert.equal(unchanged.baseline.decision.outcome,'left');
});
test('editing is gated, limited to nearby walls, invalidates guesses/results, and can restore the original',()=>{
 const start=create();assert.throws(()=>lesson.editSandLesson(start,{x:2,y:2}),/first/i);
 const first=run(start,'left');
 for(const point of [{x:2,y:1},{x:0,y:0},{x:9,y:9}])assert.throws(()=>lesson.editSandLesson(first,point),/editable/i);
 assert.throws(()=>lesson.predictSandLesson(first,'teleport'),/prediction/i);
 const changed=run(lesson.editSandLesson(first,{x:2,y:2}),'down');
 const restored=lesson.editSandLesson(changed,{x:2,y:2});
 assert.deepEqual(restored.before.cells,first.before.cells);assert.equal(restored.edit,null);
 assert.equal(restored.current,null);assert.equal(restored.prediction,null);
 assert.throws(()=>lesson.runSandLesson(restored),/prediction/i);
 assert.equal(create().baseline,null);
});
