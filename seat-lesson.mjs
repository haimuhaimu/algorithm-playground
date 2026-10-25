import {traceRanking} from './core.mjs?v=seats-20261025';

export function createSeatLesson(posts,weights,profile,size=6){
 const snapshot=structuredClone({posts,weights,profile});
 const trace=traceRanking(snapshot.posts,snapshot.weights,snapshot.profile,size);
 return {...snapshot,trace,index:0,guess:null,revealed:false,complete:trace.rounds.length===0};
}
export function currentRound(session){return session.trace.rounds[session.index]||null;}
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
