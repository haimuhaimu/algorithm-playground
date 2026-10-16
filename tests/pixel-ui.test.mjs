import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { memoryStorage } from './storage-helper.mjs';
let serial = 0;
async function boot({ reduced = false, missingCanvas = false, storage = memoryStorage() } = {}) {
  const html = await readFile(new URL('../pixel.html', import.meta.url), 'utf8').catch(() => '');
  assert.ok(html.includes('id="editor"'), 'playable pixel page must exist');
  class Element extends EventTarget {
    constructor() { super(); this.dataset = {}; this.style = {}; this.attributes = new Map(); this.hidden = false; this.disabled = false; this.open = false; this.textContent = ''; this.width = 512; this.height = 512; this.ctx = { pixels: new Map(), clearRect() { this.pixels.clear(); }, fillRect(x, y, w, h) { if (w === 32 && h === 32) this.pixels.set(`${x},${y}`, this.fillStyle); }, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }; }
    getContext() { return missingCanvas ? null : this.ctx; }
    setAttribute(k, v) { this.attributes.set(k, String(v)); } getAttribute(k) { return this.attributes.get(k); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 256, height: 256 }; }
    setPointerCapture() {} releasePointerCapture() {} focus() {}
    showModal() { this.open = true; } close() { this.open = false; this.dispatchEvent(new Event('close')); }
  }
  const els = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
  const doc = Object.assign(new EventTarget(), { hidden: false, documentElement: new Element(), getElementById: id => els.get(id) });
  const media = Object.assign(new EventTarget(), { matches: reduced });
  const frames = new Map(); let seq = 0;
  const globals = { document: doc, window: Object.assign(new EventTarget(), { localStorage: storage }), matchMedia: () => media, requestAnimationFrame: fn => { frames.set(++seq, fn); return seq; }, cancelAnimationFrame: id => frames.delete(id) };
  const old = new Map(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const restore = () => { for (const [k, d] of old) if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; };
  Object.assign(globalThis, globals);
  try { await import(new URL('../pixel.mjs?t=' + ++serial, import.meta.url)); } catch (e) { restore(); throw e; }
  const fire = (el, type, props = {}) => el.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), props));
  return { els, doc, frames, media, restore, fire, click: id => fire(els.get(id), 'click'),
    pointer(type, x, y, id = 1) { fire(els.get('editor'), type, { clientX: x, clientY: y, pointerId: id, button: 0 }); },
    key(key, props = {}) { fire(els.get('editor'), 'keydown', { key, ...props }); },
    finish() { for (const t of [0, 2000]) { const q = [...frames.values()]; frames.clear(); for (const fn of q) fn(t); } },
    hide() { doc.hidden = true; fire(doc, 'visibilitychange'); },
    pixels: id => [...els.get(id).ctx.pixels.values()],
  };
}
test('restoring an unchanged delivered draft restores actual wire bits without sending again',async()=>{
 const storage=memoryStorage();let bits,count;
 const u=await boot({storage,reduced:true});try{
  u.click('preset-blank');u.click('send');
  bits=u.els.get('wire-bits').textContent;count=u.els.get('wire-count').textContent;
  assert.match(bits,/^[01]+$/);assert.match(count,/264/);
 }finally{u.restore();}
 const v=await boot({storage});try{
  assert.equal(v.els.get('wire-bits').textContent,bits);
  assert.equal(v.els.get('wire-count').textContent,count);
  assert.equal(v.els.get('wire-progress').style.width,'100%');
  assert.match(v.els.get('receipt').textContent,/256.*256/);
  assert.equal(v.frames.size,0);
 }finally{v.restore();}
});
test('edited draft shows its unsent packet while retaining the previous receipt; undo reconciles both',async()=>{
 const storage=memoryStorage();let originalBits;
 const u=await boot({storage,reduced:true});try{
  u.click('preset-blank');u.click('send');originalBits=u.els.get('wire-bits').textContent;
  u.click('preset-noise');
  assert.match(u.els.get('wire-count').textContent,/待寄出.*528/);
  assert.notEqual(u.els.get('wire-bits').textContent,originalBits);
  assert.match(u.els.get('wire-bits').textContent,/^[01]+$/);
  assert.equal(u.els.get('wire-progress').style.width,'0%');
 }finally{u.restore();}
 const v=await boot({storage});try{
  assert.match(v.els.get('receipt').textContent,/上次.*画纸已改/);
  assert.match(v.els.get('wire-count').textContent,/待寄出.*528/);
  assert.match(v.els.get('wire-caption').textContent,/收件处保留上次来信/,'receipt location must stay meaningful in stacked phone layouts');
  assert.equal(v.frames.size,0);
  v.click('undo');assert.equal(v.els.get('wire-bits').textContent,originalBits);
  assert.match(v.els.get('wire-count').textContent,/已送达.*264/);
  assert.equal(v.els.get('wire-progress').style.width,'100%');
 }finally{v.restore();}
});
test('cancelled resend returns to current unsent packet and cannot replace the prior receipt',async()=>{
 const u=await boot();try{
  u.click('preset-blank');u.click('send');u.finish();const old=u.pixels('receiver');
  u.click('preset-noise');u.click('send');const stale=[...u.frames.values()][0];u.hide();
  assert.match(u.els.get('wire-count').textContent,/待寄出.*528/);
  assert.match(u.els.get('wire-bits').textContent,/^[01]+$/);
  stale(9999);assert.deepEqual(u.pixels('receiver'),old);assert.equal(u.frames.size,0);
 }finally{u.restore();}
});
test('restoring a draft without any receipt never claims a previous delivery',async()=>{
 const storage=memoryStorage();const u=await boot({storage});try{u.click('preset-noise');}finally{u.restore();}
 const v=await boot({storage});try{
  assert.match(v.els.get('receipt').textContent,/没有来信/);
  assert.doesNotMatch(v.els.get('status').textContent,/上次来信已恢复/);
  assert.match(v.els.get('wire-count').textContent,/待寄出.*528/);
  assert.equal(v.frames.size,0);
 }finally{v.restore();}
});
test('reload restores drawing, brush, undo and only the last successfully delivered postcard',async()=>{
 const storage=memoryStorage();let drawing,received;
 const u=await boot({storage});try{
  u.click('color-3');u.key(' ');u.click('send');u.finish();received=u.pixels('receiver');
  u.click('preset-heart');drawing=u.pixels('editor');u.click('send');
  const writes=storage.writes;u.pointer('pointerdown',1,1);u.pointer('pointermove',230,1);u.pointer('pointercancel',230,1);
  assert.equal(storage.writes,writes,'incomplete strokes and delivery must not be saved');u.hide();
 }finally{u.restore();}
 const v=await boot({storage});try{
  assert.deepEqual(v.pixels('editor'),drawing);assert.deepEqual(v.pixels('receiver'),received);
  assert.equal(v.els.get('color-3').getAttribute('aria-pressed'),'true');assert.equal(v.frames.size,0);
  assert.match(v.els.get('receipt').textContent,/上次|待重新/);assert.match(v.els.get('draft-status').textContent,/恢复/);
  v.click('undo');assert.deepEqual(v.pixels('editor'),received);
  v.click('forget-draft');assert.equal(storage.records.size,0);assert.deepEqual(v.pixels('editor'),received);v.hide();assert.equal(storage.records.size,0);
 }finally{v.restore();}
});
test('unavailable storage leaves the postcard playable with an honest warning',async()=>{
 const storage={getItem(){throw Error('blocked');},setItem(){throw Error('quota');},removeItem(){throw Error('blocked');}};
 const u=await boot({storage,reduced:true});try{u.click('preset-heart');u.click('send');assert.deepEqual(u.pixels('receiver'),u.pixels('editor'));assert.match(u.els.get('draft-status').textContent,/无法|未保存/);}finally{u.restore();}
});
test('forgetting a draft cancels active delivery so it cannot recreate deleted storage',async()=>{
 const storage=memoryStorage(),u=await boot({storage});try{
  u.click('preset-heart');u.click('send');const pending=[...u.frames.values()][0];u.click('forget-draft');
  assert.equal(u.frames.size,0);pending(2000);u.finish();assert.equal(storage.records.size,0);assert.match(u.els.get('receipt').textContent,/没有/);
 }finally{u.restore();}
});
test('the drawing-side parcel size follows committed edits, cancellation and undo', async () => {
  const u = await boot(); try {
    const badge = u.els.get('drawing-size'); assert.ok(badge, 'parcel size must be visible beside the drawing');
    const original = badge.textContent; assert.equal(original, u.els.get('packed-size').textContent + ' B');
    u.click('preset-noise'); assert.equal(badge.textContent, '66 B');
    u.click('preset-blank'); assert.equal(badge.textContent, '33 B');
    u.pointer('pointerdown', 1, 1); u.pointer('pointermove', 220, 1); u.pointer('pointercancel', 220, 1);
    assert.equal(badge.textContent, '33 B');
    u.click('undo'); assert.equal(badge.textContent, '66 B');
    u.click('undo'); assert.equal(badge.textContent, original);
  } finally { u.restore(); }
});
test('send decodes all 256 actual pixels, commits only on arrival, and ignores repeat sends', async () => {
  const u = await boot(); try {
    const expected = u.pixels('editor'); u.click('send'); u.click('send');
    assert.equal(u.frames.size, 1); assert.match(u.els.get('receipt').textContent, /寄送中/);
    u.finish(); assert.deepEqual(u.pixels('receiver'), expected);
    assert.match(u.els.get('receipt').textContent, /256.*256/); assert.equal(u.frames.size, 0);
  } finally { u.restore(); }
});
test('cancelled strokes and extra pointers preserve work; pointerup endpoint is painted and undo restores', async () => {
  const u = await boot({ reduced: true }); try {
    u.click('send'); const before = u.pixels('editor'); const receipt = u.els.get('receipt').textContent;
    u.click('color-1'); u.pointer('pointerdown', 1, 1); u.pointer('pointermove', 200, 1); u.pointer('pointercancel', 200, 1);
    assert.deepEqual(u.pixels('editor'), before); assert.equal(u.els.get('receipt').textContent, receipt);
    u.pointer('pointerdown', 1, 1); u.pointer('pointerdown', 240, 240, 2); u.pointer('pointerup', 240, 240, 2); u.pointer('pointerup', 255, 1);
    const after = u.pixels('editor'); assert.ok(after.slice(0, 16).every(x => x === after[0])); assert.notDeepEqual(after, before);
    assert.match(u.els.get('receipt').textContent, /上次|待重新/); u.click('undo'); assert.deepEqual(u.pixels('editor'), before);
  } finally { u.restore(); }
});
test('editing, hiding and help invalidate send callbacks and preserve the last received postcard', async () => {
  const u = await boot(); try {
    u.click('send'); u.finish(); const old = u.pixels('receiver');
    u.click('preset-heart'); u.click('send'); const stale = [...u.frames.values()][0];
    u.click('preset-noise'); stale(9999); assert.equal(u.frames.size, 0); assert.deepEqual(u.pixels('receiver'), old);
    u.click('send'); const stale2 = [...u.frames.values()][0]; u.hide(); u.doc.hidden = false; stale2(9999);
    assert.equal(u.frames.size, 0); assert.deepEqual(u.pixels('receiver'), old);
    u.click('send'); u.click('about'); assert.equal(u.frames.size, 0); u.click('send'); assert.equal(u.frames.size, 0);
  } finally { u.restore(); }
});
test('keyboard drawing and reduced motion use the same real packet, including expansion', async () => {
  const u = await boot({ reduced: true }); try {
    u.click('preset-blank'); u.key('2'); u.key('ArrowRight'); u.key(' '); u.click('send');
    assert.equal(u.frames.size, 0); assert.deepEqual(u.pixels('receiver'), u.pixels('editor'));
    u.click('preset-noise'); assert.equal(u.els.get('packed-size').textContent, '66');
    assert.match(u.els.get('saving').textContent, /多.*2/); u.click('send'); assert.match(u.els.get('receipt').textContent, /256.*256/);
  } finally { u.restore(); }
});
test('no-op strokes preserve receipt and undo; unavailable canvas has a readable fallback', async () => {
  const u = await boot({ reduced: true }); try {
    u.click('preset-blank'); const blank = u.pixels('editor');
    u.click('color-1'); u.pointer('pointerdown', 100, 100); u.pointer('pointerup', 100, 100);
    u.click('send'); const receipt = u.els.get('receipt').textContent;
    u.click('color-0'); u.pointer('pointerdown', 1, 1); u.pointer('pointerup', 1, 1);
    assert.equal(u.els.get('receipt').textContent, receipt);
    u.click('undo'); assert.deepEqual(u.pixels('editor'), blank, 'no-op cannot consume an undo slot');
  } finally { u.restore(); }
  const v = await boot({ missingCanvas: true }); try {
    assert.equal(v.els.get('send').disabled, true); assert.match(v.els.get('status').textContent, /Canvas|画布/);
  } finally { v.restore(); }
});
test('undo retains exactly the most recent thirty modifications', async () => {
  const u = await boot(); try {
    u.click('preset-blank'); u.click('color-1');
    for (let i = 0; i < 31; i++) { const x = i % 16 * 16 + 8, y = Math.floor(i / 16) * 16 + 8; u.pointer('pointerdown', x, y); u.pointer('pointerup', x, y); }
    for (let i = 0; i < 30; i++) u.click('undo');
    assert.equal(u.els.get('count-1').textContent, '墨黑 · 1');
    assert.equal(u.els.get('undo').disabled, true);
    const kept = u.pixels('editor'); u.click('undo'); assert.deepEqual(u.pixels('editor'), kept);
  } finally { u.restore(); }
});
test('blur and lost capture discard drafts without changing history or the received image', async () => {
  const u = await boot({ reduced: true }); try {
    u.click('send'); const before = u.pixels('editor'), receipt = u.els.get('receipt').textContent;
    for (const type of ['blur', 'lostpointercapture']) {
      u.pointer('pointerdown', 1, 1); u.pointer('pointermove', 250, 1);
      u.fire(u.els.get('editor'), type, { pointerId: 1 });
      assert.deepEqual(u.pixels('editor'), before);
      assert.equal(u.els.get('receipt').textContent, receipt);
      assert.equal(u.els.get('undo').disabled, true);
    }
  } finally { u.restore(); }
});
