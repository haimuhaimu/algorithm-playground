import test from 'node:test';
import assert from 'node:assert/strict';

const idle = ['./studio-heim-idle.png', './studio-bobby-idle.png', './studio-chouchou-idle.png'];
const run = ['./studio-heim-run.png', './studio-bobby-run.png', './studio-chouchou-run.png'];
let bootId = 0;

async function boot(t, { hidden = false, reduced = false, observe = true } = {}) {
 const images = new Map(), frames = new Map();
 const drawn = [];
 let intersect, frameId = 0;
 const ctx = Object.fromEntries('arc beginPath clearRect closePath ellipse fill fillRect fillText lineTo moveTo restore rotate save scale setTransform translate'.split(' ').map(name => [name, () => {}]));
 ctx.createRadialGradient = () => ({ addColorStop() {} });
 ctx.drawImage = image => drawn.push(image.src);
 class Sprite extends EventTarget {
  set src(src) { this.url = src; images.set(src, this); requests.push(src); }
  get src() { return this.url; }
 }
 const requests = [];
 class Observer {
  constructor(callback) { intersect = isIntersecting => callback([{ isIntersecting }]); }
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
 }
 const element = () => Object.assign(new EventTarget(), { dataset: {}, setAttribute() {} });
 const canvas = Object.assign(element(), { getContext: () => ctx, getBoundingClientRect: () => ({ width: 900, height: 330 }) });
 const motion = element();
 const elements = { '#home-theme': element(), '#hero-canvas': canvas, '#hero-fallback': element(), '#hero-motion': motion, '#hero-cat-stage': element() };
 const document = Object.assign(new EventTarget(), { hidden, documentElement: element(), querySelector: selector => elements[selector] });
 const media = Object.assign(new EventTarget(), { matches: reduced });
 const color = Object.assign(new EventTarget(), { matches: false });
 const window = new EventTarget();
 if (observe) window.IntersectionObserver = Observer;
 const globals = { window, document, location: { hash: '', search: '' }, Image: Sprite, devicePixelRatio: 1, IntersectionObserver: Observer,
  matchMedia: query => query === '(prefers-reduced-motion: reduce)' ? media : color,
  requestAnimationFrame: callback => (frames.set(++frameId, callback), frameId), cancelAnimationFrame: id => frames.delete(id) };
 for (const [key, value] of Object.entries(globals)) {
  const prior = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { value, configurable: true });
  t.after(() => prior ? Object.defineProperty(globalThis, key, prior) : delete globalThis[key]);
 }
 await import(`../../src/home/home.mjs?art-test=${++bootId}`);
 const fire = (target, type) => target.dispatchEvent(new Event(type));
 return { canvas, motion, requests, drawn,
  intersect: value => intersect(value),
  visible(value) { document.hidden = !value; fire(document, 'visibilitychange'); },
  reduce(value) { media.matches = value; fire(media, 'change'); },
  leave: () => fire(window, 'pagehide'), restore: () => fire(window, 'pageshow'),
  clickMotion: () => fire(motion, 'click'),
  load(src) { const image = images.get(src); Object.assign(image, { complete: true, naturalWidth: 360, naturalHeight: 200 }); fire(image, 'load'); },
  tick(now) { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(now); }
 };
}

test('visible playback prewarms the running art once and uses it on the original first run', async t => {
 const page = await boot(t);
 assert.deepEqual(page.requests, idle, 'waiting cats need only their static poses before the first viewport observation');
 page.intersect(false);
 assert.deepEqual(page.requests, idle);
 page.intersect(true);
 assert.deepEqual(page.requests, [...idle, ...run], 'prewarm while the cats are still waiting for A*');
 for (const src of [...idle, ...run]) page.load(src);
 assert.equal(page.canvas.dataset.catArt, 'studio');
 page.tick(0);
 page.tick(4759);
 assert.equal(page.canvas.dataset.catPhase, 'searching');
 page.drawn.length = 0;
 page.tick(4800);
 assert.equal(page.canvas.dataset.catPhase, 'running');
 assert.deepEqual(new Set(page.drawn), new Set([run[0], idle[1], idle[2]]));
 page.clickMotion();
 page.intersect(false);
 page.intersect(true);
 page.clickMotion();
 assert.deepEqual(page.requests, [...idle, ...run]);
});

test('a hidden or reduced-motion page does not prewarm until it can play', async t => {
 const page = await boot(t, { hidden: true, reduced: true });
 page.intersect(true);
 assert.deepEqual(page.requests, idle);
 assert.equal(page.canvas.dataset.catPhase, 'arrived');
 assert.equal(page.motion.disabled, true);
 for (const src of idle) page.load(src);
 assert.deepEqual(new Set(page.drawn), new Set(idle), 'the reduced-motion frame uses the unchanged idle art');
 page.reduce(false);
 assert.deepEqual(page.requests, idle, 'still hidden');
 page.reduce(true);
 page.visible(true);
 assert.deepEqual(page.requests, idle, 'still reduced motion');
 page.reduce(false);
 assert.deepEqual(page.requests, [...idle, ...run]);
});

test('a paused animation waits for both playback and a fresh viewport observation after restore', async t => {
 const page = await boot(t);
 page.clickMotion();
 page.intersect(true);
 assert.deepEqual(page.requests, idle, 'paused before first paint');
 page.leave();
 page.restore();
 page.clickMotion();
 assert.deepEqual(page.requests, idle, 'do not reuse the prior viewport observation');
 page.intersect(true);
 assert.deepEqual(page.requests, [...idle, ...run]);
});

test('playback still prewarms when IntersectionObserver is unavailable', async t => {
 const page = await boot(t, { observe: false });
 assert.equal(page.requests.length, 6);
 assert.deepEqual(new Set(page.requests), new Set([...idle, ...run]));
 assert.equal(page.canvas.dataset.motion, 'playing');
});
