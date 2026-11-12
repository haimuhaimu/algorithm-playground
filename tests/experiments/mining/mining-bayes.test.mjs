import test from 'node:test';
import assert from 'node:assert/strict';
import {
  posterior, betaCDF, betaPDF, betaQuantile,
  createBayesLesson, actBayesLesson, bayesLessonEvidence,
} from '../../../dist/mining-bayes.mjs';

function near(actual, expected, tolerance = 1e-11) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
}
function advance(actions) {
  return actions.reduce((state, action) => actBayesLesson(state, action), createBayesLesson());
}
const compared = () => advance([{type:'guess',value:'same'}, {type:'reveal'}]);
const updated = () => actBayesLesson(actBayesLesson(compared(), {type:'change-guess',value:'little'}), {type:'update'});

test('uniform prior has exact moments, density, CDF, and a 90% equal-tail interval', () => {
  const p = posterior(0, 0);
  assert.equal(p.sampleRate, null);
  assert.equal(p.total, 0);
  assert.equal(p.alpha, 1);
  assert.equal(p.beta, 1);
  assert.equal(p.mean, .5);
  near(p.variance, 1 / 12);
  assert.equal(p.credibleMass, .9);
  near(betaCDF(.3, 1, 1), .3);
  near(p.interval[0], .05);
  near(p.interval[1], .95);
  assert.equal(betaPDF(0, 1, 1), 1);
  assert.equal(betaPDF(.3, 1, 1), 1);
  assert.equal(betaPDF(1, 1, 1), 1);
});

test('integer Beta CDF agrees with a hand-computed polynomial fixture', () => {
  near(betaCDF(.5, 4, 3), .34375);
  near(betaPDF(.5, 4, 3), 1.875);
  near(betaCDF(.5, 3, 4), .65625);
});

test('Beta boundaries and quantile endpoints are explicit', () => {
  for (const [a,b] of [[1,1],[1,201],[201,1],[100,102],[4,3]]) {
    assert.equal(betaCDF(0,a,b), 0);
    assert.equal(betaCDF(1,a,b), 1);
    assert.equal(betaQuantile(0,a,b), 0);
    assert.equal(betaQuantile(1,a,b), 1);
    assert.equal(betaPDF(0,a,b), a === 1 ? b : 0);
    assert.equal(betaPDF(1,a,b), b === 1 ? a : 0);
  }
});

test('zero-success quantiles match the closed-form Beta(1,b) solution', () => {
  for (const b of [2,11,201]) {
    for (const q of [.00001,.05,.5,.95,.99999]) {
      const expected = -Math.expm1(Math.log1p(-q) / b);
      near(betaQuantile(q,1,b), expected, 2e-12);
      near(betaCDF(expected,1,b), q, 2e-12);
    }
  }
});

test('quantiles invert the CDF at balanced and highly skewed allowed boundaries', () => {
  for (const [a,b] of [[4,3],[19,13],[19,14],[101,101],[200,2],[2,200]]) {
    let previous = 0;
    for (const q of [.001,.05,.25,.5,.75,.95,.999]) {
      const x = betaQuantile(q,a,b);
      assert.ok(x > previous && x < 1);
      near(betaCDF(x,a,b), q, 2e-11);
      previous = x;
    }
  }
});

test('tiny quantile probabilities are not replaced by a fixed absolute bisection floor', () => {
  const q=1e-40;
  for (const [a,b] of [[1,1],[1,201],[4,3]]) {
    const x=betaQuantile(q,a,b);
    assert.ok(x > 0);
    near(betaCDF(x,a,b)/q,1,1e-10);
  }
});

test('the same sample rate has different posterior spread and different mean drops after failure', () => {
  const little = posterior(3,2), many = posterior(18,12);
  const littleAfter = posterior(3,3), manyAfter = posterior(18,13);
  assert.equal(little.sampleRate,.6);
  assert.equal(many.sampleRate,.6);
  assert.equal(little.mean,4/7);
  assert.equal(many.mean,19/32);
  assert.equal(littleAfter.mean,1/2);
  assert.equal(manyAfter.mean,19/33);
  near(little.mean-littleAfter.mean,1/14);
  near(many.mean-manyAfter.mean,19/1056);
  assert.ok(little.mean-littleAfter.mean > many.mean-manyAfter.mean);
  assert.ok(little.variance > many.variance);
  assert.ok(little.interval[1]-little.interval[0] > many.interval[1]-many.interval[0]);
});

