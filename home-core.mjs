import {makeMap,search,frameAt} from './pathfinding-core.mjs';

// Homepage presentation only: the real search and experiment palettes stay unchanged.
const routeMaterial=Object.freeze({top:'#cf2f79',left:'#8c1e56',right:'#b52769'});
const currentMaterial=Object.freeze({top:'#ffb3d4',left:'#c24f89',right:'#e88fb6'});
const materials={
 light:{floor:{top:'#f0edf0',left:'#c8c3ca',right:'#e0dce2'},wall:{top:'#ffffff',left:'#b6acb4',right:'#ded6dd'},visited:{top:'#f1c8de',left:'#d39bb9',right:'#e6b5cf'}},
 dark:{floor:{top:'#38303a',left:'#231b25',right:'#2d2530'},wall:{top:'#b1a5b1',left:'#625462',right:'#8f7f8e'},visited:{top:'#ba7a9e',left:'#75455f',right:'#9a5c7e'}}
};
for(const palette of Object.values(materials))for(const value of Object.values(palette))Object.freeze(value);
export function heroMaterial(state={},dark=false){
 const palette=materials[dark?'dark':'light'];
 if(state.wall)return palette.wall;
 if(state.endpoint||state.path)return routeMaterial;
 if(state.active)return currentMaterial;
 return state.visited?palette.visited:palette.floor;
}

export function createShowcaseScene(){
 const map=makeMap('maze'),trace=search(map,'astar');
 return {map,trace,delay:700,interval:95,duration:700+trace.visited.length*95+3600};
}
export function showcaseFrame(scene,elapsed){
 const time=Math.max(0,Number.isFinite(elapsed)?elapsed:0)%scene.duration;
 return frameAt(scene.trace,Math.max(0,Math.floor((time-scene.delay)/scene.interval)));
}
// Public bookmarks from the former root page. New showcase anchors never redirect.
const legacyIds=new Set(["theme","experiment-links","title","controls-title","reset","click-value","click","diversity-value","diversity","newcomer-value","newcomer","mobile-result-text","run","save-baseline","baseline-caption","feed-section","feed-title","strategy-name","feedback-entry","feed","feedback-note","taste-bars","observation-title","ctr","topic-count","new-count","distribution","legend","insight","challenge-title","challenge-checks","challenge-status","comparison-title","run-number","comparison-result","seat-lesson","seat-title","seat-start","seat-example","seat-state","seat-stage","seat-settings","seat-taste","seat-row","seat-turn","seat-context","seat-guess-0","seat-guess-1","seat-guess-2","seat-subset","seat-evidence","seat-result-title","seat-guess-result","seat-winner-score","seat-reason","seat-change","seat-all-details","seat-all-summary","seat-all","seat-next","seat-ending","seat-ending-title","seat-conclusion","seat-compare","seat-counterfactual","seat-counterfactual-title","seat-counterfactual-note","seat-original","seat-alternative","seat-answer-taste","seat-answer-seats","seat-judgment","feedback-story","feedback-story-title","feedback-record-state","feedback-arm","feedback-story-empty","feedback-story-content","feedback-action","feedback-interest","feedback-fixed-rules","feedback-summary","feedback-before","feedback-after","feedback-cause","feedback-reason","feedback-answer-card","feedback-answer-topic","feedback-judgment","announcement","toast","guide","guide-title"]);
// New recommendation lesson anchors keep the same root-bookmark compatibility.
for(const id of ['seat-carry-note','seat-choices','seat-carryover','seat-carryover-title','seat-carry-fixed','seat-occupancy-before','seat-occupancy-after','seat-carry-cards','seat-carry-reason'])legacyIds.add(id);
export function legacyRecommendationTarget(hash,search=''){
 let id;try{id=decodeURIComponent(hash.replace(/^#/,''));}catch{return null;}
 return legacyIds.has(id)?`./recommendation.html${search}${hash}`:null;
}
export function createHeroClock(){
 const state={paused:false,visible:true,inView:true,reduced:false};let elapsed=0,last=null;
 const running=()=>!state.paused&&state.visible&&state.inView&&!state.reduced;
 return {
  set(next){Object.assign(state,next);last=null;},
  tick(now){
   if(!running()||!Number.isFinite(now)){last=null;return elapsed;}
   if(last!==null&&now>=last)elapsed+=now-last;
   if(last===null||now>=last)last=now;
   return elapsed;
  },
  read(){return {...state,elapsed,running:running()};}
 };
}
