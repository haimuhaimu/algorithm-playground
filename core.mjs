const unit=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
export function probability(post,profile={}) {
  // Teaching model, not a trained predictor. Quality is deliberately separate.
  return .05+.5*unit(post.appeal)+.36*unit(profile[post.topic]);
}
export function rankPosts(posts,weights={},profile={},size=6) {
  const w=Object.fromEntries(['click','diversity','newcomer'].map(k=>[k,unit(weights[k]/100)]));
  const candidates=[...new Map(posts.map(p=>[p.id,p])).values()];
  const chosen=[],counts={};
  const limit=Number.isFinite(size)?Math.max(0,Math.floor(size)):6;
  while(chosen.length<limit&&candidates.length) {
    const ranked=candidates.map(post=>{
      const parts={click:w.click*probability(post,profile),diversity:w.diversity*.5/(1+(counts[post.topic]||0)),newcomer:w.newcomer*.45*(post.isNew?1:0)};
      return {...post,parts,score:Object.values(parts).reduce((a,b)=>a+b,0)};
    }).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id),'en'));
    const best=ranked[0];chosen.push(best);counts[best.topic]=(counts[best.topic]||0)+1;
    candidates.splice(candidates.findIndex(p=>p.id===best.id),1);
  }
  return chosen;
}
export function metrics(feed,profile={}) {
  if(!feed.length) return {ctr:0,topics:0,newcomers:0,quality:0};
  return {ctr:feed.reduce((n,p)=>n+probability(p,profile),0)/feed.length,
    topics:new Set(feed.map(p=>p.topic)).size,newcomers:feed.filter(p=>p.isNew).length,
    quality:feed.reduce((n,p)=>n+unit(p.quality),0)/feed.length};
}
export function feedback(profile,topic,direction) {
  if(!Object.hasOwn(profile,topic)||![-1,1].includes(direction)) return {...profile};
  return {...profile,[topic]:unit(profile[topic]+direction*.12)};
}
export function simulate(feed,profile,seed=42) {
  let state=(seed>>>0)||1,clicks=0;
  // Both arms use the same user/position draw order. Item IDs don't affect RNG.
  for(let user=0;user<100;user++) for(const post of feed) {
    state=(Math.imul(1664525,state)+1013904223)>>>0;
    if(state/4294967296<probability(post,profile)) clicks++;
  }
  return {clicks,impressions:100*feed.length};
}
export function challenge(m) {
  const click=m.ctr>=.4,diversity=m.topics>=4,newcomer=m.newcomers>=2;
  return {click,diversity,newcomer,won:click&&diversity&&newcomer};
}
export function experiment(posts,weights,baseline,profile,seed=42){
 const evaluate=w=>{
  const feed=rankPosts(posts,w,profile);
  return {...metrics(feed,profile),...simulate(feed,profile,seed)};
 };
 return {weights:{...weights},baseline:{...baseline},profile:{...profile},current:evaluate(weights),control:evaluate(baseline),seed};
}