test('posterior curves have 201 finite density samples and unit integrated mass', () => {
  for (const [s,f] of [[0,0],[3,2],[18,12],[3,3],[18,13],[0,1],[0,10],[200,0],[0,200],[100,100]]) {
    const p = posterior(s,f);
    assert.equal(p.curve.length,201);
    p.curve.forEach((point,i) => {
      assert.equal(point.x,i/200);
      assert.ok(Number.isFinite(point.y) && point.y >= 0);
    });
    near(betaCDF(p.interval[0],p.alpha,p.beta), .05, 2e-11);
    near(betaCDF(p.interval[1],p.alpha,p.beta), .95, 2e-11);
    // Finer independent trapezoidal integration avoids coarse endpoint error
    // for the deliberately allowed 201x boundary densities.
    const steps = 10000;
    let area = (betaPDF(0,p.alpha,p.beta)+betaPDF(1,p.alpha,p.beta))/2;
    for (let i=1;i<steps;i++) area += betaPDF(i/steps,p.alpha,p.beta);
    near(area/steps,1,.00004);
  }
});

test('baseline and updated density peaks fit scale 6, while transfer density is never clamped', () => {
  for (const [s,f] of [[3,2],[18,12],[3,3],[18,13]]) {
    const p=posterior(s,f);
    const mode=(p.alpha-1)/(p.alpha+p.beta-2);
    assert.ok(betaPDF(mode,p.alpha,p.beta)<6);
    assert.ok(p.curve.every(point=>point.y<6));
  }
  assert.equal(posterior(0,10).curve[0].y,11);
});

test('CDF is monotone and respects reflection without instability at tiny tails', () => {
  for (const [a,b] of [[1,201],[201,1],[101,101],[19,14]]) {
    let previous = 0;
    for (let i=0;i<=200;i++) {
      const x=i/200, value=betaCDF(x,a,b);
      assert.ok(value >= previous-1e-13 && value >= 0 && value <= 1);
      near(value + betaCDF(1-x,b,a),1,2e-12);
      previous=value;
    }
  }
  assert.ok(betaCDF(.01,101,101) > 0);
  assert.ok(betaCDF(.01,101,101) < 1e-100);
});

test('count and Beta APIs reject malformed values and enforce supported limits', () => {
  for (const invalid of [-1, .5, NaN, Infinity, '1', null, undefined, true]) {
    assert.throws(() => posterior(invalid,0));
    assert.throws(() => posterior(0,invalid));
  }
  assert.throws(() => posterior(101,100));
  assert.equal(posterior(200,0).total,200);
  for (const api of [betaCDF,betaPDF,betaQuantile]) {
    for (const bad of [-.1,1.1,NaN,Infinity,'0.5',null,undefined]) assert.throws(() => api(bad,1,1));
    for (const bad of [0,-1,.5,NaN,Infinity,'1',null,undefined]) {
      assert.throws(() => api(.5,bad,1));
      assert.throws(() => api(.5,1,bad));
    }
    assert.throws(() => api(.5,102,101));
  }
});

test('a fresh lesson hides beliefs and cannot reveal or update without a prediction', () => {
  const state=createBayesLesson();
  assert.deepEqual(state,{phase:'predict',guess:null,changeGuess:null,attempts:[]});
  const view=bayesLessonEvidence(state);
  assert.deepEqual(view.baseline.map(({id,successes,failures,sampleRate,belief})=>({id,successes,failures,sampleRate,belief})),[
    {id:'little',successes:3,failures:2,sampleRate:.6,belief:null},
    {id:'many',successes:18,failures:12,sampleRate:.6,belief:null},
  ]);
  assert.equal(view.after,null);
  assert.equal(view.transfer,null);
  assert.equal(view.ending,null);
  for (const type of ['reveal','update']) assert.deepEqual(actBayesLesson(state,{type}),state);
});

test('reveal requires a first prediction and update requires its own second prediction', () => {
  const predicted=actBayesLesson(createBayesLesson(),{type:'guess',value:'same'});
  assert.equal(predicted.phase,'predict');
  assert.ok(bayesLessonEvidence(predicted).baseline.every(row=>row.belief===null));
  const compare=actBayesLesson(predicted,{type:'reveal'});
  assert.equal(compare.phase,'compare');
  assert.equal(compare.guess,'same');
  assert.deepEqual(actBayesLesson(compare,{type:'update'}),compare);
  const before=bayesLessonEvidence(compare);
  assert.equal(before.baseline[0].belief.mean,4/7);
  assert.equal(before.baseline[1].belief.mean,19/32);
  assert.equal(before.after,null);
  const final=actBayesLesson(actBayesLesson(compare,{type:'change-guess',value:'many'}),{type:'update'});
  assert.equal(final.phase,'updated');
  assert.equal(final.guess,'same');
  assert.equal(final.changeGuess,'many');
  const after=bayesLessonEvidence(final);
  assert.deepEqual(after.baseline,before.baseline);
  assert.deepEqual(after.after.map(row=>[row.successes,row.failures,row.belief.mean]),[[3,3,.5],[18,13,19/33]]);
  assert.equal(after.transfer,null);
});

