import {AGENT_FRAME_CLIP, runAgentFrames} from './agent-frames-tool.mjs?v=agent-frames-v1';
import {createGenaiReturnUrl, readGenaiHandoffContext} from './genai-handoff.mjs?v=handoff-trust-v1';
import {createAgentResultStore} from './agent-last-result.mjs?v=frames-saved-v1';

const SOURCE = {producer: 'browser-session'};
const SCENE = {
 wide: ['0 0 560 284', 25, '站台远景，门边牌子太小，读不清。'],
 approach: ['24 7 520 264', 64, '镜头靠近站台，叉车驶入画面。门牌仍读不清。'],
 door: ['44 17 486 246', 110, '镜头朝向装卸门，门牌上的字模糊。'],
 'forklift-near': ['48 17 486 246', 208, '叉车和货箱经过装卸门。门牌读不清。'],
 blocked: ['57 21 470 238', 286, '叉车的货箱挡住门边牌子。'],
 'sign-clear': ['59 21 470 238', 223, '叉车露出门边牌子，可以读到「允许卸货」。'],
 'forklift-pass': ['43 14 510 259', 117, '叉车驶离，镜头移开，门牌再次读不清。'],
};
const time = ({timeMs}) => `00:${String(timeMs / 1000).padStart(2, '0')}`;
const frameId = id => `#${String(id).padStart(2, '0')}`;

function sceneArt({id, view, sign}) {
 const [crop, x] = SCENE[view];
 const truckX = id > 6 ? (id === 7 ? 52 : -75) : x;
 const clear = sign === 'unload';
 return `<svg viewBox="${crop}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <path class="art-sky" d="M0 0h560v284H0z"/>
  <path class="art-distant" d="M0 86h56V63h72v14h39v88H0zm446-14h57V54h57v115H446z"/>
  <path class="art-skyline" d="M22 103h61m26-11h35m367 0h30m-23 14h42M0 128h128" stroke-width="4"/>
  <path class="art-floor" d="M0 169 560 143v141H0z"/>
  <path class="art-floor-grid" d="M0 215l560-24M0 254l560-21M53 284l93-112m64 112 56-121m87 121 23-129m112 129-13-130" fill="none" stroke-width="2"/>
  <path class="art-road" d="M-24 229 563 210m-505 51 66-3m42-1 66-3m42-2 66-3m42-2 66-3m42-2 66-3" fill="none" stroke-width="4"/>
  <path class="art-shadow" d="M103 190 445 212 551 182 227 159z"/>
  <path class="art-roof" d="M106 68 178 43h343l-76 25z"/>
  <path class="art-roof-line" d="M161 61h284l35-12H196z"/>
  <path class="art-side" d="M445 68 521 43v136l-76 25z"/>
  <path class="art-side-panel" d="M470 78l32-11v30l-32 11zm0 48 32-11v30l-32 11z"/>
  <path class="art-wall" d="M106 68h339v136H106z"/>
  <path class="art-wall-trim" d="M106 68h339v10H106zm0 116h339v20H106z"/>
  <path class="art-lintel" d="M151 92h207v88H151z"/>
  <path class="art-door" d="M166 110h176v69H166z"/>
  <path class="art-door-line" d="M169 121h170m-170 12h170m-170 12h170m-170 12h170m-170 12h170" fill="none" stroke-width="3"/>
  <path class="art-dock" d="M132 178h238v11H132zm11 12h217v5H143z"/>
  <path class="art-marker" d="M120 157h7v23h-7zm312 0h7v23h-7z"/>
  <path class="art-sign-shadow" d="M369 116h68v35h-68z"/>
  <path class="art-sign" d="M366 113h68v35h-68z"/>
  ${clear ? '<text class="art-sign-type" x="400" y="135" text-anchor="middle">允许卸货</text>' :
   '<path class="art-sign-illegible" d="M374 123h13v3h-13zm18 0h11v3h-11zm18 0h14v3h-14zm-36 10h27v4h-27zm34 0h12v4h-12z"/>'}
  <text class="art-station-type" x="175" y="105">08 / LOADING BAY</text>
  <g transform="translate(${truckX} 0)">
   <path class="art-truck-shadow" d="M0 209h127v9H-8z"/>
   <path class="art-tyre" d="M15 192h21v24H15zm56 0h21v24H71z"/>
   <path class="art-hub" d="M21 201h9v9h-9zm56 0h9v9h-9z"/>
   <path class="art-truck-side" d="M4 176h79v25H4z"/>
   <path class="art-truck-top" d="M4 176l13-11h78l-12 11z"/>
   <path class="art-cabin" d="M21 175v-39h42v39h-8v-31H29v31zm-7-40 10-8h51l-12 8z"/>
   <path class="art-cabin-glass" d="M30 145h24v19H30z"/>
   <path class="art-fork" d="M80 136h7v54h43v6H80z"/>
   <path class="art-box-front" d="M87 122h34v61H87z"/>
   <path class="art-box-side" d="M121 122l13-9v59l-13 11z"/>
   <path class="art-box-top" d="M87 122l13-9h34l-13 9z"/>
   <path class="art-box-tape" d="M102 122h6v61h-6z"/>
   <path class="art-headlamp" d="M73 183h10v6H73z"/>
  </g>
  <path class="art-camera-corners" d="M16 35V17h22m484 0h22v18m0 214v18h-22m-484 0H16v-18" fill="none" stroke-width="2"/>
 </svg>`;
}

