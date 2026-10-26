import {createGradientLesson,setGradientRate,stepGradientLesson,resetGradientLesson,gradientEvidence,answerGradientLesson} from './neural-gradient.mjs';
import {paintGuide} from './neural-guide-view.mjs';

export function mountGradientLesson({document,window}){
 const $=id=>document.getElementById(id),set=(id,text)=>{$(id).textContent=text;};
 const s=createGradientLesson(),canvas=$('gradient-map'),supported=!!canvas.getContext('2d');
 let opened=false,before=false;
 function render(){
  const e=gradientEvidence(s),stepped=e.steps>0,full=e.steps===120;
  $('gradient-lesson').hidden=!opened;$('gradient-rate').value=String(s.rate);$('gradient-rate').disabled=stepped;
  $('gradient-step').disabled=$('gradient-ten').disabled=!supported||full;
  $('gradient-answer-points').disabled=$('gradient-answer-parameters').disabled=!stepped||!supported;
  $('gradient-takeaway').hidden=s.answer!=='parameters';
  $('gradient-current').setAttribute('aria-pressed',String(!before));$('gradient-original').setAttribute('aria-pressed',String(before));
  set('gradient-view',before?'原来的分界线':'现在的分界线');set('gradient-count',`已更新 ${e.steps} / 120 步`);
  set('gradient-loss',`整组误差 ${e.lossBefore.toFixed(3)} → ${e.lossAfter.toFixed(3)}`);
  set('gradient-reading',!stepped?'还是刚才那 6 个点、同一条原始分界。先走一步，观察实线与虚线的差别。':`点的位置和标签都没变。分错数 ${e.mistakesBefore.length} → ${e.mistakesNow.length}；整组误差${e.lossAfter<e.lossBefore?'降低了':'没有降低'}。${e.mistakesNow.length===e.mistakesBefore.length?'分错数没变，不代表这一步白走了：同一类别里的预测倾向也在变。':'线的位置改变后，点落入的区域也可能改变。'}${before?' 当前单独显示原来的线。':' 实线是现在，虚线始终保留原来的线。'}`);
  set('gradient-status',!supported?'此浏览器不支持 Canvas，不能显示改线。下方公式说明和 GenAI OS 链接仍可阅读。':full?'已走完这轮 120 步。退回起点，就能在同样条件下换个步长再试。':stepped?'步长已锁定。想公平比较另一种步长，请先退回同一起点。':'选好步长再走。退回起点不会改变新手小题或自由涂鸦草稿。');
  set('gradient-answer',s.answer==='points'?'再看图：6 个点一直没动，变的是用来分组的线。':s.answer==='parameters'?'对。改变的是线的参数，不是点，也不是给新点偷偷补答案。':'走过一步后，用自己的话选一次。');
  set('gradient-map-text',`${before?'原来的线，2 个例子分错。':`当前的线，${e.mistakesNow.length} 个例子分错。`}圆区与方区按同一套坐标显示；点不移动。`);
  const names=['横向权重 a','纵向权重 b','偏移 c'];
  for(let i=0;i<3;i++)set('gradient-param-'+i,e.lastGradient?`${names[i]}：${e.lastWeights[i].toFixed(4)} − ${e.rate} × (${e.lastGradient[i].toFixed(4)}) = ${s.model.weights[i].toFixed(4)}`:`${names[i]}：${s.model.weights[i].toFixed(4)}，尚未更新`);
  set('gradient-formula-step',stepped?`下面只拆开第 ${e.steps} 步。每一步的梯度都会用当时的参数重新计算；不是把第一步的箭头重复用 120 次。`:'线由 a × 横坐标 + b × 纵坐标 + c = 0 表示。先走一步，再把真实数字代进去。');
  if(opened&&supported)paintGuide(canvas,s,{before,dark:document.documentElement.dataset.theme==='dark'});
 }
 function open(){opened=true;window.dispatchEvent(new Event('neural-gradient-open'));window.dispatchEvent(new Event('neural-guide-pause'));render();$('gradient-title').focus({preventScroll:true});$('gradient-lesson').scrollIntoView({block:'start'});}
 $('guide-open-gradient').addEventListener('click',open);
 $('gradient-rate').addEventListener('change',()=>{if(s.model.epoch){render();return;}const rate=Number($('gradient-rate').value);if([.03,.15,.6].includes(rate))setGradientRate(s,rate);render();});
 for(const [id,count]of [['step',1],['ten',10]])$('gradient-'+id).addEventListener('click',()=>{
  if(!opened||!supported||document.hidden)return;stepGradientLesson(s,count);before=false;render();
 });
 $('gradient-reset').addEventListener('click',()=>{resetGradientLesson(s);before=false;render();});
 for(const [id,value]of [['original',true],['current',false]])$('gradient-'+id).addEventListener('click',()=>{before=value;render();});
 for(const answer of ['points','parameters'])$('gradient-answer-'+answer).addEventListener('click',()=>{if(!opened||!s.model.epoch||document.hidden)return;answerGradientLesson(s,answer);render();});
 function route(){if(window.location.hash==='#gradient-lesson')open();}
 window.addEventListener('hashchange',route);
 if(typeof MutationObserver!=='undefined')new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 render();route();return {snapshot:()=>structuredClone(s)};
}
if(typeof document!=='undefined'&&document.getElementById('gradient-lesson'))mountGradientLesson({document,window});