test('wrong answers remain actual history and transfer evidence appears before correction', () => {
  let state=actBayesLesson(updated(),{type:'answer',value:'never'});
  assert.equal(state.phase,'updated');
  assert.deepEqual(state.attempts,['never']);
  let view=bayesLessonEvidence(state);
  assert.equal(view.ending,null);
  assert.deepEqual(view.transfer.map(row=>[row.id,row.successes,row.failures]),[['one',0,1],['ten',0,10]]);
  assert.equal(view.transfer[0].belief.mean,1/3);
  assert.equal(view.transfer[1].belief.mean,1/12);
  assert.ok(view.transfer.every(row=>row.belief.interval[0]>0 && row.belief.interval[1]>0));
  state=actBayesLesson(state,{type:'answer',value:'guarantee'});
  state=actBayesLesson(state,{type:'answer',value:'evidence'});
  assert.equal(state.phase,'done');
  assert.deepEqual(state.attempts,['never','guarantee','evidence']);
  view=bayesLessonEvidence(state);
  assert.deepEqual(view.ending,{firstAttemptCorrect:false,attemptsCount:3});
  assert.deepEqual(actBayesLesson(state,{type:'answer',value:'never'}),state);
});

test('a correct first transfer attempt is distinguished from corrected completion', () => {
  const state=actBayesLesson(updated(),{type:'answer',value:'evidence'});
  assert.deepEqual(bayesLessonEvidence(state).ending,{firstAttemptCorrect:true,attemptsCount:1});
});

test('known out-of-phase actions do not skip lesson gates', () => {
  const stages=[createBayesLesson(),compared(),updated(),actBayesLesson(updated(),{type:'answer',value:'evidence'})];
  const actions=[{type:'guess',value:'little'},{type:'reveal'},{type:'change-guess',value:'same'},{type:'update'},{type:'answer',value:'evidence'}];
  const allowed=[['guess'],['change-guess'],['answer'],[]];
  stages.forEach((state,i)=>actions.forEach(action=>{
    if (!allowed[i].includes(action.type)) assert.deepEqual(actBayesLesson(state,action),state);
  }));
});

test('every prediction choice is accepted and can be revised only before its gate', () => {
  for (const value of ['little','many','same']) {
    const predicted=actBayesLesson(createBayesLesson(),{type:'guess',value});
    assert.equal(predicted.guess,value);
    const compare=actBayesLesson(predicted,{type:'reveal'});
    assert.equal(actBayesLesson(compare,{type:'change-guess',value}).changeGuess,value);
  }
  let state=actBayesLesson(createBayesLesson(),{type:'guess',value:'many'});
  state=actBayesLesson(state,{type:'guess',value:'little'});
  assert.equal(state.guess,'little');
});

test('reset clears all predictions and history from every phase', () => {
  for (const state of [createBayesLesson(),compared(),updated(),actBayesLesson(updated(),{type:'answer',value:'never'}),actBayesLesson(updated(),{type:'answer',value:'evidence'})]) {
    const reset=actBayesLesson(state,{type:'reset'});
    assert.deepEqual(reset,{phase:'predict',guess:null,changeGuess:null,attempts:[]});
    reset.attempts.push('never');
    assert.deepEqual(createBayesLesson().attempts,[]);
  }
});

test('actions never mutate frozen inputs and evidence arrays cannot poison later calls', () => {
  const state=updated();
  Object.freeze(state.attempts);Object.freeze(state);
  const action=Object.freeze({type:'answer',value:'never'});
  const next=actBayesLesson(state,action);
  assert.deepEqual(state.attempts,[]);
  next.attempts.push('guarantee');
  assert.deepEqual(state.attempts,[]);
  const view=bayesLessonEvidence(next);
  view.baseline[0].successes=999;
  view.baseline[0].belief.curve[0].y=999;
  view.baseline[0].belief.interval[0]=999;
  view.after[0].belief.mean=999;
  view.transfer[0].belief.curve.pop();
  const fresh=bayesLessonEvidence(next);
  assert.equal(fresh.baseline[0].successes,3);
  assert.equal(fresh.baseline[0].belief.curve[0].y,0);
  assert.ok(fresh.baseline[0].belief.interval[0]<1);
  assert.equal(fresh.after[0].belief.mean,.5);
  assert.equal(fresh.transfer[0].belief.curve.length,201);
});

test('unknown and malformed actions throw even when out of phase', () => {
  const bad=[null,undefined,[],{},'reset',{type:'unknown'},{type:'guess'},
    {type:'guess',value:'one'},{type:'change-guess',value:null},{type:'answer',value:'same'},
    {type:'reveal',value:'little'},{type:'reset',value:'evidence'}];
  for (const state of [createBayesLesson(),updated()]) {
    for (const action of bad) assert.throws(()=>actBayesLesson(state,action));
  }
});