function packetArt(id) {
 const frame=AGENT_FRAME_CLIP[id];
 const note=frame.sign==='unload'?'门牌：允许卸货':frame.view==='blocked'?'货箱挡住门牌':'门牌读不清';
 return `<span class="frames-packet-thumb" data-packet-frame="${id}" role="img" aria-label="第 ${id} 帧：${SCENE[frame.view][2]}">${sceneArt(frame)}</span><small class="frames-packet-caption">${note}</small>`;
}

export function mountAgentFrames({document, window}) {
 const e = name => document.getElementById(`frames-${name}`);
 const set = (name, text) => { if (e(name).textContent !== text) e(name).textContent = text; };
 const show = (name, visible) => { e(name).hidden = !visible; };
 const focus = name => e(name).focus({preventScroll: false});
 const handoff = readGenaiHandoffContext(window.location, 'agent-frames');
 const canReturn = Boolean(handoff);
 const store = createAgentResultStore(window, 'agent-frames'), saved = store.read();
 let run = runAgentFrames([], SOURCE), baseline = null, playing = false, timeout = null, generation = 0;
 let inspected = null, comparison = null, retryNotice = false;
 let previous = saved.status === 'saved' ? saved.receipt : null, reviewing = false, exportEpoch = 0, saveStatus = '';
 const visibleRun = () => reviewing ? previous : run;
 const resultText = outcome => outcome.conclusion === 'clear-to-unload' ? '允许卸货' : '证据不足，不能确认';

 if (canReturn) e('os-fallback').href = handoff.returnURL;

 function paint(name, frame) {
  const node = e(name);
  if (node.dataset.frame === String(frame.id)) return;
  node.dataset.frame = String(frame.id);
  node.setAttribute('aria-label', `第 ${frame.id} 帧：${SCENE[frame.view][2]}`);
  node.innerHTML = sceneArt(frame);
 }

 function drawRound(name, outcome) {
  e(`${name}-ids`).innerHTML = outcome.frameIds.map(id => `<li>${packetArt(id)}<strong>${frameId(id)}</strong></li>`).join('');
  set(`${name}-evidence`, outcome.signFrame === null ? '这三帧没拍清门牌。' : `${frameId(outcome.signFrame)} 拍清了「允许卸货」的门牌。`);
  set(`${name}-result`, resultText(outcome));
 }

 function inspect(id) {
  const shown = visibleRun();
  if (shown?.result.stage !== 'done') return;
  const frame = AGENT_FRAME_CLIP[id];
  if (!frame) return;
  inspected = id;
  const {fixed, manual} = shown.result.evidence;
  const inFixed = fixed.frameIds.includes(id), inManual = manual.frameIds.includes(id);
  for (const button of e('timeline').querySelectorAll?.('button') ?? []) {
   button.setAttribute('aria-pressed', String(Number(button.dataset.inspectFrame) === id));
  }
  paint('inspect-scene', frame);
  set('inspect-title', `第 ${id} 帧 · ${time(frame)}`);
  set('inspect-evidence', SCENE[frame.view][2]);
  set('inspect-selection', inFixed && inManual ? '两轮都保留' : inFixed ? '仅第一轮保留' : inManual ? '仅第二轮保留' : '两轮都没保留');
 }

 function drawComparison() {
  const shown = visibleRun();
  if (comparison === shown) return;
  comparison = shown;
  const {fixed, manual} = shown.result.evidence;
  drawRound('fixed', fixed);
  drawRound('manual', manual);
  set('comparison-summary', manual.signFrame === null
   ? '两轮都没留下拍清门牌的那一帧。证据不足，不等于门牌写着禁止卸货。'
   : '两轮都只留 3 帧。换掉中间一帧后，Agent 才拿到了可以确认卸货的证据。');
  e('timeline').innerHTML = AGENT_FRAME_CLIP.map(frame => {
   const a = fixed.frameIds.includes(frame.id), b = manual.frameIds.includes(frame.id);
   const marks = a && b ? '双轮' : a ? '固定' : b ? '手动' : '未留';
   return `<li><button type="button" data-inspect-frame="${frame.id}" aria-pressed="false" aria-label="查看第 ${frame.id} 帧，${marks}">
    <span class="frames-thumb">${sceneArt(frame)}</span><span class="frames-thumb-meta"><b>${frameId(frame.id)}</b><span>${marks}</span></span>
   </button></li>`;
  }).join('');
  inspect(inspected ?? fixed.frameIds[1]);
 }

 function drawRetryComparison() {
  const before = previous.result.evidence, after = run.result.evidence;
  for (const [name, evidence] of [['previous', before], ['current', after]]) {
   e(`${name}-pick`).innerHTML = packetArt(evidence.manualPick) + `<b class="frames-mono">${frameId(evidence.manualPick)}</b>`;
   set(`${name}-result`, resultText(evidence.manual));
  }
  const changed = before.manual.conclusion !== after.manual.conclusion;
  set('retry-summary', `第 ${before.manualPick} 帧 → 第 ${after.manualPick} 帧。` + (changed
   ? after.manual.signFrame === null ? '这次没有留下清楚的门牌，所以从能确认变回了证据不足。' : '这次留下了清楚的门牌，所以从证据不足变成了能确认。'
   : before.manualPick === after.manualPick ? '选的还是同一帧，证据和结论都没变。' : '换了画面，但都没拍清门牌：结论仍是证据不足，不会为了重试就变好。'));
 }

 const available = action => run.result.availableActions.some(entry => entry.action === action);
 function render() {
  const {stage, evidence} = run.result;
  const {frame: id, manualPick} = evidence;
  const frame = AGENT_FRAME_CLIP[id], first = stage === 'baseline' || stage === 'baseline-done';
  const done = stage === 'done';
  paint('scene', frame);
  set('position', `第 ${id} / 9 帧 · ${time(frame)}`);
  set('announcement', playing || done ? '' : `第 ${id} 帧：${SCENE[frame.view][2]}`);
  set('caption', `「${frame.caption}」`);
  for (const [name, current] of [['round-one', first], ['round-two', !first]]) e(name).setAttribute('aria-current', current ? 'step' : 'false');
  set('status', {
   baseline: '第一轮：固定抽帧', 'baseline-done': '第一轮已完成', manual: '第二轮：换掉中间一帧',
   'manual-empty': '这轮没有保留中间帧', done: '两轮已完成',
  }[stage]);
  set('feedback', retryNotice ? (previous ? '第一轮保持不变。上次完整结果已保留，可以边回看边重试。' : '第一轮保持不变。这次重新选一帧。') : {
   baseline: '系统按固定间隔取第 0、4、8 帧。',
   'baseline-done': 'Agent 只拿到了第 0、4、8 帧。第二轮可以自己选中间那一帧。',
   manual: manualPick === null ? '第 0 帧和第 8 帧不变。在第 1–7 帧里选一次，选定后继续到末帧。' : `已保留第 ${manualPick} 帧。继续看完原片，就能比较两轮的结果。`,
   'manual-empty': '第一轮仍保留。重做第二轮，在第 1–7 帧里留一帧。',
   done: '',
  }[stage]);
  const slots = [{id: 0, label: '首帧'}, {id: first ? 4 : manualPick, label: first ? '固定中间帧' : '你的中间帧'}, {id: 8, label: '末帧'}];
  e('slots').innerHTML = slots.map(({id: value, label}) => {
   const received=value!==null&&(value<=id||done);
   return `<li data-received="${received}">${received?packetArt(value):'<span class="frames-packet-wait">尚未收到画面</span>'}<strong>${value===null?'待选':frameId(value)}</strong><span>${label}</span></li>`;
  }).join('');
  for (const name of ['advance', 'play']) {
   show(name, available('advance'));
   e(name).disabled = !available('advance');
  }
  set('play', playing ? '暂停' : '播放');
  e('play').setAttribute('aria-pressed', String(playing));
  show('pin', stage === 'manual');
  e('pin').disabled = !available('pin');
  set('pin', manualPick === null ? '保留当前帧' : `已保留第 ${manualPick} 帧`);
  show('start-manual', available('start-manual'));
  show('baseline-result', stage === 'baseline-done');
  if (stage === 'baseline-done') set('baseline-verdict', resultText(evidence.fixed));
  show('retry-empty', stage === 'manual-empty');
  show('tip', available('advance'));
  show('workbench', !done && !reviewing);
  show('last-entry', !reviewing && !done && (Boolean(previous) || ['invalid', 'unavailable'].includes(saved.status)));
  show('review', Boolean(previous));
  set('last-summary', previous ? `上次选第 ${previous.result.evidence.manualPick} 帧 · ${resultText(previous.result.evidence.manual)}。可以先回看，也可以直接开始这次尝试。`
   : saved.status === 'invalid' ? '本机旧记录未通过核验，没有载入或删除。可以开始新一轮。'
   : saved.status === 'unavailable' ? '当前浏览器不能读取本机结果。仍可开始新一轮，完成后生成 JSON 留存。' : '');
  show('compare', done || reviewing);
  show('share', done || reviewing);
  show('resume', reviewing);
  show('resume-footer', reviewing);
  if (reviewing) set('resume-state', stage === 'manual-empty'
   ? '这次已看到末帧，但没有保留中间帧。回去后可以重做第二轮。'
   : `这次停在第 ${id} 帧，${manualPick === null ? '还没保留中间帧' : `已保留第 ${manualPick} 帧`}。继续后仍暂停，不会自动播放。`);
  show('redo', done && !reviewing);
  show('redo-note', !reviewing);
  show('return', canReturn && !reviewing);
  show('os-manual', !canReturn || reviewing);
  show('os-link', !canReturn || reviewing);
  set('compare-title', reviewing ? '上次完整结果 · 这次尝试已暂停' : '同一段画面，Agent 看到了什么？');
  set('share-title', reviewing ? '带走上次完整记录' : '带走这次对照');
  set('save-status', reviewing ? '正在回看上次完整结果，不是这次任务的新操作；没有记成新的课程进度。' : saveStatus);
  for (const name of ['resume', 'resume-bottom']) set(name, run.actions.length ? '继续这次尝试' : '开始这次尝试');
  set('export', reviewing ? '生成上次记录 JSON' : '生成实验 JSON');
  show('retry-compare', done && Boolean(previous) && !reviewing);
  if (done || reviewing) drawComparison();
  if (done && previous && !reviewing) drawRetryComparison();
 }

 function stop() {
  playing = false;
  generation++;
  if (timeout !== null) window.clearTimeout(timeout);
  timeout = null;
 }

 function revealPlayer() {
  const player = e('player');
  if (e('workbench').hidden || !window.scrollBy || !player?.getBoundingClientRect) return;
  const {top, bottom, height} = player.getBoundingClientRect(), viewport = window.innerHeight;
  const margin = 8;
  if (height + margin * 2 > viewport) return;
  const delta = top < 0 ? top - margin : bottom > viewport ? bottom - viewport + margin : 0;
  if (delta) window.scrollBy({top: delta, behavior: 'instant'});
 }

 function act(action) {
  if (document.hidden || reviewing || !available(action)) return;
  try { run = runAgentFrames([...run.actions, {action}], SOURCE); }
  catch { stop(); render(); set('feedback', '操作未完成，已有记录仍在。请重试。'); return; }
  retryNotice = false;
  if (run.result.stage === 'baseline-done') baseline = run;
  if (run.result.workflowComplete) {
   const stored = store.save(run);
   saveStatus = stored.status === 'saved'
    ? '本次两轮已保存在此浏览器。刷新后可回看；未完成的新尝试不会覆盖它。未上传，也未记为课程进度。'
    : '未能确认本机保存。当前结果仍在，离开前请生成 JSON 留存。';
  }
  if (!available('advance')) stop();
  render();
  if (run.result.stage === 'done') focus(previous ? 'retry-title' : 'compare-title');
  else if (run.result.stage === 'baseline-done') focus('start-manual');
  else if (run.result.stage === 'manual-empty') focus('retry-empty');
  else if (action === 'start-manual' || action === 'pin') focus('advance');
 }

 function queue() {
  const ticket = generation;
  timeout = window.setTimeout(() => {
   if (ticket !== generation) return;
   timeout = null;
   if (!playing || document.hidden) { stop(); render(); return; }
   act('advance');
   if (playing) queue();
  }, 1200);
 }

 function operate(action) {
  if (document.hidden || reviewing || !available(action)) return;
  stop(); act(action); revealPlayer();
 }
 e('advance').addEventListener('click', () => operate('advance'));
 e('play').addEventListener('click', () => {
  if (document.hidden || reviewing || !available('advance')) return;
  if (playing) stop();
  else { playing = true; queue(); }
  render(); revealPlayer();
 });
 for (const name of ['pin', 'start-manual']) e(name).addEventListener('click', () => operate(name));
 document.addEventListener('visibilitychange', () => { if (document.hidden) { exportEpoch++; stop(); render(); } });
 window.addEventListener('pagehide', () => { exportEpoch++; stop(); render(); });
 e('timeline').addEventListener('click', event => {
  const button = event.target.closest?.('[data-inspect-frame]');
  if (button) inspect(Number(button.dataset.inspectFrame));
 });

 const completed = () => !document.hidden && !reviewing && run.result.stage === 'done' && run.result.workflowComplete;
 const exportable = () => !document.hidden && visibleRun()?.result.stage === 'done' && visibleRun().result.workflowComplete;
 function clearExport() {
  exportEpoch++;
  e('export-text').value = '';
  show('export-record', false);
  show('os-fallback', false);
  set('share-status', '');
 }
 e('review').addEventListener('click', () => {
  if (document.hidden || !previous || reviewing || run.result.stage === 'done') return;
  stop(); clearExport(); reviewing = true; inspected = comparison = null;
  render(); focus('compare-title');
 });
 function resume() {
  if (document.hidden || !reviewing) return;
  clearExport(); reviewing = false; inspected = comparison = null;
  render(); focus(available('advance') ? 'advance' : available('start-manual') ? 'start-manual' : 'retry-empty'); revealPlayer();
 }
 for (const name of ['resume', 'resume-bottom']) e(name).addEventListener('click', resume);
 function redo() {
  if (!baseline || document.hidden || reviewing || !['done', 'manual-empty'].includes(run.result.stage)) return;
  stop();
  if (run.result.stage === 'done') previous = run;
  run = runAgentFrames([...baseline.actions, {action: 'start-manual'}], SOURCE);
  inspected = comparison = null;
  e('timeline').innerHTML = '';
  clearExport();
  retryNotice = true;
  render();
  focus('advance'); revealPlayer();
 }
 e('redo').addEventListener('click', redo);
 e('retry-empty').addEventListener('click', redo);
 e('return').addEventListener('click', () => {
  if (!completed() || !canReturn) return;
  try {
   window.location.assign(createGenaiReturnUrl(handoff, run, window.location));
  } catch {
   show('os-fallback', true);
   set('share-status', '暂时无法自动带回。可以生成 JSON，再手动导入。');
  }
 });
 e('export').addEventListener('click', () => {
  if (!exportable()) return;
  exportEpoch++;
  e('export-text').value = JSON.stringify(visibleRun(), null, 2);
  show('export-record', true);
  focus('export-text');
  set('share-status', reviewing ? '上次完整记录的 JSON 已生成，不包含这次尚未完成的尝试。没有上传。' : 'JSON 已在本页生成，没有上传。');
 });
 e('copy').addEventListener('click', async () => {
  const snapshot = visibleRun(), text = e('export-text').value, ticket = ++exportEpoch;
  if (!exportable() || !text) return;
  const stillCurrent = () => ticket === exportEpoch && snapshot === visibleRun() && exportable() && text === e('export-text').value;
  try {
   await window.navigator.clipboard.writeText(text);
   if (stillCurrent()) set('share-status', reviewing ? '已复制上次完整记录，可到 GenAI OS 第三关手动导入。' : '已复制，可到 GenAI OS 第三关手动导入。');
  } catch {
   if (!stillCurrent()) return;
   focus('export-text');
   e('export-text').select();
   set('share-status', '浏览器未允许自动复制，已选中 JSON，请手动复制。');
  }
 });
 const theme = document.getElementById('home-theme'), scheme = window.matchMedia('(prefers-color-scheme: dark)');
 let manualTheme = false;
 function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  theme.setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
 }
 applyTheme(scheme.matches);
 theme.hidden = false;
 theme.addEventListener('click', () => { manualTheme = true; applyTheme(document.documentElement.dataset.theme !== 'dark'); });
 scheme.addEventListener('change', event => { if (!manualTheme) applyTheme(event.matches); });
 render();
}

if (typeof document !== 'undefined' && document.getElementById('frames-scene')) mountAgentFrames({document, window});
