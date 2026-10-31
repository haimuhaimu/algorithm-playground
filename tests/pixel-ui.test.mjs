import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { memoryStorage } from './storage-helper.mjs';
let serial = 0;
test('allocating codes preserves editor, draft writes, last receipt and existing recipient/reorder exercises',async()=>{
 const storage=memoryStorage(),u=await boot({storage,reduced:true});try{
  assert.ok(u.els.has('code-start'),'code allocation must be integrated in the actual postcard page');
  u.click('send');const drawing=u.pixels('editor'),received=u.pixels('receiver'),writes=storage.writes;
  u.click('code-start');
  for(const i of [0,3])u.click('code-group-'+i);u.click('code-merge');
  u.click('code-undo');u.click('code-retry');
  assert.deepEqual(u.pixels('editor'),drawing);assert.deepEqual(u.pixels('receiver'),received);
  assert.equal(storage.writes,writes);assert.equal(u.frames.size,0);
  u.click('recipient-start');assert.equal(u.els.get('recipient-lesson').hidden,false);
  u.click('reorder-start');assert.equal(u.els.get('reorder-lesson').hidden,false);
 }finally{u.restore();}
});
test('recipient reads actual bits and restores eight cells without editing or saving the postcard',async()=>{
 const storage=memoryStorage(),u=await boot({storage,reduced:true});try{
  assert.ok(u.els.has('recipient-start'),'recipient entry exists');
  u.click('send');const drawing=u.pixels('editor'),received=u.pixels('receiver'),writes=storage.writes;
  u.click('recipient-start');assert.equal(u.els.get('recipient-lesson').hidden,false);
  assert.equal(u.els.get('recipient-title').scrollOptions.block,'start','entry must reveal the lesson, not just its bottom-edge title');
  const source=u.els.get('recipient-source-strip').innerHTML;
  u.click('recipient-begin');assert.equal(u.els.get('recipient-source').hidden,true);
  assert.equal(u.els.get('recipient-color-0').disabled,true);
  u.click('recipient-color-0');assert.match(u.els.get('recipient-progress').textContent,/0.*8/);
  for(let i=0;i<8;i++){
   let guard=0;while(!u.els.get('recipient-read').disabled && guard++<4)u.click('recipient-read');
   const prefix=u.els.get('recipient-prefix').textContent;
   const correct=[0,1,2,3].find(c=>u.els.get('recipient-code-'+c).textContent===prefix);
   assert.ok(correct!==undefined);
   if(i===0){u.click('recipient-color-'+((correct+1)%4));assert.match(u.els.get('recipient-feedback').textContent,/不对应/);}
   u.click('recipient-color-'+correct);
  }
  assert.equal(u.els.get('recipient-end').hidden,false);
  assert.match(u.els.get('recipient-verdict').textContent,/8.*8/);
  assert.equal(u.els.get('recipient-source-strip').innerHTML,source);
  u.click('recipient-answer-loss');assert.match(u.els.get('recipient-takeaway').textContent,/没删/);
  u.click('recipient-answer-code');assert.match(u.els.get('recipient-takeaway').textContent,/无损/);
  assert.deepEqual(u.pixels('editor'),drawing);assert.deepEqual(u.pixels('receiver'),received);
  assert.equal(storage.writes,writes,'lesson is not a draft mutation');
 }finally{u.restore();}
});
test('recipient snapshot survives editing, replay resets progress, hidden documents cannot advance',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('recipient-start'),'recipient entry exists');
  u.click('recipient-start');const source=u.els.get('recipient-source-strip').innerHTML;
  u.click('recipient-begin');u.click('recipient-read');
  u.click('preset-noise');assert.equal(u.els.get('recipient-source-strip').innerHTML,source);
  assert.match(u.els.get('recipient-snapshot-note').textContent,/画纸已改/);
  const prefix=u.els.get('recipient-prefix').textContent;u.hide();u.click('recipient-read');
  assert.equal(u.els.get('recipient-prefix').textContent,prefix);
  u.doc.hidden=false;u.click('recipient-replay');
  assert.equal(u.els.get('recipient-source-strip').innerHTML,source);assert.equal(u.els.get('recipient-source').hidden,false);
  assert.match(u.els.get('recipient-progress').textContent,/0.*8/);
  u.click('recipient-start');assert.notEqual(u.els.get('recipient-source-strip').innerHTML,source);
  u.click('preset-blank');u.click('recipient-start');
  assert.equal(u.els.get('recipient-code-1').textContent,'本图未使用');
 }finally{u.restore();}
});
test('a larger noise postcard never teaches that every code or packet gets shorter',async()=>{
 const u=await boot();try{
  u.click('preset-noise');u.click('recipient-start');u.click('recipient-begin');
  for(let i=0;i<8;i++){
   for(let b=0;b<3&&!u.els.get('recipient-read').disabled;b++)u.click('recipient-read');
   const prefix=u.els.get('recipient-prefix').textContent;
   const c=[0,1,2,3].find(c=>u.els.get('recipient-code-'+c).textContent===prefix);
   u.click('recipient-color-'+c);
  }
  assert.match(u.els.get('recipient-packet-cost').textContent,/66 B/);
  u.click('recipient-answer-loss');
  assert.doesNotMatch(u.els.get('recipient-takeaway').textContent,/变短/,'the actual packet is larger, so no unconditional savings claim');
 }finally{u.restore();}
});
async function boot({ reduced = false, missingCanvas = false, storage = memoryStorage() } = {}) {
  const html = await readFile(new URL('../pixel.html', import.meta.url), 'utf8').catch(() => '');
  assert.ok(html.includes('id="editor"'), 'playable pixel page must exist');
  class Element extends EventTarget {
    constructor() { super(); this.dataset = {}; this.style = {}; this.attributes = new Map(); this.hidden = false; this.disabled = false; this.open = false; this.textContent = ''; this.width = 512; this.height = 512; this.ctx = { pixels: new Map(), clearRect() { this.pixels.clear(); }, fillRect(x, y, w, h) { if (w === 32 && h === 32) this.pixels.set(`${x},${y}`, this.fillStyle); }, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }; }
    getContext() { return missingCanvas ? null : this.ctx; }
    setAttribute(k, v) { this.attributes.set(k, String(v)); } getAttribute(k) { return this.attributes.get(k); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 256, height: 256 }; }
    set textContent(value){this.text=value;this.textWrites=(this.textWrites??0)+1;} get textContent(){return this.text;}
    setPointerCapture() {} releasePointerCapture() {} focus() {doc.activeElement=this;}
    scrollIntoView(options){this.scrolled=true;this.scrollOptions=options;}
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
    advance(t) { const q = [...frames.values()]; frames.clear(); for (const fn of q) fn(t); },
    pointer(type, x, y, id = 1) { fire(els.get('editor'), type, { clientX: x, clientY: y, pointerId: id, button: 0 }); },
    key(key, props = {}) { fire(els.get('editor'), 'keydown', { key, ...props }); },
    finish() { for (const t of [0, 20000]) { const q = [...frames.values()]; frames.clear(); for (const fn of q) fn(t); } },
    hide() { doc.hidden = true; fire(doc, 'visibilitychange'); },
    pixels: id => [...els.get(id).ctx.pixels.values()],
  };
}
test('delivery never reveals the cat green cells before their actual code bits arrive',async()=>{
 const u=await boot();try{
  u.click('send');u.advance(0);u.advance(5250);
  assert.notEqual(u.pixels('receiver')[220],'#bdd754','bit 393 is required for this green pixel, not 378');
  assert.equal(u.els.get('delivery-preview')?.dataset.decoded,'216');
 }finally{u.restore();}
});
test('paused delivery reads one bit, guards queued frames, and resumes without catching up',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('delivery-toggle'),'pause control is in the real page');
  u.click('send');u.advance(0);u.advance(100);const stale=[...u.frames.values()][0];
  u.click('delivery-toggle');const count=u.els.get('delivery-count').textContent;
  stale(9999);assert.equal(u.els.get('delivery-count').textContent,count);assert.equal(u.frames.size,0);
  u.click('delivery-bit');assert.equal(u.frames.size,0);
  assert.equal(parseInt(u.els.get('delivery-count').textContent),parseInt(count)+1);
  u.click('delivery-toggle');u.advance(20000);assert.equal(parseInt(u.els.get('delivery-count').textContent),parseInt(count)+1);
  stale(99999);assert.equal(parseInt(u.els.get('delivery-count').textContent),parseInt(count)+1);
  u.advance(30000);assert.deepEqual(u.pixels('receiver'),u.pixels('editor'));
 }finally{u.restore();}
});
test('slow replay uses the last fixed parcel without changing a drawing or successful mail',async()=>{
 const storage=memoryStorage(),u=await boot({storage,reduced:true});try{
  assert.ok(u.els.has('delivery-replay'));
  u.click('send');const old=u.pixels('receiver');u.click('preset-heart');
  const drawing=u.pixels('editor'),writes=storage.writes;
  u.click('delivery-replay');assert.equal(u.frames.size,0);
  assert.match(u.els.get('delivery-note').textContent,/旧|刚才|同一/);
  for(let n=0;n<600;n++)u.click('delivery-bit');
  assert.deepEqual(u.pixels('receiver'),old);assert.deepEqual(u.pixels('editor'),drawing);assert.equal(storage.writes,writes);
 }finally{u.restore();}
});
test('slow replay starts on the next undecoded cell and visibly waits for its full three-bit code',async()=>{
 const u=await boot({reduced:true});try{
  u.click('send');u.click('delivery-replay');
  assert.ok(u.els.has('delivery-cell-result'),'the target pixel has a visible magnified result');
  assert.equal(u.els.get('delivery-cell-result').dataset.ready,'false');
  assert.match(u.els.get('delivery-cell').textContent,/3 行.*4 列/);
  assert.equal(u.els.get('delivery-prefix').textContent,'—');
  for(const [prefix,count] of [['0','35'],['01','35'],['011','36']]){
   u.click('delivery-bit');assert.equal(u.els.get('delivery-prefix').textContent,prefix);
   assert.equal(u.els.get('delivery-preview').dataset.decoded,count);
  }
  assert.match(u.els.get('delivery-explanation').textContent,/墨黑/);
  assert.equal(u.els.get('delivery-cell-result').dataset.ready,'true');
  assert.equal(u.els.get('delivery-cell-result').style.backgroundColor,'#30352a');
 }finally{u.restore();}
});
test('completed old-parcel replay keeps the detailed wire on that same snapshot through rerenders',async()=>{
 const u=await boot({reduced:true});try{
  u.click('send');u.click('preset-noise');u.click('delivery-replay');
  for(let n=0;n<500;n++)u.click('delivery-bit');
  const bits=u.els.get('wire-bits').textContent;
  u.fire(u.els.get('editor'),'focus');
  assert.equal(u.els.get('wire-count').textContent,'432 / 432 bit');
  assert.equal(u.els.get('wire-bits').textContent,bits);
  assert.match(u.els.get('wire-caption').textContent,/回放/);
 }finally{u.restore();}
});
test('switching an in-flight parcel to replay does not claim it was delivered or leave a sending status',async()=>{
 const storage=memoryStorage(),u=await boot({storage});try{
  u.click('send');u.advance(0);u.click('delivery-toggle');u.click('delivery-replay');
  assert.match(u.els.get('status').textContent,/回放/);
  assert.match(u.els.get('receipt').textContent,/没有来信/);
  assert.equal(u.frames.size,0);
  for(let n=0;n<500;n++)u.click('delivery-bit');
  assert.match(u.els.get('status').textContent,/回放完成/);
  assert.match(u.els.get('receipt').textContent,/没有来信/);
  assert.equal(storage.writes,0);
 }finally{u.restore();}
});
test('all cat pixels can be decoded before padding but successful mail and storage wait for the whole packet',async()=>{
 const storage=memoryStorage(),u=await boot({storage});try{
  u.click('send');u.advance(0);u.advance(5950);
  assert.equal(u.els.get('delivery-preview').dataset.decoded,'256');
  assert.match(u.els.get('delivery-explanation').textContent,/补零/);
  assert.match(u.els.get('receipt').textContent,/寄送中/);assert.equal(storage.writes,0);
  for(let n=0;n<3;n++)u.click('delivery-bit');assert.equal(storage.writes,0);
  u.click('delivery-bit');assert.match(u.els.get('receipt').textContent,/256.*256/);
  const writes=storage.writes;u.click('delivery-bit');assert.equal(storage.writes,writes);
 }finally{u.restore();}
});
test('hiding a paused one-bit replay invalidates it without changing old mail or restarting on return',async()=>{
 const storage=memoryStorage(),u=await boot({storage,reduced:true});try{
  u.click('send');const received=u.pixels('receiver'),writes=storage.writes;
  u.click('delivery-replay');u.click('delivery-bit');u.hide();
  u.doc.hidden=false;u.click('delivery-bit');u.click('delivery-toggle');
  assert.equal(u.frames.size,0);assert.equal(u.els.get('delivery-panel').hidden,true);
  assert.deepEqual(u.pixels('receiver'),received);assert.equal(storage.writes,writes);
 }finally{u.restore();}
});
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

