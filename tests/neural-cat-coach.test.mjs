import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';

async function coach(){
 const url=new URL('../neural-cat-coach.mjs',import.meta.url);
 await assert.doesNotReject(access(url),'the guided coach must be available');
 return import(url);
}

test('one label changes what the same trainer calls the mistaken comic card',async()=>{
 const {coachBaseline,coachRound}=await coach();
 const before=coachBaseline(),correct=coachRound('chouchou'),flipped=coachRound('bobby');
 assert.equal(before.prediction,'bobby');
 assert.equal(correct.trainingCard.id,'03');
 assert.equal(correct.trainingCard.truth,'chouchou');
 assert.equal(correct.trainingCard.prediction,'chouchou');
 assert.equal(flipped.trainingCard.prediction,'bobby');
 assert.equal(correct.steps,120);
 assert.equal(flipped.steps,120);
 assert.deepEqual(correct.trainingCard.features,[4,2]);
 assert.deepEqual(flipped.trainingCard.features,[4,2]);
 assert.ok(correct.trainingCard.score>.73&&flipped.trainingCard.score<.29);
});

test('continuing the real updates changes the scores but cannot split equal inputs',async()=>{
 const {coachRound}=await coach();
 for(const label of ['bobby','chouchou']){
  const first=coachRound(label),more=coachRound(label,'more');
  assert.equal(more.label,label);
  assert.equal(more.steps,240);
  assert.equal(more.feature,'ears');
  assert.deepEqual(more.test.map(card=>card.features),[[6,6],[6,6]]);
  assert.deepEqual(more.test.map(card=>card.truth),['bobby','chouchou']);
  assert.equal(more.test[0].score,more.test[1].score);
  assert.notEqual(first.test[0].score,more.test[0].score);
  assert.equal(more.matches,1);
 }
});

test('adding fluff keeps both prior inputs and training labels, and fits a genuine third weight',async()=>{
 const {coachRound}=await coach();
 const original=coachRound('chouchou');
 const trial=coachRound('chouchou','fluff');
 assert.equal(trial.steps,original.steps);
 assert.deepEqual(trial.baseline,original.baseline);
 assert.deepEqual(trial.points.map(({id,label,features})=>[id,label,features.slice(0,2)]),
  original.points.map(({id,label,features})=>[id,label,features]));
 assert.deepEqual(trial.points.map(p=>p.features[2]),[2,10,8,3,2,9]);
 assert.deepEqual(trial.points.map(p=>p.before),original.points.map(p=>p.before));
 assert.equal(trial.model.weights.length,4,'one coefficient per feature plus a bias');
 const weights=[1.4059195027913778,-1.6995840961488136,1.9457986145934074,-.19007941789523503];
 trial.model.weights.forEach((w,i)=>assert.ok(Math.abs(w-weights[i])<1e-12));
 assert.equal(trial.feature,'fluff');
 assert.deepEqual(trial.test.map(card=>card.id),['07','08']);
 assert.deepEqual(trial.test.map(card=>card.features),[[6,6,2],[6,6,9]]);
 assert.deepEqual(trial.test.map(card=>card.prediction),['bobby','chouchou']);
 // Independently calculated full-batch logistic updates from weights [1,0,0,0].
 assert.ok(Math.abs(trial.test[0].score-.195243616955428)<1e-12);
 assert.ok(Math.abs(trial.test[1].score-.787149232630304)<1e-12);
 assert.equal(trial.matches,2);
});

test('different feature inputs are not a promise of different final classes',async()=>{
 const {coachRound}=await coach();
 const trial=coachRound('bobby','fluff',6);
 assert.equal(trial.trainingCard.prediction,'bobby','the six-card branch still uses the deliberately reversed label');
 assert.notEqual(trial.test[0].score,trial.test[1].score);
 assert.deepEqual(trial.test.map(card=>card.prediction),['bobby','bobby']);
 assert.equal(trial.matches,1);
});

test('unknown variants or labels cannot be mistaken for a valid controlled trial',async()=>{
 const {coachRound}=await coach();
 assert.throws(()=>coachRound('heim'),RangeError);
 assert.throws(()=>coachRound('bobby','unlimited'),RangeError);
 assert.throws(()=>coachRound('bobby','first',12),RangeError);
});

test('18 original cards are independent training points, and the 6-card comparison keeps every shared point fixed',async()=>{
 const {coachRound}=await coach();
 const short=coachRound('chouchou','first',6),full=coachRound('chouchou','first',18);
 assert.deepEqual([short.size,full.size,short.steps,full.steps],[6,18,120,120]);
 assert.deepEqual(full.baseline,short.baseline);
 assert.deepEqual(full.points.slice(0,6).map(p=>p.features),short.points.map(p=>p.features));
 assert.equal(new Set(full.points.map(p=>p.id)).size,18);
 assert.equal(new Set(full.points.map(p=>p.image)).size,18);
 assert.equal(full.points.filter(p=>p.truth==='bobby').length,9);
 assert.equal(full.points.filter(p=>p.truth==='chouchou').length,9);
 assert.deepEqual(full.test.map(p=>p.id),['07','08']);
 assert.ok(full.points.every(p=>!['07','08'].includes(p.id)));
 assert.deepEqual([full.beforeMatches,full.trainingMatches],[13,17]);
 assert.notDeepEqual(full.model.weights,short.model.weights);
 assert.deepEqual(full.points.filter(p=>p.label!==p.prediction).map(p=>p.id),['17']);
});

test('the larger group still reacts to the single tag and preserves both causal held-out interventions',async()=>{
 const {coachRound}=await coach();
 const a=coachRound('chouchou','first',18),b=coachRound('bobby','first',18);
 assert.equal(a.trainingCard.prediction,'chouchou');
 assert.equal(b.trainingCard.prediction,'bobby');
 assert.deepEqual(a.points.filter((p,i)=>p.label!==b.points[i].label).map(p=>p.id),['03']);
 for(const label of ['bobby','chouchou']){
  const more=coachRound(label,'more',18),fluff=coachRound(label,'fluff',18);
  assert.deepEqual([more.steps,fluff.steps],[240,120]);
  assert.equal(more.test[0].score,more.test[1].score);
  assert.deepEqual(fluff.test.map(card=>card.features),[[6,6,2],[6,6,9]]);
  assert.deepEqual(fluff.points.map(p=>[p.id,p.label,p.features.slice(0,2)]),more.points.map(p=>[p.id,p.label,p.features]));
  assert.deepEqual(fluff.test.map(p=>p.prediction),['bobby','chouchou']);
  assert.equal(fluff.matches,2);
 }
});
