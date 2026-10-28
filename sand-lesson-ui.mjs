import {SAND,WATER,WALL} from './sand-core.mjs?v=material-1';
import {SAND_ORIGIN,SAND_OUTCOMES,createSandLesson,canEditSandCell,predictSandLesson,runSandLesson,editSandLesson,describeSandAttempt,summarizeSandLesson,createMaterialLesson,selectMaterialLesson,predictMaterialLesson,runMaterialLesson,retryMaterialLesson} from './sand-lesson.mjs?v=material-1';

const $=id=>document.getElementById(id),root=$('grain-lab');
let state=createSandLesson(),materialState=createMaterialLesson(),mode='material',beforeFrame=false;
const materialNames={0:'空格',2:'水',3:'墙'};
const materialAnswers={fall:'沙往下，原位变空',swap:'沙往下，水到沙的原位',stay:'沙不动，下方也不变'};
const pointName=p=>`第${p.y+1}行第${p.x+1}列`;
const motion=r=>`沙：${pointName(r.decision.from)} → ${pointName(r.decision.to)}。`+(r.waterFrom?`水：${pointName(r.waterFrom)} → ${pointName(r.waterTo)}。`:'这轮没有水，水的数量一直是 0。');
const glyph=m=>m===SAND?'●':m===WATER?'≈':m===WALL?'▧':'';
const nextMaterial=()=>[0,2,3].find(m=>!materialState.results[m]);
const bringIntoView=id=>{$(id).focus();$(id).scrollIntoView({block:'start',behavior:'auto'});};
const cells=[];
for(let y=0;y<5;y++)for(let x=0;x<5;x++){
 const editable=canEditSandCell(x,y),cell=document.createElement(editable?'button':'div');
 cell.className='grain-cell';
 if(editable){cell.type='button';cell.addEventListener('click',()=>{if(mode!=='wall')return;state=editSandLesson(state,{x,y});render();});}
 $('grain-board').append(cell);cells.push(cell);
}
function currentRecord(){return state.edit?state.current:state.baseline;}
function snapshot(record,label,frame='after'){
 const group=document.createElement('div');group.className='grain-snapshot';
 const location=m=>{const i=record[frame].cells.indexOf(m);return i<0?null:pointName({x:i%5,y:Math.floor(i/5)});};
 group.setAttribute('role','img');group.setAttribute('aria-label',label+'：沙在'+location(SAND)+(location(WATER)?'，水在'+location(WATER):'，没有水'));
 for(let i=0;i<25;i++){
  const cell=document.createElement('span'),m=record[frame].cells[i];cell.dataset.cellMaterial=m;
  cell.textContent=glyph(m)||(i===7?'○':'');
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
function renderFramePair(element,record){
 element.replaceChildren();if(!record)return;
 for(const [frame,label]of [['before','之前'],['after','之后']]){
  const fig=document.createElement('div'),caption=document.createElement('span');caption.textContent=label;
  fig.append(caption,snapshot(record,label,frame));element.append(fig);
 }
}
function renderWall(){
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
function renderMaterial(){
 const r=materialState.record,display=r&&!beforeFrame?r.after:materialState.before;
 cells.forEach((cell,i)=>{
  const m=display.cells[i];cell.dataset.cellMaterial=m;cell.dataset.edited=String(i===12);cell.dataset.origin=String(i===7);cell.dataset.attempt='';
  cell.replaceChildren();const mark=document.createElement('span');mark.textContent=glyph(m)||(i===7?'○':'');cell.append(mark);
  cell.setAttribute('aria-label',`第${Math.floor(i/5)+1}行第${i%5+1}列，${m===SAND?'沙粒':materialNames[m]}`);
  if(cell.type==='button'){cell.disabled=true;cell.setAttribute('aria-pressed','false');}
 });
 document.querySelectorAll('[data-grain-material]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.grainMaterial)===materialState.material)));
 document.querySelectorAll('[data-material-guess]').forEach(button=>{button.disabled=Boolean(r);button.setAttribute('aria-pressed',String(button.dataset.materialGuess===materialState.prediction));});
 $('grain-phase').textContent=r?'02 / 看这一拍的真实变化':'01 / 先猜沙和水的变化';
 $('grain-prompt').textContent=r?`下方是${materialNames[materialState.material]}。起点没换，只跑了一拍。`:`下方是${materialNames[materialState.material]}。黄色沙粒会怎样，原来那格会留下什么？`;
 $('grain-board-title').textContent=(r&&!beforeFrame?'这一拍之后':'这一拍之前')+' · ● 沙 / ≈ 水 / ▧ 墙';
 $('grain-edit-note').textContent='亮框是唯一更换材料的一格。所有条件都从第 0 拍、同一起点开始。';
 $('grain-run').disabled=Boolean(r)||!materialState.prediction;$('grain-run').textContent='走一拍，看沙和水';
 $('grain-frame').hidden=!r;$('grain-frame').textContent=beforeFrame?'看这一拍之后':'看这一拍之前';$('grain-frame').setAttribute('aria-pressed',String(beforeFrame));
 $('grain-feedback').textContent=r?(r.correct?'你猜中了。':'这次猜错也没关系。')+materialAnswers[r.outcome]+'。':'先选一种完整结果，再运行。选错也能看见实际变化。';
 $('grain-material-evidence').hidden=!r;
 renderFramePair($('grain-material-inline'),r);
 $('grain-material-motion').textContent=r?motion(r):'';
 $('grain-material-counts').textContent=r?`沙：${r.countsBefore.sand} → ${r.countsAfter.sand} 格；水：${r.countsBefore.water} → ${r.countsAfter.water} 格。材料没被删除，也没凭空增加。`:'';
 $('grain-material-next').textContent=nextMaterial()===undefined?'三种都看完了，看结论 ↓':`接着看下方是${materialNames[nextMaterial()]} →`;
 const trace=$('grain-trace');trace.replaceChildren();
 if(r)r.decision.attempts.forEach(a=>{const li=document.createElement('li');li.textContent=describeSandAttempt(a);li.dataset.accepted=String(a.accepted);trace.append(li);});
 $('grain-trace-note').textContent=r?(materialState.material===WATER?'本轮水被周围墙挡住，轮到沙时仍未移动，才能交换；在自由画布里，水也可能先流走。':'记录只列这粒沙实际检查的方向。不同材料用的更新规则没有改变。'):'本轮水的下方和两侧都被墙围住。只换下方那一格，不改沙的起点或围墙。';
 const completed=Object.keys(materialState.results).length;
 $('grain-material-progress').textContent=`已观察 ${completed} / 3 种材料。切换材料或同条件重试，不会抹掉其他记录。`;
 for(const material of [0,2,3]){
  const card=$('grain-material-'+material),record=materialState.results[material];card.replaceChildren();
  const title=document.createElement('h3');title.textContent='下方是'+materialNames[material];card.append(title);
  if(!record){const p=document.createElement('p');p.textContent='还没观察。选这个材料，先猜，再跑一拍。';card.append(p);continue;}
  const pair=document.createElement('div');pair.className='grain-frame-pair';renderFramePair(pair,record);
  const result=document.createElement('strong');result.textContent=materialAnswers[record.outcome];
  const p=document.createElement('p');p.textContent=motion(record)+'你的预测：'+materialAnswers[record.guess]+' · '+(record.correct?'猜中了':'实际结果已保留');
  card.append(pair,result,p);
 }
 $('grain-material-ending').hidden=completed!==3;
}
function render(){
 const material=mode==='material';
 $('grain-mode-material').setAttribute('aria-pressed',String(material));$('grain-mode-wall').setAttribute('aria-pressed',String(!material));
 $('grain-title').textContent=material?'沙沉下去，水去了哪？':'看一粒沙怎么做决定';
 $('grain-description').textContent=material?'同一粒沙，只换正下方的一格。先猜，再看这一拍沙和水各去了哪里。':'先猜，走一拍；只改一格，再看一次。不是播放预设动画，是真的运行同一套规则。';
 for(const id of ['grain-material-options','grain-material-guesses','grain-material-comparison'])$(id).hidden=!material;
 for(const id of ['grain-wall-guesses','grain-wall-comparison'])$(id).hidden=material;
 $('grain-conclusion').hidden=true;$('grain-material-ending').hidden=true;
 $('grain-frame').hidden=true;$('grain-material-evidence').hidden=true;
 if(material)renderMaterial();else renderWall();
}
document.querySelectorAll('[data-grain-guess]').forEach(button=>button.addEventListener('click',()=>{state=predictSandLesson(state,button.dataset.grainGuess);render();}));
document.querySelectorAll('[data-grain-material]').forEach(button=>button.addEventListener('click',()=>{materialState=selectMaterialLesson(materialState,Number(button.dataset.grainMaterial));beforeFrame=false;render();}));
document.querySelectorAll('[data-material-guess]').forEach(button=>button.addEventListener('click',()=>{materialState=predictMaterialLesson(materialState,button.dataset.materialGuess);render();}));
for(const name of ['material','wall'])$('grain-mode-'+name).addEventListener('click',()=>{mode=name;render();});
$('grain-frame').addEventListener('click',()=>{beforeFrame=!beforeFrame;render();});
$('grain-material-retry').addEventListener('click',()=>{materialState=retryMaterialLesson(materialState);beforeFrame=false;render();bringIntoView('grain-board-title');});
$('grain-material-next').addEventListener('click',()=>{
 if(mode!=='material'||!materialState.record)return;
 const next=nextMaterial();if(next===undefined){bringIntoView('grain-material-ending');return;}
 materialState=selectMaterialLesson(materialState,next);beforeFrame=false;render();bringIntoView('grain-board-title');
});
$('grain-run').addEventListener('click',()=>{
 if(mode==='material'){materialState=runMaterialLesson(materialState);beforeFrame=false;render();bringIntoView('grain-material-evidence');}
 else{state=runSandLesson(state);render();if(state.current)$('grain-conclusion').focus();else cells[12].focus({preventScroll:true});}
});
$('grain-restart').addEventListener('click',()=>{if(mode==='material'){materialState=createMaterialLesson();beforeFrame=false;}else state=createSandLesson();render();$('grain-title').focus();});
// Focus or pointer interaction pauses the free sandbox; its painting is preserved.
for(const event of ['pointerdown','focusin'])root.addEventListener(event,()=>document.dispatchEvent(new Event('sand-lesson-start')));
render();
