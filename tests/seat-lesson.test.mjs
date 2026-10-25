import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.mjs';
import {POSTS,PRESETS,INITIAL_PROFILE} from '../data.mjs';
const lesson=await import('../seat-lesson.mjs').catch(()=>({}));
const posts=[
 {id:'a',topic:'cat',appeal:.9,isNew:false},
 {id:'b',topic:'cat',appeal:.8,isNew:false},
 {id:'c',topic:'food',appeal:.7,isNew:true},
];
const weights={click:40,diversity:100,newcomer:0},profile={cat:1,food:.4};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function start(){assert.equal(typeof lesson.createSeatLesson,'function');return lesson.createSeatLesson(posts,weights,profile,3);}
test('trace exposes all simultaneous competitors and reduced same-topic diversity after seating',()=>{
 assert.equal(typeof core.traceRanking,'function');
 const t=core.traceRanking(posts,weights,profile,3);
 assert.deepEqual(t.feed.map(p=>p.id),['a','c','b']);
 assert.deepEqual(t.rounds.map(r=>r.ranked.length),[3,2,1]);
 assert.deepEqual(t.rounds[1].countsBefore,{cat:1});
 close(t.rounds[0].ranked[0].parts.click,.344);
 close(t.rounds[0].ranked.find(p=>p.id==='b').parts.diversity,.5);
 close(t.rounds[1].ranked.find(p=>p.id==='b').parts.diversity,.25);
 close(t.rounds[1].ranked[0].score,.7176);
 close(t.rounds[1].ranked[1].score,.574);
});
test('trace is the actual feed for every preset, all-zero ties, duplicate IDs and empty pools',()=>{
 assert.equal(typeof core.traceRanking,'function');
 for(const w of [...Object.values(PRESETS).map(p=>p.weights),{}, {click:-5,diversity:Infinity,newcomer:150}]){
  const t=core.traceRanking(POSTS,w,INITIAL_PROFILE);
  assert.deepEqual(t.feed,core.rankPosts(POSTS,w,INITIAL_PROFILE));
  assert.equal(new Set(t.feed.map(p=>p.id)).size,6);
  for(const round of t.rounds) for(const p of round.ranked)close(p.score,p.parts.click+p.parts.diversity+p.parts.newcomer);
 }
 assert.deepEqual(core.traceRanking([posts[2],posts[1],posts[0],posts[0]],{},profile,9).feed.map(p=>p.id),['a','b','c']);
 assert.deepEqual(core.traceRanking([],{},{}),{feed:[],rounds:[]});
 assert.equal(core.traceRanking(posts,weights,profile,0).rounds.length,0);
});
test('guessing does not change the algorithm and cannot skip unrevealed seats',()=>{
 const s=start();assert.equal(lesson.nextSeat(s),s);
 assert.equal(lesson.chooseSeat(s,'missing'),s);
 const r=lesson.chooseSeat(s,'b');assert.equal(r.guess,'b');assert.equal(r.revealed,true);
 assert.equal(lesson.currentRound(r).ranked[0].id,'a');assert.equal(s.revealed,false);
 assert.equal(lesson.chooseSeat(r,'a'),r,'answer cannot be rewritten after reveal');
 const next=lesson.nextSeat(r);assert.equal(next.index,1);assert.equal(next.guess,null);assert.equal(next.revealed,false);
 assert.equal(lesson.chooseSeat(next,'a'),next,'already seated candidate cannot be chosen');
 const final=lesson.chooseSeat(lesson.nextSeat(lesson.chooseSeat(next,'c')),'b');
 assert.equal(final.complete,true);assert.equal(lesson.nextSeat(final),final);
});
test('snapshots and diversity-only alternative keep taste, other rules and caller data intact',()=>{
 const p=structuredClone(posts),w={...weights},taste={...profile};
 const s=lesson.createSeatLesson?.(p,w,taste,3);assert.ok(s);
 p[0].title='changed';w.click=0;taste.cat=0;
 assert.equal(s.profile.cat,1);assert.equal(s.weights.click,40);assert.equal(s.posts[0].title,undefined);
 const c=lesson.diversityCounterfactual(s);
 assert.deepEqual(c.weights,{click:40,diversity:0,newcomer:0});
 assert.deepEqual(c.feed.map(p=>p.id),['a','b','c']);assert.equal(c.firstChangedSlot,2);
 assert.equal(lesson.lessonMatches(s,weights,profile),true);
 assert.equal(lesson.lessonMatches(s,{...weights,newcomer:1},profile),false);
 assert.equal(lesson.lessonMatches(s,weights,{...profile,cat:.9}),false);
 assert.deepEqual(s.trace.feed.map(p=>p.id),['a','c','b']);
});
test('empty and one-card lessons terminate without nonexistent rounds',()=>{
 assert.equal(typeof lesson.createSeatLesson,'function');
 const empty=lesson.createSeatLesson([],{},{});assert.equal(empty.complete,true);assert.equal(lesson.currentRound(empty),null);
 assert.equal(lesson.nextSeat(empty),empty);assert.equal(lesson.chooseSeat(empty,'a'),empty);
 const single=lesson.chooseSeat(lesson.createSeatLesson([posts[0]],{},profile),'a');assert.equal(single.complete,true);
 assert.equal(lesson.diversityCounterfactual(single).firstChangedSlot,null);
});
