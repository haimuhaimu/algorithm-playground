import {createCodeLesson,mergeCodeGroups,undoCodeMerge,suggestCodePair,codeGroupCodes,codeLessonResult} from './pixel-code.mjs?v=code-1';
import {decode} from './pixel-core.mjs?v=recipient-1';

const names=['米白','墨黑','苔绿','珊瑚'];
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const members=node=>node.symbol!==undefined?[node.symbol]:[...members(node.left),...members(node.right)];
const label=node=>members(node).map(c=>names[c]).join('＋');
const picture=pixels=>pixels.map(c=>`<i class="color-${c}"></i>`).join('');
const tag=node=>`<span class="code-group-colors">${members(node).map(c=>`<i class="color-${c}" aria-hidden="true"></i>`).join('')}</span><span>${label(node)}</span>`;
const fork=node=>node.left?`<div><b>0</b>${tag(node.left)}<strong>${node.left.weight} 格</strong></div><div><b>1</b>${tag(node.right)}<strong>${node.right.weight} 格</strong></div>`:'';
export function setupCodeLesson({document:doc,getPixels,available,cancelStroke}){
 const $=id=>doc.getElementById('code-'+id);
 let state=null,selected=[],hint=false,result=null,huffmanSteps=[],huffmanIndex=0,answer=null;
 const focus=id=>{ $(id).focus({preventScroll:true}); };
 function refresh(){
  if(!state)return;
  $('snapshot').textContent=equal(getPixels(),state.snapshot)
   ? '同一张画的 256 格副本。只改记录方式，原画、草稿和上次来信不会改变。'
   : '画纸已改。这轮仍保留刚才那张图和你的分法；要改用新图，请点下方「换用当前画纸」。';
 }
 function renderHuffman(){
  const step=huffmanSteps[huffmanIndex];
  $('huffman-fork').innerHTML=step?fork(step):'';
  $('huffman-step').textContent=step
   ? `第 ${huffmanIndex+1} / ${huffmanSteps.length} 次：${step.left.weight} 格 ＋ ${step.right.weight} 格 = ${step.weight} 格。${label(step.left)}和${label(step.right)}是当时最少的两组；这 ${step.weight} 格各多写 1 位。`
   : '只有一种颜色，不需要合并。按本协议，每一格仍写一个 0。';
  $('huffman-prev').disabled=!step||huffmanIndex===0;
  $('huffman-next').disabled=!step||huffmanIndex===huffmanSteps.length-1;
 }
 function renderResult(){
  if(!result)return;
  const {user,reference,matches,payloadDelta,byteDelta}=result;
  const one=state.counts.filter(Boolean).length===1;
  $('result-undo').hidden=one;
  $('difference').textContent=one
   ? '只有一种颜色，不需要选组。本协议每格仍写 1 bit，不是零字节。换一张有两种以上颜色的画，就能亲手分叉。'
   : payloadDelta===0
    ? '你的分法和 Huffman 一样省。0 和 1 可以不一样，只要每种颜色的长度代价合适，总位数就能相同。'
    : `你的分法也能完整读回，但图案多写了 ${payloadDelta} bit，实际邮包多 ${byteDelta} B。对照下表，看看哪些常见颜色被重复写长了。${byteDelta===0?'这次少位数还没跨过整字节边界，所以字节数相同。':''}`;
  for(const [prefix,encoded,pixels] of [['user',user,result.decoded],['huffman',reference,decode(reference.packet,256)]]){
   $(prefix+'-cost').textContent=encoded.packet.length+' B';
   $(prefix+'-picture').innerHTML=picture(pixels);
   $(prefix+'-equation').textContent=`图案 ${encoded.payloadBits} ＋ 树 ${encoded.treeBits} ＋ 补齐 ${encoded.paddingBits} = ${encoded.packet.length*8} bit`;
  }
  $('integrity').textContent=`两份真实邮包分别解码：你的 ${matches} / 256 格一致，Huffman 的 256 / 256 格一致。没有删色、没有删格，也没有覆盖上次来信。`;
  $('comparison').innerHTML=state.counts.map((n,c)=>n?`<tr><th scope="row"><i class="color-${c}" aria-hidden="true"></i>${names[c]}<small>${n} 格</small></th><td><code>${user.codes[c]}</code><span>${n} × ${user.codes[c].length} = <b>${n*user.codes[c].length}</b> bit</span></td><td><code>${reference.codes[c]}</code><span>${n} × ${reference.codes[c].length} = <b>${n*reference.codes[c].length}</b> bit</span></td></tr>`:'').join('');
  $('takeaway').textContent=answer==='loss'?'没删任何颜色或格子。看两张解码图：它们与原图完全一致；变的是记录方式。再想想，哪一位会被重复写最多次？'
   :answer==='code'?'对。常见颜色的暗号每少 1 位，就能在许多格上少重复写 1 位。把很少出现的颜色放得深一点，代价通常更小；完整邮包还要算树和补齐。'
   :'选一次，把刚才的分叉变成自己的结论。';
 }
 function render(){
  $('lab').hidden=!state;if(!state)return;
  const done=state.forest.length===1,total=state.counts.filter(Boolean).length-1;
  $('build').hidden=done;$('result').hidden=!done;
  $('progress').textContent=`已组合 ${state.steps.length} / ${total} 次`;
  $('instruction').textContent=state.steps.length?'再选两组，直到只剩一组':'先选两组颜色';
  for(let i=0;i<4;i++){
   const button=$('group-'+i),node=state.forest[i];button.hidden=!node;
   if(!node)continue;
   button.dataset.group=node.id;button.setAttribute('aria-pressed',selected.includes(node.id));
   button.innerHTML=`${tag(node)}<strong>${node.weight}<small> 格</small></strong><span class="code-group-check">${selected.includes(node.id)?'已选':'选择这组'}</span>`;
  }
  const chosen=selected.map(id=>state.forest.find(n=>n.id===id));
  $('selection').textContent=chosen.length===2?`这次会让 ${chosen[0].weight+chosen[1].weight} 格各多写 1 位，累积增加 ${chosen[0].weight+chosen[1].weight} bit。`
   :chosen.length?`已选${label(chosen[0])}，再选一组；点已选组可取消。`:'先选两组。没有唯一的点击顺序，最后比较实际邮包。';
  $('merge').disabled=selected.length!==2||done;$('undo').disabled=!state.steps.length;
  const pair=suggestCodePair(state).map(id=>state.forest.find(n=>n.id===id));
  $('hint-copy').textContent=hint&&pair.length===2?`Huffman 会先合并 ${pair[0].weight} 格的${label(pair[0])}与 ${pair[1].weight} 格的${label(pair[1])}。让最少的格子先多写一位；提示不会替你选择。`:'';
  const last=state.steps.at(-1);$('last').hidden=!last;
  if(last){$('fork').innerHTML=fork(last);$('last-copy').textContent=`刚才合并 ${last.left.weight} ＋ ${last.right.weight} = ${last.weight} 格；这一步增加 ${last.weight} bit。已有暗号前面各接上 0 或 1，组里的颜色仍能分清。`;}
  const codes=codeGroupCodes(state);
  $('codes').innerHTML=state.counts.map((n,c)=>n?`<tr><th scope="row"><i class="color-${c}" aria-hidden="true"></i>${names[c]}<small>${n} 格</small></th><td><code>${codes[c]||'还没分叉'}</code></td><td>${n} × ${codes[c].length} = <b>${n*codes[c].length}</b> bit</td></tr>`:'').join('');
  refresh();renderResult();
 }
 function begin(pixels){
  state=createCodeLesson(pixels);selected=[];hint=false;answer=null;huffmanIndex=0;
  result=codeLessonResult(state);huffmanSteps=[];
  let canonical=createCodeLesson(state.snapshot);
  while(canonical.forest.length>1){canonical=mergeCodeGroups(canonical,suggestCodePair(canonical));huffmanSteps.push(canonical.steps.at(-1));}
  $('huffman-replay').hidden=true;$('huffman-open').setAttribute('aria-expanded','false');
  $('miniature').innerHTML=picture(state.snapshot);render();focus('title');$('lab').scrollIntoView({block:'start',behavior:'auto'});
 }
 $('start').addEventListener('click',()=>{if(!available())return;cancelStroke();begin(getPixels());});
 for(let i=0;i<4;i++)$('group-'+i).addEventListener('click',()=>{
  if(!state||!available()||state.forest.length===1||!state.forest[i])return;
  const id=state.forest[i].id;
  if(selected.includes(id))selected=selected.filter(v=>v!==id);
  else if(selected.length<2)selected=[...selected,id];
  render();
 });
 $('merge').addEventListener('click',()=>{
  if(!state||!available()||selected.length!==2||state.forest.length===1)return;
  state=mergeCodeGroups(state,selected);selected=[];hint=false;result=codeLessonResult(state);render();
  if(result){focus('result-title');$('result').scrollIntoView({block:'start',behavior:'auto'});}
  else focus('group-0');
 });
 const undo=()=>{if(!state||!available()||!state.steps.length)return;state=undoCodeMerge(state);selected=[];hint=false;result=null;render();focus('group-0');};
 $('undo').addEventListener('click',undo);$('result-undo').addEventListener('click',undo);
 $('hint').addEventListener('click',()=>{if(!state||!available())return;hint=!hint;render();});
 $('retry').addEventListener('click',()=>{if(state&&available())begin(state.snapshot);});
 $('current').addEventListener('click',()=>{if(!available())return;cancelStroke();begin(getPixels());});
 $('huffman-open').addEventListener('click',()=>{if(!result||!available())return;const open=$('huffman-replay').hidden;$('huffman-replay').hidden=!open;$('huffman-open').setAttribute('aria-expanded',open);renderHuffman();});
 for(const [id,delta]of [['huffman-prev',-1],['huffman-next',1]])$(id).addEventListener('click',()=>{if(!result||!available()||$(id).disabled)return;huffmanIndex=Math.max(0,Math.min(huffmanSteps.length-1,huffmanIndex+delta));renderHuffman();});
 for(const value of ['loss','code'])$('answer-'+value).addEventListener('click',()=>{if(!result||!available())return;answer=value;renderResult();});
 render();return {refresh};
}
