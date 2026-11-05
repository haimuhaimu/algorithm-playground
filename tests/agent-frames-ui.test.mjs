import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';

const pageFile = new URL('../agent-frames.html', import.meta.url);
const uiFile = new URL('../agent-frames-ui.mjs', import.meta.url);
const mount = existsSync(uiFile) ? (await import(uiFile)).mountAgentFrames : null;

function open(journey) {
 assert.equal(typeof mount, 'function', 'Level 03 needs an interactive player');
 const html = readFileSync(pageFile, 'utf8');
 class Element extends EventTarget {
  hidden = false; disabled = false; dataset = {}; textContent = ''; innerHTML = ''; value = '';
  click() { if (!this.hidden && !this.disabled) this.dispatchEvent(new Event('click')); }
  setAttribute(key, value) { this[key] = String(value); }
  focus() {}
  select() {}
 }
 const nodes = new Map([...html.matchAll(/<[a-z][\w:-]*\b[^>]*\bid="([\w-]+)"[^>]*>/g)].map(([tag, id]) => [
  id, Object.assign(new Element(), {hidden: /\shidden(?:\s|>)/.test(tag), disabled: /\sdisabled(?:\s|>)/.test(tag)})
 ]));
 const getElementById = id => nodes.get(id) ?? null;
 const page = new URL('http://127.0.0.1:3157/agent-frames.html#mission');
 if (journey) {
  page.searchParams.set('genaiReturn', 'http://127.0.0.1:3156/');
  page.searchParams.set('genaiRequest', 'agent-frames-0123456789');
  page.searchParams.set('genaiJourney', journey);
 }
 const sends = [], timers = new Map();
 let lastTimer = 0;
 const location = {href: page.href, assign: url => sends.push(url)};
 const document = Object.assign(new EventTarget(), {getElementById, documentElement: {dataset: {}}, hidden: false});
 const window = Object.assign(new EventTarget(), {
  location, navigator: {}, matchMedia: () => Object.assign(new EventTarget(), {matches: false}),
  setTimeout(fn) { timers.set(++lastTimer, fn); return lastTimer; },
  clearTimeout(id) { timers.delete(id); }
 });
 for (const context of [document, window]) for (const key of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(context, key, {get() { throw Error('The experiment must not touch storage'); }});
 }
 mount({document, window});
 const e = name => {
  const node = getElementById(`frames-${name}`);
  assert.ok(node, `Missing real control: ${name}`);
  return node;
 };
 const click = (...names) => names.forEach(name => e(name).click());
 const step = count => { for (let i = 0; i < count; i++) click('advance'); };
 const tick = () => {
  const [id, fn] = timers.entries().next().value;
  timers.delete(id); fn();
 };
 return {e, click, step, sends, location, document, timers, tick};
}

test('playback is opt-in; pause and a hidden page stop it without consuming future frames', () => {
 const {e, click, step, document, timers, tick} = open();
 assert.equal(e('scene').dataset.frame, '0');
 assert.equal(timers.size, 0);
 click('play'); tick();
 assert.equal(e('scene').dataset.frame, '1');
 click('play'); assert.equal(timers.size, 0);
 step(1); assert.equal(e('scene').dataset.frame, '2');
 click('play');
 document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
 assert.equal(timers.size, 0);
 document.hidden = false; document.dispatchEvent(new Event('visibilitychange'));
 assert.equal(timers.size, 0);
 assert.equal(e('scene').dataset.frame, '2');
});

test('the door evidence appears in the current frame only; comparison is not visible until both attempts finish', () => {
 const {e, click, step} = open();
 for (let id = 0; id < 9; id++) {
  assert.equal(e('scene').dataset.frame, String(id));
  assert.equal(e('scene').innerHTML.includes('允许卸货'), id === 5);
  assert.equal(e('compare').hidden, true);
  if (id < 8) step(1);
 }
 click('start-manual'); step(4);
 assert.doesNotMatch(e('caption').textContent, /允许卸货/);
 click('pin'); step(4);
 assert.equal(e('compare').hidden, false);
 assert.equal((e('timeline').innerHTML.match(/data-inspect-frame=/g) ?? []).length, 9);
 assert.match(e('fixed-result').textContent, /证据不足/);
 assert.match(e('manual-result').textContent, /证据不足/);
 assert.equal(e('share').hidden, false);
 click('export');
 const receipt = JSON.parse(e('export-text').value);
 assert.deepEqual(receipt.result.evidence.manual.frameIds, [0, 4, 8]);
 assert.equal(receipt.result.evidence.manual.signFrame, null);
});

test('stepping while focused on the controls announces the current visual evidence', () => {
 const {e, step} = open();
 step(4);
 assert.match(e('announcement').textContent, /第 4 帧.*挡住门边牌子/);
 step(1);
 assert.match(e('announcement').textContent, /第 5 帧.*允许卸货/);
 step(1);
 assert.doesNotMatch(e('announcement').textContent, /允许卸货/);
});

test('redo discards the unsent second attempt and its export while preserving the fixed baseline', () => {
 const {e, click, step} = open();
 step(8); click('start-manual'); step(3); click('pin'); step(5); click('export');
 const before = JSON.parse(e('export-text').value);
 click('redo');
 assert.equal(e('share').hidden, true);
 assert.equal(e('compare').hidden, true);
 assert.equal(e('export-text').value, '');
 assert.equal(e('scene').dataset.frame, '0');
 assert.match(e('feedback').textContent, /第一轮.*保留|保留.*第一轮/);
 step(5); click('pin'); step(3); click('export');
 const after = JSON.parse(e('export-text').value);
 assert.deepEqual(after.result.evidence.fixed, before.result.evidence.fixed);
 assert.deepEqual(after.actions.slice(0, 9), before.actions.slice(0, 9));
 assert.equal(after.actions.filter(entry => entry.action === 'pin').length, 1);
 assert.deepEqual(after.result.evidence.manual.frameIds, [0, 5, 8]);
 assert.equal(after.result.evidence.manual.signFrame, 5);
 assert.match(e('manual-result').textContent, /允许卸货/);
});

test('an unpinned attempt is not shareable and can restart from the same baseline', () => {
 const {e, click, step, sends} = open('agent-frames');
 step(8); click('start-manual'); step(8);
 click('return'); click('export');
 assert.equal(e('share').hidden, true);
 assert.equal(e('export-text').value, '');
 assert.deepEqual(sends, []);
 click('redo'); step(5); click('pin'); step(3);
 assert.equal(e('share').hidden, false);
});

test('a legitimate miss can leave via an explicit, matching handoff only', () => {
 const {e, click, step, sends, location} = open('agent-frames');
 step(8); click('start-manual'); step(6); click('pin'); step(2);
 assert.deepEqual(sends, []);
 click('return');
 const target = new URL(sends[0]);
 const envelope = JSON.parse(Buffer.from(target.hash.slice('#playground='.length), 'base64url').toString());
 assert.equal(target.search, '?page=routes&section=agent-frames-journey');
 assert.equal(envelope.requestId, 'agent-frames-0123456789');
 assert.equal(envelope.receipt.result.evidence.manual.conclusion, 'insufficient-evidence');
 location.href = location.href.replace('agent-frames-0123456789', 'changed-request-0123456789');
 click('return'); assert.equal(sends.length, 1);
 assert.equal(e('os-fallback').hidden, false);
});
