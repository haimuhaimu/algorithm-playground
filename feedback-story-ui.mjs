import {TOPICS} from './data.mjs?v=seats-20261025';
import {recordMatches} from './feedback-story.mjs?v=seats-20261025';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const interest=value=>Math.round(value*100);
function cards(record,side){
 return record[side].feed.map((post,i)=>{
  const change=record.changes.find(c=>c.id===post.id),topic=TOPICS[post.topic];
  const label=side==='before'
   ?change.afterRank===null?'离开首页':change.kind==='same'?`留在第 ${i+1}`:`移到第 ${change.afterRank}`
   :change.beforeRank===null?'新进入':change.kind==='same'?`仍在第 ${i+1}`:`第 ${change.beforeRank} → ${i+1}`;
  return `<li class="feedback-mini-card ${change.kind==='same'?'':'is-changed'} ${post.id===record.action.post.id?'is-selected':''}" data-post="${escape(post.id)}">
   <span class="feedback-mini-art" style="--topic:${topic.color}" aria-hidden="true">${topic.glyph}</span>
   <div><span class="feedback-mini-topic">${i+1} / ${topic.short}${post.id===record.action.post.id?' · 你点的这张':''}</span><h4>${escape(post.title)}</h4><span class="feedback-mini-creator">${escape(post.creator)}</span></div><span class="feedback-movement">${label}</span></li>`;
 }).join('');
}
function cause(record){
 const {action:a,effect}=record,topic=TOPICS[a.post.topic].short;
 if(effect==='limit')return `${topic}兴趣已经到${a.direction>0?'上限 100':'下限 0'}，这次没有再变。规则也没变，因此首页保持不变。`;
 if(effect==='unweighted')return `${topic}兴趣改变了，但这次记录中的「点击优先为 0」，排序不使用口味带来的点击分，所以首页保持不变。`;
 return `这不是屏蔽单张卡片，而是把整个「${topic}」主题的兴趣${a.direction>0?'提高':'降低'}了 ${interest(Math.abs(a.interestDelta))} 点。同主题候选的预测点击率随之${a.direction>0?'上升':'下降'}，其他主题兴趣与三项规则权重都不变。`;
}
function reason(record){
 const {action:a,decision:d}=record;
 const place=a.afterRank===null?'你点的卡片退出了这六个席位，但仍在候选池里。':a.afterRank===a.beforeRank?`你点的卡片仍在第 ${a.afterRank} 位。`:`你点的卡片从第 ${a.beforeRank} 位移到第 ${a.afterRank} 位。`;
 if(!d.alternative)return place;
 let scores;
 for(let digits=4;digits<=12;digits++){
  scores=[d.selected.score.toFixed(digits),d.alternative.score.toFixed(digits)];
  if(d.tied||scores[0]!==scores[1])break;
 }
 if(!d.tied&&scores[0]===scores[1])scores=[String(d.selected.score),String(d.alternative.score)];
 const comparison=d.tied?'两者同分，按固定内容编号决定顺序。':`前者得分更高，拿到这个席位。`;
 return `${place}反馈后争夺第 ${d.slot} 个席位时，《${d.selected.title}》得 ${scores[0]} 分，《${d.alternative.title}》得 ${scores[1]} 分。${comparison}`;
}
function summary(record){
 const entered=record.changes.filter(c=>c.kind==='entered').length,exited=record.changes.filter(c=>c.kind==='exited').length,moved=record.changes.filter(c=>['up','down'].includes(c.kind)).length;
 return entered||exited||moved?`${entered} 张新进入 · ${exited} 张离开首页 · ${moved} 张留在首页但换了名次。逐张对照下方标记。`:'六张卡片和名次都没变。反馈不保证换卡：要看兴趣边界、点击权重和候选之间的分差。';
}

export function mountFeedbackStory({document}){
 const $=id=>document.getElementById(id);
 let saved=null,armed=true,number=0,matches=true;
 function state(){
  $('feedback-arm').disabled=armed;
  $('feedback-arm').textContent=armed?'等待下一次卡片反馈':'记录下一次反馈';
  $('feedback-record-state').textContent=!saved?'尚未记录。先给任意一张卡片反馈。':armed?'已准备记录下一次反馈；下方旧对照会保留到那时。':matches?'已保留这次对照 · 当前首页与反馈后结果一致。':'当前首页已继续变化 · 下方仍保留原来的那次对照，不会被覆盖。';
  $('feedback-entry').textContent=saved?`查看第 ${number} 次反馈对照 ↓`:'看反馈前后对照 ↓';
 }
 function clearJudgment(){
  $('feedback-judgment').textContent='';
  for(const id of ['feedback-answer-card','feedback-answer-topic'])$(id).setAttribute('aria-pressed','false');
 }
 $('feedback-arm').addEventListener('click',()=>{armed=true;state();});
 for(const [id,correct] of [['feedback-answer-card',false],['feedback-answer-topic',true]])$(id).addEventListener('click',()=>{
  if(!saved)return;
  for(const other of ['feedback-answer-card','feedback-answer-topic'])$(other).setAttribute('aria-pressed',String(other===id));
  $('feedback-judgment').textContent=correct
   ?`答对了。反馈作用在主题兴趣，调旋钮才是改排序规则。${saved.effect==='limit'?'这次兴趣已到边界，所以没有实际变化。':'卡片是否换位，还取决于权重与其他候选。'}你刚才观察的是一次反馈，不是一次规则 A/B 测试。`
   :'不是屏蔽这张卡。它没有被移出候选池；反馈作用在这一类内容的兴趣上。再看看兴趣数字和前后卡片，换一个答案试试。';
 });
 function reset(){
  saved=null;armed=true;number=0;matches=true;
  $('feedback-story-empty').hidden=false;$('feedback-story-content').hidden=true;
  clearJudgment();state();
 }
 reset();
 return {
  shouldRecord:()=>armed,
  record(record){
   if(!armed)return;
   saved=record;armed=false;matches=true;number++;
   $('feedback-story-empty').hidden=true;$('feedback-story-content').hidden=false;
   const a=record.action,topic=TOPICS[a.post.topic].short;
   $('feedback-action').textContent=`第 ${number} 次 · 你对《${a.post.title}》点了「${a.direction>0?'喜欢':'少一点'}」`;
   $('feedback-interest').textContent=`${topic}兴趣 ${interest(record.before.profile[a.post.topic])} → ${interest(record.after.profile[a.post.topic])}`;
   $('feedback-fixed-rules').textContent=`规则没动：点击 ${record.weights.click} / 多样 ${record.weights.diversity} / 新人 ${record.weights.newcomer}`;
   $('feedback-cause').textContent=cause(record);$('feedback-reason').textContent=reason(record);$('feedback-summary').textContent=summary(record);
   $('feedback-before').innerHTML=cards(record,'before');$('feedback-after').innerHTML=cards(record,'after');
   clearJudgment();state();
  },
  sync(weights,profile){if(saved){matches=recordMatches(saved,weights,profile);state();}},
  reset,
 };
}
