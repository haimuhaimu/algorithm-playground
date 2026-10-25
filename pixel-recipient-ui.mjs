import { createRecipientLesson, readRecipientBit, chooseRecipientColor } from './pixel-recipient.mjs?v=recipient-1';

const names = ['米白', '墨黑', '苔绿', '珊瑚'];
const equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
export function setupRecipient({ getPixels, available, cancelStroke }) {
  const $ = id => document.getElementById('recipient-' + id);
  let state = null, stage = 'source', peek = false, answer = null;
  const focus = id => { $(id).focus(); $(id).scrollIntoView({ block: ['title', 'work-title', 'verdict'].includes(id) ? 'start' : 'nearest', behavior: 'auto' }); };
  const strip = (pixels, codes = null, offset = 0) => pixels.map((color, i) =>
    `<div class="recipient-cell"><i class="color-${color}" aria-hidden="true"></i><span>${names[color]}</span><code>${codes ? codes[color] : '✓'}</code><span class="visually-hidden">第 ${offset + i + 1} 格</span></div>`).join('');
  function refresh() {
    if (!state) return;
    const note = equal(getPixels(), state.snapshot)
      ? '本轮封存了当前画纸的副本。练习不会改原画、草稿或上次来信。'
      : '画纸已改。本轮仍用刚才封存的旧图；要换信，请回到寄件处再点「当一次收件员」。';
    if ($('snapshot-note').textContent !== note) $('snapshot-note').textContent = note;
  }
  function render() {
    $('lesson').hidden = !state;
    if (!state) return;
    const done = state.restored.length === 8, reading = stage === 'reading';
    const entry = state.entries[state.restored.length];
    const leaf = !!entry && state.prefix === entry.code;
    $('source').hidden = reading && !peek;
    $('begin').hidden = stage !== 'source';
    $('work').hidden = !reading;
    $('end').hidden = !done;
    for (let i = 1; i <= 3; i++) $('step-' + i).setAttribute('aria-current', (done ? 3 : reading ? 2 : 1) === i ? 'step' : 'false');
    $('location').textContent = `本轮读第 ${Math.floor(state.start / 16) + 1} 行，第 ${state.start % 16 + 1}–${state.start % 16 + 8} 格。`;
    $('source-strip').innerHTML = strip(state.snapshot.slice(state.start, state.start + 8), state.codes);
    $('miniature').innerHTML = state.snapshot.map((c, i) => `<i class="color-${c}" data-selected="${i >= state.start && i < state.start + 8}"></i>`).join('');
    $('progress').textContent = `已还原 ${state.restored.length} / 8 格`;
    $('restored').innerHTML = Array.from({length:8}, (_, i) => i < state.restored.length
      ? strip([state.restored[i]], null, i) : `<div class="recipient-cell recipient-empty" ${i === state.restored.length ? 'aria-current="step"' : ''}><i aria-hidden="true">${i+1}</i><span>${i === state.restored.length ? '轮到这格' : '待还原'}</span></div>`).join('');
    const bits = state.entries.map(e => e.code).join('');
    $('stream').innerHTML = `<span class="recipient-read-bits">${bits.slice(0, state.readBits)}</span><span>${bits.slice(state.readBits)}</span>`;
    $('stream').setAttribute('aria-label', `来信片段 ${bits}，已读 ${state.readBits} 位`);
    $('prefix').textContent = state.prefix || '—';
    $('read').disabled = !reading || leaf || done;
    $('read').textContent = leaf ? '暗号读全了，选一个颜色 ↓' : '读下一位 →';
    for (let c = 0; c < 4; c++) {
      $('code-' + c).textContent = state.codes[c] ?? '本图未使用';
      $('count-' + c).textContent = `整张画 ${state.counts[c]} 格`;
      $('color-' + c).disabled = !reading || !leaf || done;
      $('color-' + c).dataset.possible = String(!!state.codes[c]?.startsWith(state.prefix));
    }
    const message = state.feedback === 'wrong'
      ? `这个颜色不对应「${state.prefix}」。对照暗号表再选一次，这一格还没落笔。`
      : leaf ? `「${state.prefix}」已经是一个完整暗号。轮到你了：它对应什么颜色？`
      : state.prefix ? `读到了「${state.prefix}」，还不是完整暗号。再读一位，看看剩下哪条可能。`
      : `第 ${Math.min(8, state.restored.length + 1)} 格：从空白开始读。每读完一格，就重新从第一位找暗号。`;
    if ($('feedback').textContent !== message) $('feedback').textContent = message;
    $('prefix-help').textContent = state.codes.filter(Boolean).length === 1
      ? '这张画只有一种颜色。本协议仍给每格写一个 0，不是假装什么都没传。'
      : '读一位，排除开头不符的暗号；读到完整暗号才落笔。颜色名字也能帮你分辨，不必只靠色块。';
    $('peek').setAttribute('aria-expanded', peek);
    $('peek').textContent = peek ? '收起原片段' : '看一眼原片段';
    if (done) {
      const matches = state.restored.filter((c, i) => c === state.snapshot[state.start + i]).length;
      $('verdict').textContent = `收件完成 · ${matches} / 8 格与原片段一致`;
      $('final-strip').innerHTML = strip(state.restored);
      const cost = state.entries.reduce((n, e) => n + e.code.length, 0), delta = 16 - cost;
      $('bit-cost').textContent = `这 8 格的颜色暗号共 ${cost} bit，原来固定每格 2 bit、共 16 bit。${delta > 0 ? `这一段少写了 ${delta} bit。` : delta === 0 ? '这一段没有变短。' : `这一段反而多写了 ${-delta} bit；短不短要看颜色组合。`}`;
      $('packet-cost').textContent = `整张画才是一封完整邮包：编码树 ${state.treeBits} + 颜色暗号 ${state.payloadBits} + 补齐 ${state.paddingBits} = ${state.packetBytes * 8} bit（${state.packetBytes} B）。上面的片段不另加一次树；不代表整张图或 PNG 文件的大小。`;
      $('takeaway').textContent = answer === 'loss'
        ? '没删任何一格。看看前后 8 格：颜色和顺序完全一致。改变的是记录颜色的写法；是否更短，要看实际数字。再选一次。'
        : answer === 'code'
          ? '对，这就是无损：颜色和顺序都保留，只换表达。你刚才用同一本暗号表逐格读回了原片段；Huffman 通常给常见颜色较短的暗号，整封信还要算上表和补齐。'
          : '选一次，把刚才的操作变成自己的结论。';
    }
    refresh();
  }
  function begin(snapshot) {
    state = createRecipientLesson(snapshot); stage = 'source'; peek = false; answer = null;
    render(); focus('title');
  }
  $('start').addEventListener('click', () => {
    if (!available()) return;
    cancelStroke(); begin(getPixels());
  });
  $('begin').addEventListener('click', () => {
    if (!state || !available() || stage !== 'source') return;
    stage = 'reading'; render(); focus('work-title');
  });
  $('read').addEventListener('click', () => {
    if (!state || stage !== 'reading' || !available() || $('read').disabled) return;
    state = readRecipientBit(state); render();
    if ($('read').disabled) focus('color-0');
  });
  for (let c = 0; c < 4; c++) $('color-' + c).addEventListener('click', () => {
    if (!state || stage !== 'reading' || !available() || $('color-' + c).disabled) return;
    state = chooseRecipientColor(state, c);
    if (state.restored.length === 8) stage = 'done';
    render();
    if (stage === 'done') focus('verdict');
    else if (state.feedback === 'correct') focus('read');
  });
  $('peek').addEventListener('click', () => {
    if (!state || stage !== 'reading' || !available()) return;
    peek = !peek; render();
    if (peek) $('source').scrollIntoView({ block: 'nearest', behavior: 'auto' });
  });
  $('replay').addEventListener('click', () => { if (state && available()) begin(state.snapshot); });
  for (const value of ['loss', 'code']) $('answer-' + value).addEventListener('click', () => {
    if (!state || stage !== 'done' || !available()) return;
    answer = value; render();
  });
  render();
  return { refresh };
}
