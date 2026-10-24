import {BUDGET,createWorld,createRecord,pull,runPolicyTrace,traceChoices} from './mining-core.mjs';
import {initSharedLesson} from './mining-shared-ui.mjs';

const $=id=>document.getElementById(id);
const names=['苔原','珊瑚','琥珀','雾蓝','月白'];
const buttons=names.map((_,i)=>$('planet-'+i));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let world=createWorld(newSeed()),record=createRecord(),pending=null,frame=0,version=0,replay=false;
const actors={you:'你',greedy:'守成派',epsilon:'冒险派',ucb:'好奇派'};
let replayRuns=null,replayActor='ucb',replayIndex=5;
const simulation={elapsed:0,phase:'ready',running:false,continuous:false,last:null,frame:0,version:0,speed:1};
function newSeed(){return crypto.getRandomValues(new Uint32Array(1))[0];}
function completed(){return record.history.length===BUDGET;}
function setStatus(message){$('status').textContent=message;}
function render(){
 $('remaining').textContent=String(BUDGET-record.history.length);$('minerals').textContent=String(record.total);
 $('round-mode').textContent=replay?'复盘局 · 已有历史':'首次探索';$('seed-label').textContent='星域 '+world.seed.toString(16).toUpperCase().padStart(8,'0');
 buttons.forEach((button,i)=>{
  button.disabled=completed();
  button.setAttribute('aria-disabled',String(pending!==null||completed()||document.hidden||$('guide').open));
  $('sample-'+i).textContent=record.counts[i]?`${record.wins[i]} 矿 / ${record.counts[i]} 次`:'未探测';
  $('truth-'+i).textContent=completed()?`产矿概率 ${Math.round(world.probabilities[i]*100)}%`:'产量未知';
 });
 $('history').replaceChildren(...Array.from({length:BUDGET},(_,i)=>{
  const item=document.createElement('li'),move=record.history[i];
  item.textContent=move?(move.reward?'◆':'·'):'';
  item.dataset.arm=move?String(move.arm):'';item.dataset.reward=move?String(move.reward):'';
  const label=move?`第 ${i+1} 趟，${names[move.arm]}，${move.reward} 块矿石`:`第 ${i+1} 趟，尚未出发`;
  item.setAttribute('aria-label',label);item.title=label;return item;
 }));
 $('results').hidden=!completed();$('view-results').hidden=!completed();
 $('decision-replay').hidden=!completed()||!replayRuns;
}
function reveal(){
 replayRuns={you:{record,steps:traceChoices(record.history)},...Object.fromEntries(['greedy','epsilon','ucb'].map(key=>[key,runPolicyTrace(world,key)]))};
 for(const[key,{record:result}]of Object.entries(replayRuns)){
  $('score-'+key).textContent=result.total+' 块';$('bar-'+key).style.setProperty('--score',`${result.total/BUDGET*100}%`);
  $('visits-'+key).textContent='探测分配：'+names.map((name,i)=>`${name} ${result.counts[i]} 次`).join(' · ');
 }
 $('result-caption').textContent=`你带回了 ${record.total} 块矿石。${replay?'这是已知历史的复盘局，不作为首次盲测。':'看看不同的选择，会带回怎样的收获。'}`;
 renderReplay();
}
function renderReplay(){
 if(!completed()||!replayRuns)return;
 const step=replayRuns[replayActor].steps[replayIndex],ucb=replayActor==='ucb',name=names[step.arm];
 $('decision-replay').hidden=false;$('replay-actor').value=replayActor;$('replay-round').value=String(replayIndex+1);
 $('replay-round-label').textContent=`第 ${step.round} / ${BUDGET} 趟`;
 $('replay-round').setAttribute('aria-valuetext',`第 ${step.round} 趟，共 ${BUDGET} 趟，${actors[replayActor]}`);
 $('replay-prev').disabled=replayIndex===0;$('replay-next').disabled=replayIndex===BUDGET-1;
 $('replay-knowledge').textContent=`${actors[replayActor]}已完成 ${replayIndex} 次探测，累计 ${step.totalBefore} 块矿。下表不含本趟结果。`;
 $('replay-score-heading').hidden=!ucb;$('replay-formula').hidden=!ucb;
 $('replay-observations').replaceChildren(...names.map((planet,i)=>{
  const row=document.createElement('tr');row.dataset.selected=String(i===step.arm);
  const label=document.createElement('th');label.setAttribute('scope','row');label.textContent=planet+(i===step.arm?' · 本趟':'');
  const count=document.createElement('td');count.textContent=`${step.wins[i]} / ${step.counts[i]}`;
  const mean=document.createElement('td');mean.textContent=step.means[i]===null?'未探测':step.means[i].toFixed(2);
  const score=document.createElement('td');score.hidden=!ucb;
  if(step.scores[i]===null)score.textContent='—';
  else{score.textContent=step.scores[i].toFixed(2);const parts=document.createElement('small');parts.textContent=`${step.means[i].toFixed(2)} + ${step.bonuses[i].toFixed(2)}`;score.append(parts);}
  row.append(label,count,mean,score);return row;
 }));
 $('replay-choice').textContent=`${actors[replayActor]} → ${name}`;
 const labels={initial:'先摸底',explore:'这次随机探索',exploit:'利用已有反馈',ucb:'兼顾收获与未知',human:'你的真实记录'};
 $('replay-kind').textContent=labels[step.kind];
 const tie=step.ties.length>1?` ${step.ties.map(i=>names[i]).join('、')}并列最高，按编号先选${name}。`:'';
 let reason;
 if(step.kind==='initial')reason=`${name}还没有样本。三个策略都先按顺序各探一颗，暂不按分数比较；这不是判断它矿更多。`;
 else if(step.kind==='explore')reason=`这一步触发了 20% 的随机探索分支，在五颗星球中等概率抽到${name}。它也可能恰好是实测最好的，不代表这次按均值挑选。`;
 else if(step.kind==='exploit')reason=`${replayActor==='epsilon'?'这一步没有触发随机探索。':''}${name}此前 ${step.wins[step.arm]} 矿 / ${step.counts[step.arm]} 次，实测均值 ${step.means[step.arm].toFixed(2)}，是当前最高值。${tie}`;
 else if(step.kind==='ucb')reason=`${name}的实测均值 ${step.means[step.arm].toFixed(2)} + 探索加分 ${step.bonuses[step.arm].toFixed(2)} ≈ ${step.scores[step.arm].toFixed(2)}，UCB 分数最高。样本较少会得到更高的探索加分，不是直接选择真实产矿概率最高的星球。${tie}`;
 else reason='这是你当时的选择。这里只回放真实记录，不替你推测选择理由；可以看看当时哪些星球还没摸清。';
 $('replay-reason').textContent=reason;
 renderSimulation();
}
function simulationPhase(){
 const t=simulation.elapsed;
 return t<900?'choice':t<1500?'outbound':t<2000?'mining':t<2600?'inbound':'result';
}
function renderSimulation(){
 if(!replayRuns||!completed())return;
 const step=replayRuns[replayActor].steps[replayIndex],returned=['result','done'].includes(simulation.phase);
 $('replay-outcome').textContent=simulation.phase==='ready'||returned?`${names[step.arm]}${step.reward?'带回 1 块矿石':'这次空手而归（0 块）'}。累计矿石 ${step.totalBefore} → ${step.totalAfter}。`:'探测器尚未返回；本趟结果将在返航后显示。';
 const phaseLabels={ready:'准备出发',choice:'01 · 比较与选择',outbound:'02 · 飞向目标',mining:'03 · 正在探测',inbound:'04 · 返回探测站',result:'05 · 更新观测',done:replayIndex===BUDGET-1?'本局演示完成':'本趟演示完成'};
 $('sim-phase').textContent=(simulation.running||['ready','done'].includes(simulation.phase)?'':'已暂停 · ')+phaseLabels[simulation.phase];
 $('sim-total').textContent=String(returned?step.totalAfter:step.totalBefore);
 $('sim-round').textContent=`第 ${step.round} / ${BUDGET} 趟 · ${$('replay-kind').textContent}`;
 $('sim-choice').textContent=$('replay-choice').textContent;
 $('sim-reason').textContent=step.kind==='ucb'?`${names[step.arm]}：均值 ${step.means[step.arm].toFixed(2)} + 探索加分 ${step.bonuses[step.arm].toFixed(2)} ≈ ${step.scores[step.arm].toFixed(2)}，分数最高。样本少的星球会得到探索加分。${step.ties.length>1?'并列时先选编号小的。':''}`:$('replay-reason').textContent;
 const count=step.counts[step.arm]+1,wins=step.wins[step.arm]+step.reward;
 $('sim-feedback').textContent=returned?`${names[step.arm]}${step.reward?'带回 1 块矿石':'这次没有找到矿石'}。样本更新为 ${wins} 矿 / ${count} 次，实测均值 ${(wins/count).toFixed(2)}。${replayIndex===BUDGET-1?'30 趟结束，本局观测已更新完成。':'下一趟将使用这次反馈。'}`:
  simulation.phase==='mining'?'已到达目标，正在探测。结果还没有回传。':simulation.phase==='inbound'?'探测器正在返航；回到探测站后，才把这次反馈计入观测。':'只根据此前的样本决定目的地，不知道这趟能挖到多少矿。';
 names.forEach((_,i)=>{
  const planet=$('sim-planet-'+i),n=step.counts[i]+(returned&&i===step.arm?1:0),w=step.wins[i]+(returned&&i===step.arm?step.reward:0);
  $('sim-sample-'+i).textContent=n?`${w} 矿 / ${n} 次`:'未探测';
  $('sim-score-'+i).textContent=returned?(n?`均值 ${(w/n).toFixed(2)}`:'暂无样本'):
   step.scores[i]!==null?`${replayActor==='ucb'?'UCB':'均值'} ${step.scores[i].toFixed(2)}`:n?`均值 ${(w/n).toFixed(2)}`:'暂无样本';
  delete planet.dataset.target;delete planet.dataset.reward;
  if(i===step.arm){if(returned)planet.dataset.reward=String(step.reward);else planet.dataset.target='true';}
 });
 $('sim-probe').hidden=reduced.matches||!['outbound','mining','inbound'].includes(simulation.phase);
 $('sim-play').textContent=simulation.running?'暂停演示':simulation.phase==='done'&&replayIndex===BUDGET-1?'重播整局':simulation.phase==='ready'?'连续演示':'继续演示';
 $('sim-play').setAttribute('aria-pressed',String(simulation.running));
 $('sim-step').disabled=simulation.running||simulation.phase==='done'&&replayIndex===BUDGET-1;
 $('sim-step').textContent=simulation.phase==='done'?'只演下一趟':'只演这一趟';
 $('sim-hint').textContent=reduced.matches?'已减少动画：不移动探测器，仍逐阶段展示选择与反馈。':simulation.running?'播放的是本局已记录的真实决策；你可以随时暂停细看。':'从当前趟开始；想看完整过程，先点「从头开始」。';
 positionSimulationProbe();
}
function positionSimulationProbe(){
 if($('sim-probe').hidden||!replayRuns)return;
 const arm=replayRuns[replayActor].steps[replayIndex].arm;
 const bounds=$('sim-field').getBoundingClientRect(),start=$('sim-launchpad').getBoundingClientRect(),target=$('sim-planet-'+arm).getBoundingClientRect();
 const a={x:start.left+start.width/2-bounds.left,y:start.top+12-bounds.top},b={x:target.left+target.width/2-bounds.left,y:target.top+25-bounds.top};
 const returning=simulation.phase==='inbound';
 const p=simulation.phase==='mining'?1:Math.max(0,Math.min(1,(simulation.elapsed-(returning?2000:900))/600));
 const eased=p*p*(3-2*p),q=returning?1-eased:eased;
 const angle=Math.atan2((b.y-a.y)*(returning?-1:1),(b.x-a.x)*(returning?-1:1))*180/Math.PI+90;
 $('sim-probe').style.transform=`translate(${a.x+(b.x-a.x)*q}px,${a.y+(b.y-a.y)*q}px) translate(-50%,-50%) rotate(${angle}deg)`;
}
function pauseSimulation(){
 simulation.version++;cancelAnimationFrame(simulation.frame);simulation.frame=0;simulation.running=false;simulation.last=null;renderSimulation();
}
function resetSimulation(){
 pauseSimulation();simulation.elapsed=0;simulation.phase='ready';$('sim-probe').hidden=true;
}
function startSimulation(continuous){
 if(!replayRuns||!completed()||document.hidden||$('guide').open||simulation.running)return;
 if(simulation.phase==='done'){replayIndex=replayIndex===BUDGET-1?0:replayIndex+1;resetSimulation();renderReplay();}
 simulation.continuous=continuous;simulation.running=true;simulation.last=null;
 if(simulation.phase==='ready')simulation.phase='choice';
 const token=++simulation.version;renderSimulation();
 const bounds=$('policy-theater').getBoundingClientRect();
 if(bounds.top<0||bounds.bottom>window.innerHeight)$('policy-theater').scrollIntoView({block:'start',behavior:'instant'});
 function tick(time){
  if(token!==simulation.version||!simulation.running||!replayRuns)return;
  if(document.hidden||$('guide').open){pauseSimulation();return;}
  if(simulation.last!==null)simulation.elapsed+=Math.max(0,time-simulation.last)*simulation.speed;
  simulation.last=time;
  if(simulation.elapsed>=3700){
   if(simulation.continuous&&replayIndex<BUDGET-1){replayIndex++;simulation.elapsed=0;simulation.phase='choice';renderReplay();}
   else{simulation.phase='done';simulation.running=false;simulation.frame=0;simulation.last=null;renderSimulation();return;}
  }else{const phase=simulationPhase();if(phase!==simulation.phase){simulation.phase=phase;renderSimulation();}}
  positionSimulationProbe();simulation.frame=requestAnimationFrame(tick);
 }
 simulation.frame=requestAnimationFrame(tick);
}
function clearReplay(){
 resetSimulation();
 replayRuns=null;replayActor='ucb';replayIndex=5;$('decision-replay').hidden=true;
 $('replay-observations').replaceChildren();
 for(const id of ['replay-knowledge','replay-choice','replay-kind','replay-reason','replay-outcome'])$(id).textContent='';
}
function cancel(message){
 const hadFlight=pending!==null;version++;cancelAnimationFrame(frame);frame=0;pending=null;$('probe').hidden=true;
 buttons.forEach(button=>delete button.dataset.target);render();if(hadFlight&&message)setStatus(message);
}
function arrive(arm,token){
 if(token!==version||pending===null||document.hidden||$('guide').open)return;
 record=pull(world,record,arm);pending=null;frame=0;$('probe').hidden=true;
 buttons.forEach(button=>{delete button.dataset.target;delete button.dataset.reward;});
 const reward=record.history.at(-1).reward;buttons[arm].dataset.reward=String(reward);render();
 setStatus(completed()?`30 趟结束，带回 ${record.total} 块矿石。矿藏已揭晓，往下看看算法的选择。`:reward?`${names[arm]}传来好消息：带回 1 块矿石。下一趟，还去吗？`:`${names[arm]}这次空手而归。是运气不好，还是该换个地方？`);
 if(completed())reveal();
}
function launch(arm){
 if(pending!==null||completed()||document.hidden||$('guide').open)return;
 const token=++version;pending=arm;buttons.forEach(button=>delete button.dataset.reward);buttons[arm].dataset.target='true';render();
 setStatus(`探测器正飞往${names[arm]}……`);
 if(reduced.matches){arrive(arm,token);return;}
 const bounds=$('starfield').getBoundingClientRect(),start=$('launchpad').getBoundingClientRect(),target=buttons[arm].getBoundingClientRect();
 const a={x:start.left+start.width/2-bounds.left,y:start.top+12-bounds.top};
 const b={x:target.left+target.width/2-bounds.left,y:target.top+38-bounds.top};
 let began=null;$('probe').hidden=false;
 function fly(time){
  if(token!==version||pending===null)return;
  if(began===null)began=time;const p=Math.min(1,(time-began)/420),q=1-(1-p)**2;
  const x=a.x+(b.x-a.x)*q,y=a.y+(b.y-a.y)*q;
  const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+90;
  $('probe').style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) rotate(${angle}deg)`;
  if(p>=1)arrive(arm,token);else frame=requestAnimationFrame(fly);
 }
 frame=requestAnimationFrame(fly);
}
function reset(same){
 cancel();if(!same){let seed=newSeed();if(seed===world.seed)seed=(seed+1)>>>0;world=createWorld(seed);}
 record=createRecord();replay=same;clearReplay();buttons.forEach(button=>delete button.dataset.reward);render();
 setStatus(same?'同一片星域，同样的潜在结果。带着上次的经验，再选一次。':'新星域到了。矿藏重新分配，外观不会透露答案。');
}
buttons.forEach((button,i)=>button.addEventListener('click',()=>launch(i)));
$('replay-actor').addEventListener('change',()=>{if(!Object.hasOwn(actors,$('replay-actor').value))return;resetSimulation();replayActor=$('replay-actor').value;renderReplay();});
$('replay-round').addEventListener('input',()=>{const value=Number($('replay-round').value);if(!Number.isInteger(value)||value<1||value>BUDGET)return;resetSimulation();replayIndex=value-1;renderReplay();});
$('replay-prev').addEventListener('click',()=>{if(!replayRuns)return;resetSimulation();replayIndex=Math.max(0,replayIndex-1);renderReplay();});
$('replay-next').addEventListener('click',()=>{if(!replayRuns)return;resetSimulation();replayIndex=Math.min(BUDGET-1,replayIndex+1);renderReplay();});
$('sim-play').addEventListener('click',()=>simulation.running?pauseSimulation():startSimulation(true));
$('sim-step').addEventListener('click',()=>startSimulation(false));
$('sim-restart').addEventListener('click',()=>{if(!replayRuns)return;resetSimulation();replayIndex=0;renderReplay();});
$('sim-speed').addEventListener('change',()=>{const speed=Number($('sim-speed').value);if(speed===1||speed===2)simulation.speed=speed;});
$('new').addEventListener('click',()=>reset(false));$('replay').addEventListener('click',()=>reset(true));
$('about').addEventListener('click',()=>{pauseSimulation();cancel('探测已取消，没有扣次数。关闭说明后重新选择。');$('guide').showModal();render();});
$('guide').addEventListener('close',render);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseSimulation();cancel('已取消未到达的探测，没有扣次数。回来后可以重新选择。');}else render();});
window.addEventListener('pagehide',()=>{pauseSimulation();cancel();});
window.addEventListener('resize',positionSimulationProbe);
reduced.addEventListener('change',()=>{pauseSimulation();cancel('动画偏好已改变。重新选择星球即可继续。');});
document.addEventListener('keydown',event=>{
 if(event.target?.closest?.('#shared-lab')||document.activeElement?.dataset?.sharedControl==='true')return;
 if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName))return;
 if(/^[1-5]$/.test(event.key)&&!document.hidden&&!$('guide').open){event.preventDefault();launch(Number(event.key)-1);}
});
$('theme').addEventListener('click',()=>{
 const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';
 $('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');
});
render();setStatus('这里没有地图。第一趟，凭直觉选就好。');
initSharedLesson();
