import {traceRanking} from './core.mjs?v=seat-carryover-20261029';

export function createSeatLesson(posts,weights,profile,size=6){
 const snapshot=structuredClone({posts,weights,profile});
 const trace=traceRanking(snapshot.posts,snapshot.weights,snapshot.profile,size);
 return {...snapshot,trace,index:0,guess:null,revealed:false,complete:trace.rounds.length===0};
}
export function currentRound(session){return session.trace.rounds[session.index]||null;}
const byScore=(a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id),'en');
export function carryoverComparison(session){
 const round=currentRound(session),previous=session.trace.rounds[session.index-1];
 if(!round||!previous)return null;
 const justSeated=previous.ranked[0];
 const before=previous.ranked.find(p=>p.id!==justSeated.id&&p.topic===justSeated.topic&&round.ranked.some(q=>q.id===p.id));
 if(!before)return null;
 const carried=round.ranked.find(p=>p.id===before.id);
 const rival=round.ranked[0].id!==carried.id?round.ranked[0]:round.ranked.find(p=>p.topic!==carried.topic);
 if(!rival||rival.topic===carried.topic)return null;
 const rivalBefore=previous.ranked.find(p=>p.id===rival.id);
 // Both cards are still in THIS seat's pool. Only the previous winner's
 // topic count differs; the winner itself is not reintroduced into the pool.
 return structuredClone({justSeated,carried:{before,after:carried},rival:{before:rivalBefore,after:rival},
  beforeCount:previous.countsBefore[justSeated.topic]||0,afterCount:round.countsBefore[justSeated.topic]||0,
  beforeWinnerId:[before,rivalBefore].sort(byScore)[0].id,
  afterWinnerId:[carried,rival].sort(byScore)[0].id});
}
export function seatGuessOptions(session){
 const round=currentRound(session);if(!round)return [];
 const comparison=carryoverComparison(session);
 return comparison?[comparison.carried.after,comparison.rival.after]
  :round.ranked.slice(0,3).sort((a,b)=>String(a.id).localeCompare(String(b.id),'en'));
}
export function chooseSeat(session,id){
 if(session.revealed||session.complete||!currentRound(session)?.ranked.some(p=>p.id===id))return session;
 return {...session,guess:id,revealed:true,complete:session.index===session.trace.rounds.length-1};
}
export function nextSeat(session){
 if(!session.revealed||session.complete)return session;
 return {...session,index:session.index+1,guess:null,revealed:false};
}
export function lessonMatches(session,weights,profile){
 return ['click','diversity','newcomer'].every(k=>session.weights[k]===weights[k])&&
  [...new Set([...Object.keys(session.profile),...Object.keys(profile)])].every(k=>session.profile[k]===profile[k]);
}
export function diversityCounterfactual(session){
 const weights={...session.weights,diversity:0};
 const {feed}=traceRanking(session.posts,weights,session.profile,session.trace.feed.length);
 const index=feed.findIndex((p,i)=>p.id!==session.trace.feed[i]?.id);
 return {weights,feed,firstChangedSlot:index<0?null:index+1};
}
