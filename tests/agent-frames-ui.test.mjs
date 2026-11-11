import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';

const pageFile = new URL('../agent-frames.html', import.meta.url);
const uiFile = new URL('../agent-frames-ui.mjs', import.meta.url);
const mount = existsSync(uiFile) ? (await import(uiFile)).mountAgentFrames : null;

function open(journey) {
 assert.equal(typeof mount, 'function', 'Level 03 needs an interactive player');
 const html = readFileSync(pageFile, 'utf8');
 let focused = null;
 class Element extends EventTarget {
  hidden = false; disabled = false; dataset = {}; textContent = ''; innerHTML = ''; value = '';
  click() { if (!this.hidden && !this.disabled) this.dispatchEvent(new Event('click')); }
  setAttribute(key, value) { this[key] = String(value); }
  getAttribute(key) { return this[key] ?? null; }
  focus() { focused = this; }
  select() {}
 }
 const nodes = new Map([...html.matchAll(/<[a-z][\w:-]*\b[^>]*\bid="([\w-]+)"[^>]*>/g)].map(([tag, id]) => [
  id, Object.assign(new Element(), Object.fromEntries([...tag.matchAll(/\s(href|target|rel)="([^"]*)"/g)].map(([,key,value])=>[key,value.replaceAll('&amp;','&')])), {hidden: /\shidden(?:\s|>)/.test(tag), disabled: /\sdisabled(?:\s|>)/.test(tag)})
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
 return {e, click, step, sends, location, document, window, timers, tick, focused: () => focused};
}

test('the received packet shows only frames already captured, never future footage',()=>{
 const {e,click,step}=open();
 const shown=()=>[...e('slots').innerHTML.matchAll(/data-packet-frame="(\d+)"/g)].map(m=>Number(m[1]));
 assert.deepEqual(shown(),[0]);
 assert.equal((e('slots').innerHTML.match(/<svg /g)||[]).length,1);
 assert.doesNotMatch(e('slots').innerHTML,/允许卸货/);
 step(4);assert.deepEqual(shown(),[0,4]);
 step(4);assert.deepEqual(shown(),[0,4,8]);
 click('start-manual');step(5);assert.deepEqual(shown(),[0]);
 click('pin');assert.deepEqual(shown(),[0,5]);
 assert.match(e('slots').innerHTML,/允许卸货/);
});

test('each comparison packet displays exactly its actual three frames without adding the missing sign',()=>{
 for(const pick of [4,5]){
  const {e,click,step}=open();step(8);click('start-manual');step(pick);click('pin');step(8-pick);
  for(const [side,want]of [['fixed',[0,4,8]],['manual',[0,pick,8]]]){
   const markup=e(side+'-ids').innerHTML;
   assert.deepEqual([...markup.matchAll(/data-packet-frame="(\d+)"/g)].map(m=>Number(m[1])),want);
   assert.equal((markup.match(/<svg /g)||[]).length,3);
   assert.equal(markup.includes('允许卸货'),side==='manual'&&pick===5);
   assert.doesNotMatch(markup,/studio-.*\.png/,'Heim stays outside the evidence');
  }
  click('export');const receipt=JSON.parse(e('export-text').value);
  assert.deepEqual(receipt.result.evidence.fixed.frameIds,[0,4,8]);
  assert.deepEqual(receipt.result.evidence.manual.frameIds,[0,pick,8]);
  assert.equal(receipt.result.evidence.manual.signFrame,pick===5?5:null);
 }
});

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

test('the fixed round reports its actual uncertain verdict before asking for a manual frame', () => {
 const {e, click, step} = open();
 assert.equal(e('baseline-result').hidden, true);
 step(7);
 assert.equal(e('baseline-result').hidden, true);
 step(1);
 assert.equal(e('baseline-result').hidden, false);
 assert.match(e('baseline-verdict').textContent, /证据不足/);
 assert.equal(e('compare').hidden, true, 'the full comparison still waits for round two');
 assert.doesNotMatch(e('baseline-verdict').textContent, /禁止|第 5 帧/);
 click('start-manual');
 assert.equal(e('baseline-result').hidden, true);
 step(5); click('pin'); step(3); click('export');
 assert.equal(JSON.parse(e('export-text').value).result.evidence.fixed.conclusion, 'insufficient-evidence');
});

test('both review exits resume the same paused frame and pick without adding actions', () => {
 for (const exit of ['resume', 'resume-bottom']) {
  const {e, click, step, tick, timers, focused, document} = open();
  assert.equal(e('resume-footer').hidden, true);
  step(8); click('start-manual'); step(3); click('pin'); step(5); click('export');
  const oldJSON = e('export-text').value;
  click('redo'); step(2); click('pin'); click('play'); tick(); click('review');
  assert.equal(e('resume-footer').hidden, false);
  assert.match(e('resume-state').textContent, /第 3 帧.*第 2 帧/);
  click('export'); assert.equal(e('export-text').value, oldJSON);
  document.hidden = true; e(exit).dispatchEvent(new Event('click'));
  assert.equal(e('workbench').hidden, true, 'background clicks cannot resume');
  document.hidden = false; click(exit);
  assert.equal(e('resume-footer').hidden, true);
  assert.equal(e('workbench').hidden, false);
  assert.equal(e('scene').dataset.frame, '3');
  assert.match(e('pin').textContent, /第 2 帧/);
  assert.equal(e('export-text').value, '');
  assert.equal(timers.size, 0);
  assert.equal(focused(), e('advance'));
  step(5); click('export');
  const receipt = JSON.parse(e('export-text').value);
  assert.equal(receipt.actions.length, 18);
  assert.equal(receipt.actions.filter(x => x.action === 'pin').length, 1);
  assert.equal(receipt.result.evidence.manualPick, 2);
 }
});

test('the bottom review exit preserves an empty finished attempt and its previous result', () => {
 const {e, click, step, focused} = open();
 step(8); click('start-manual'); step(5); click('pin'); step(3);
 click('redo'); step(8); click('review');
 assert.equal(e('resume-footer').hidden, false);
 assert.match(e('resume-state').textContent, /没有.*中间帧/);
 click('resume-bottom');
 assert.equal(e('retry-empty').hidden, false);
 assert.equal(focused(), e('retry-empty'));
 click('review'); click('export');
 assert.equal(JSON.parse(e('export-text').value).result.evidence.manualPick, 5);
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

test('a manual action brings a clipped player back into view without moving focus or scrolling on playback ticks', () => {
 const {e, click, step, document, window, tick, focused} = open();
 step(8); click('start-manual'); step(3);
 let top = -90, scrolls = 0;
 window.innerHeight = 560;
 window.scrollBy = ({top: delta}) => { top -= delta; scrolls++; };
 const player = document.getElementById('frames-player') ?? e('workbench');
 player.getBoundingClientRect = () => ({top, bottom: top + 310, height: 310});
 e('advance').focus(); step(1);
 assert.equal(e('scene').dataset.frame, '4');
 assert.ok(top >= 0 && top + 310 <= 560, 'both the current image and the controls must fit');
 assert.equal(focused(), e('advance'));
 assert.equal(scrolls, 1);
 click('play'); tick();
 assert.equal(e('scene').dataset.frame, '5');
 assert.equal(scrolls, 1, 'an automatic frame must not scroll the page');
 click('pin');
 assert.match(e('pin').textContent, /已保留第 5 帧/);
 assert.equal(scrolls, 1, 'pinning an already visible player must not scroll');
});

test('redo keeps the last complete result reviewable without changing the new attempt', () => {
 const {e, click, step} = open();
 step(8); click('start-manual'); step(3); click('pin'); step(5); click('export');
 const before = JSON.parse(e('export-text').value);
 click('redo');
 assert.equal(e('share').hidden, true);
 assert.equal(e('compare').hidden, true);
 assert.equal(e('export-text').value, '');
 assert.equal(e('scene').dataset.frame, '0');
 assert.match(e('feedback').textContent, /第一轮.*保留|保留.*第一轮/);
 assert.equal(e('last-entry').hidden, false);
 click('review');
 assert.equal(e('compare').hidden, false);
 assert.equal(e('workbench').hidden, true);
 assert.match(e('manual-result').textContent, /证据不足/);
 click('export');
 assert.deepEqual(JSON.parse(e('export-text').value), before);
 click('resume');
 assert.equal(e('scene').dataset.frame, '0');
 assert.equal(e('compare').hidden, true);
 assert.equal(e('export-text').value, '');
 step(5); click('pin'); step(3); click('export');
 const after = JSON.parse(e('export-text').value);
 assert.deepEqual(after.result.evidence.fixed, before.result.evidence.fixed);
 assert.deepEqual(after.actions.slice(0, 9), before.actions.slice(0, 9));
 assert.equal(after.actions.filter(entry => entry.action === 'pin').length, 1);
 assert.deepEqual(after.result.evidence.manual.frameIds, [0, 5, 8]);
 assert.equal(after.result.evidence.manual.signFrame, 5);
 assert.match(e('manual-result').textContent, /允许卸货/);
 assert.equal(e('retry-compare').hidden, false);
 assert.match(e('previous-pick').innerHTML, /data-packet-frame="3"/);
 assert.match(e('current-pick').innerHTML, /data-packet-frame="5"/);
 assert.match(e('previous-result').textContent, /证据不足/);
 assert.match(e('current-result').textContent, /允许卸货/);
 assert.match(e('retry-summary').textContent, /3.*5/);
});

test('an empty retry cannot replace the previous complete attempt; later completions compare the latest pair only', () => {
 const {e, click, step} = open();
 step(8); click('start-manual'); step(3); click('pin'); step(5);
 click('redo'); step(8);
 assert.equal(e('share').hidden, true);
 click('review'); click('export');
 assert.equal(JSON.parse(e('export-text').value).result.evidence.manualPick, 3);
 click('resume');
 assert.equal(e('retry-empty').hidden, false);
 click('retry-empty'); step(5); click('pin'); step(3);
 assert.match(e('previous-pick').innerHTML, /data-packet-frame="3"/);
 click('redo'); step(2); click('pin'); step(6);
 assert.match(e('previous-pick').innerHTML, /data-packet-frame="5"/);
 assert.match(e('current-pick').innerHTML, /data-packet-frame="2"/);
 assert.match(e('previous-result').textContent, /允许卸货/);
 assert.match(e('current-result').textContent, /证据不足/);
 click('export');
 const receipt = JSON.parse(e('export-text').value);
 assert.deepEqual(receipt.result.evidence.fixed.frameIds, [0,4,8]);
 assert.equal(receipt.actions.filter(x=>x.action==='pin').length, 1);
 assert.equal(receipt.result.evidence.manualPick, 2);
});

test('review pauses playback and resumes the same frame and pick without carrying over timers', () => {
 const {e, click, step, timers, tick, focused} = open();
 step(8); click('start-manual'); step(3); click('pin'); step(5);
 click('redo'); step(2); click('pin'); click('play'); tick();
 assert.equal(e('scene').dataset.frame, '3');
 click('review'); assert.equal(timers.size, 0);
 click('resume');
 assert.equal(e('scene').dataset.frame, '3');
 assert.equal(timers.size, 0);
 assert.match(e('pin').textContent, /已保留第 2 帧/);
 assert.equal(focused(), e('advance'));
 step(5); click('export');
 assert.equal(JSON.parse(e('export-text').value).result.evidence.manualPick, 2);
});

test('a historical view cannot automatically return under the current request, but the current completed run can', () => {
 const {e, click, step, sends} = open('agent-frames');
 step(8); click('start-manual'); step(3); click('pin'); step(5);
 click('redo'); click('review');
 assert.equal(e('return').hidden, true);
 e('return').dispatchEvent(new Event('click'));
 assert.deepEqual(sends, []);
 assert.equal(e('os-link').hidden, false);
 click('export'); assert.equal(JSON.parse(e('export-text').value).result.evidence.manualPick, 3);
 click('resume'); step(5); click('pin'); step(3); click('return');
 assert.equal(sends.length, 1);
 const target = new URL(sends[0]);
 const envelope = JSON.parse(Buffer.from(target.hash.slice('#playground='.length), 'base64url').toString());
 assert.equal(envelope.receipt.result.evidence.manualPick, 5);
 assert.equal(envelope.requestId, 'agent-frames-0123456789');
});

test('direct and invalid-journey entries offer a new-tab manual review route with no request or receipt', () => {
 for (const journey of [undefined, 'agent-tool-loop']) {
  const {e, click, step, sends} = open(journey);
  step(8); click('start-manual'); step(3); click('pin'); step(5);
  assert.equal(e('return').hidden, true);
  assert.equal(e('os-link').hidden, false);
  const link = new URL(e('os-link').href);
  assert.equal(link.href, 'https://haimuhaimu.github.io/genai-learning-os/?page=routes&section=agent-frames-journey');
  assert.equal(link.hash, '');
  assert.equal(e('os-link').target, '_blank');
  assert.match(e('os-link').rel, /noopener/);
  assert.deepEqual(sends, []);
 }
});

test('stale copy completion cannot affect a restored view of the same historical receipt', async () => {
 for (const failure of [false,true]) {
  const {e, click, step, window, focused} = open();
  let resolve, reject;
  window.navigator.clipboard = {writeText:()=>new Promise((a,b)=>{resolve=a;reject=b;})};
  step(8); click('start-manual'); step(3); click('pin'); step(5);
  click('redo'); click('review'); click('export'); click('copy');
  click('resume'); click('review'); click('export');
  e('compare-title').focus();
  const message = e('share-status').textContent;
  if (failure) reject(Error('denied')); else resolve();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(e('share-status').textContent, message);
  assert.equal(focused(), e('compare-title'));
 }
});

test('an unpinned attempt is not shareable and can restart from the same baseline', () => {
 const {e, click, step, sends} = open('agent-frames');
 step(8); click('start-manual'); step(8);
 click('return'); click('export');
 assert.equal(e('share').hidden, true);
 assert.equal(e('export-text').value, '');
 assert.deepEqual(sends, []);
 click('retry-empty'); step(5); click('pin'); step(3);
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
