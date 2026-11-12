import test from 'node:test';
import assert from 'node:assert/strict';

const core = await import('../../../dist/distributions-core.mjs').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return null;
  throw error;
});
function api() {
  assert.ok(core, 'distribution model API must exist');
  return core;
}
const ids = ['normal', 'exponential', 'pareto', 'lognormal'];
const close = (actual, expected, tolerance = 1e-11) => assert.ok(
  Math.abs(actual - expected) <= tolerance,
  `${actual} differs from ${expected} by more than ${tolerance}`,
);

test('known generators distinguish light, long/heavy, and power-law classes', () => {
  const { MODEL_IDS, MODEL_INFO } = api();
  assert.deepEqual(MODEL_IDS, ids);
  for (const [index, id] of ids.entries()) {
    const info = MODEL_INFO[id];
    assert.equal(info.letter, 'ABCD'[index]);
    assert.ok(info.label.length > 0);
    assert.equal(info.median, 0);
    assert.equal(info.iqr, 2);
    assert.deepEqual([info.heavy, info.longTail, info.powerLaw], {
      normal: [false, false, false], exponential: [false, false, false],
      pareto: [true, true, true], lognormal: [true, true, false],
    }[id]);
  }
});

test('population normalization has median zero and IQR two without forcing symmetric quartiles', () => {
  const { modelQuantile } = api();
  for (const id of ids) {
    close(modelQuantile(id, 0.5), 0);
    close(modelQuantile(id, 0.75) - modelQuantile(id, 0.25), 2);
  }
  close(modelQuantile('exponential', 0.25), -0.7381404928570853);
  close(modelQuantile('pareto', 0.75), 1.4252840557736357);
  close(modelQuantile('lognormal', 0.25), -0.6749844814969814);
});

test('survival uses each shifted generator rather than unshifted tail formulas', () => {
  const { modelSurvival } = api();
  const expected = {
    normal: [0.00348830161964012, 0.00002594593379604, 0.00000003408703904],
    exponential: [0.05555555555555555, 0.01851851851851852, 0.00617283950617284],
    pareto: [0.11600213782236997, 0.07726006985187106, 0.05613283629371375],
    lognormal: [0.08646827066942771, 0.04656418340858137, 0.02748921148400953],
  };
  for (const id of ids) for (const [index, x] of [4, 6, 8].entries()) {
    close(modelSurvival(id, x), expected[id][index], 3e-14);
  }
});

test('normal complementary tail stays positive when 1 minus CDF would cancel', () => {
  const { modelSurvival } = api();
  const p = modelSurvival('normal', 16);
  assert.ok(p > 0 && p < 1e-25);
  close(modelSurvival('normal', -4), 1 - 0.00348830161964012, 2e-15);
});

test('quantile inversion is accurate across central and extreme open probabilities', () => {
  const { modelSurvival, modelQuantile } = api();
  for (const id of ids) for (const u of [1e-10, 0.001, 0.25, 0.5, 0.99, 1 - 1e-10]) {
    close(modelSurvival(id, modelQuantile(id, u)), 1 - u, 3e-13);
  }
  for (const [id, q] of Object.entries({ normal: 3.4490485191, exponential: 7.1217535900, pareto: 30.5052172317, lognormal: 12.7137858729 })) {
    close(modelQuantile(id, 0.99), q, 6e-11);
  }
});

test('positive-support survival guards return one below the support', () => {
  const { modelSurvival } = api();
  for (const id of ['exponential', 'pareto', 'lognormal']) {
    assert.equal(modelSurvival(id, -100), 1);
    assert.ok(modelSurvival(id, 0) > 0.499999999999 && modelSurvival(id, 0) < 0.500000000001);
  }
  for (const id of ids) {
    assert.ok(modelSurvival(id, Number.MAX_VALUE) >= 0);
    assert.ok(Number.isFinite(modelSurvival(id, Number.MAX_VALUE)));
  }
});

