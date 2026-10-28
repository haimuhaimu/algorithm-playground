import { encode, decode, preset, stroke, rearrangement } from './pixel-core.mjs?v=recipient-1';
import { setupRecipient } from './pixel-recipient-ui.mjs?v=recipient-1';
import { setupCodeLesson } from './pixel-code-ui.mjs?v=code-1';
import {DRAFT_KEYS,readDraft,writeDraft,clearDraft,validatePixelDraft,draftMessage} from './local-drafts.mjs';

const $ = id => document.getElementById(id);
const editor = $('editor'), receiver = $('receiver');
const context = editor.getContext('2d'), receivedContext = receiver.getContext('2d');
const colors = ['#f3eedc', '#30352a', '#bdd754', '#e79d88'], names = ['米白', '墨黑', '苔绿', '珊瑚'];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let pixels = preset('cat'), color = 1, cursor = { x: 0, y: 0 }, focused = false;
let gesture = null, history = [], received = null, job = null, frame = 0;
let reorder = null, recipient = null, codeLesson = null;
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
    ctx.fillStyle = data ? colors[data[i]] : colors[0];
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
  if (job) $('receipt').textContent = '寄送中… 上次来信会保留到新信送达';
  else if (!received) $('receipt').textContent = '还没有来信';
  else $('receipt').textContent = equal(received.pixels, pixels) ? `完整收到 · 256 / 256 格一致 · ${received.bytes} B` : `上次收到 ${received.bytes} B · 画纸已改，待重新寄出`;
}
function renderIdleWire(packet) {
  if (job) return;
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
  $('send').setAttribute('aria-disabled', !!job);
  $('challenge').textContent = size <= 48 ? `轻装达成 · ${size} B / 48 B。还能画点什么？` : `小挑战：把一张喜欢的画装进 48 B。还差 ${size - 48} B。`;
  receipt();
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
$('send').addEventListener('click', () => {
  if (!available() || job) return;
  cancelStroke();
  const snapshot = [...pixels], encoded = encode(snapshot), decoded = decode(encoded.packet, 256);
  const current = { snapshot, decoded, encoded, start: null }; job = current;
  const bits = [...encoded.packet].map(byte => byte.toString(2).padStart(8, '0')).join('');
  $('wire-count').textContent = `0 / ${bits.length} bit`;
  $('wire-bits').textContent = '正在把编码树与图案装进字节…';
  $('wire-progress').style.width = '0%';
  $('wire-caption').textContent = '正在模拟寄送当前邮包。这里只展示最近经过的 96 位，新信送达前保留上次来信。';
  function advance(time) {
    if (job !== current) return;
    if (current.start === null) current.start = time;
    const progress = motion.matches ? 1 : Math.min(1, (time - current.start) / 1200);
    const sent = Math.floor(progress * bits.length);
    $('wire-count').textContent = `${sent} / ${bits.length} bit`;
    $('wire-bits').textContent = sent ? bits.slice(Math.max(0, sent - 96), sent) : '正在把编码树与图案装进字节…';
    $('wire-progress').style.width = `${progress * 100}%`;
    if (!received) { const partial = Array(256).fill(0); for (let i = 0; i < Math.floor(progress * 16) * 16; i++) partial[i] = decoded[i]; draw(receivedContext, partial); }
    if (progress < 1) { frame = requestAnimationFrame(advance); return; }
    job = null; frame = 0;
    const matches = decoded.reduce((n, value, i) => n + (value === snapshot[i]), 0);
    if (matches !== 256) { $('status').textContent = '还原校验未通过，保留上次来信。'; draw(receivedContext, received?.pixels); render(); return; }
    received = { pixels: decoded, bytes: encoded.packet.length }; draw(receivedContext, decoded);
    $('status').textContent = `送达了！${encoded.packet.length} 字节，256 格一格不少。`; render(); saveDraft();
  }
  $('status').textContent = '正在模拟寄送，收件端只从真实字节包解码。'; render();
  if (motion.matches) advance(0); else frame = requestAnimationFrame(advance);
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
