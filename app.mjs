import {POSTS,TOPICS,PRESETS,INITIAL_PROFILE} from './data.mjs';
import {rankPosts,metrics,feedback,challenge,probability,experiment} from './core.mjs';

const $=id=>document.getElementById(id);
let weights={...PRESETS.click.weights},baseline={...PRESETS.click.weights},profile={...INITIAL_PROFILE};
let completed=null,runCount=0,toastTimer;
const keyOrder=['click','diversity','newcomer'];
const same=(a,b)=>keyOrder.every(k=>a[k]===b[k]);
const strategy=w=>Object.values(PRESETS).find(p=>same(p.weights,w))?.name||'你的自定义规则';
const settings=w=>keyOrder.map(k=>w[k]).join(' / ');
const pct=x=>(x*100).toFixed(1);
const announce=text=>{$('announcement').textContent=text;};
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2600);}

function card(post,index){
 const topic=TOPICS[post.topic];
 return `<article class="post-card" data-id="${post.id}" aria-label="第 ${index+1} 位：${post.title}">
  <div class="cover" style="--topic:${topic.color}" data-art="${post.art%4}" aria-hidden="true"><span class="rank">0${index+1}</span>${post.isNew?'<span class="new-badge">新作者</span>':''}<span class="cover-glyph">${topic.glyph}</span><span class="cover-label">${topic.english}</span></div>
  <div class="post-body"><h3 title="${post.title}">${post.title}</h3><div class="creator"><span>${post.creator}${post.isNew?' · 新作者':''}</span><span>${post.readTime}″</span></div>
  <div class="card-actions"><button class="feedback-button" data-feedback="1" data-post="${post.id}" aria-label="喜欢：${post.title}"><span aria-hidden="true">♡</span>喜欢</button><button class="feedback-button" data-feedback="-1" data-post="${post.id}" aria-label="少一点：${post.title}"><span aria-hidden="true">−</span>少一点</button></div>
  <details class="why"><summary>为什么推荐它？</summary><div class="score-parts"><div><span>点击分</span><b>${post.parts.click.toFixed(3)}</b></div><div><span>多样性分</span><b>${post.parts.diversity.toFixed(3)}</b></div><div><span>新人分</span><b>${post.parts.newcomer.toFixed(3)}</b></div><div><span>选中时总分</span><b>${post.score.toFixed(3)}</b></div><p>预测点击 ${pct(probability(post,profile))}%。多样性分按轮到此席位时，已选主题数计算。</p></div></details></div>
 </article>`;
}

function render(){
 const feed=rankPosts(POSTS,weights,profile),m=metrics(feed,profile),goal=challenge(m);
 const opened=new Set([...document.querySelectorAll('.why[open]')].map(el=>el.closest('.post-card').dataset.id));
 $('feed').innerHTML=feed.map(card).join('');
 for(const article of $('feed').children) if(opened.has(article.dataset.id)) article.querySelector('details').open=true;
 $('strategy-name').textContent=strategy(weights);
 for(const key of keyOrder){$(key).value=weights[key];$(key).style.setProperty('--progress',`${weights[key]}%`);$(`${key}-value`).value=weights[key];}
 document.querySelectorAll('[data-preset]').forEach(button=>button.setAttribute('aria-pressed',String(same(weights,PRESETS[button.dataset.preset].weights))));
 $('ctr').textContent=pct(m.ctr);$('topic-count').innerHTML=`${m.topics}<span>/ 6</span>`;$('new-count').innerHTML=`${m.newcomers}<span>/ 6</span>`;
 $('mobile-result-text').textContent=`${m.topics} 主题 · ${m.newcomers} 新人 · 预测点击 ${pct(m.ctr)}%`;
 $('distribution').innerHTML=feed.map(p=>`<span style="--topic:${TOPICS[p.topic].color}" title="${TOPICS[p.topic].short}"></span>`).join('');
 const counts=Object.fromEntries(Object.keys(TOPICS).map(key=>[key,feed.filter(p=>p.topic===key).length]));
 $('distribution').setAttribute('aria-label',`首页主题分布：${Object.entries(counts).filter(([,n])=>n).map(([key,n])=>`${TOPICS[key].short}${n}条`).join('，')}`);
 $('legend').innerHTML=Object.entries(counts).filter(([,n])=>n).map(([key,n])=>`<span><i style="--topic:${TOPICS[key].color}"></i>${TOPICS[key].short} ${n}</span>`).join('');
 $('insight').textContent=m.topics<=2?'熟悉的内容占据了首页。点击可能很高，但你会错过多少新东西？':m.newcomers>=5?'新作者站到了台前。机会更多了，但点击预测也可能付出代价。':`首页出现了 ${m.topics} 种主题。留一点空间，给还不知道自己会喜欢的东西。`;
 $('challenge-checks').innerHTML=[[goal.click,'预测点击率 ≥ 40%'],[goal.diversity,'至少 4 种主题'],[goal.newcomer,'至少 2 个新人席位']].map(([ok,label])=>`<li class="${ok?'done':''}"><span class="check-icon" aria-hidden="true">${ok?'✓':''}</span>${label}<span class="sr-only">${ok?'，已达成':'，未达成'}</span></li>`).join('');
 $('challenge-status').textContent=goal.won?'挑战达成！再跑一轮，看看代价。':'还差一点，试着调调看。';$('challenge-status').classList.toggle('won',goal.won);
 $('taste-bars').innerHTML=Object.entries(TOPICS).map(([key,topic])=>`<div class="taste-item" title="${topic.short}兴趣 ${Math.round(profile[key]*100)}"><div class="taste-track"><div class="taste-fill" style="width:${profile[key]*100}%"></div></div><span>${topic.short} ${Math.round(profile[key]*100)}</span></div>`).join('');
 $('baseline-caption').textContent=`对照组：${strategy(baseline)}`;renderComparison();return m;
}