test('numeric model APIs reject malformed ids, probabilities, thresholds, seeds and counts', () => {
  const { modelQuantile, modelSurvival, sampleModel } = api();
  for (const id of ['missing', null, '__proto__']) {
    assert.throws(() => modelQuantile(id, 0.5));
    assert.throws(() => modelSurvival(id, 0));
    assert.throws(() => sampleModel(id, 1, 1));
  }
  for (const u of [0, 1, -1, NaN, Infinity, '0.5', undefined]) assert.throws(() => modelQuantile('normal', u));
  for (const x of [NaN, Infinity, -Infinity, '4', null]) assert.throws(() => modelSurvival('normal', x));
  for (const count of [-1, 1.5, 10001, NaN, '30', null]) assert.throws(() => sampleModel('normal', count, 0));
  for (const seed of [-1, 4294967296, 1.5, NaN, '1', null]) assert.throws(() => sampleModel('normal', 1, seed));
});

test('seeded sampling is repeatable, prefix stable, finite and independent between model streams', () => {
  const { sampleModel } = api();
  for (const id of ids) for (const seed of [0, 20261102, 4294967295]) {
    const first = sampleModel(id, 30, seed);
    const larger = sampleModel(id, 10000, seed);
    assert.deepEqual(larger.slice(0, 30), first);
    assert.ok(larger.every(Number.isFinite));
    assert.equal(larger.length, 10000);
    assert.equal(new Set(first).size, 30);
    assert.deepEqual(sampleModel(id, 0, seed), []);
    first[0] = Infinity;
    assert.ok(Number.isFinite(sampleModel(id, 30, seed)[0]));
  }
  const { modelSurvival } = api();
  const uniforms = ids.map((id) => sampleModel(id, 6, 20).map((v) => 1 - modelSurvival(id, v)));
  assert.notDeepEqual(uniforms[0], uniforms[1]);
  assert.notDeepEqual(sampleModel('pareto', 30, 20), sampleModel('pareto', 30, 21));
});

test('histogram conserves boundaries and outliers while exceedance is strictly greater', () => {
  const { summarize } = api();
  const values = [-100, -4, -3.5, -3, 0, 8, 8, 15.999, 16, 1000];
  const snapshot = [...values];
  const result = summarize(values, 8);
  assert.equal(result.n, 10);
  assert.equal(result.below, 1);
  assert.equal(result.above, 2);
  assert.equal(result.histogram.length, 20);
  assert.equal(result.histogram[0], 2);
  assert.equal(result.histogram[1], 1);
  assert.equal(result.histogram[4], 1);
  assert.equal(result.histogram[12], 2);
  assert.equal(result.histogram[19], 1);
  assert.equal(result.histogram.reduce((a, b) => a + b, 0) + result.below + result.above, 10);
  assert.equal(result.tailCount, 3);
  assert.equal(result.tailRate, 0.3);
  assert.equal(result.median, 4);
  assert.equal(result.max, 1000);
  close(result.mean, 93.7499);
  assert.deepEqual(result.latest, [0, 8, 8, 15.999, 16, 1000]);
  assert.deepEqual(values, snapshot);
  result.latest[0] = 42;
  assert.deepEqual(values, snapshot);
});

test('summary handles empty, odd and all-negative data without fabricated zero extrema', () => {
  const { summarize } = api();
  const empty = summarize([], 4);
  assert.deepEqual({ ...empty, histogram: [] }, { n: 0, mean: null, median: null, max: null, tailCount: 0, tailRate: null, histogram: [], below: 0, above: 0, latest: [] });
  assert.ok(empty.histogram.every((v) => v === 0));
  const odd = summarize([-8, -4, -5], -5);
  assert.equal(odd.median, -5);
  assert.equal(odd.max, -4);
  assert.equal(odd.tailCount, 1);
  assert.equal(summarize([Number.MAX_VALUE, Number.MAX_VALUE], 0).mean, Number.MAX_VALUE);
});

