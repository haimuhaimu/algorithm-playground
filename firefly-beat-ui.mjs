import {createBeatLesson,selectBeatCase,guessBeat,runBeat,retryBeat} from './firefly-beat.mjs?v=one-beat-1';

const names={faster:'加快追上',slower:'放慢等一等',same:'照自己的节拍走'};
const contexts={ahead:'三只邻居此刻领先 ¼ 圈。它们和金色这只的天生步速完全相同。',behind:'三只邻居此刻落后 ¼ 圈。它们和金色这只的天生步速完全相同。',out:'邻居仍领先 ¼ 圈，但距离在听见范围外。这只还会追上去吗？'};
const degree=rad=>rad*180/Math.PI,angle=rad=>degree(rad).toFixed(1)+'°';
const hand=(phase,r,cls)=>`<line class="${cls}" x1="110" y1="106" x2="${(110+Math.sin(phase)*r).toFixed(2)}" y2="${(106-Math.cos(phase)*r).toFixed(2)}"/>`;
function dial(world,solo=null){
 const p=world.points[0],q=world.points[1];
 const ticks=Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return `<line x1="${110+Math.sin(a)*73}" y1="${106-Math.cos(a)*73}" x2="${110+Math.sin(a)*79}" y2="${106-Math.cos(a)*79}"/>`;}).join('');
 return `<svg viewBox="0 0 220 214" role="img" aria-label="金色这只 ${angle(p.phase)}，三只邻居 ${angle(q.phase)}${solo?'，独自走会在 '+angle(solo.points[0].phase):''}"><circle class="beat-ring" cx="110" cy="106" r="79"/><g class="beat-ticks">${ticks}</g><text x="110" y="15" text-anchor="middle">亮起 · 0°</text><text x="110" y="207" text-anchor="middle">一圈 = 一个明暗周期 ↻</text>${solo?hand(solo.points[0].phase,70,'beat-solo'):''}${hand(q.phase,52,'beat-neighbor')}${hand(p.phase,70,'beat-actual')}<circle class="beat-pin" cx="110" cy="106" r="5"/></svg>`;
}
export function mountBeatLesson({document=globalThis.document,onStart=()=>{}}={}){
 const $=id=>document.getElementById(id);if(!$('beat-panel'))return;
 let state=createBeatLesson(),opened=false,index=0,raf=null,token=0,origin=null,startIndex=0;
 const motion=matchMedia('(prefers-reduced-motion:reduce)');let reduced=motion.matches;
 function stop(){token++;if(raf!==null)cancelAnimationFrame(raf);raf=null;origin=null;}
 function renderFrames(){
  const c=state.comparison,world=c?c.frames[index]:state.before;
  $('beat-before').innerHTML=dial(state.before);
  $('beat-after').innerHTML=dial(world,c?.soloFrames[index]);
  $('beat-after-title').textContent=!c?'半秒后 · 等你先猜':index===30?'半秒后 · 已封存':`回看第 ${index} 拍 / 30`;
  $('beat-frame').textContent=`第 ${index} / 30 拍 · ${(index/60).toFixed(2)} / 0.50 秒${index<30&&c?' · 下方完整结果保持封存':''}`;
  $('beat-scrub').value=String(index);$('beat-scrub').setAttribute('aria-valuetext',`第 ${index} 拍，模拟 ${(index/60).toFixed(2)} 秒`);
  $('beat-replay').textContent=raf===null?'慢放这半秒 ↻':'暂停慢放 Ⅱ';
 }
 function render(){
  const c=state.comparison;
  $('beat-panel').dataset.scenario=state.scenario;$('beat-panel').dataset.stage=c?'result':'guess';
  $('beat-body').hidden=!opened;$('beat-open').setAttribute('aria-expanded',String(opened));$('beat-open').textContent=opened?'收起放大镜 −':'放大一只，试试看 ↗';
  for(const scenario of ['ahead','behind','out'])$('beat-'+scenario).setAttribute('aria-pressed',String(state.scenario===scenario));
  $('beat-context').textContent=contexts[state.scenario];
  $('beat-progress').textContent=`已看过 ${Object.keys(state.records).length} / 3 种情况`;
  $('beat-guess-panel').hidden=Boolean(c);$('beat-run').hidden=Boolean(c);$('beat-run').disabled=state.guess===null||Boolean(c);
  for(const guess of ['faster','slower','same'])$('beat-'+guess).setAttribute('aria-pressed',String(state.guess===guess));
  $('beat-result').hidden=!c;$('beat-retry').hidden=!c;$('beat-replay').hidden=!c||reduced;$('beat-timeline').hidden=!c;$('beat-scrub').disabled=!c;
  $('beat-legend-solo').hidden=!c;$('beat-ending').hidden=!c;
  if(c){
   $('beat-result').dataset.correct=String(c.correct);
   $('beat-result-title').textContent=`${c.correct?'你猜对了':'这次和你猜的不一样'}：它会${names[c.outcome]}。`;
   const difference=angle(Math.abs(c.difference));
   $('beat-numbers').textContent=`同样半秒：独自走 ${angle(c.soloAdvance)} → 实际走 ${angle(c.actualAdvance)}${c.outcome==='same'?' · 没有多走或少走':` · ${c.outcome==='faster'?'多':'少'}走 ${difference}`}`;
   $('beat-explanation').textContent=state.scenario==='ahead'?'邻居此刻领先，金针加快追上，比灰色虚线多走了一段。青针也在动：双方都在调整，没有谁充当总指挥。':state.scenario==='behind'?'邻居此刻落后，金针放慢等一等，比灰色虚线少走了一段。但它仍然向前，不是倒转回去。青针也在调整。':'听不见的邻居不参与这只的调整。虽然青针领先，金针仍与灰色虚线重合：没有看到别人就自动追上的隐藏规则。';
   $('beat-ending').textContent=Object.keys(state.records).length===3?'三种情况都留下了证据：同步不是一律加速，也不是直接跳到别人的位置，而是在自己的步速上，受听见的邻居影响，一小步一小步调整。':'再换一种情况，检验你的理解：它总会加快吗？距离太远时，邻居还有用吗？';
  }
  renderFrames();
 }
 function prepare(){stop();onStart();}
 $('beat-open').addEventListener('click',()=>{prepare();opened=!opened;render();if(opened)$('beat-body').scrollIntoView?.({block:'start',behavior:'instant'});});
 for(const scenario of ['ahead','behind','out'])$('beat-'+scenario).addEventListener('click',()=>{prepare();state=selectBeatCase(state,scenario);index=state.comparison?30:0;render();});
 for(const guess of ['faster','slower','same'])$('beat-'+guess).addEventListener('click',()=>{if(state.comparison)return;prepare();state=guessBeat(state,guess);render();});
 $('beat-run').addEventListener('click',()=>{
  if(state.guess===null||state.comparison)return;prepare();state=runBeat(state);index=30;render();$('beat-body').scrollIntoView?.({block:'start',behavior:'instant'});$('beat-result-title').focus({preventScroll:true});
 });
 $('beat-retry').addEventListener('click',()=>{prepare();state=retryBeat(state);index=0;render();$('beat-faster').focus({preventScroll:true});});
 $('beat-scrub').addEventListener('input',()=>{if(!state.comparison)return;prepare();const value=Number($('beat-scrub').value);index=Number.isFinite(value)?Math.max(0,Math.min(30,Math.round(value))):0;renderFrames();});
 function schedule(){const current=token;raf=requestAnimationFrame(now=>{if(current!==token||document.hidden)return;raf=null;if(origin===null)origin=now;index=Math.min(30,startIndex+Math.floor((now-origin)*30/2000));if(index<30)schedule();renderFrames();});}
 $('beat-replay').addEventListener('click',()=>{
  if(!state.comparison||reduced||document.hidden)return;
  if(raf!==null){stop();renderFrames();return;}
  prepare();if(index===30)index=0;startIndex=index;schedule();renderFrames();
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();renderFrames();}});
 window.addEventListener('pagehide',()=>{stop();renderFrames();});
 document.addEventListener('firefly-world-action',()=>{if(raf!==null){stop();renderFrames();}});
 motion.addEventListener('change',e=>{reduced=e.matches;if(reduced)stop();render();});
 render();
}
