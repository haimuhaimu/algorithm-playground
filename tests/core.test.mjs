import test from 'node:test';
import assert from 'node:assert/strict';
import {rankPosts,metrics,simulate,feedback,challenge,probability,experiment} from '../core.mjs';
import {POSTS,TOPICS,INITIAL_PROFILE,PRESETS} from '../data.mjs';

const posts=[
 {id:'a',topic:'cat',appeal:.9,quality:.4,isNew:false},
 {id:'b',topic:'cat',appeal:.8,quality:.5,isNew:false},
 {id:'c',topic:'food',appeal:.7,quality:.8,isNew:true},
 {id:'d',topic:'tech',appeal:.6,quality:.9,isNew:true},
];
const profile={cat:1,food:.4,tech:.2};
test('click-only sorting uses the stated appeal/interest probability',()=>{
 assert.equal(probability(posts[0],profile),.86);
 assert.deepEqual(rankPosts(posts,{click:100,diversity:0,newcomer:0},profile,2).map(p=>p.id),['a','b']);
});
test('diversity reranks repeated themes at selection time',()=>{
 const feed=rankPosts(posts,{click:40,diversity:100,newcomer:0},profile,3);
 assert.deepEqual(feed.map(p=>p.topic),['cat','food','tech']);
});
test('newcomer boost can put new creators before established ones',()=>{
 assert.deepEqual(rankPosts(posts,{click:0,diversity:0,newcomer:100},profile,2).map(p=>p.id),['c','d']);
});
test('score explanation components sum to the actual selection score',()=>{
 const feed=rankPosts(posts,{click:75,diversity:60,newcomer:50},profile,4);
 assert.equal(feed.length,4);
 for(const p of feed) assert.ok(Math.abs(p.score-Object.values(p.parts).reduce((a,b)=>a+b,0))<1e-9);
});
test('empty and zero-weight inputs stay deterministic with no duplicates',()=>{
 assert.deepEqual(rankPosts([],{},profile),[]);
 assert.deepEqual(rankPosts([...posts].reverse(),{click:0,diversity:0,newcomer:0},profile,8).map(p=>p.id),['a','b','c','d']);
 assert.equal(new Set(rankPosts([...posts,posts[0]],{},profile).map(p=>p.id)).size,4);
});
test('invalid weights are bounded and ranking never mutates the caller',()=>{
 const snapshot=structuredClone(posts),weights={click:Infinity,diversity:-50,newcomer:NaN};
 const feed=rankPosts(posts,weights,profile,6);
 assert.equal(feed.length,4);
 assert.ok(feed.every(p=>Number.isFinite(p.score)));
 assert.deepEqual(posts,snapshot);
});
test('metrics report empty feeds without NaN and literal topic/newcomer counts',()=>{
 assert.deepEqual(metrics([],profile),{ctr:0,topics:0,newcomers:0,quality:0});
 const m=metrics(posts,profile);
 assert.equal(m.topics,3);assert.equal(m.newcomers,2);assert.equal(m.quality,.65);
});
test('feedback is immutable, bounded, and can express disinterest',()=>{
 const next=feedback(profile,'cat',-1);
 assert.ok(next.cat<profile.cat);assert.equal(profile.cat,1);
 assert.equal(feedback(profile,'cat',1).cat,1);
 assert.equal(feedback({cat:0},'cat',-1).cat,0);
 assert.deepEqual(feedback(profile,'unknown',1),profile);
});
test('simulation is reproducible and uses 100 exposures per slot',()=>{
 const a=simulate(posts,profile,42),b=simulate(posts,profile,42);
 assert.deepEqual(a,b);assert.equal(a.impressions,400);
 assert.ok(a.clicks>0&&a.clicks<400);
 assert.deepEqual(simulate([],profile),{clicks:0,impressions:0});
});
test('using the same random draws cannot reward lower probabilities at every slot',()=>{
 const low=posts.map(p=>({...p,appeal:0})),high=posts.map(p=>({...p,appeal:1}));
 for(let seed=0;seed<20;seed++) assert.ok(simulate(high,profile,seed).clicks>=simulate(low,profile,seed).clicks);
});
test('challenge checks each constraint, not only the combined headline',()=>{
 assert.deepEqual(challenge({ctr:.4,topics:4,newcomers:2}),{click:true,diversity:true,newcomer:true,won:true});
 assert.equal(challenge({ctr:.39,topics:6,newcomers:6}).won,false);
 assert.equal(challenge({ctr:.8,topics:3,newcomers:4}).diversity,false);
 assert.equal(challenge({ctr:.8,topics:6,newcomers:1}).newcomer,false);
});
test('the synthetic catalog has consistent creator identities and distinct preset outcomes',()=>{
 assert.equal(POSTS.length,48);assert.equal(new Set(POSTS.map(p=>p.id)).size,48);
 assert.equal(Object.keys(TOPICS).length,6);
 const creators=new Map();
 for(const p of POSTS){
  if(creators.has(p.creator)) assert.equal(p.isNew,creators.get(p.creator));
  creators.set(p.creator,p.isNew);
 }
 const click=metrics(rankPosts(POSTS,PRESETS.click.weights,INITIAL_PROFILE),INITIAL_PROFILE);
 const balanced=metrics(rankPosts(POSTS,PRESETS.balanced.weights,INITIAL_PROFILE),INITIAL_PROFILE);
 const newcomers=metrics(rankPosts(POSTS,PRESETS.newcomer.weights,INITIAL_PROFILE),INITIAL_PROFILE);
 assert.ok(click.topics<balanced.topics);
 assert.ok(newcomers.newcomers>click.newcomers);
 assert.ok(newcomers.newcomers>balanced.newcomers);
 assert.equal(challenge(newcomers).won,true);
});
test('a completed comparison keeps its own settings/profile and uses the same exposure sample',()=>{
 const weights={...PRESETS.newcomer.weights},baseline={...PRESETS.click.weights},taste={...INITIAL_PROFILE};
 const result=experiment(POSTS,weights,baseline,taste);
 weights.click=0;baseline.click=0;taste.cat=0;
 assert.equal(result.weights.click,70);assert.equal(result.baseline.click,100);assert.equal(result.profile.cat,1);
 assert.equal(result.current.impressions,600);assert.equal(result.control.impressions,600);
 const equal=experiment(POSTS,PRESETS.click.weights,PRESETS.click.weights,INITIAL_PROFILE);
 assert.deepEqual(equal.current,equal.control);
});
