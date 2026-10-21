import {EMPTY,SAND,WALL,observeSandStep} from './sand-core.mjs';

export const SAND_ORIGIN=Object.freeze({x:2,y:1});
export const SAND_OUTCOMES=Object.freeze({down:'往下 ↓',left:'左下 ↙',right:'右下 ↘',stay:'停住 ·'});
const EDITABLE=new Set([6,8,11,12,13]);
const cloneWorld=w=>({...w,cells:w.cells.slice()});
export function createSandLesson(){
 const before={width:5,height:5,tick:0,cells:Uint8Array.from([
  0,0,0,0,0,
  0,0,SAND,WALL,0,
  0,0,WALL,0,0,
  0,0,0,0,0,
  WALL,WALL,WALL,WALL,WALL,
 ])};
 return {before,baseline:null,current:null,prediction:null,edit:null};
}
export function canEditSandCell(x,y){return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<5&&y>=0&&y<5&&EDITABLE.has(y*5+x);}
export function predictSandLesson(state,guess){
 if(!Object.hasOwn(SAND_OUTCOMES,guess))throw Error('Invalid prediction');
 if(state.current||(state.baseline&&!state.edit))return state;
 return {...state,prediction:guess};
}
export function runSandLesson(state){
 if(!state.prediction)throw Error('Choose a prediction first');
 if(state.current||(state.baseline&&!state.edit))return state;
 const result=observeSandStep(state.before,SAND_ORIGIN);
 const record={before:cloneWorld(state.before),after:result.world,decision:result.decision,guess:state.prediction,correct:state.prediction===result.decision.outcome};
 return state.baseline?{...state,current:record}:{...state,baseline:record};
}
export function editSandLesson(state,point){
 if(!state.baseline)throw Error('Run the first observation before editing');
 if(!point||!canEditSandCell(point.x,point.y))throw Error('Not an editable cell');
 const index=point.y*5+point.x,before=cloneWorld(state.baseline.before);
 const restore=state.edit?.x===point.x&&state.edit?.y===point.y;
 if(!restore)before.cells[index]=before.cells[index]===WALL?EMPTY:WALL;
 return {...state,before,edit:restore?null:{...point},prediction:null,current:null};
}
export function describeSandAttempt(attempt,from=SAND_ORIGIN){
 const direction=attempt.to.x===from.x?'下方':attempt.to.x<from.x?'左下':'右下';
 const reason={edge:'超出边界，不能走',corner:'侧边有墙，不能穿过墙角',occupied:'目标格被占住，不能走','water-moved':'水这一拍已移动，不能再交换',empty:'目标格空着，可以走',swap:'与还未移动的水交换位置'}[attempt.reason];
 return direction+'：'+reason;
}
export function summarizeSandLesson(state){
 if(!state.current)return null;
 const a=state.baseline.decision,b=state.current.decision,changed=a.outcome!==b.outcome;
 const i=state.edit.y*5+state.edit.x,action=state.before.cells[i]===WALL?'补上':'移走';
 const edit=`${action}第 ${state.edit.y+1} 行、第 ${state.edit.x+1} 列的一格墙`;
 return {changed,title:changed?'只改一格，去向变了。':'改了一格，去向却没变。',text:`${edit}。第一次${SAND_OUTCOMES[a.outcome]}，这一次${SAND_OUTCOMES[b.outcome]}。`+
  (changed?'下面的尝试记录显示：邻居变了，可走的路也变了。':'这格变化没有改变首条可走的路。被墙角挡住的方向，即使落点变了，也仍不能穿过去。'),
  takeaway:'沙粒不认识整个沙堆，也不计划终点。它只按顺序检查邻居，走第一条可走的路；许多粒子重复这件事，就形成了大画面。'};
}
