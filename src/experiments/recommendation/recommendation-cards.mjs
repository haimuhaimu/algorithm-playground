import {TOPICS} from './data.mjs?v=cat-feedback-v1';
import {probability} from './core.mjs?v=cat-feedback-v1';

// Display-only remapping. The same post IDs and original data still go to the scorer.
const studioPosts={
 '0-0':{cat:'bobby',art:'portrait'},
 '0-1':{cat:'heim',art:'portrait'},
 '1-0':{cat:'heim',title:'嘿姆盯上了那碗面'},
 '1-4':{cat:'bobby',title:'波比试吃外婆的豆腐'},
 '2-0':{cat:'chouchou',title:'跟着臭臭走到城边'},
 '2-4':{cat:'heim',title:'嘿姆画下路过的站牌'},
 '3-0':{cat:'bobby',title:'波比把键盘改成了琴'},
 '3-4':{cat:'chouchou',title:'臭臭做了个离线工具'},
 '4-0':{cat:'bobby',title:'波比终于投进一球'},
 '4-4':{cat:'heim',title:'跟嘿姆拉伸十分钟'},
 '5-0':{cat:'chouchou',title:'臭臭捏了只歪杯子'},
 '5-4':{cat:'bobby',title:'波比染出了晚霞色'},
};
const studioPost=post=>Object.hasOwn(studioPosts,post.id)?studioPosts[post.id]:null;
const studioNames={bobby:'波比',heim:'嘿姆',chouchou:'臭臭'};
export const recommendationCharacter=post=>studioNames[studioPost(post)?.cat]??null;
export const escapeCardText=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const recommendationTitle=post=>studioPost(post)?.title??post.title;
export function recommendationArt(post){
 const studio=studioPost(post);
 return studio?`<img class="recommendation-post-art" src="./studio-${studio.cat}-${studio.art||'idle'}.png" alt="" loading="lazy" decoding="async">`:'';
}
export function recommendationThumbnail(post){
 const art=recommendationArt(post);
 return art?`<span class="recommendation-post-thumb" style="--topic:${TOPICS[post.topic].color}" aria-hidden="true">${art}</span>`:'';
}
export function renderRecommendationCard(post,index,profile){
 const topic=TOPICS[post.topic],studio=studioPost(post),title=escapeCardText(recommendationTitle(post)),character=recommendationCharacter(post);
 return `<article class="post-card" data-id="${escapeCardText(post.id)}" aria-label="第 ${index+1} 位：${title}">
  <div class="cover" style="--topic:${topic.color}" data-art="${post.art%4}"${studio?` data-studio-cover="${studio.art||'topic'}"`:''} aria-hidden="true">${recommendationArt(post)}<span class="rank">0${index+1}</span>${post.isNew?'<span class="new-badge">新作者</span>':''}<span class="cover-glyph">${topic.glyph}</span><span class="cover-label">${topic.english}</span></div>
  <div class="post-body"><h3 title="${title}">${title}</h3>${character?`<span class="post-cast">出镜：${escapeCardText(character)}</span>`:''}<div class="creator"><span>${escapeCardText(post.creator)}${post.isNew?' · 新作者':''}</span><span>${post.readTime}″</span></div>
  <div class="card-actions"><button class="feedback-button" data-feedback="1" data-post="${escapeCardText(post.id)}" aria-label="喜欢：${title}"><span aria-hidden="true">♡</span>喜欢</button><button class="feedback-button" data-feedback="-1" data-post="${escapeCardText(post.id)}" aria-label="少一点：${title}"><span aria-hidden="true">−</span>少一点</button></div>
  <details class="why"><summary>为什么推荐它？</summary><div class="score-parts"><div><span>点击分</span><b>${post.parts.click.toFixed(3)}</b></div><div><span>多样性分</span><b>${post.parts.diversity.toFixed(3)}</b></div><div><span>新人分</span><b>${post.parts.newcomer.toFixed(3)}</b></div><div><span>选中时总分</span><b>${post.score.toFixed(3)}</b></div><p>预测点击 ${(probability(post,profile)*100).toFixed(1)}%。多样性分按轮到此席位时，已选主题数计算。</p></div></details></div>
 </article>`;
}