test('adjacent floating-point boundaries cannot create a phantom histogram bin', () => {
  const { summarize } = api();
  const result = summarize([15.999999999999998, 16, -Number.MIN_VALUE, 0, -4, -4.000000000000001], 8);
  assert.equal(result.histogram.length, 20);
  assert.ok(result.histogram.every(Number.isInteger));
  assert.equal(result.histogram[19], 1);
  assert.equal(result.histogram[3], 1);
  assert.equal(result.histogram[4], 1);
  assert.equal(result.histogram[0], 1);
  assert.equal(result.below, 1);
  assert.equal(result.above, 1);
  assert.equal(result.n, 6);
  assert.equal(result.histogram.reduce((sum, count) => sum + count, 0) + result.below + result.above, 6);
});

test('summary refuses sparse or invalid values and unsupported lengths', () => {
  const { summarize } = api();
  for (const values of [null, {}, [NaN], [Infinity], ['1'], Array(2), Array(10001).fill(0)]) assert.throws(() => summarize(values, 4));
  for (const threshold of [NaN, Infinity, null, '8']) assert.throws(() => summarize([], threshold));
});

test('even medians remain correct for subnormal and huge finite values', () => {
  const { summarize } = api();
  assert.equal(summarize([Number.MIN_VALUE, Number.MIN_VALUE], 0).median, Number.MIN_VALUE);
  assert.equal(summarize([Number.MIN_VALUE, 2 * Number.MIN_VALUE], 0).median, 2 * Number.MIN_VALUE);
  assert.equal(summarize([Number.MAX_VALUE, Number.MAX_VALUE], 0).median, Number.MAX_VALUE);
  assert.equal(summarize([-Number.MAX_VALUE, Number.MAX_VALUE], 0).median, 0);
});

// These cases catch skipped/repeated stages, changed sample identity, dishonest
// retry endings, premature transfer disclosure, and invalid cross-phase inputs.
const pushedState = (seed) => core.actObservatory(core.actObservatory(core.createObservatory(seed), { type: 'grow' }), { type: 'push' });

test('guided flow starts at thirty plus four and only grows once', () => {
  const { createObservatory, actObservatory } = api();
  const initial = createObservatory();
  assert.deepEqual(initial, { phase: 'ready', seed: 20261102, count: 30, threshold: 4, attempts: [], inspected: false });
  Object.freeze(initial.attempts);
  Object.freeze(initial);
  for (const action of [{ type: 'push' }, { type: 'inspect' }, { type: 'answer', value: 'sample' }]) {
    const next = actObservatory(initial, action);
    assert.deepEqual(next, initial);
    assert.notEqual(next, initial);
    assert.notEqual(next.attempts, initial.attempts);
  }
  const grown = actObservatory(initial, { type: 'grow' });
  assert.deepEqual(grown, { ...initial, phase: 'grown', count: 3030 });
  assert.deepEqual(actObservatory(grown, { type: 'grow' }), grown);
  assert.deepEqual(actObservatory(grown, { type: 'answer', value: 'sample' }), grown);
  assert.deepEqual(actObservatory(grown, { type: 'inspect' }), grown);
  const pushed = actObservatory(grown, { type: 'push' });
  assert.deepEqual(pushed, { ...grown, phase: 'pushed', threshold: 16 });
  assert.deepEqual(actObservatory(pushed, { type: 'push' }), pushed);
  assert.deepEqual(actObservatory(pushed, { type: 'grow' }), pushed);
  assert.deepEqual(actObservatory(pushed, { type: 'inspect' }), pushed);
});

