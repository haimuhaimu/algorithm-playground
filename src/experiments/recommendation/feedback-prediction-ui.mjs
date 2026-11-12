import {TOPICS} from './data.mjs?v=feedback-prediction-v1';
import {captureFeedback,recordMatches} from './feedback-story.mjs?v=feedback-prediction-v1';
import {escapeCardText as escape,recommendationTitle as title,recommendationArt as art,recommendationCharacter as character} from './recommendation-cards.mjs?v=feedback-prediction-v1';

const percent=value=>Math.round(value*100);
const position=rank=>rank===null?'六席外':`第 ${rank} 位`;
const answer=choice=>choice==='stays'?'仍在首页六席':'离开首页六席';

// This optional layer defers an existing feedback action. It does not change the
// scorer, profile persistence, or the separate, user-pinned feedback story.
export function mountFeedbackPrediction({document,getInputs,applyFeedback,returnToCard=()=>{},reducedMotion=()=>false}){
 const $=name=>document.getElementById(`feedback-prediction-${name}`);
 let enabled=false,pending=null,choice=null,completed=null;
 const status=text=>{$('status').textContent=text;};
 function moveTo(name){
  $(name).focus({preventScroll:true});
  $('panel').scrollIntoView({behavior:reducedMotion()?'instant':'smooth',block:'nearest'});
 }
 function hideChoices(){
  $('choices').hidden=true;$('apply').disabled=true;
  for(const key of ['stays','leaves'])$(key).setAttribute('aria-pressed','false');
 }
 function cancel(message,{restoreFocus=false}={}){
  const action=pending?.action;pending=null;choice=null;hideChoices();
  $('panel').hidden=true;status(message);
  if(action&&restoreFocus)returnToCard({postId:action.post.id,direction:action.direction});
 }
 function pendingMatches(){
  if(!pending)return false;
  const {weights,profile}=getInputs();
  return recordMatches({...pending,after:pending.before},weights,profile);
 }
 function sync(){
  if(pending&&!pendingMatches())cancel('规则或口味变了，这次猜测已取消，未发送反馈。请重新选一张卡。');
  if(completed){
   const {weights,profile}=getInputs();
   $('result-state').textContent=recordMatches(completed,weights,profile)
    ?'本次反馈结果 · 规则未改'
    :'保留上次反馈结果 · 当前口味或规则已改变';
  }
 }
 function request(postId,direction){
  if(!enabled)return false;
  const {posts,weights,profile}=getInputs();
  pending=captureFeedback(posts,weights,profile,postId,direction);choice=null;completed=null;
  const {post,beforeRank}=pending.action,topic=TOPICS[post.topic],name=character(post);
  $('card').innerHTML=`<span class="feedback-prediction-art" style="--topic:${topic.color}" aria-hidden="true">${art(post)||topic.glyph}</span><div><strong>${escape(title(post))}</strong><span>${name?`出镜：${escape(name)} · `:''}${escape(topic.short)} · 反馈前${position(beforeRank)}</span></div>`;
  $('title').textContent=`点「${direction>0?'喜欢':'少一点'}」后，这张卡还会在首页吗？`;
  $('panel').hidden=false;$('result').hidden=true;hideChoices();$('choices').hidden=false;
  status('先猜去留，再检验；这次反馈还没发送，首页和口味都没变。');
  moveTo('title');return true;
 }
 function choose(value){
  if(!pending)return;
  if(!pendingMatches()){sync();return;}
  choice=value;
  for(const key of ['stays','leaves'])$(key).setAttribute('aria-pressed',String(key===choice));
  $('apply').disabled=false;status(`你猜「${answer(choice)}」。还没发送反馈，点「检验这次反馈」看实际结果。`);
 }
 function reveal(){
  if(!pending||!choice)return;
  if(!pendingMatches()){sync();return;}
  const evidence=pending,guess=choice;
  // Consume before rendering/applying: repeated clicks cannot send it twice.
  pending=null;choice=null;hideChoices();
  applyFeedback(evidence);completed=evidence;
  const {action:a,before,after,effect}=evidence,topic=TOPICS[a.post.topic].short;
  $('result').hidden=false;
  $('verdict').textContent=`你猜：${answer(guess)}。实际：${a.afterRank===null?'离开首页六席':`仍在首页，第 ${a.afterRank} 位`}。`;
  $('position').textContent=`${position(a.beforeRank)} → ${position(a.afterRank)}`;
  $('interest-label').textContent=`${topic}兴趣`;
  $('interest').textContent=`${percent(before.profile[a.post.topic])} → ${percent(after.profile[a.post.topic])}`;
  const cause=effect==='limit'
   ?`${topic}兴趣已到${a.direction>0?'上限':'下限'}，这次没有变化，首页也没变。`
   :effect==='unweighted'
    ?'兴趣变了，但「点击优先」是 0，口味不参与排序，所以首页没变。'
    :`反馈调整的是「${topic}」主题兴趣，不是屏蔽某张卡；兴趣变了，也不保证它离开首页。`;
  $('reason').textContent=`${cause}三项规则没变。${a.afterRank===null?'这张卡仍在候选池里，没有被屏蔽。':''}`;
  $('title').textContent='这张卡，真的离开了吗？';
  sync();status('已发送一次反馈。你的猜测和真实结果就在下方；可继续选别的卡。');moveTo('result-state');
 }
 $('mode').addEventListener('click',()=>{
  enabled=!enabled;$('mode').setAttribute('aria-pressed',String(enabled));
  $('mode').textContent=enabled?'退出猜测模式':'先猜再反馈';
  if(!enabled&&pending)cancel('已退出猜测模式；刚才的反馈没有发送。现在点卡片可直接反馈。',{restoreFocus:true});
  else status(enabled?'已开启：选一张卡，点「喜欢」或「少一点」，先猜它的去留。':'已恢复直接反馈；点卡片就会更新首页。');
 });
 $('stays').addEventListener('click',()=>choose('stays'));
 $('leaves').addEventListener('click',()=>choose('leaves'));
 $('apply').addEventListener('click',reveal);
 $('cancel').addEventListener('click',()=>cancel('已取消，这次没有发送反馈；首页和口味没变。',{restoreFocus:true}));
 function reset(){
  enabled=false;pending=null;choice=null;completed=null;hideChoices();
  $('panel').hidden=true;$('result').hidden=true;$('mode').setAttribute('aria-pressed','false');$('mode').textContent='先猜再反馈';
  status('可选小挑战：先开启，再点一张卡的反馈。不开启也能照常玩。');
 }
 reset();return {request,sync,reset};
}
