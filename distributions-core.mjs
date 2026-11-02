// Population median / half-IQR normalization; these never depend on a sample.
const NORMAL_HALF_IQR = 0.6744897501960817;
const EXP_MEDIAN = Math.LN2;
const EXP_HALF_IQR = Math.log(3) / 2;
const PARETO_MEDIAN = 2 ** (2 / 3);
const PARETO_HALF_IQR = (4 ** (2 / 3) - (4 / 3) ** (2 / 3)) / 2;
const LOGNORMAL_HALF_IQR = Math.sinh(NORMAL_HALF_IQR);
const MAX_COUNT = 10000;

export const MODEL_IDS = Object.freeze(['normal', 'exponential', 'pareto', 'lognormal']);
export const MODEL_INFO = Object.freeze(Object.fromEntries([
  ['normal', '正态', 'A', false, false, false],
  ['exponential', '指数', 'B', false, false, false],
  ['pareto', '帕累托', 'C', true, true, true],
  ['lognormal', '对数正态', 'D', true, true, false],
].map(([id, label, letter, heavy, longTail, powerLaw]) => [id, Object.freeze({ label, letter, heavy, longTail, powerLaw, median: 0, iqr: 2 })])));

function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
}
function integer(value, min, max, name) {
  finite(value, name);
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${name} outside supported range`);
}
function model(id) {
  if (!MODEL_IDS.includes(id)) throw new RangeError('Unknown distribution model');
}

// Q(1/2, x), the regularized upper incomplete gamma. Evaluating its
// continued fraction directly avoids subtracting an almost-one normal CDF.
function gammaHalfUpper(x) {
  if (x === 0) return 1;
  if (!Number.isFinite(x)) return 0;
  const factor = Math.exp(-x + 0.5 * Math.log(x) - 0.5723649429247001);
  if (x < 1.5) {
    let term = 2;
    let sum = term;
    for (let i = 1; i < 200; i++) {
      term *= x / (i + 0.5);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 2e-16) break;
    }
    return Math.max(0, Math.min(1, 1 - sum * factor));
  }
  let b = x + 0.5;
  let c = 1e300;
  let d = 1 / b;
  let fraction = d;
  for (let i = 1; i < 300; i++) {
    const a = -i * (i - 0.5);
    b += 2;
    d = a * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + a / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    fraction *= delta;
    if (Math.abs(delta - 1) < 3e-16) break;
  }
  return Math.max(0, Math.min(1, factor * fraction));
}
function normalSurvival(z) {
  const smallTail = 0.5 * gammaHalfUpper(z * z / 2);
  return z < 0 ? 1 - smallTail : smallTail;
}

// Acklam rational starting approximation, refined using the complementary
// normal tail (including for the upper branch where CDF subtraction fails).
function inverseNormal(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  let z;
  if (p < 0.02425 || p > 0.97575) {
    const q = Math.sqrt(-2 * (p < 0.5 ? Math.log(p) : Math.log1p(-p)));
    z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    if (p > 0.5) z = -z;
  } else {
    const q = p - 0.5;
    const r = q * q;
    z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  for (let i = 0; i < 2; i++) {
    const density = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
    if (density === 0) break;
    const error = z < 0 ? normalSurvival(-z) - p : (1 - p) - normalSurvival(z);
    const step = error / density;
    z -= step / (1 + z * step / 2);
  }
  return z;
}

export function modelQuantile(id, u) {
  model(id);
  finite(u, 'probability');
  if (u <= 0 || u >= 1) throw new RangeError('probability must be strictly between zero and one');
  switch (id) {
    case 'normal': return inverseNormal(u) / NORMAL_HALF_IQR;
    case 'exponential': return (-Math.log1p(-u) - EXP_MEDIAN) / EXP_HALF_IQR;
    case 'pareto': return (Math.exp(-2 / 3 * Math.log1p(-u)) - PARETO_MEDIAN) / PARETO_HALF_IQR;
    case 'lognormal': return Math.expm1(inverseNormal(u)) / LOGNORMAL_HALF_IQR;
  }
}

export function modelSurvival(id, x) {
  model(id);
  finite(x, 'threshold');
  switch (id) {
    case 'normal': return normalSurvival(NORMAL_HALF_IQR * x);
    case 'exponential': {
      const raw = EXP_MEDIAN + EXP_HALF_IQR * x;
      return raw <= 0 ? 1 : Math.exp(-raw);
    }
    case 'pareto': {
      const raw = PARETO_MEDIAN + PARETO_HALF_IQR * x;
      return raw <= 1 ? 1 : raw ** -1.5;
    }
    case 'lognormal': {
      const offset = LOGNORMAL_HALF_IQR * x;
      return offset <= -1 ? 1 : normalSurvival(Math.log1p(offset));
    }
  }
}

const MODEL_SALTS = Object.freeze({ normal: 0xa341316c, exponential: 0xc8013ea4, pareto: 0xad90777d, lognormal: 0x7e95761e });
export function sampleModel(id, count, seed) {
  model(id);
  integer(count, 0, MAX_COUNT, 'count');
  integer(seed, 0, 0xffffffff, 'seed');
  let state = (seed ^ MODEL_SALTS[id]) >>> 0;
  const result = [];
  for (let i = 0; i < count; i++) {
    // Mulberry32 stream. A half-unit offset makes every uniform open (0,1).
    state = (state + 0x6d2b79f5) >>> 0;
    let bits = state;
    bits = Math.imul(bits ^ (bits >>> 15), bits | 1);
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61);
    const uniform = (((bits ^ (bits >>> 14)) >>> 0) + 0.5) / 4294967296;
    result.push(modelQuantile(id, uniform));
  }
  return result;
}

export function summarize(values, threshold) {
  finite(threshold, 'threshold');
  if (!Array.isArray(values) || values.length > MAX_COUNT) throw new TypeError('values must be an array of at most 10000 finite numbers');
  const histogram = Array(20).fill(0);
  let below = 0;
  let above = 0;
  let tailCount = 0;
  let max = null;
  let scale = 0;
  for (const value of values) {
    finite(value, 'sample');
    if (value < -4) below++;
    else if (value >= 16) above++;
    else histogram[Math.floor(value) + 4]++;
    if (value > threshold) tailCount++;
    if (max === null || value > max) max = value;
    scale = Math.max(scale, Math.abs(value));
  }
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(n / 2);
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  const median = !n ? null : n % 2 ? upper
    : Math.abs(lower) <= Number.MAX_VALUE / 2 && Math.abs(upper) <= Number.MAX_VALUE / 2
      ? (lower + upper) / 2 : lower / 2 + upper / 2;
  // Sum scaled terms so a finite mean of very large finite inputs cannot
  // overflow merely because an intermediate unscaled sum does.
  let scaledSum = 0;
  if (scale) for (const value of values) scaledSum += value / scale;
  const mean = !n ? null : scale * Math.max(-1, Math.min(1, scaledSum / n));
  return { n, mean, median, max, tailCount, tailRate: n ? tailCount / n : null, histogram, below, above, latest: values.slice(-6) };
}

const OBSERVATORY_PHASES = ['ready', 'grown', 'pushed', 'done'];
const OBSERVATORY_ANSWERS = ['sample', 'zero'];

function validateState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state) || !OBSERVATORY_PHASES.includes(state.phase)) throw new TypeError('Invalid observatory state');
  integer(state.seed, 0, 0xffffffff, 'seed');
  if (typeof state.inspected !== 'boolean' || !Array.isArray(state.attempts)) throw new TypeError('Invalid observatory state');
  const { phase, count, threshold, attempts, inspected } = state;
  if (count !== (phase === 'ready' ? 30 : 3030) || threshold !== (['ready', 'grown'].includes(phase) ? 4 : 16)) throw new TypeError('Invalid phase observations');
  for (const answer of attempts) if (!OBSERVATORY_ANSWERS.includes(answer)) throw new TypeError('Invalid answer history');
  if (phase === 'done') {
    if (!attempts.length || attempts.at(-1) !== 'sample' || attempts.slice(0, -1).some((answer) => answer !== 'zero')) throw new TypeError('Invalid completed answer history');
  } else {
    if (inspected || attempts.some((answer) => answer !== 'zero') || (phase !== 'pushed' && attempts.length)) throw new TypeError('Invalid phase progress');
  }
}

export function createObservatory(seed = 20261102) {
  integer(seed, 0, 0xffffffff, 'seed');
  return { phase: 'ready', seed, count: 30, threshold: 4, attempts: [], inspected: false };
}

export function actObservatory(state, action) {
  validateState(state);
  if (!action || typeof action !== 'object' || Array.isArray(action)) throw new TypeError('Invalid action');
  const { type, value } = action;
  switch (type) {
    case 'answer':
      if (!OBSERVATORY_ANSWERS.includes(value)) throw new RangeError('Invalid answer');
      break;
    case 'new-seed':
      integer(value, 0, 0xffffffff, 'seed');
      break;
    case 'grow': case 'push': case 'inspect': case 'reset':
      if (value !== undefined) throw new TypeError('This action takes no value');
      break;
    default: throw new RangeError('Unknown action');
  }
  if (type === 'reset') return createObservatory(state.seed);
  if (type === 'new-seed') return createObservatory(value);
  const next = { ...state, attempts: [...state.attempts] };
  if (type === 'grow' && state.phase === 'ready') {
    next.phase = 'grown';
    next.count = 3030;
  }
  if (type === 'push' && state.phase === 'grown') {
    next.phase = 'pushed';
    next.threshold = 16;
  }
  if (type === 'answer' && state.phase === 'pushed') {
    next.attempts.push(value);
    if (value === 'sample') next.phase = 'done';
  }
  if (type === 'inspect' && state.phase === 'done') next.inspected = true;
  return next;
}

export function observatoryEvidence(state) {
  validateState(state);
  const { phase, seed, count, threshold } = state;
  const summary = (id, n, limit) => ({ id, stats: summarize(sampleModel(id, n, seed), limit) });
  const row = (id) => ({ ...summary(id, count, threshold), theoreticalTail: modelSurvival(id, threshold) });
  const ending = phase === 'done' ? {
    firstAttemptCorrect: state.attempts[0] === 'sample',
    attemptsCount: state.attempts.length,
    firstAnswer: state.attempts[0],
    lastAnswer: state.attempts.at(-1),
  } : null;
  return {
    phase, seed, count, threshold, baselineThreshold: 4,
    baseline: MODEL_IDS.slice(0, 3).map((id) => summary(id, 30, 4)),
    comparison: phase === 'ready' ? null : MODEL_IDS.slice(0, 3).map((id) => summary(id, 3030, 4)),
    rows: MODEL_IDS.slice(0, 3).map(row),
    transfer: phase === 'done' && state.inspected ? row('lognormal') : null,
    ending,
  };
}
