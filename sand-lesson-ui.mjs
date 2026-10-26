import {SAND,WALL} from './sand-core.mjs?v=edit-history-1';
import {SAND_ORIGIN,SAND_OUTCOMES,createSandLesson,canEditSandCell,predictSandLesson,runSandLesson,editSandLesson,describeSandAttempt,summarizeSandLesson} from './sand-lesson.mjs?v=edit-history-1';

const $=id=>document.getElementById(id),root=$('grain-lab');
let state=createSandLesson();
const cells=[];
for(let y=0;y<5;y++)for(let x=0;x<5;x++){
 const editable=canEditSandCell(x,y),cell=document.createElement(editable?'button':'div');
 cell.className='grain-cell';
 if(editable){cell.type='button';cell.addEventListener('click',()=>{state=editSandLesson(state,{x,y});render();});}
 $('grain-board').append(cell);cells.push(cell);
}
function currentRecord(){return state.edit?state.current:state.baseline;}
function snapshot(record,label){
 const group=document.createElement('div');group.className='grain-snapshot';
 group.setAttribute('role','img');group.setAttribute('aria-label',label+'，从第2行第3列到第'+(record.decision.to.y+1)+'行第'+(record.decision.to.x+1)+'列');
 for(let i=0;i<25;i++){
  const cell=document.createElement('span');cell.dataset.cellMaterial=record.after.cells[i];
  if(i===7)cell.textContent='○';
  if(record.after.cells[i]===SAND)cell.textContent='●';
  group.append(cell);
 }
 return group;
}
function resultCard(id,record,empty){
 const element=$(id);element.replaceChildren();
 if(!record){element.textContent=empty;return;}
 const title=document.createElement('strong');title.textContent=SAND_OUTCOMES[record.decision.outcome];
 const detail=document.createElement('p');detail.textContent='你的预测：'+SAND_OUTCOMES[record.guess]+' · '+(record.correct?'猜中了':'这次猜错也没关系');
 element.append(title,snapshot(record,title.textContent),detail);
}
function render(){
 const record=currentRecord(),display=record?.after||state.before;
 cells.forEach((cell,i)=>{
  const x=i%5,y=Math.floor(i/5),material=display.cells[i],editable=canEditSandCell(x,y);
  cell.dataset.cellMaterial=material;
  cell.dataset.edited=String(state.edit?.x===x&&state.edit?.y===y);
  cell.dataset.origin=String(i===7);
  cell.replaceChildren();
  const glyph=document.createElement('span');glyph.textContent=material===SAND?'●':i===7?'○':material===WALL?'▧':'';cell.append(glyph);
  const attempt=record?.decision.attempts.findIndex(a=>a.to.x===x&&a.to.y===y)??-1;
  cell.dataset.attempt=attempt<0?'':record.decision.attempts[attempt].accepted?'accepted':'rejected';
  if(attempt>=0){const badge=document.createElement('small');badge.textContent=attempt+1;cell.append(badge);}
  const label=`第${y+1}行第${x+1}列，${material===WALL?'墙':material===SAND?'沙粒':'空格'}`;
  if(editable){
   cell.disabled=!state.baseline;
   cell.setAttribute('aria-pressed',String(state.edit?.x===x&&state.edit?.y===y));
   const original=state.baseline?.before.cells[i]??state.before.cells[i];
   cell.setAttribute('aria-label',label+'，'+(state.edit?.x===x&&state.edit?.y===y?'撤回此处改动':original===WALL?'移走这格墙':'在这里补墙'));
  }else cell.setAttribute('aria-label',label);
 });
 const ready=!record&&(!state.baseline||state.edit);
 document.querySelectorAll('[data-grain-guess]').forEach(button=>{
  button.disabled=!ready;button.setAttribute('aria-pressed',String(state.prediction===button.dataset.grainGuess));
 });
 $('grain-run').disabled=!ready||!state.prediction;
 $('grain-run').textContent=state.edit?'从同一起点再跑一拍':'走一拍，看决定';
 $('grain-phase').textContent=state.current?'03 / 对照这一次变化':state.baseline?'02 / 只改一格，再猜一次':'01 / 先猜下一格';
 $('grain-prompt').textContent=state.current?'第一次结果留下了。规则和起点相同，只有你选的那一格不同。':state.edit?'沙粒已回到原点。先预测，再重跑；换另一格时会撤回上一次改动。':state.baseline?'点虚线框改一格，然后沙粒会回到原点。先试移走 ○ 原位正下方的墙，看看它还会不会绕路。':'黄色沙粒已选中：下方有墙，右侧也有墙。这一拍它会去哪里？';
 $('grain-edit-note').textContent=state.edit?`只改了第 ${state.edit.y+1} 行、第 ${state.edit.x+1} 列。再次点它可撤回；点别处则改做那一格。`:state.baseline?'虚线框可以点：墙 ↔ 空格。每次只改一格。':'先预测并走一拍，再解锁五个可改的格子。';
 $('grain-board-title').textContent=record?'这一拍之后 · ○ 原位 / ● 沙粒':'这一拍之前 · ● 选中的沙粒';
 $('grain-feedback').textContent=record?(record.correct?'你猜中了！':'原来是这样：')+'沙粒'+SAND_OUTCOMES[record.decision.outcome]+'。数字是实际尝试顺序。':'先选一个去向，再让它真的走一拍。';
 const trace=$('grain-trace');trace.replaceChildren();
 if(record)record.decision.attempts.forEach(attempt=>{
  const li=document.createElement('li');li.textContent=describeSandAttempt(attempt);li.dataset.accepted=String(attempt.accepted);trace.append(li);
 });
 $('grain-trace-note').textContent=record?'找到能走的路就停止尝试；没有列出的方向，这一拍并未检查。':'顺序：先下方，再试两条斜路。斜路还要看侧边，不能穿墙角。本回合先右后左。';
 resultCard('grain-before',state.baseline,'第一次走完后，结果会留在这里。');
 resultCard('grain-after',state.current,state.edit?'已改一格，等待重新预测并运行。':'只改一格，看看去向变不变。');
 const summary=summarizeSandLesson(state);
 $('grain-conclusion').hidden=!summary;
 if(summary){$('grain-summary-title').textContent=summary.title;$('grain-summary').textContent=summary.text;$('grain-takeaway').textContent=summary.takeaway;}
}
document.querySelectorAll('[data-grain-guess]').forEach(button=>button.addEventListener('click',()=>{state=predictSandLesson(state,button.dataset.grainGuess);render();}));
$('grain-run').addEventListener('click',()=>{state=runSandLesson(state);render();if(state.current)$('grain-conclusion').focus();else cells[12].focus({preventScroll:true});});
$('grain-restart').addEventListener('click',()=>{state=createSandLesson();render();$('grain-title').focus();});
// Focus or pointer interaction pauses the free sandbox; its painting is preserved.
for(const event of ['pointerdown','focusin'])root.addEventListener(event,()=>document.dispatchEvent(new Event('sand-lesson-start')));
render();