function renderComparison(){
 if(!completed)return;
 const {result,number}=completed;
 // Compare effective inputs, not click counts: no-op actions do not stale a result.
 const stale=!same(weights,result.weights)||!same(baseline,result.baseline)||Object.keys(TOPICS).some(key=>profile[key]!==result.profile[key]);
 const {control,current}=result;
 $('run-number').textContent=`第 ${number} 轮`;
 $('comparison-result').innerHTML=`<p class="result-status ${stale?'stale':''}">${stale?'规则或口味已改变 · 下方保留上轮结果':'本轮已完成 · 同一批模拟曝光'}</p>
  <table class="result-table"><caption class="sr-only">第 ${number} 轮已完成的模拟对照，每组 ${current.impressions} 次曝光</caption><thead><tr><th>每组 ${current.impressions} 曝光</th><th>对照组</th><th>本轮</th></tr></thead><tbody><tr><td>模拟点击</td><td>${control.clicks}</td><td>${current.clicks}</td></tr><tr><td>不同主题</td><td>${control.topics}</td><td>${current.topics}</td></tr><tr><td>新人席位</td><td>${control.newcomers}</td><td>${current.newcomers}</td></tr></tbody></table>
  <p class="result-note">固定随机样本 · 相同设置可复现<br>点击为模拟次数，主题与新人为单页席位。</p>
  <details class="result-settings"><summary>查看本轮设置</summary><p>点击 / 多样 / 新人<br>对照 ${settings(result.baseline)}<br>本轮 ${settings(result.weights)}<br>兴趣 ${Object.entries(result.profile).map(([k,v])=>`${TOPICS[k].short}${Math.round(v*100)}`).join(' · ')}</p></details>`;
}

function changeWeights(next){weights={...next};const m=render();announce(`首页已更新：${m.topics} 种主题，${m.newcomers} 个新人席位，预测点击率 ${pct(m.ctr)}%。`);}
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>changeWeights(PRESETS[button.dataset.preset].weights)));
for(const key of keyOrder) $(key).addEventListener('input',event=>changeWeights({...weights,[key]:Number(event.target.value)}));
$('feed').addEventListener('click',event=>{
 const button=event.target.closest('[data-feedback]');if(!button)return;
 const post=POSTS.find(p=>p.id===button.dataset.post),direction=Number(button.dataset.feedback);
 const before=profile[post.topic];profile=feedback(profile,post.topic,direction);
 const note=before===profile[post.topic]?`${TOPICS[post.topic].short}兴趣已${direction>0?'达到上限':'降到下限'}。`:`${direction>0?'多看一点':'少看一点'}${TOPICS[post.topic].short}，首页已重新排序。`;
 const slot=[...$('feed').children].indexOf(button.closest('.post-card'));
 render();$('feedback-note').textContent=note;announce(note);toast(note);
 // Reranking replaces cards; keep keyboard focus on the same action when possible.
 const retained=[...$('feed').querySelectorAll('[data-feedback]')].find(b=>b.dataset.post===post.id&&Number(b.dataset.feedback)===direction);
 (retained||$('feed').children[Math.max(0,slot)]?.querySelector(`[data-feedback="${direction}"]`))?.focus({preventScroll:true});
});
$('run').addEventListener('click',()=>{
 completed={result:experiment(POSTS,weights,baseline,profile),number:++runCount};
 renderComparison();const {current,control}=completed.result;
 announce(`第 ${runCount} 轮完成。每组 600 次模拟曝光，对照组 ${control.clicks} 次点击，本轮 ${current.clicks} 次点击。`);
 toast(`对照完成：${control.clicks} → ${current.clicks} 次模拟点击`);
 if(matchMedia('(max-width:1150px)').matches) $('comparison-title').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'center'});
});
$('save-baseline').addEventListener('click',()=>{baseline={...weights};render();toast('已保存当前规则为对照组');announce('已保存当前规则为对照组。下一轮将使用同一份当前口味比较两套规则。');});
const emptyComparison=$('comparison-result').innerHTML;
$('reset').addEventListener('click',()=>{
 weights={...PRESETS.click.weights};baseline={...PRESETS.click.weights};profile={...INITIAL_PROFILE};completed=null;runCount=0;
 $('comparison-result').innerHTML=emptyComparison;$('run-number').textContent='未运行';$('feedback-note').textContent='试试卡片上的「喜欢」和「少一点」。';
 $('feed').innerHTML='';render();toast('已回到实验起点');announce('全部规则、口味和实验记录已重置。');
});
const themeQuery=matchMedia('(prefers-color-scheme:dark)');let explicitTheme=false;
function setTheme(dark){document.documentElement.dataset.theme=dark?'dark':'light';$('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');$('theme').title=dark?'切换浅色模式':'切换深色模式';}
setTheme(themeQuery.matches);themeQuery.addEventListener('change',e=>{if(!explicitTheme)setTheme(e.matches);});
$('theme').addEventListener('click',()=>{explicitTheme=true;setTheme(document.documentElement.dataset.theme!=='dark');});
$('about').addEventListener('click',()=>$('guide').showModal());
$('guide').addEventListener('click',event=>{if(event.target===$('guide')){const r=$('guide').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('guide').close();}});
render();