test('rearrangement reveals real decoded evidence only after a prediction and never edits the postcard or draft',async()=>{
 const storage=memoryStorage(),u=await boot({storage,reduced:true});try{
  assert.ok(u.els.has('reorder-start'),'the experiment needs a user entry point');
  u.click('send');const original=u.pixels('editor'),receipt=u.els.get('receipt').textContent,records=[...storage.records];
  u.click('reorder-start');
  assert.equal(u.els.get('reorder-results').hidden,true);assert.equal(u.els.get('reorder-question').hidden,false);
  assert.deepEqual(u.pixels('reorder-before'),original);
  assert.equal(u.els.get('reorder-after-wrap').hidden,true,'future image must stay hidden before guessing');
  u.click('guess-more');
  assert.equal(u.els.get('reorder-results').hidden,false);assert.equal(u.els.get('reorder-results').dataset.correct,'false');
  assert.equal(u.els.get('reorder-before-size').textContent,'54 B');assert.equal(u.els.get('reorder-after-size').textContent,'54 B');
  assert.notDeepEqual(u.pixels('reorder-after'),original);assert.deepEqual(u.pixels('editor'),original);assert.deepEqual(u.pixels('receiver'),original);
  assert.equal(u.els.get('receipt').textContent,receipt);assert.deepEqual([...storage.records],records);
  assert.equal(u.doc.activeElement,u.els.get('reorder-result-title'));
  const announcements=u.els.get('reorder-feedback').textWrites;
  u.fire(u.els.get('editor'),'focus');
  assert.equal(u.els.get('reorder-feedback').textWrites,announcements,'focusing the editor must not repeat the old result announcement');
  u.click('guess-same');assert.equal(u.els.get('reorder-results').dataset.correct,'false','one prediction remains the recorded prediction');
 }finally{u.restore();}
});

