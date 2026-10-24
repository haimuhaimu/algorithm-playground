import {createSharedCase,compareSharedChoice,resolveSharedChoice} from './mining-shared-evidence.mjs';

const NAMES=['苔原','珊瑚','琥珀','雾蓝','月白'];
const percent=value=>(value*100).toFixed(value*100%1?1:0)+'%';
export function initSharedLesson(){
 const $=id=>document.getElementById(id),box=$('shared-lab');
 const buttons=NAMES.map((_,i)=>$('shared-planet-'+i));
 const evidence=createSharedCase(),before=evidence.record;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let choice=null,phase='choose',seen=false,frame=0,version=0;
 const controls=[...buttons,$('shared-reveal'),$('shared-fly'),$('shared-retry'),
  $('shared-answer-rules'),$('shared-answer-luck'),$('shared-more'),$('shared-formula')];
 controls.forEach(el=>{el.dataset.sharedControl='true';});
 function status(text){$('shared-status').textContent=text;}
 function render(){
  box.dataset.phase=phase;
  buttons.forEach((el,i)=>{
   el.setAttribute('aria-pressed',String(choice===i));
   el.setAttribute('aria-disabled',String(phase!=='choose'));
   $('shared-sample-'+i).textContent=before.wins[i]+' 矿 / '+before.counts[i]+' 次';
   $('shared-mean-'+i).textContent='实测 '+percent(before.wins[i]/before.counts[i]);
  });
  $('shared-reveal').disabled=choice===null||phase!=='choose';
  $('shared-reveal').hidden=phase!=='choose';
  $('shared-comparison').hidden=phase==='choose';
  $('shared-fly').hidden=phase==='choose'||phase==='result';
  $('shared-fly').disabled=phase==='flying';
  $('shared-fly').textContent=phase==='flying'?'探测器正在返回…':'按这三种选择，各模拟一趟 →';
  $('shared-result').hidden=phase!=='result';
  $('shared-flight').hidden=phase!=='flying';
  $('shared-retry').hidden=phase==='choose';
 }
 function stop(){
  version++;cancelAnimationFrame(frame);frame=0;
  if(phase==='flying'){phase='compare';status('演示已暂停，结果还没揭晓。可重新出发，线索和收获不会重抽。');render();}
 }
 function arrive(){
  const result=resolveSharedChoice(choice),record=result.you,reward=record.history.at(-1).reward;
  phase='result';seen=true;frame=0;render();
  $('shared-outcome').textContent='你去'+NAMES[choice]+'，'+(reward?'带回 1 块矿。':'这次空手而归。');
  $('shared-change').textContent=NAMES[choice]+'的记录：'+before.wins[choice]+' 矿 / '+before.counts[choice]+' 次 → '+record.wins[choice]+' 矿 / '+record.counts[choice]+' 次；实测 '+percent(before.wins[choice]/before.counts[choice])+' → '+percent(record.wins[choice]/record.counts[choice])+'。其他星球的记录不变。';
  for(const actor of ['greedy','ucb']){
   const move=result[actor].history.at(-1);
   $('shared-'+actor+'-outcome').textContent='同条件这一趟：'+(move.reward?'1 块矿':'空手而归');
  }
  $('shared-you-outcome').textContent='同条件这一趟：'+(reward?'1 块矿':'空手而归');
  status('已完成。原来的 20 次线索保留在上方；这一次收获不能判定哪种规则一定更好。');
  $('shared-result-title').focus();
 }
 buttons.forEach((button,i)=>button.addEventListener('click',()=>{
  if(phase!=='choose'||document.hidden||$('guide').open)return;
  choice=i;status('你选了'+NAMES[i]+'。先想想理由，再看看算法怎么选。');render();
 }));
 $('shared-reveal').addEventListener('click',()=>{
  if(phase!=='choose'||choice===null||document.hidden||$('guide').open)return;
  const comparison=compareSharedChoice(choice),g=comparison.greedy.arm,u=comparison.ucb.arm;
  phase='compare';
  $('shared-you').textContent='你 → '+NAMES[choice];
  $('shared-greedy').textContent='守成派 → '+NAMES[g];
  $('shared-ucb').textContent='好奇派 → '+NAMES[u];
  $('shared-greedy-reason').textContent=NAMES[g]+'实测 '+percent(comparison.greedy.means[g])+'，在这份记录里最高。守成派只比较实测收获，不给“还没摸清”额外加分。';
  $('shared-ucb-reason').textContent=NAMES[u]+'只试了 '+before.counts[u]+' 次。好奇派把实测收获和探索加分相加，暂时优先补线索，而不是认定它更富矿。';
  $('shared-formula-body').textContent='UCB1 分数 = 实测均值 + √(2 × ln(总探测次数) / 该星球次数)。总次数为 20；分数用于排序，不是产矿概率。'+NAMES.map((name,i)=>name+'：'+comparison.ucb.means[i].toFixed(2)+' + '+comparison.ucb.bonuses[i].toFixed(2)+' = '+comparison.ucb.scores[i].toFixed(2)).join('；')+'。完整精度比较，同分按星球顺序选择。';
  for(const actor of ['you','greedy','ucb'])$('shared-'+actor+'-outcome').textContent='尚未出发 · 收获未知';
  render();status('线索没有变，比较规则不同，所以选择不同。先看理由，再出发验证。');
  $('shared-comparison-title').focus();
 });
 $('shared-fly').addEventListener('click',()=>{
  if(phase!=='compare'||document.hidden||$('guide').open)return;
  if(reduced.matches){arrive();return;}
  phase='flying';render();status('三种选择从同一份记录出发。到达前，不提前揭晓矿石。');
  const token=++version;let start=null;
  $('shared-flight').style.setProperty('--flight','0');
  function fly(time){
   if(token!==version||phase!=='flying')return;
   start??=time;const progress=Math.min(1,(time-start)/1200);
   $('shared-flight').style.setProperty('--flight',String(progress));
   if(progress===1)arrive();else frame=requestAnimationFrame(fly);
  }
  frame=requestAnimationFrame(fly);
 });
 $('shared-retry').addEventListener('click',()=>{
  stop();phase='choose';choice=null;
  $('shared-learning').textContent='';
  for(const actor of ['you','greedy','ucb'])$('shared-'+actor+'-outcome').textContent='';
  render();status(seen?'复看这份线索（结果已知）：换一种选择，仍是同一轮，不重新抽奖。':'重新选择：仍是同一份线索，没有消耗原游戏的探测次数。');
  buttons[0].focus();
 });
 $('shared-answer-rules').addEventListener('click',()=>{
  if(phase==='result')$('shared-learning').textContent='对。同一份线索，守成派看“目前谁表现最好”，好奇派还问“谁值得再了解”。新收获更新线索，不会把规则改成必胜秘籍。';
 });
 $('shared-answer-luck').addEventListener('click',()=>{
  if(phase==='result')$('shared-learning').textContent='再想一层：算法做选择时看不到这一趟的收获。空手或有矿只是一次结果；真正的差别，是它是否为还没摸清的星球加分。';
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener('pagehide',stop);reduced.addEventListener('change',stop);
 $('about').addEventListener('click',stop);
 render();status('先选一颗星球。这是一份固定教学航海日志，不需要先玩完 30 趟。');
}
