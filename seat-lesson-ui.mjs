import {TOPICS,PRESETS} from './data.mjs?v=seats-20261025';
import {probability,scorePost} from './core.mjs?v=seats-20261025';
import {createSeatLesson,chooseSeat,nextSeat,currentRound,lessonMatches,diversityCounterfactual} from './seat-lesson.mjs?v=seats-20261025';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=post=>TOPICS[post.topic]?.short||post.topic;
const number=value=>Number(value.toPrecision(12)).toString();
function formula(post){
 return `<span>点击 <b>${number(post.parts.click)}</b></span><span>＋ 多样 <b>${number(post.parts.diversity)}</b></span><span>＋ 新人 <b>${number(post.parts.newcomer)}</b></span><strong>＝ ${number(post.score)}</strong>`;
}
function compactCards(feed){
 return feed.map((post,i)=>`<li><span>${i+1} · ${escape(label(post))}</span><strong>${escape(post.title)}</strong></li>`).join('');
}
export function mountSeatLesson({document,getInputs}){
 const $=id=>document.getElementById(id);
 let session=null,example=false,options=[];
 function showStep(id){
  $(id).focus({preventScroll:true});
  $(id).scrollIntoView({block:'start',behavior:'instant'});
 }
 function sync(){
  if(!session){$('seat-state').textContent='先固定一份口味和规则，再亲手猜六个席位。不会改变上方首页或反馈记录。';return;}
  const {weights,profile}=getInputs();
  $('seat-state').textContent=example
   ?'独立演示规则：多看一点。使用开始时的口味；上方自由调参和反馈记录都没动。'
   :lessonMatches(session,weights,profile)?'这次排座位与当前首页设置一致；过程中口味、规则和候选池保持固定。'
    :'上方首页已变化；这里仍保留开始时的口味和规则。要用新设置，请点「排当前首页」。';
 }
 function clearEnding(){
  $('seat-ending').hidden=true;$('seat-counterfactual').hidden=true;$('seat-judgment').textContent='';
  for(const id of ['seat-answer-taste','seat-answer-seats'])$(id).setAttribute('aria-pressed','false');
 }
 function reset(){
  session=null;options=[];example=false;
  $('seat-stage').hidden=true;clearEnding();sync();
 }
 function render(){
  const round=currentRound(session),seated=session.index+(session.revealed?1:0);
  $('seat-stage').hidden=!round;if(!round)return;
  $('seat-settings').textContent=`固定规则：点击 ${session.weights.click} / 多样 ${session.weights.diversity} / 新人 ${session.weights.newcomer} · ${session.posts.length} 张候选`;
  $('seat-taste').textContent=`固定口味：${Object.entries(session.profile).map(([key,v])=>`${TOPICS[key]?.short||key} ${Math.round(v*100)}`).join(' · ')}`;
  $('seat-row').innerHTML=session.trace.feed.map((post,i)=>i<seated
   ?`<li data-seated="${escape(post.id)}" style="--topic:${TOPICS[post.topic]?.color||'var(--soft)'}"><span>第 ${i+1} 席 · ${escape(label(post))}</span><strong>${escape(post.title)}</strong></li>`
   :`<li class="${i===session.index?'is-waiting':''}"><span>第 ${i+1} 席</span><strong>${i===session.index?'等你来猜':'空位'}</strong></li>`).join('');
  $('seat-turn').textContent=`第 ${round.slot} 席 / ${session.trace.feed.length} · ${session.revealed?'已经揭晓':'你觉得谁会坐下？'}`;
  const counts=Object.entries(round.countsBefore).map(([key,n])=>`${TOPICS[key]?.short||key} ${n} 张`).join('、');
  const rule=`本轮：点击 ${session.weights.click} / 多样 ${session.weights.diversity} / 新人 ${session.weights.newcomer}。`;
  $('seat-context').textContent=rule+(counts
   ?`这一席之前，首页已有：${counts}。`+(session.weights.diversity===0?'多样权重为 0，候选分数不会因为占座而改变。':'口味没变，但同主题已占的席位会减少多样性加分。')
   :'这是第一席，还没有主题占座。先看预测点击、新人身份，猜算法会选哪张。');
  options=round.ranked.slice(0,3).sort((a,b)=>String(a.id).localeCompare(String(b.id),'en'));
  $('seat-subset').textContent=`先猜最接近入选的 ${options.length} 张（按编号展示，不是得分顺序）。它们只是本席 ${round.ranked.length} 张候选的一部分，揭晓后可查全部。猜测不等于给首页反馈。`;
  for(let i=0;i<3;i++){
   const post=options[i],button=$(`seat-guess-${i}`);
   button.hidden=!post;button.disabled=session.revealed;
   if(!post)continue;
   button.setAttribute('aria-pressed',String(post.id===session.guess));
   button.innerHTML=`<span class="seat-choice-topic">${escape(label(post))} · ${post.isNew?'新作者':'已有作者'} · #${escape(post.id)}</span><strong>${escape(post.title)}</strong><span>预测点击 ${(probability(post,session.profile)*100).toFixed(1)}% · 同主题已坐 ${round.countsBefore[post.topic]||0} 张</span><b class="seat-choice-action">${session.revealed?post.id===round.ranked[0].id?'✓ 算法选了它':post.id===session.guess?'你猜的 · 本席未选中':'本席未选中':'我猜这张入选 →'}</b>`;
  }
  $('seat-evidence').hidden=!session.revealed;$('seat-next').hidden=!session.revealed||session.complete;
  if(!session.revealed){$('seat-all-details').open=false;sync();return;}
  const winner=round.ranked[0],runner=round.ranked[1],guess=round.ranked.find(p=>p.id===session.guess);
  $('seat-result-title').textContent=`第 ${round.slot} 席坐下的是《${winner.title}》`;
  $('seat-guess-result').textContent=guess.id===winner.id?'你猜中了。不是因为你点了它，而是它按固定规则排在第一。':`你猜的是《${guess.title}》。点选不会改规则；算法仍选择这一席得分最高的候选。`;
  $('seat-winner-score').innerHTML=formula(winner);
  $('seat-reason').textContent=!runner?'只剩这一张候选。':winner.score===runner.score
   ?`《${winner.title}》和《${runner.title}》同分（${number(winner.score)}）。按固定内容编号排序，${winner.id} 排在 ${runner.id} 前；不是模型更喜欢它。`
   :`这一席的最接近落选者是《${runner.title}》：${number(runner.score)} 分。赢家 ${number(winner.score)} 分，高出 ${number(winner.score-runner.score)}。比较使用同一席位、同一套规则。`;
  const nextCounts={...round.countsBefore,[winner.topic]:(round.countsBefore[winner.topic]||0)+1};
  const follower=round.ranked.find(p=>p.topic===winner.topic&&p.id!==winner.id);
  $('seat-change').textContent=session.weights.diversity===0
   ?'这次多样权重为 0：坐下一张不会改变其余卡片的多样性分。剩余候选只按点击分、新人分与同分编号继续排。'
   :follower?`《${winner.title}》坐下后，同属${label(winner)}的《${follower.title}》多样性分 ${number(follower.parts.diversity)} → ${number(scorePost(follower,session.weights,session.profile,nextCounts).parts.diversity)}。点击分、新人分不变，其他主题的多样性分也不变。${session.complete?'这是如果继续排第七席时的分数；本页六席已满。':'下一席会用更新后的分数重新比较。'}`
   :`已有${label(winner)}席位增至 ${nextCounts[winner.topic]}，但候选池已没有同主题卡片。其余候选的多样性分不变。`;
  $('seat-all-summary').textContent=`查看本席全部 ${round.ranked.length} 张候选：谁入选、谁落选？`;
  $('seat-all').innerHTML=round.ranked.map((post,i)=>`<li data-candidate="${escape(post.id)}"><div class="seat-candidate-heading"><strong>${i+1}. ${escape(post.title)}</strong><span>${escape(label(post))} · ${post.isNew?'新作者':'已有作者'} · #${escape(post.id)}</span></div><div class="seat-formula">${formula(post)}</div><p>${i===0?'本席入选':post.score===winner.score?`本席落选：同分，编号 ${escape(post.id)} 排在 ${escape(winner.id)} 后。`:`本席落选：比赢家少 ${number(winner.score-post.score)} 分。`} ${i>0?session.complete?'六席已满，本次未进首页。':'仍留在候选池，下一席可以再争取。':''}</p></li>`).join('');
  $('seat-next').textContent=`去排第 ${round.slot+1} 席 →`;
  if(session.complete){
   $('seat-ending').hidden=false;
   const process=session.weights.diversity>0?'每坐下一张，就按更新后的主题数，用剩余候选重算下一席。'
    :session.weights.click>0&&session.weights.newcomer===0?'这次多样性和新人权重都为 0，结果等同于按固定点击分排序。'
     :'这次多样权重为 0，点击分和新人分不会因为占座而改变；剩余卡片按固定分数和同分编号排序。';
   $('seat-conclusion').textContent=`六席排好了：${new Set(session.trace.feed.map(p=>p.topic)).size} 个主题，${session.trace.feed.filter(p=>p.isNew).length} 位新作者。${process}落选只表示这套规则下没拿到席位，不等于内容不好。`;
   $('seat-original').innerHTML=compactCards(session.trace.feed);
  }
  sync();
 }
 function start(useExample){
  const {posts,weights,profile}=getInputs();example=useExample;
  session=createSeatLesson(posts,useExample?PRESETS.balanced.weights:weights,profile);
  clearEnding();render();showStep('seat-turn');
 }
 $('seat-start').addEventListener('click',()=>start(false));
 $('seat-example').addEventListener('click',()=>start(true));
 for(let i=0;i<3;i++)$(`seat-guess-${i}`).addEventListener('click',()=>{
  if(!session||!options[i])return;
  const next=chooseSeat(session,options[i].id);if(next===session)return;
  session=next;render();showStep('seat-result-title');
 });
 $('seat-next').addEventListener('click',()=>{
  if(!session)return;const next=nextSeat(session);if(next===session)return;
  session=next;render();showStep('seat-turn');
 });
 $('seat-compare').addEventListener('click',()=>{
  if(!session?.complete)return;
  const alternative=diversityCounterfactual(session);
  $('seat-alternative').innerHTML=compactCards(alternative.feed);
  $('seat-counterfactual-note').textContent=session.weights.diversity===0
   ?'本次多样权重本来就是 0，两份六席完全相同。想看差别，可用「多看一点」演示重玩。'
   :`只把多样权重 ${session.weights.diversity} → 0；点击 ${session.weights.click}、新人 ${session.weights.newcomer}、候选池和口味全部不变。${alternative.firstChangedSlot?`从第 ${alternative.firstChangedSlot} 席开始不同。`:'这次六席恰好相同：改规则不保证改结果。'}`;
  $('seat-counterfactual').hidden=false;showStep('seat-counterfactual-title');
 });
 for(const [id,correct] of [['seat-answer-taste',false],['seat-answer-seats',true]])$(id).addEventListener('click',()=>{
  if(!session?.complete)return;
  for(const other of ['seat-answer-taste','seat-answer-seats'])$(other).setAttribute('aria-pressed',String(other===id));
  $('seat-judgment').textContent=correct
   ?`答对了。看已经坐下的同主题数量：在多样权重大于 0 时，同主题越多，加分越少。${session.weights.diversity===0?'这次权重是 0，所以该项没有实际作用。':''}卡片反馈改变兴趣；旋钮改变规则；逐席排座位只更新已选主题数。这是三件不同的事。`
   :'这趟排座位里，口味没有改变。再看看「坐下以后」：变化的是已选主题数，不是你的兴趣。试试另一个答案。';
 });
 reset();return {sync,reset};
}