test('growth comparison and threshold push preserve the same observations', () => {
  const { createObservatory, actObservatory, observatoryEvidence } = api();
  const initial = observatoryEvidence(createObservatory());
  assert.equal(initial.comparison, null);
  assert.equal(initial.baselineThreshold, 4);
  assert.deepEqual(initial.baseline, initial.rows.map(({ id, stats }) => ({ id, stats })));
  const grown = actObservatory(createObservatory(), { type: 'grow' });
  const low = observatoryEvidence(grown);
  const high = observatoryEvidence(actObservatory(grown, { type: 'push' }));
  assert.deepEqual(low.rows.map((r) => r.id), ['normal', 'exponential', 'pareto']);
  assert.deepEqual(low.rows.map((r) => r.stats.tailCount), [11, 166, 352]);
  assert.deepEqual(high.rows.map((r) => r.stats.tailCount), [0, 0, 88]);
  assert.deepEqual(low.comparison, low.rows.map(({ id, stats }) => ({ id, stats })));
  assert.deepEqual(high.comparison, low.comparison);
  assert.deepEqual(low.baseline, initial.baseline);
  assert.deepEqual(high.baseline, initial.baseline);
  for (let i = 0; i < 3; i++) {
    const { tailCount: lc, tailRate: lr, ...ls } = low.rows[i].stats;
    const { tailCount: hc, tailRate: hr, ...hs } = high.rows[i].stats;
    assert.deepEqual(ls, hs);
    assert.equal(ls.n, 3030);
    assert.ok(low.rows[i].theoreticalTail > high.rows[i].theoreticalTail);
  }
  assert.ok(high.rows[0].theoreticalTail > 0);
  assert.ok(high.rows[1].theoreticalTail > 0);
});

test('wrong first answers remain recorded after correction', () => {
  const { actObservatory, observatoryEvidence } = api();
  const pushed = pushedState(12);
  const wrong = actObservatory(pushed, { type: 'answer', value: 'zero' });
  assert.equal(wrong.phase, 'pushed');
  assert.deepEqual(wrong.attempts, ['zero']);
  assert.equal(observatoryEvidence(wrong).ending, null);
  const retry = actObservatory(wrong, { type: 'answer', value: 'zero' });
  const done = actObservatory(retry, { type: 'answer', value: 'sample' });
  assert.deepEqual(done.attempts, ['zero', 'zero', 'sample']);
  assert.deepEqual(wrong.attempts, ['zero']);
  assert.deepEqual(pushed.attempts, []);
  assert.equal(done.phase, 'done');
  assert.deepEqual(observatoryEvidence(done).ending, { firstAttemptCorrect: false, attemptsCount: 3, firstAnswer: 'zero', lastAnswer: 'sample' });
  for (const action of [{ type: 'answer', value: 'zero' }, { type: 'grow' }, { type: 'push' }]) assert.deepEqual(actObservatory(done, action), done);
});

test('one correct attempt completes before optional lognormal inspection', () => {
  const { actObservatory, observatoryEvidence, MODEL_INFO } = api();
  const done = actObservatory(pushedState(), { type: 'answer', value: 'sample' });
  const evidence = observatoryEvidence(done);
  assert.deepEqual(evidence.ending, { firstAttemptCorrect: true, attemptsCount: 1, firstAnswer: 'sample', lastAnswer: 'sample' });
  assert.equal(evidence.transfer, null);
  assert.equal(done.inspected, false);
  const inspected = actObservatory(done, { type: 'inspect' });
  assert.equal(inspected.phase, 'done');
  assert.equal(inspected.inspected, true);
  assert.deepEqual(actObservatory(inspected, { type: 'inspect' }), inspected);
  const transfer = observatoryEvidence(inspected).transfer;
  assert.equal(transfer.id, 'lognormal');
  assert.equal(transfer.stats.n, 3030);
  assert.ok(transfer.stats.tailCount > 0);
  assert.equal(transfer.theoreticalTail, core.modelSurvival('lognormal', 16));
  assert.equal(MODEL_INFO.lognormal.powerLaw, false);
});

