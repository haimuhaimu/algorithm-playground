import {createGeneralizationLesson,trainGeneralization,revealGeneralization,selectGeneralizationPoint,setGeneralizationView,answerGeneralization,resetGeneralization,generalizationEvidence} from './neural-generalization.mjs';
import {paintGeneralization,hitGeneralizationPoint} from './neural-generalization-view.mjs';
const shape=label=>label?'方':'圆',number=n=>(Math.abs(n)<.00001?0:n).toFixed(2);
export function mountGeneralizationLesson({document,window}){
 const $=id=>document.getElementById(id),set=(id,value)=>{$(id).textContent=value;};
 const s=createGeneralizationLesson(),canvas=$('generalization-map'),supported=!!canvas.getContext('2d');
 let opened=false,showRule=true,gesture=null;
 const canAct=()=>opened&&supported&&!document.hidden,hasTest=()=>['reveal','done'].includes(s.phase);
 function top(){ $('generalization-lesson').scrollIntoView({block:'start',behavior:'instant'});$('generalization-title').focus({preventScroll:true}); }
 function render(){
  const e=generalizationEvidence(s),revealed=!!e.test;
  $('generalization-lesson').hidden=!opened;$('generalization-lesson').setAttribute('data-stage',s.phase);
  set('generalization-title',s.phase==='intro'?'熟题做对了，新题还会吗？':s.phase==='guess'?'6 个练习点全对了。你猜新题呢？':'分界没动，新题里却有错点。');
  set('generalization-prompt',s.phase==='intro'?'还是前面的 6 个练习点。先让同一条线学习，再把模型封存起来。':s.phase==='guess'?'模型已经停在第 120 步。接下来只揭开 16 个新位置，不会再教它答案。':'实心小点是练习题，空心编号点是新题。选一个圈出的错点，看看同一条线怎样分错了它。');
  set('generalization-practice-score',e.frozen?`${e.train.correct} / ${e.train.total} 个分对`:'6 个练习点');
  set('generalization-test-score',revealed?`${e.test.correct} / ${e.test.total} 个分对`:e.frozen?'等你先猜一次':'尚未揭晓');
  $('generalization-scope-result').hidden=!revealed;set('generalization-scope-result',revealed?`本轮固定小题：分对 ${e.test.correct} / ${e.test.total} 个。新题只被评估，没有继续训练。`:'');
  set('generalization-frozen',e.frozen?'已封存 · 120 步 · 不再训练':'只用练习点学习');
  $('generalization-train').hidden=s.phase!=='intro';$('generalization-train').disabled=!supported;
  $('generalization-guess').hidden=s.phase!=='guess';$('generalization-result').hidden=!revealed;$('generalization-reflect').hidden=!revealed;
  $('generalization-takeaway').hidden=s.phase!=='done';
  set('generalization-guess-result',revealed?`你猜${s.guess==='all'?'新题会全对':'新题不一定全对'}。实际分对 ${e.test.correct} / ${e.test.total} 个；模型只学过原来的 ${e.train.total} 个位置。`:'');
  set('generalization-map-state',revealed&&s.view==='test'?'揭开新题 · 分界仍是刚才那条':'只看练习点');
  for(const view of ['training','test'])$('generalization-'+view).setAttribute('aria-pressed',String(s.view===view));
  $('generalization-rule').setAttribute('aria-pressed',String(showRule));$('generalization-rule').disabled=s.view!=='test';
  set('generalization-rule',showRule?'隐藏出题规则虚线':'叠加出题规则虚线');
  for(let i=0;i<3;i++){
   const index=e.wrong[i],button=$('generalization-error-'+i);button.hidden=index===undefined;
   if(index!==undefined){button.textContent=`${index+1} 号错题`;button.setAttribute('aria-pressed',String(s.selected===index));}
  }
  const p=e.selected;
  set('generalization-point-detail',p?`${p.id} 号新题：标准答案是${shape(p.label)}，模型${p.correct?'也':'却'}判成${shape(p.predicted)}。${p.correct?'这一次判断一致。':'外圈标记的是这个不一致。'}`:'');
  if(p){
   const [a,b,c]=s.model.weights,score=a*p.x+b*p.y+c,truth=p.x+p.y;
   set('generalization-point-reason',`点的位置没变：横 ${number(p.x)}，纵 ${number(p.y)}。它落在模型实线的${shape(p.predicted)}区；但按出题规则，它应在${shape(p.label)}区。${p.correct?'两种分法在这个位置一致。':'两条分界不同，这个位置被分到了不同侧。'}`);
   set('generalization-point-math',`出题规则：横 + 纵 = ${number(truth)}，${truth>0?'大于 0，答案为方':'不大于 0，答案为圆'}。模型实际算出 ${number(a)} × 横 + ${number(b)} × 纵 + ${number(c)} = ${number(score)}，${score>=0?'不小于 0，判方':'小于 0，判圆'}。方倾向为 ${(p.probability*100).toFixed(1)}%，不是正确率或可靠度。`);
  }else{set('generalization-point-reason','');set('generalization-point-math','');}
  set('generalization-map-text',revealed?`同一个冻结模型：练习分对 ${e.train.correct}/${e.train.total}，新题分对 ${e.test.correct}/${e.test.total}。错题编号 ${e.wrong.map(i=>i+1).join('、')}。${s.view==='training'?'当前只显示练习点。':'可用下方错题按钮或上一个、下一个位置查看各题。'}`:'目前只显示 6 个练习点，新题尚未揭晓。');
  set('generalization-answer',s.answer==='practice'?'再想一下：这轮练习全对，新题仍有错。还需要用未参与训练的位置检验。':s.answer==='unseen'?'对。先冻结模型，再用没参加训练的新题检验，才能看见这份规则在哪些位置还不适用。':'看过一个错点后，选一句你能确定的结论。');
  for(const answer of ['practice','unseen'])$('generalization-answer-'+answer).disabled=!revealed||s.phase==='done';
  set('generalization-status',!supported?'此浏览器不支持 Canvas，无法完成这个可视实验。仍可阅读说明和使用其他课程入口。':s.phase==='intro'?'本课不读取或改变自由涂鸦草稿。':s.phase==='guess'?'训练已停止。先留一个判断，再揭晓。':'选点、切换显示和揭开虚线，都没有继续训练。');
  if(opened&&supported)paintGeneralization(canvas,s,{dark:document.documentElement.dataset.theme==='dark',showRule});
 }
 function open(){opened=true;window.dispatchEvent(new Event('neural-gradient-open'));window.dispatchEvent(new Event('neural-guide-pause'));render();top();}
 $('residual-open-generalization').addEventListener('click',open);
 for(const link of document.querySelectorAll('a[href="#generalization-lesson"]'))link.addEventListener('click',open);
 $('generalization-train').addEventListener('click',()=>{if(!canAct()||s.phase!=='intro')return;trainGeneralization(s);render();top();});
 for(const guess of ['all','not-all'])$('generalization-guess-'+guess).addEventListener('click',()=>{if(!canAct()||s.phase!=='guess')return;revealGeneralization(s,guess);render();top();});
 function choose(index){if(!canAct()||!hasTest())return;selectGeneralizationPoint(s,index);setGeneralizationView(s,'test');render();}
 for(let i=0;i<3;i++)$('generalization-error-'+i).addEventListener('click',()=>{const index=generalizationEvidence(s).wrong[i];if(index!==undefined)choose(index);});
 for(const [id,delta]of [['previous',-1],['next',1]])$('generalization-'+id).addEventListener('click',()=>choose((s.selected+delta+s.test.length)%s.test.length));
 for(const view of ['training','test'])$('generalization-'+view).addEventListener('click',()=>{if(!canAct()||!hasTest())return;setGeneralizationView(s,view);render();});
 $('generalization-rule').addEventListener('click',()=>{if(!canAct()||!hasTest()||s.view!=='test')return;showRule=!showRule;render();});
 for(const answer of ['practice','unseen'])$('generalization-answer-'+answer).addEventListener('click',()=>{if(!canAct()||s.phase!=='reveal')return;answerGeneralization(s,answer);render();});
 $('generalization-reset').addEventListener('click',()=>{if(!opened||document.hidden)return;resetGeneralization(s);showRule=true;gesture=null;render();top();});
 canvas.addEventListener('keydown',event=>{if(!canAct()||!hasTest()||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();choose((s.selected+(event.key==='ArrowLeft'?-1:1)+s.test.length)%s.test.length);});
 const geometry=()=>{const r=canvas.getBoundingClientRect();return [r.left,r.top,r.width,r.height];};
 canvas.addEventListener('pointerdown',event=>{if(!canAct()||!hasTest()||s.view!=='test'||event.button!==0||event.isPrimary===false)return;gesture={id:event.pointerId,x:event.clientX,y:event.clientY,index:hitGeneralizationPoint(canvas,event,s),box:geometry(),moved:false};});
 canvas.addEventListener('pointermove',event=>{if(gesture?.id===event.pointerId&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>8)gesture.moved=true;});
 canvas.addEventListener('pointercancel',()=>{gesture=null;});
 canvas.addEventListener('pointerup',event=>{const old=gesture;if(old?.id!==event.pointerId)return;gesture=null;if(old.moved||old.index===null||Math.hypot(event.clientX-old.x,event.clientY-old.y)>8||!canAct()||geometry().some((value,i)=>value!==old.box[i]))return;const index=hitGeneralizationPoint(canvas,event,s);if(index===old.index)choose(index);});
 for(const event of ['scroll','resize'])window.addEventListener(event,()=>{gesture=null;},true);
 window.addEventListener('pointerup',event=>{if(gesture?.id===event.pointerId)gesture=null;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)gesture=null;});
 window.addEventListener('pagehide',()=>{gesture=null;});
 function route(){if(window.location.hash==='#generalization-lesson')open();}window.addEventListener('hashchange',route);
 if(typeof MutationObserver!=='undefined')new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 render();route();return {snapshot:()=>structuredClone(s)};
}
if(typeof document!=='undefined'&&document.getElementById('generalization-lesson'))mountGeneralizationLesson({document,window});
