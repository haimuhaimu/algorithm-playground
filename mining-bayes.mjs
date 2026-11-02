// A separate Beta–Bernoulli teaching model: fixed unknown p, independent
// observations conditional on p, and a common Beta(1,1) prior. This module
// deliberately does not import or infer the original mining game's generator.
const MAX_OBSERVATIONS = 200;
const LOG_FACTORIAL = [0];
for (let n = 1; n <= MAX_OBSERVATIONS + 1; n++) {
  LOG_FACTORIAL[n] = LOG_FACTORIAL[n - 1] + Math.log(n);
}

function unitInterval(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite number in [0,1]`);
  }
}

function parameters(alpha, beta) {
  if (!Number.isInteger(alpha) || !Number.isInteger(beta) || alpha < 1 || beta < 1 || alpha + beta > MAX_OBSERVATIONS + 2) {
    throw new RangeError('Beta parameters must be positive integers with sum <= 202');
  }
}

function density(x, alpha, beta) {
  if (x === 0) return alpha === 1 ? beta : 0;
  if (x === 1) return beta === 1 ? alpha : 0;
  const logNormalizer = LOG_FACTORIAL[alpha + beta - 1] - LOG_FACTORIAL[alpha - 1] - LOG_FACTORIAL[beta - 1];
  return Math.exp(logNormalizer + (alpha - 1) * Math.log(x) + (beta - 1) * Math.log1p(-x));
}

// For integer parameters, I_x(a,b) is the Binomial(a+b-1,x) tail
// P(K >= a). Log-sum-exp avoids overflowing coefficients or losing tiny
// tails; compensated summation limits rounding error in the scaled sum.
function binomialTail(x, alpha, beta) {
  const n = alpha + beta - 1;
  const logX = Math.log(x), logOneMinusX = Math.log1p(-x);
  const terms = [];
  let largest = -Infinity;
  for (let k = alpha; k <= n; k++) {
    const term = LOG_FACTORIAL[n] - LOG_FACTORIAL[k] - LOG_FACTORIAL[n - k] + k * logX + (n - k) * logOneMinusX;
    terms.push(term);
    largest = Math.max(largest, term);
  }
  let sum = 0, correction = 0;
  for (const term of terms) {
    const adjusted = Math.exp(term - largest) - correction;
    const next = sum + adjusted;
    correction = (next - sum) - adjusted;
    sum = next;
  }
  return Math.exp(largest + Math.log(sum));
}

function cumulative(x, alpha, beta) {
  if (x === 0) return 0;
  if (x === 1) return 1;
  const value = x > alpha / (alpha + beta)
    ? 1 - binomialTail(1 - x, beta, alpha)
    : binomialTail(x, alpha, beta);
  return Math.max(0, Math.min(1, value));
}

export function betaPDF(x, alpha, beta) {
  unitInterval(x, 'x');
  parameters(alpha, beta);
  return density(x, alpha, beta);
}

export function betaCDF(x, alpha, beta) {
  unitInterval(x, 'x');
  parameters(alpha, beta);
  return cumulative(x, alpha, beta);
}

export function betaQuantile(q, alpha, beta) {
  unitInterval(q, 'q');
  parameters(alpha, beta);
  if (q === 0 || q === 1) return q;
  let low = 0, high = 1;
  // Bisection is bounded and monotone; no normal approximation or numerical
  // derivative is needed. 1075 halvings cover the subnormal double range;
  // ordinary quantiles stop around 54 iterations when bounds are adjacent.
  for (let iteration = 0; iteration < 1075; iteration++) {
    const middle = (low + high) / 2;
    if (middle === low || middle === high) break;
    if (cumulative(middle, alpha, beta) < q) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export function posterior(successes, failures) {
  if (!Number.isInteger(successes) || successes < 0 || !Number.isInteger(failures) || failures < 0 || successes + failures > MAX_OBSERVATIONS) {
    throw new RangeError('Observation counts must be nonnegative integers with total <= 200');
  }
  const total = successes + failures, alpha = successes + 1, beta = failures + 1;
  const sum = alpha + beta;
  return {
    successes, failures, total, sampleRate: total === 0 ? null : successes / total,
    alpha, beta, mean: alpha / sum,
    variance: alpha * beta / (sum * sum * (sum + 1)),
    credibleMass: .9,
    interval: [betaQuantile(.05, alpha, beta), betaQuantile(.95, alpha, beta)],
    curve: Array.from({length: 201}, (_, i) => {
      const x = i / 200;
      return {x, y: density(x, alpha, beta)};
    }),
  };
}

const PREDICTIONS = ['little', 'many', 'same'];
const ANSWERS = ['evidence', 'never', 'guarantee'];
const PHASES = ['predict', 'compare', 'updated', 'done'];

export function createBayesLesson() {
  return {phase: 'predict', guess: null, changeGuess: null, attempts: []};
}

function validateState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state) || !PHASES.includes(state.phase) ||
      (state.guess !== null && !PREDICTIONS.includes(state.guess)) ||
      (state.changeGuess !== null && !PREDICTIONS.includes(state.changeGuess)) ||
      !Array.isArray(state.attempts) || state.attempts.some(answer => !ANSWERS.includes(answer))) {
    throw new TypeError('Invalid Bayesian lesson state');
  }
}

function validateAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) throw new TypeError('Invalid lesson action');
  if (action.type === 'guess' || action.type === 'change-guess') {
    if (!PREDICTIONS.includes(action.value)) throw new TypeError('Invalid lesson prediction');
  } else if (action.type === 'answer') {
    if (!ANSWERS.includes(action.value)) throw new TypeError('Invalid lesson answer');
  } else if (['reveal', 'update', 'reset'].includes(action.type)) {
    if (action.value !== undefined) throw new TypeError('This lesson action takes no value');
  } else throw new TypeError('Unknown lesson action');
}

export function actBayesLesson(state, action) {
  validateState(state);
  validateAction(action);
  if (action.type === 'reset') return createBayesLesson();
  const next = {...state, attempts: [...state.attempts]};
  if (action.type === 'guess' && state.phase === 'predict') next.guess = action.value;
  else if (action.type === 'reveal' && state.phase === 'predict' && state.guess !== null) next.phase = 'compare';
  else if (action.type === 'change-guess' && state.phase === 'compare') next.changeGuess = action.value;
  else if (action.type === 'update' && state.phase === 'compare' && state.changeGuess !== null) next.phase = 'updated';
  else if (action.type === 'answer' && state.phase === 'updated') {
    next.attempts.push(action.value);
    if (action.value === 'evidence') next.phase = 'done';
  }
  return next;
}

function evidenceRow(id, successes, failures, visible = true) {
  const total = successes + failures;
  return {id, successes, failures, sampleRate: total === 0 ? null : successes / total,
    belief: visible ? posterior(successes, failures) : null};
}

export function bayesLessonEvidence(state) {
  validateState(state);
  const hasUpdate = state.phase === 'updated' || state.phase === 'done';
  return {
    phase: state.phase, guess: state.guess, changeGuess: state.changeGuess,
    baseline: [evidenceRow('little', 3, 2, state.phase !== 'predict'), evidenceRow('many', 18, 12, state.phase !== 'predict')],
    after: hasUpdate ? [evidenceRow('little', 3, 3), evidenceRow('many', 18, 13)] : null,
    transfer: state.attempts.length > 0 ? [evidenceRow('one', 0, 1), evidenceRow('ten', 0, 10)] : null,
    ending: state.phase === 'done' ? {firstAttemptCorrect: state.attempts[0] === 'evidence', attemptsCount: state.attempts.length} : null,
  };
}
