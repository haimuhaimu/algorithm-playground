import { encode, decode, preset, stroke, rearrangement, POSTCARD_COLORS, EDITOR_POSTCARD_PRESETS, STUDIO_POSTCARD_NAMES, POSTAGE_BYTE_STEPS, postageByteTrial } from './pixel-core.mjs?v=cat-postage-byte-v1';
import { setupRecipient } from './pixel-recipient-ui.mjs?v=recipient-resume-v1';
import { setupCodeLesson } from './pixel-code-ui.mjs?v=code-1';
import { createDelivery, deliveryAt } from './pixel-delivery.mjs?v=delivery-1';
import { setupPixelToolUI } from './pixel-tool-ui.mjs?v=studio-postcards-v2';
import {DRAFT_KEYS,readDraft,writeDraft,clearDraft,validatePixelDraft,draftMessage} from './local-drafts.mjs';

const $ = id => document.getElementById(id);
const editor = $('editor'), receiver = $('receiver');
const context = editor.getContext('2d'), receivedContext = receiver.getContext('2d');
const colors = POSTCARD_COLORS, names = ['米白', '墨黑', '苔绿', '珊瑚'];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const editorPresets = EDITOR_POSTCARD_PRESETS;
let pixels = preset('heim'), color = 1, cursor = { x: 0, y: 0 }, focused = false;
let gesture = null, history = [], received = null, job = null, frame = 0;
let reorder = null, recipient = null, codeLesson = null;
let lastParcel = null, deliveryView = null, pixelToolExport = null;
let deliveredParcel = null, firstLetter = { source: null, restored: 0, answer: null };
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
  pixelToolExport?.refresh();
  renderIdleWire(packet);
  renderReorder();
  recipient?.refresh();
  codeLesson?.refresh();
  renderFirstLetter();
}
function renderFirstLetter() {
  const reading = deliveredParcel && firstLetter.source === deliveredParcel;
  const restored = reading ? firstLetter.restored : 0;
  const concluded = restored === 8 && firstLetter.answer === 'code';
  const stage = !deliveredParcel ? 1 : restored === 8 ? 3 : 2;
  for (let i = 1; i <= 3; i++) {
    const complete = i === 1 ? !!deliveredParcel : i === 2 ? restored === 8 : concluded;
    $('first-letter-step-' + i).dataset.complete = String(complete);
    $('first-letter-step-' + i).setAttribute('aria-current', !concluded && stage === i ? 'step' : 'false');
  }
  $('first-letter-status').textContent = !deliveredParcel
    ? received ? '画纸和上次来信都保留着。本轮从寄出开始，不会自动重寄或把旧记录当作完成。' : '先选一张三猫明信片，也可以直接寄当前画纸。点「打包寄出」，看看它怎样到达。'
    : concluded ? '这一轮走完了：你亲手还原了 8 格，并核对了无损的含义。这不是掌握证明。'
    : restored === 8 ? '8 格已经读回来了。看看原片段和你的结果，再做最后一个判断。'
    : reading && firstLetter.stage === 'reading' ? `这封信已读回 ${restored} / 8 格。回到画纸不会清掉进度，可以接着读。`
    : '已成功寄出。接下来，你来读回这封信的 8 格，不让动画替你选颜色。';
  $('first-letter-read').disabled = !deliveredParcel || !context || !receivedContext;
  const inline = !!deliveredParcel && deliveryView?.verifiedParcel === deliveredParcel && !$('delivery-panel').hidden;
  $('first-letter-next').hidden = !inline;
  $('first-letter-resume').hidden = !deliveredParcel || inline;
  $('first-letter-resume').disabled = !deliveredParcel || !context || !receivedContext;
  const readLabel = !deliveredParcel ? '先寄出，再来亲手读信'
    : restored === 8 ? concluded ? '回看这封信（8 / 8 格）→' : '核对这封信（8 / 8 格）→'
    : reading && firstLetter.stage === 'reading' ? `继续读（${restored} / 8 格）→`
    : '亲手读回这封信的 8 格 →';
  $('first-letter-read').textContent = readLabel;
  $('first-letter-resume').textContent = readLabel;
  $('first-letter-note').textContent = deliveredParcel
    ? `成功来信 ${deliveredParcel.bytes} B · ${equal(pixels,deliveredParcel.snapshot) ? '用刚才那封信，不另换一张图。' : '画纸已改，仍读上一封成功来信；新画纸不会被覆盖。'}只在本页保留这条实操，不写学习进度。`
    : '完整收齐并核验后，这个入口才会开放。原来的单独练习也保留。';
}
function readSuccessfulLetter() {
  if (!available() || !deliveredParcel) return;
  cancelStroke(); cancelSend('已取消未完成的寄送，改读上一封成功来信。');
  recipient.openParcel(deliveredParcel);
}
for (const id of ['first-letter-read','first-letter-resume']) $(id).addEventListener('click', readSuccessfulLetter);
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
    : '这张图只有一种颜色，所有格子都一样，换位置不会产生可见变化。换一张预设，或画上另一种颜色再试。';
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
function renderPresetSelection() {
  for (const name of editorPresets) $('preset-' + name).setAttribute('aria-pressed', equal(pixels, preset(name)));
}
function setupCatByteTrial(){
  const base=postageByteTrial(),panel=$('cat-byte-trial'),next=$('cat-byte-next'),reset=$('cat-byte-reset');
  const preview=$('cat-byte-preview').getContext('2d'),bits=$('cat-byte-bits');
  $('cat-byte-picture').hidden=!preview;
  $('cat-byte-key').textContent=`在这张副本里，珊瑚每格 ${base.encoded.codes[3].length} 位，米白每格 ${base.encoded.codes[0].length} 位。虚线框是凑满 8 位而补的 0。`;
  let step=0,trial=base;
  function renderTrial(previous=base.encoded){
    const {packet,payloadBits,paddingBits}=trial.encoded,bytes=packet.length,last=trial.changed.at(-1);
    draw(preview,trial.pixels);
    if(preview&&last!==undefined){
      const x=last%16*32,y=Math.floor(last/16)*32;
      preview.lineWidth=4;preview.strokeStyle='#25243b';preview.strokeRect(x+3,y+3,26,26);
      preview.lineWidth=2;preview.strokeStyle='#fff';preview.strokeRect(x+6,y+6,20,20);
    }
    $('cat-byte-bytes').textContent=bytes+' B';
    $('cat-byte-payload').textContent=payloadBits+' 位';
    $('cat-byte-padding').textContent=paddingBits+' 位';
    $('cat-byte-last').textContent=`第 ${bytes} 个字节 · 邮包的最后 8 位`;
    const sequence=packet.at(-1).toString(2).padStart(8,'0');
    bits.innerHTML=[...sequence].map((bit,i)=>`<span class="${i>=8-paddingBits?'is-padding':''}" aria-hidden="true">${bit}</span>`).join('');
    bits.setAttribute('aria-label',`末字节 ${sequence}，${8-paddingBits} 位有效数据，${paddingBits} 位补零`);
    next.setAttribute('aria-disabled',String(step===POSTAGE_BYTE_STEPS));
    next.textContent=step===POSTAGE_BYTE_STEPS?'四格都换好了':'换一格：珊瑚 → 米白';
    reset.disabled=step===0;
    $('cat-byte-status').textContent=step===0
      ? '先换一格，看邮包会不会变小。'
      : bytes<previous.packet.length
        ? `第 ${step} 次换色：终于省下一个整字节，${previous.packet.length} B → ${bytes} B。副本仍有 256 格。`
        : `第 ${step} 次换色：图案少写 ${previous.payloadBits-payloadBits} 位，但末尾还要凑满 8 位，整封仍是 ${bytes} B。`;
  }
  next.addEventListener('click',()=>{
    if(step>=POSTAGE_BYTE_STEPS)return;
    const previous=trial.encoded;
    trial=postageByteTrial(++step);renderTrial(previous);
  });
  function restart(){step=0;trial=base;renderTrial();}
  reset.addEventListener('click',()=>{if(!step)return;restart();next.focus();});
  restart();
  return ()=>{restart();panel.open=false;};
}
function setupCatPostage() {
  const samples=Object.entries(STUDIO_POSTCARD_NAMES).map(([id,name])=>{
    const art=preset(id),encoded=encode(art),{counts,packet,payloadBits,treeBits,paddingBits}=encoded;
    const preview=$('cat-guess-'+id+'-art'),previewContext=preview.getContext('2d');
    preview.hidden=!previewContext;draw(previewContext,art);
    $('cat-postage-'+id+'-size').textContent=packet.length+' B';
    counts.forEach((count,index)=>{$('cat-postage-'+id+'-'+index).textContent=count;});
    $('cat-postage-'+id+'-bits').textContent=`${payloadBits} + ${treeBits} + ${paddingBits} = ${packet.length*8} 位`;
    return {id,name,bytes:packet.length,encoded,button:$('cat-guess-'+id),badge:$('cat-postage-'+id+'-badge')};
  });
  const min=Math.min(...samples.map(sample=>sample.bytes));
  const lightest=samples.filter(sample=>sample.bytes===min),winner=`${lightest.map(sample=>sample.name).join('、')}${lightest.length>1?'并列':''}最轻：${min} B。`;
  const bobby=samples.find(sample=>sample.id==='bobby').encoded,chouchou=samples.find(sample=>sample.id==='chouchou-studio').encoded;
  const sameCodes=equal(bobby.codes,chouchou.codes),coralLength=bobby.codes[3]?.length;
  $('cat-postage-why').textContent=sameCodes&&coralLength
    ? `波比和臭臭用同一套暗号。臭臭有 ${chouchou.counts[3]} 格珊瑚色，波比有 ${bobby.counts[3]} 格，这个颜色每格写 ${coralLength} 位。把四种颜色都算进去，波比的图案用了 ${bobby.payloadBits} 位，臭臭用了 ${chouchou.payloadBits} 位。`
    : '把每种颜色的格数乘上它的暗号长度，再加起来，就得到图案位数。暗号表和补零也会占空间。';
  let guess=null;
  const resetByteTrial=setupCatByteTrial();
  const evidence=$('cat-postage-evidence'),result=$('cat-postage-result');
  function renderGuess(){
    for(const sample of samples){
      sample.button.setAttribute('aria-pressed',String(sample===guess));
      sample.button.setAttribute('aria-disabled',String(Boolean(guess)));
      sample.badge.textContent=guess?`${sample.bytes} B`:'';
      sample.badge.hidden=!guess;
    }
    evidence.hidden=!guess;
    result.textContent=!guess?'':guess.bytes===min?`猜中了！${winner}`:`你选了${guess.name}（${guess.bytes} B）。${winner}`;
  }
  for(const sample of samples)sample.button.addEventListener('click',()=>{if(guess)return;guess=sample;renderGuess();});
  $('cat-postage-retry').addEventListener('click',()=>{
    if(!guess)return;
    const previous=guess;guess=null;$('cat-postage-details').open=false;resetByteTrial();renderGuess();previous.button.focus();
  });
  renderGuess();
}
function commit(next, message) {
  if (equal(pixels, next)) { render(); return; }
  cancelSend(); history.push(pixels); if (history.length > 30) history.shift(); pixels = next;
  renderPresetSelection();
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
for (const name of editorPresets) $('preset-' + name).addEventListener('click', () => {
  if (!available()) return; cancelStroke(); commit(preset(name), '换好画纸了。这次修改也可以撤销。');
});
$('undo').addEventListener('click', () => {
  if (!available() || !history.length) return;
  cancelStroke(); cancelSend(); pixels = history.pop(); $('status').textContent = '已撤销一次修改。';
  renderPresetSelection();
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
  pixelToolExport?.refresh();
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
    deliveredParcel = {packet:Uint8Array.from(current.parcel.encoded.packet),snapshot:Object.freeze([...decoded]),bytes:received.bytes};
    current.verifiedParcel = deliveredParcel;
    firstLetter = {source:deliveredParcel,restored:0,answer:null};
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
  const current = {parcel,trace,replay,sample,sent:replay?sample.startBit:0,paused:true,epoch:0,aiActions:[],aiSent:replay?sample.startBit:0};
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
  if(current.sent!==current.aiSent)current.aiActions.push({action:'seek',value:current.sent});
  current.aiActions.push({action:'read',value:1});
  current.sent=Math.min(current.trace.bits.length,current.sent+1);current.aiSent=current.sent;renderDelivery(current);
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
renderPresetSelection();
setupCatPostage();
recipient = setupRecipient({ getPixels: () => pixels, available, cancelStroke, onProgress: progress => {
  if (!deliveredParcel || progress.source !== deliveredParcel) return;
  firstLetter = progress; renderFirstLetter();
} });
codeLesson = setupCodeLesson({ document, getPixels: () => pixels, available, cancelStroke });
pixelToolExport=setupPixelToolUI({document,window,getView:()=>deliveryView,available,pause:()=>{
 if(job){job.paused=true;job.epoch++;cancelAnimationFrame(frame);frame=0;renderDelivery(job);}
}});
draw(receivedContext, received?.pixels); render();
if (!context || !receivedContext) {
  $('status').textContent = '此浏览器无法打开 Canvas 画布，请换用支持 Canvas 的浏览器。';
  $('send').disabled = true; $('undo').disabled = true; editor.setAttribute('aria-disabled', 'true');
  $('reorder-start').disabled = true;
  $('recipient-start').disabled = true;
  $('code-start').disabled = true;
  for (const name of editorPresets) $('preset-' + name).disabled = true;
  for (let i = 0; i < 4; i++) $('color-' + i).disabled = true;
}