test('editing after a comparison retains the old evidence and starting again clears the old answer',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('reorder-start'));u.click('reorder-start');u.click('guess-same');
  const before=u.pixels('reorder-before'),after=u.pixels('reorder-after');
  u.click('preset-heart');
  assert.deepEqual(u.pixels('reorder-before'),before);assert.deepEqual(u.pixels('reorder-after'),after);
  assert.match(u.els.get('reorder-source').textContent,/已改|旧/);
  u.click('reorder-again');assert.equal(u.els.get('reorder-results').hidden,true);
  assert.equal(u.els.get('reorder-feedback').textContent,'');assert.deepEqual(u.pixels('reorder-before'),u.pixels('editor'));
  assert.equal(u.els.get('reorder-after-wrap').hidden,true);
 }finally{u.restore();}
});

test('rearrangement respects monochrome and missing-canvas states and does not interrupt a delivery',async()=>{
 const u=await boot();try{
  assert.ok(u.els.has('reorder-start'));u.click('send');u.click('reorder-start');u.click('guess-same');
  assert.equal(u.frames.size,1);u.finish();assert.deepEqual(u.pixels('receiver'),u.pixels('editor'));
  u.click('preset-blank');u.click('reorder-start');u.click('guess-less');
  assert.equal(u.els.get('reorder-results').dataset.changed,'false');
  assert.match(u.els.get('reorder-explanation').textContent,/只有一种颜色|单色/);
  assert.equal(u.els.get('reorder-after-size').textContent,'33 B');
 }finally{u.restore();}
 const v=await boot({missingCanvas:true});try{
  assert.equal(v.els.get('reorder-start').disabled,true);
  v.click('reorder-start');assert.equal(v.els.get('reorder-lesson').hidden,true);
 }finally{v.restore();}
});
