import { encode, decode, preset, stroke, rearrangement } from './pixel-core.mjs?v=recipient-1';
import { setupRecipient } from './pixel-recipient-ui.mjs?v=recipient-1';
import { setupCodeLesson } from './pixel-code-ui.mjs?v=code-1';
import { createDelivery, deliveryAt } from './pixel-delivery.mjs?v=delivery-1';
import {DRAFT_KEYS,readDraft,writeDraft,clearDraft,validatePixelDraft,draftMessage} from './local-drafts.mjs';

const $ = id => document.getElementById(id);
const editor = $('editor'), receiver = $('receiver');
const context = editor.getContext('2d'), receivedContext = receiver.getContext('2d');
const colors = ['#f3eedc', '#30352a', '#bdd754', '#e79d88'], names = ['米白', '墨黑', '苔绿', '珊瑚'];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let pixels = preset('cat'), color = 1, cursor = { x: 0, y: 0 }, focused = false;
let gesture = null, history = [], received = null, job = null, frame = 0;
let reorder = null, recipient = null, codeLesson = null;
let lastParcel = null, deliveryView = null;
const deliveryContext = $('delivery-preview').getContext('2d');
const equal = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
const available = () => context && receivedContext && !document.hidden && !$('guide').open;
function saveDraft(){
  const ok=writeDraft(DRAFT_KEYS.pixel,{pixels,color,history,received:received?.pixels??null},validatePixelDraft);
  $('draft-status').textContent=ok?'草稿已保留 · 仅在此浏览器，不上传。':'草稿未保存：浏览器存储不可用或空间不足。当前仍可继续玩。';
}
$('forget-draft').addEventListener('click',()=>{
  interrupt();
  $('draft-status').textContent=clearDraft(DRAFT_KEYS.pixel)?'已删除本地草稿，当前画纸不变；继续操作会重新保存。':'无法删除本地草稿，请在浏览器设置中清理此站点数据。';
});

