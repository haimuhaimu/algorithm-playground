import {BUDGET,createWorld,createRecord,pull,runPolicy} from './mining-core.mjs';

const $=id=>document.getElementById(id);
const names=['苔原','珊瑚','琥珀','雾蓝','月白'];
const buttons=names.map((_,i)=>$('planet-'+i));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let world=createWorld(newSeed()),record=createRecord(),pending=null,frame=0,version=0,replay=false;
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
}
function reveal(){
 const entries=[['you',record],...['greedy','epsilon','ucb'].map(key=>[key,runPolicy(world,key)])];
 for(const[key,result]of entries){
  $('score-'+key).textContent=result.total+' 块';$('bar-'+key).style.setProperty('--score',`${result.total/BUDGET*100}%`);
  $('visits-'+key).textContent='探测分配：'+names.map((name,i)=>`${name} ${result.counts[i]} 次`).join(' · ');
 }
 $('result-caption').textContent=`你带回了 ${record.total} 块矿石。${replay?'这是已知历史的复盘局，不作为首次盲测。':'看看不同的选择，会带回怎样的收获。'}`;
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
 record=createRecord();replay=same;buttons.forEach(button=>delete button.dataset.reward);render();
 setStatus(same?'同一片星域，同样的潜在结果。带着上次的经验，再选一次。':'新星域到了。矿藏重新分配，外观不会透露答案。');
}
buttons.forEach((button,i)=>button.addEventListener('click',()=>launch(i)));
$('new').addEventListener('click',()=>reset(false));$('replay').addEventListener('click',()=>reset(true));
$('about').addEventListener('click',()=>{cancel('探测已取消，没有扣次数。关闭说明后重新选择。');$('guide').showModal();render();});
$('guide').addEventListener('close',render);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel('已取消未到达的探测，没有扣次数。回来后可以重新选择。');else render();});
window.addEventListener('pagehide',()=>cancel());
reduced.addEventListener('change',()=>cancel('动画偏好已改变。重新选择星球即可继续。'));
document.addEventListener('keydown',event=>{
 if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName))return;
 if(/^[1-5]$/.test(event.key)&&!document.hidden&&!$('guide').open){event.preventDefault();launch(Number(event.key)-1);}
});
$('theme').addEventListener('click',()=>{
 const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';
 $('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');
});
render();setStatus('这里没有地图。第一趟，凭直觉选就好。');
