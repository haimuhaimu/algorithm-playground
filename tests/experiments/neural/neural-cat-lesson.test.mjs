import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {createModel,train} from '../../../dist/neural-core.mjs';

async function lesson(){
 const url=new URL('../../../dist/neural-cat-lesson.mjs',import.meta.url);
 await assert.doesNotReject(access(url),'the isolated cat lesson must be available');
 return import(url);
}
const answers=['bobby','chouchou','chouchou','bobby','bobby','chouchou'];
const opposite=label=>label==='bobby'?'chouchou':'bobby';
function labelRound(api,state,tags=answers){
 api.CAT_TRAIN.forEach((sample,i)=>assert.equal(api.labelCat(state,sample.id,tags[i]),true));
}

test('only six playable training cards can be labeled; missing or one-class tags cannot train',async()=>{
 const a=await lesson(),s=a.makeCatLesson();
 assert.equal(a.labelCat(s,'07','bobby'),false);
 assert.equal(a.labelCat(s,'01','heim'),false);
 assert.equal(a.guessCatTraining(s,'moves'),false);
 assert.equal(a.trainCats(s),null);
 labelRound(a,s,Array(6).fill('bobby'));
 assert.equal(a.guessCatTraining(s,'moves'),false);
 assert.equal(a.trainCats(s),null);
 assert.equal(a.labelCat(s,'02','chouchou'),true);
 assert.equal(a.trainCats(s),null,'a prediction must precede training');
});

test('the same six feature coordinates learn from the player’s labels and compare two actual models',async()=>{
 const a=await lesson(),s=a.makeCatLesson();
 const initial=structuredClone(a.CAT_TRAIN.map(sample=>sample.features));
 labelRound(a,s);
 assert.equal(a.guessCatTraining(s,'moves'),true);
 const r=a.trainCats(s);
 const expected=createModel('linear');
 expected.weights=[1,0,0];
 train(expected,[
  {x:-.6,y:.8,label:0},{x:.8,y:-.6,label:1},{x:-.2,y:-.6,label:1},
  {x:.2,y:.6,label:0},{x:-.2,y:.4,label:0},{x:.6,y:-.2,label:1}
 ],.15,120);
 assert.deepEqual(r.after,expected,'use the same gradient updates as the existing trainer');
 assert.deepEqual(r.before.weights,[1,0,0]);
 assert.deepEqual(a.CAT_TRAIN.map(sample=>sample.features),initial);
 assert.deepEqual([r.correctBefore,r.correctAfter,r.changed,r.steps],[4,6,2,120]);
 assert.ok(r.lossAfter<r.lossBefore);
 assert.deepEqual(r.rows.filter(row=>row.before!==row.after).map(row=>row.id),['03','04']);
 assert.equal(a.trainCats(s),r,'an already trained result is not trained again');
});

test('swapping all labels swaps the learned assignments; the true identities are only comparison evidence',async()=>{
 const a=await lesson(),s=a.makeCatLesson();
 const reversed=answers.map(opposite);
 labelRound(a,s,reversed);
 assert.equal(a.guessCatTraining(s,'stays'),true);
 const result=a.trainCats(s);
 assert.deepEqual(result.rows.map(row=>row.after),reversed);
 assert.deepEqual(result.rows.map(row=>row.truth),answers);
 assert.equal(result.correctAfter,6,'score against what the player supplied, not hidden labels');
});

test('the two held-out cards reveal only after a guess and have identical predictions without any more training',async()=>{
 const a=await lesson(),s=a.makeCatLesson();
 assert.equal(a.guessCatTest(s,'different'),false);
 labelRound(a,s);
 a.guessCatTraining(s,'moves');
 const result=a.trainCats(s),fixed=structuredClone(result.after);
 assert.equal(a.catTestEvidence(s),null);
 assert.equal(a.guessCatTest(s,'different'),true);
 const pair=a.catTestEvidence(s);
 assert.deepEqual(pair.map(row=>row.truth),['bobby','chouchou']);
 assert.equal(pair[0].score,pair[1].score);
 assert.equal(pair[0].prediction,'bobby');
 assert.equal(pair[0].prediction,pair[1].prediction);
 assert.notEqual(a.CAT_TEST[0].image,a.CAT_TEST[1].image);
 assert.deepEqual(a.CAT_TEST[0].features,a.CAT_TEST[1].features);
 assert.deepEqual(s.result.after,fixed);
 assert.equal(a.guessCatTest(s,'same'),false,'do not silently overwrite the player’s initial guess');
});

test('changing a tag invalidates only this round’s results and guesses, allowing a fair retry',async()=>{
 const a=await lesson(),s=a.makeCatLesson();
 labelRound(a,s);
 a.guessCatTraining(s,'moves');
 const first=a.trainCats(s);
 a.guessCatTest(s,'same');
 assert.equal(a.labelCat(s,'01','bobby'),false);
 assert.equal(s.result,first,'same label is a no-op');
 assert.equal(a.labelCat(s,'01','chouchou'),true);
 assert.deepEqual([s.guess,s.result,s.testGuess,s.revealed],[null,null,null,false]);
 assert.equal(s.labels['02'],'chouchou');
 assert.equal(a.catTestEvidence(s),null);
 a.guessCatTraining(s,'moves');
 assert.notDeepEqual(a.trainCats(s).after,first.after);
 assert.deepEqual(a.makeCatLesson().labels,{});
});