function draw(ctx, data, showCursor = false) {
  if (!ctx) return;
  ctx.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 256; i++) {
    ctx.fillStyle = data?.[i] === null ? ((i % 16 + Math.floor(i / 16)) % 2 ? '#d5d5dc' : '#e4e4e9') : data ? colors[data[i]] : colors[0];
    ctx.fillRect(i % 16 * 32, Math.floor(i / 16) * 32, 32, 32);
  }
  if (ctx === context) {
    ctx.strokeStyle = '#30352a20'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) { ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, 512); ctx.moveTo(0, i * 32); ctx.lineTo(512, i * 32); }
    ctx.stroke();
    if (showCursor) { ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.strokeRect(cursor.x * 32 + 2, cursor.y * 32 + 2, 28, 28); ctx.strokeStyle = '#30352a'; ctx.strokeRect(cursor.x * 32 + 5, cursor.y * 32 + 5, 22, 22); }
  }
}
function receipt() {
  if (job && !job.replay) $('receipt').textContent = '寄送中… 上次来信会保留到新信送达';
  else if (!received) $('receipt').textContent = '还没有来信';
  else $('receipt').textContent = equal(received.pixels, pixels) ? `完整收到 · 256 / 256 格一致 · ${received.bytes} B` : `上次收到 ${received.bytes} B · 画纸已改，待重新寄出`;
}
function renderIdleWire(packet) {
  if (job || deliveryView?.replay) return;
  const bits = [...packet.packet].map(byte => byte.toString(2).padStart(8, '0')).join('');
  const delivered = received && equal(received.pixels, pixels);
  $('wire-count').textContent = delivered ? `已送达 · ${bits.length} / ${bits.length} bit` : `当前画纸待寄出 · ${bits.length} bit`;
  $('wire-bits').textContent = bits.slice(-96);
  $('wire-progress').style.width = delivered ? '100%' : '0%';
  $('wire-caption').textContent = delivered
    ? '当前画纸与来信一致。这里是已送达邮包的最后 96 位；刷新不会重新寄送。'
    : received
      ? '这里是当前画纸待寄邮包的最后 96 位。收件处保留上次来信，寄出后才会更新。'
      : '这里是当前画纸待寄邮包的最后 96 位。尚未寄送，树和补齐也计入体积。';
}
function render() {
  draw(context, gesture?.draft || pixels, focused);
  const packet = encode(pixels), size = packet.packet.length;
  $('packed-size').textContent = String(size);
  $('drawing-size').textContent = size + ' B';
  $('saving').textContent = size <= 64 ? `比原始像素少 ${64 - size} B` : `反而多了 ${size - 64} B，杂色也有代价。`;
  $('saving').dataset.larger = String(size > 64);
  for (let i = 0; i < 4; i++) {
    $('count-' + i).textContent = `${names[i]} · ${packet.counts[i]}`;
    $('code-' + i).textContent = packet.codes[i] ?? '未使用';
    $('color-' + i).setAttribute('aria-pressed', i === color);
  }
  $('entropy').textContent = `${packet.entropy.toFixed(2)} bit/格`;
  $('payload').textContent = `${packet.payloadBits} bit`;
  $('overhead').textContent = `${packet.treeBits} + ${packet.paddingBits} bit`;
  $('undo').disabled = !history.length || !context || !receivedContext;
  $('send').setAttribute('aria-disabled', !!job && !job.replay);
  $('delivery-replay').disabled = !lastParcel || !deliveryContext;
  $('challenge').textContent = size <= 48 ? `轻装达成 · ${size} B / 48 B。还能画点什么？` : `小挑战：把一张喜欢的画装进 48 B。还差 ${size - 48} B。`;
  receipt();
  if (deliveryView) renderDelivery(deliveryView);
  renderIdleWire(packet);
  renderReorder();
  recipient?.refresh();
  codeLesson?.refresh();
}
function renderReorder() {
  $('reorder-lesson').hidden = !reorder;
  if (!reorder) return;
  const {trial,guess} = reorder, {before,after,changedCells,samePacket} = trial;
  const shown = guess !== null;
  $('reorder-source').textContent = equal(pixels,before.pixels)
    ? '本轮用的是当前画纸的副本。原画、草稿和上次来信不会改变。'
    : '画纸已改。这里仍是刚才封存的旧图对照；要比较新图，请点「用当前画纸再试一次」。';
  if(reorder.renderedGuess===guess)return;
  reorder.renderedGuess=guess;
  draw($('reorder-before').getContext('2d'),before.decoded);
  $('reorder-before-size').textContent = before.encoded.packet.length + ' B';
  $('reorder-after-size').textContent = shown ? after.encoded.packet.length + ' B' : '待揭晓';
  $('reorder-after-wrap').hidden = !shown; $('reorder-mystery').hidden = shown;
  $('reorder-question').hidden = shown; $('reorder-results').hidden = !shown;
  $('reorder-feedback').textContent = '';
  if (!shown) return;
  draw($('reorder-after').getContext('2d'),after.decoded);
  const delta = after.encoded.packet.length-before.encoded.packet.length;
  const actual = delta===0?'same':delta>0?'more':'less', correct = guess===actual;
  $('reorder-results').dataset.correct=String(correct);$('reorder-results').dataset.changed=String(changedCells>0);
  $('reorder-result-title').textContent = delta===0?'图案换了，邮包一样大。':`实际邮包变化：${delta>0?'+':''}${delta} B`;
  if(!changedCells)$('reorder-result-title').textContent='单色图，换了位置也看不出变化。';
  const labels={more:'变大',same:'一样大',less:'变小'};
  $('reorder-feedback').textContent=`你猜的是「${labels[guess]}」。${correct?'这次判断对了。':'这次结果和直觉不一样。'}看下面两组实际记录。`;
  $('reorder-counts').innerHTML=names.map((name,i)=>`<div><span><i class="color-${i}" aria-hidden="true"></i>${name}</span><b>${before.encoded.counts[i]} → ${after.encoded.counts[i]} 格</b><code>${before.encoded.codes[i]??'未使用'}</code></div>`).join('');
  $('reorder-costs').innerHTML=[['图案编码',before.encoded.payloadBits,after.encoded.payloadBits],['编码树',before.encoded.treeBits,after.encoded.treeBits],['字节补齐',before.encoded.paddingBits,after.encoded.paddingBits],['合计',before.encoded.packet.length*8,after.encoded.packet.length*8]].map(([label,a,b])=>`<div><dt>${label}</dt><dd>${a} → ${b} bit</dd></div>`).join('');
  $('reorder-explanation').textContent=changedCells
    ? `${changedCells} 个位置的颜色和原图不同，但每种颜色的总格数没变，分到的暗号也没变。因此总编码长度不变。`
    : '这张图只有一种颜色，所有格子都一样，换位置不会产生可见变化。换成小猫、爱心或画两种颜色，再试一次更明显。';
  $('reorder-integrity').textContent=`前后邮包分别解码：原图 ${before.matches} / 256 格一致，重排图 ${after.matches} / 256 格一致。${samePacket?'本轮二进制内容也相同。':'大小相同，不是内容相同：两个邮包的二进制内容不同，分别还原出各自的图。'}没有通过删像素变小，也没有寄出或覆盖原画。`;
}
function startReorder() {
  if(!available())return;
  cancelStroke();reorder={trial:rearrangement(pixels),guess:null};renderReorder();$('reorder-title').focus({preventScroll:true});$('reorder-lesson').scrollIntoView({block:'start',behavior:'instant'});
}
$('reorder-start').addEventListener('click',startReorder);
$('reorder-again').addEventListener('click',startReorder);
for(const guess of ['more','same','less'])$('guess-'+guess).addEventListener('click',()=>{
  if(!available()||!reorder||reorder.guess!==null)return;
  reorder.guess=guess;renderReorder();$('reorder-result-title').focus({preventScroll:true});$('reorder-lesson').scrollIntoView({block:'start',behavior:'instant'});
});
function cancelSend(message) {
  if (!job) return;
  job = null; cancelAnimationFrame(frame); frame = 0;
  deliveryView = null;
  $('delivery-panel').hidden = true;
  draw(receivedContext, received?.pixels);
  if (message) $('status').textContent = message;
  render();
}
function cancelStroke() {
  if (!gesture) return;
  const id = gesture.id; gesture = null;
  try { editor.releasePointerCapture(id); } catch { /* Capture may already be lost. */ }
  render();
}
function commit(next, message) {
  if (equal(pixels, next)) { render(); return; }
  cancelSend(); history.push(pixels); if (history.length > 30) history.shift(); pixels = next;
  for (const name of ['cat', 'heart', 'noise', 'blank']) $('preset-' + name).setAttribute('aria-pressed', equal(pixels, preset(name)));
  $('status').textContent = message; render(); saveDraft();
}
function cell(event) {
  const box = editor.getBoundingClientRect();
  return { x: Math.max(0, Math.min(15, Math.floor((event.clientX - box.left) / box.width * 16))), y: Math.max(0, Math.min(15, Math.floor((event.clientY - box.top) / box.height * 16))) };
}
editor.addEventListener('pointerdown', event => {
  if (!available() || gesture || event.button !== 0) return;
  event.preventDefault(); editor.focus(); const point = cell(event); cursor = point;
  gesture = { id: event.pointerId, last: point, draft: stroke(pixels, point, point, color), color };
  editor.setPointerCapture(event.pointerId); render();
});
editor.addEventListener('pointermove', event => {
  if (!gesture || event.pointerId !== gesture.id) return;
  const point = cell(event); gesture.draft = stroke(gesture.draft, gesture.last, point, gesture.color); gesture.last = point; cursor = point; draw(context, gesture.draft, focused);
});
editor.addEventListener('pointerup', event => {
  if (!gesture || event.pointerId !== gesture.id) return;
  const point = cell(event), next = stroke(gesture.draft, gesture.last, point, gesture.color); cursor = point;
  cancelStroke(); commit(next, '已落笔。打包台已按新图案重新计算。');
});
for (const type of ['pointercancel', 'lostpointercapture']) editor.addEventListener(type, event => { if (gesture?.id === event.pointerId) cancelStroke(); });
editor.addEventListener('focus', () => { focused = true; render(); });
editor.addEventListener('blur', () => { focused = false; cancelStroke(); render(); });
editor.addEventListener('keydown', event => {
  if (!available() || gesture || event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^[1-4]$/.test(event.key)) { color = Number(event.key) - 1; saveDraft(); }
  else if (event.key.startsWith('Arrow')) {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta) return;
    cursor = { x: Math.max(0, Math.min(15, cursor.x + delta[0])), y: Math.max(0, Math.min(15, cursor.y + delta[1])) };
  } else if ([' ', 'Enter'].includes(event.key)) {
    if (!event.repeat) commit(stroke(pixels, cursor, cursor, color), '键盘落笔完成。可以继续画，也可以寄出。');
  } else return;
  event.preventDefault(); $('cursor-status').textContent = `第 ${cursor.y + 1} 行，第 ${cursor.x + 1} 列；${names[color]}画笔`; render();
});
for (let i = 0; i < 4; i++) $('color-' + i).addEventListener('click', () => { cancelStroke(); color = i; render(); saveDraft(); });
for (const name of ['cat', 'heart', 'noise', 'blank']) $('preset-' + name).addEventListener('click', () => {
  if (!available()) return; cancelStroke(); commit(preset(name), '换好画纸了。这次修改也可以撤销。');
});
$('undo').addEventListener('click', () => {
  if (!available() || !history.length) return;
  cancelStroke(); cancelSend(); pixels = history.pop(); $('status').textContent = '已撤销一次修改。';
  for (const name of ['cat', 'heart', 'noise', 'blank']) $('preset-' + name).setAttribute('aria-pressed', equal(pixels, preset(name)));
  render(); saveDraft();
});
function renderDelivery(current) {
  const state = deliveryAt(current.trace, current.sent), {bits, treeBits, payloadEnd} = current.trace;
  const focus = current.replay && current.sent === current.sample.startBit ? current.sample : state.focus;
  const prefix = focus ? bits.slice(focus.startBit,Math.min(state.sent,focus.endBit)) : '';
  $('delivery-panel').hidden = false;
  $('delivery-preview').dataset.decoded = String(state.decoded);
  draw(deliveryContext, state.pixels);
  if (focus && deliveryContext) {
    const x = focus.index % 16 * 32, y = Math.floor(focus.index / 16) * 32;
    deliveryContext.lineWidth = 5; deliveryContext.strokeStyle = '#b82465';
    deliveryContext.strokeRect(x + 3, y + 3, 26, 26);
  }
  $('delivery-count').textContent = `${state.sent} / ${bits.length} bit`;
  $('delivery-decoded').textContent = `已还原 ${state.decoded} / 256 格`;
  $('delivery-track').style.width = `${state.sent / bits.length * 100}%`;
  $('delivery-toggle').textContent = state.complete ? '已读完' : motion.matches ? '逐位模式' : current.paused ? '继续播放' : '暂停';
  $('delivery-toggle').disabled = state.complete || motion.matches;
  $('delivery-bit').disabled = state.complete;
  $('delivery-note').textContent = current.replay || state.complete
    ? `慢拆刚才封存的同一封信，不重新寄送、不覆盖画纸或草稿。${equal(current.parcel.snapshot,pixels)?'':'画纸已改，这里仍保留旧图。'}`
    : '本次还原中 · 灰格尚未收到；下方成功来信在送达前不变。动画速度不代表运算速度。';
  $('delivery-cell').textContent = focus ? `第 ${Math.floor(focus.index/16)+1} 行 · 第 ${focus.index%16+1} 列` : '先读这封信的暗号表';
  $('delivery-prefix').textContent = focus ? (prefix || '—') : `${state.sent} / ${treeBits} 位`;
  $('delivery-prefix').dataset.complete = String(!!focus && state.sent >= focus.endBit);
  const ready = !!focus && state.sent >= focus.endBit, result = $('delivery-cell-result');
  result.dataset.ready = String(ready);
  result.style.backgroundColor = ready ? colors[focus.color] : '';
  result.setAttribute('aria-label',`放大后的这一格：${ready?names[focus.color]:'暗号未收齐'}`);
  const explanation = state.phase === 'tree' ? '先收到编码树，才能知道每种颜色用什么暗号。现在还不能还原像素。'
    : state.phase === 'padding' ? `256 格已经齐了。还要收齐 ${bits.length-payloadEnd} 位字节补零，邮包才算送达；补零不会多出像素。`
    : state.complete ? '一格没删：同一份字节包还原出全部 256 格。常见颜色用短暗号，不是提前猜出颜色。'
    : state.sent >= focus.endBit ? `「${focus.code}」完整了 → ${names[focus.color]}。这一格现在才出现；下一位从新的暗号开始。`
    : `「${prefix || '尚未开始'}」还不是完整暗号，这一格继续留灰。再读一位，看看它是否对应表里的一种颜色。`;
  const output = $('delivery-explanation');
  output.setAttribute('aria-live', current.paused ? 'polite' : 'off');
  if (output.textContent !== explanation) output.textContent = explanation;
  // The existing detailed wire follows this same playhead, including on replay.
  if (!job && !current.replay) return;
  $('wire-count').textContent = `${state.sent} / ${bits.length} bit`;
  $('wire-bits').textContent = bits.slice(Math.max(0,state.sent-96),state.sent) || '正在读编码树…';
  $('wire-progress').style.width = `${state.sent/bits.length*100}%`;
  $('wire-caption').textContent = current.replay ? '这是刚才封存邮包的逐位回放，不是当前画纸的新寄送。' : '当前邮包的实际位流；树、图案编码和补齐共用同一个进度。';
}
function finishDelivery(current) {
  if (job !== current) return;
  current.sent = current.trace.bits.length;
  current.paused = true; current.epoch++; cancelAnimationFrame(frame); frame = 0;
  if (!current.replay) {
    const decoded = decode(current.parcel.encoded.packet,256);
    if (!equal(decoded,current.parcel.snapshot)) { cancelSend('还原校验未通过，保留上次来信。'); return; }
    received = {pixels:decoded,bytes:current.parcel.encoded.packet.length};
    draw(receivedContext,decoded);
    $('status').textContent = `送达了！${received.bytes} 字节，256 格一格不少。可以逐位拆这封信。`;
    job = null; render(); saveDraft();
  } else { job = null; $('status').textContent = '回放完成。没有重新寄送，也没有覆盖画纸或草稿。'; render(); }
  renderDelivery(current);
}
function playDelivery(current) {
  if (motion.matches) return; // Reduced-motion users retain manual, non-animated replay.
  current.paused = false; current.start = null; current.base = current.sent;
  const epoch = ++current.epoch;
  function advance(time) {
    if (job !== current || current.paused || current.epoch !== epoch) return;
    if (current.start === null) current.start = time;
    current.sent = Math.min(current.trace.bits.length,current.base+Math.floor(Math.max(0,time-current.start)/6000*current.trace.bits.length));
    renderDelivery(current);
    if (current.sent === current.trace.bits.length) finishDelivery(current);
    else frame = requestAnimationFrame(advance);
  }
  renderDelivery(current); frame = requestAnimationFrame(advance);
}
function openDelivery(parcel,replay=false) {
  const trace = createDelivery(parcel.encoded.packet,256);
  // Skip only a clearly labelled prefix when replaying, to reach a multi-bit color.
  const sample = trace.entries.find(entry=>entry.color!==trace.pixels[0] && entry.code.length>1) ?? trace.entries[0];
  const current = {parcel,trace,replay,sample,sent:replay?sample.startBit:0,paused:true,epoch:0};
  deliveryView = current;
  job = current;
  $('delivery-codebook').innerHTML = names.map((name,i)=>`<div><i class="color-${i}" aria-hidden="true"></i><span>${name}</span><code>${trace.entries.find(entry=>entry.color===i)?.code??'未使用'}</code></div>`).join('');
  $('delivery-skipped').textContent = replay ? `已快进：读好暗号表和前 ${sample.index} 格。从粉框这一格开始，每点一次只多收 1 bit。` : '可以暂停，再点「读下一位」；只有读到完整暗号，粉框里的像素才出现。';
  render(); renderDelivery(current);
  $('delivery-title').focus({preventScroll:true}); $('delivery-panel').scrollIntoView({block:'start',behavior:'instant'});
  if (!replay) {
    if (motion.matches) finishDelivery(current); else playDelivery(current);
  }
}
$('send').addEventListener('click', () => {
  if (!available() || (job && !job.replay)) return;
  cancelStroke(); cancelSend();
  const snapshot = [...pixels]; lastParcel = {snapshot,encoded:encode(snapshot)};
  $('status').textContent = '正在模拟寄送，收件端只从真实字节包解码。';
  openDelivery(lastParcel);
});
$('delivery-toggle').addEventListener('click',()=>{
  if (!available() || !job) return;
  if (job.paused) { playDelivery(job); return; }
  job.paused = true; job.epoch++; cancelAnimationFrame(frame); frame = 0; renderDelivery(job);
});
$('delivery-bit').addEventListener('click',()=>{
  if (!available() || !job) return;
  const current=job;current.paused=true;current.epoch++;cancelAnimationFrame(frame);frame=0;
  current.sent=Math.min(current.trace.bits.length,current.sent+1);renderDelivery(current);
  if(current.sent===current.trace.bits.length)finishDelivery(current);
});
$('delivery-replay').addEventListener('click',()=>{
  if(!available() || !lastParcel || !deliveryContext)return;
  const interrupted = job && !job.replay;
  cancelStroke();cancelSend();openDelivery(lastParcel,true);
  $('status').textContent = interrupted ? '原寄送已取消，切到逐位回放。只拆刚才封存的邮包，成功来信保持不变。' : '正在逐位回放刚才封存的邮包；不重新寄送，成功来信保持不变。';
});
function interrupt() { cancelStroke(); cancelSend('寄送已取消，画纸和上一张来信已保留。需要时再寄一次。'); }
document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); });
window.addEventListener('pagehide', interrupt); window.addEventListener('blur', cancelStroke); window.addEventListener('resize', cancelStroke);
motion.addEventListener('change', interrupt);
$('about').addEventListener('click', () => { interrupt(); $('guide').showModal(); });
$('theme').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme').setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
});
const draft=readDraft(DRAFT_KEYS.pixel,validatePixelDraft);
if(draft.value){
  ({pixels,color,history}=draft.value);
  if(draft.value.received)received={pixels:draft.value.received,bytes:encode(draft.value.received).packet.length};
  $('status').textContent=received?'画纸和上次来信已恢复。可以接着画，或重新寄出。':'画纸已恢复，还没有来信。画好了就寄出吧。';
}
$('draft-status').textContent=draftMessage(draft.status);
for(const name of ['cat','heart','noise','blank'])$('preset-'+name).setAttribute('aria-pressed',equal(pixels,preset(name)));
recipient = setupRecipient({ getPixels: () => pixels, available, cancelStroke });
codeLesson = setupCodeLesson({ document, getPixels: () => pixels, available, cancelStroke });
draw(receivedContext, received?.pixels); render();
if (!context || !receivedContext) {
  $('status').textContent = '此浏览器无法打开 Canvas 画布，请换用支持 Canvas 的浏览器。';
  $('send').disabled = true; $('undo').disabled = true; editor.setAttribute('aria-disabled', 'true');
  $('reorder-start').disabled = true;
  $('recipient-start').disabled = true;
  $('code-start').disabled = true;
  for (const name of ['cat', 'heart', 'noise', 'blank']) $('preset-' + name).disabled = true;
  for (let i = 0; i < 4; i++) $('color-' + i).disabled = true;
}