test('reset and new seed clear progress and replay independent initial evidence', () => {
  const { createObservatory, actObservatory, observatoryEvidence } = api();
  const initial = createObservatory(55);
  const done = actObservatory(actObservatory(pushedState(55), { type: 'answer', value: 'sample' }), { type: 'inspect' });
  const reset = actObservatory(done, { type: 'reset' });
  assert.deepEqual(reset, initial);
  assert.deepEqual(observatoryEvidence(reset), observatoryEvidence(initial));
  const fresh = actObservatory(done, { type: 'new-seed', value: 56 });
  assert.deepEqual(fresh, createObservatory(56));
  assert.notDeepEqual(observatoryEvidence(fresh).baseline, observatoryEvidence(initial).baseline);
  reset.attempts.push('zero');
  assert.deepEqual(initial.attempts, []);
});

test('evidence returns fresh nested outputs without raw samples or state mutation', () => {
  const { actObservatory, observatoryEvidence } = api();
  const state = actObservatory(actObservatory(pushedState(), { type: 'answer', value: 'sample' }), { type: 'inspect' });
  const snapshot = structuredClone(state);
  const expected = observatoryEvidence(state);
  const mutable = observatoryEvidence(state);
  for (const rows of [mutable.baseline, mutable.comparison, mutable.rows, [mutable.transfer]]) {
    rows[0].stats.histogram[0] = 9999;
    rows[0].stats.latest[0] = 9999;
    rows[0].stats.max = 9999;
    assert.equal('values' in rows[0], false);
  }
  mutable.ending.firstAttemptCorrect = false;
  assert.deepEqual(observatoryEvidence(state), expected);
  assert.deepEqual(state, snapshot);
});

test('invalid actions and unsupported old actions throw even out of phase', () => {
  const { createObservatory, actObservatory } = api();
  const state = createObservatory();
  for (const action of [null, [], {}, { type: 'wat' }, { type: 'guess', value: 'normal' }, { type: 'reveal' }, { type: 'sample', value: 30 }, { type: 'threshold', value: 4 }, { type: 'answer', value: 'overlap' }, { type: 'answer' }, { type: 'new-seed', value: -1 }, { type: 'new-seed', value: 4294967296 }, { type: 'new-seed', value: 1.5 }, { type: 'new-seed', value: '1' }]) {
    assert.throws(() => actObservatory(state, action));
  }
  for (const type of ['grow', 'push', 'inspect', 'reset']) for (const value of [null, 0, false, 'sample']) assert.throws(() => actObservatory(state, { type, value }));
  for (const seed of [-1, 4294967296, 1.1, null, '1']) assert.throws(() => createObservatory(seed));
});

test('malformed state and cross-phase contradictions are rejected', () => {
  const { createObservatory, actObservatory, observatoryEvidence } = api();
  const ready = createObservatory();
  const invalid = [
    null, [], {}, { ...ready, phase: 'predict' }, { ...ready, seed: -1 },
    { ...ready, count: 3030 }, { ...ready, threshold: 16 }, { ...ready, inspected: true },
    { ...ready, attempts: ['zero'] }, { ...ready, inspected: 0 }, { ...ready, attempts: null },
    { ...ready, phase: 'grown', count: 3030, threshold: 16 },
    { ...ready, phase: 'grown', count: 3030, attempts: ['zero'] },
    { ...ready, phase: 'pushed', count: 3030, threshold: 16, attempts: ['sample'] },
    { ...ready, phase: 'done', count: 3030, threshold: 16 },
    { ...ready, phase: 'done', count: 3030, threshold: 16, attempts: ['sample', 'zero'] },
    { ...ready, phase: 'done', count: 3030, threshold: 16, attempts: ['sample', 'sample'] },
    { ...ready, phase: 'done', count: 3030, threshold: 16, attempts: ['wrong', 'sample'] },
  ];
  for (const state of invalid) {
    assert.throws(() => actObservatory(state, { type: 'reset' }));
    assert.throws(() => observatoryEvidence(state));
  }
});
