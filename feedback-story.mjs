import {feedback,rankPosts,scorePost,probability,metrics} from './core.mjs?v=feedback-20261021';

function freeze(value){
 if(value&&typeof value==='object'){
  Object.values(value).forEach(freeze);Object.freeze(value);
 }
 return value;
}
const position=(feed,id)=>{const i=feed.findIndex(p=>p.id===id);return i<0?null:i+1;};
const snapshot=(posts,weights,profile)=>{
 const feed=rankPosts(posts,weights,profile);
 return {profile:{...profile},feed,metrics:metrics(feed,profile)};
};

export function captureFeedback(posts,weights,profile,postId,direction){
 const post=posts.find(p=>p.id===postId);
 if(!post||!Object.hasOwn(profile,post.topic)||![-1,1].includes(direction))throw new Error('Invalid feedback action');
 const before=snapshot(posts,weights,profile),next=feedback(profile,post.topic,direction),after=snapshot(posts,weights,next);
 const beforeRank=position(before.feed,postId),afterRank=position(after.feed,postId);
 const changes=[...new Set([...before.feed,...after.feed].map(p=>p.id))].map(id=>{
  const a=position(before.feed,id),b=position(after.feed,id);
  return {id,beforeRank:a,afterRank:b,kind:a===null?'entered':b===null?'exited':a===b?'same':b<a?'up':'down'};
 });
 // Compare candidates at one actual selection slot, using that slot's topic counts.
 const slot=afterRank||after.feed.length,previous=after.feed.slice(0,slot-1),counts={};
 for(const p of previous)counts[p.topic]=(counts[p.topic]||0)+1;
 const candidates=posts.filter(p=>!previous.some(selected=>selected.id===p.id))
  .map(p=>({...p,...scorePost(p,weights,next,counts)}))
  .sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id),'en'));
 const selected=candidates[0],alternative=afterRank?candidates[1]||null:candidates.find(p=>p.id===postId);
 const delta=next[post.topic]-profile[post.topic];
 return freeze(structuredClone({
  weights:{...weights},before,after,changes,
  action:{post:{...post},direction,beforeRank,afterRank,interestDelta:delta,
   probabilityBefore:probability(post,profile),probabilityAfter:probability(post,next)},
  effect:delta===0?'limit':!(weights.click>0)?'unweighted':'adjusted',
  decision:{slot,selected,alternative,tied:!!alternative&&selected.score===alternative.score},
 }));
}

export function recordMatches(record,weights,profile){
 return ['click','diversity','newcomer'].every(k=>weights[k]===record.weights[k])
  &&Object.keys(record.after.profile).every(k=>profile[k]===record.after.profile[k]);
}
