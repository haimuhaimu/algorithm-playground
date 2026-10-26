import {createGuide,teachGuide,openGuideTest,guessGuide,openGuideRecap,finishGuide,guideEvidence,GUIDE_STEPS} from './neural-guide.mjs';
import {paintGuide} from './neural-guide-view.mjs';
const pct=n=>(n*100).toFixed(1)+'%',shape=n=>n?'方':'圆';
const phases={intro:0,teaching:1,trained:1,test:2,reveal:2,reflect:3,done:3};

export function mountNeuralGuide({document,window,schedule=callback=>requestAnimationFrame(callback)}){
 const $=id=>document.getElementById(id),set=(id,text)=>{$(id).textContent=text;};
 let s=createGuide(),running=false,token=0,before=false;
 const canvas=$('guide-map'),supported=!!canvas.getContext('2d'),advanced=$('neural-advanced');
 function pause(){if(!running)return;running=false;token++;render();set('guide-status','已暂停，训练进度保留。点“继续这轮训练”即可接着看。');}
 function pauseAdvanced(){window.dispatchEvent(new Event('neural-guide-pause'));}
 function showStep(){
  $('first-lesson').scrollIntoView({block:'start'});$('guide-title').focus({preventScroll:true});
 }
 function render(){
  const e=guideEvidence(s),phase=s.phase,showProbe=['reveal','reflect','done'].includes(phase),viewLabel=Number((before?e.probe.before:e.probe.after)>=.5);
  for(let i=0;i<4;i++)$('guide-progress-'+i).setAttribute('aria-current',i===phases[phase]?'step':'false');
  const copy={
   intro:['这条线，分错了两个点。','圆点要进圆区，方点要进方区。找找图上标“错”的两个点。','看它怎样调整这条线'],
   teaching:['点不动，线在调整。','留意两个错点：分界线移动后，它们会不会回到各自的区域？',running?'正在调整…':'继续看它改线'],
   trained:['两个错点，已经分回去了。','虚线是原来的分法，实线是学到的新分法。点没有挪，改变的是线的方向和位置。','用这条线，分一个新点'],
   test:['新来的点，该进哪边？','问号没有参加训练。沿着已经学到的实线，判断它在圆区还是方区。',''],
   reveal:['同一条线，也能分新点。','模型没有再学习，只按刚才调整好的分界线给新点分组。','看看这轮学到了什么'],
   reflect:['它到底学会了什么？','新位置没有教过，它为什么还能判断？',''],
   done:['它学到了一条分组规则。','训练时调整分界线；使用时，按这条线给新位置分组。你刚才亲手用了一次这条规则。','']
  }[phase];
  set('guide-stage','第 '+(phases[phase]+1)+' 步 / 4');set('guide-title',copy[0]);set('guide-description',before?'现在单独看原来的线。切回“现在”，就能同时比较学到的实线和原来的虚线。':copy[1]);
  set('guide-main',copy[2]);$('guide-main').disabled=running||!supported;
  $('guide-main').hidden=['test','reflect','done'].includes(phase);
  $('guide-choices').hidden=phase!=='test';$('guide-reflection').hidden=phase!=='reflect';$('guide-summary').hidden=phase!=='done';
  $('guide-compare').hidden=!['trained','reveal','reflect','done'].includes(phase);
  $('guide-retest').hidden=!['reveal','done'].includes(phase);
  $('guide-open-gradient').hidden=phase!=='done';
  $('guide-before').setAttribute('aria-pressed',String(before));$('guide-current').setAttribute('aria-pressed',String(!before));
  set('guide-map-state',before?'原来的分法':e.steps?'现在的分法':'先看原来的分法');
  set('guide-error-count',e.steps&&!before?`${e.mistakesBefore.length} → ${e.mistakesNow.length} 个分错`:`${e.mistakesBefore.length} 个分错`);
  set('guide-observation',before?(showProbe?`现在看原来的分法：新点 ${e.probe.id} 会被判进${shape(viewLabel)}区。切到“现在”，再看学习后的线怎样分。`:`现在看原来的分法：6 个点中有 ${e.mistakesBefore.length} 个分错。切到“现在”，再比较线的变化。`):showProbe?`你猜${shape(e.guess)}区，模型按实线判${shape(e.probe.label)}区。${e.matchesGuess?'你用对了这条分界。':'看问号在哪一侧，再沿实线看一次。'} 它没有用这个新点训练。`:e.steps?`原来 ${e.mistakesBefore.length} 个分错，现在 ${e.mistakesNow.length} 个。实线是当前分法，虚线保留原来的分法；6 个点都没移动。`:'带“错”的圆点掉进了方区，方点掉进了圆区。训练要改变这条线，不是把点搬走。');
  set('guide-feedback',s.reflection==='memorize'?'再想一下：新点没有给过答案。刚才是用已经调整好的分界线，看它落在哪一边。':'');
  set('guide-summary-model',`学到的：分界线该怎样摆。这条分界线把例子的分错数从 ${e.mistakesBefore.length} 个降到 ${e.mistakesNow.length} 个，点的位置没有改变。`);
  set('guide-summary-probe',`你应用的：新点 ${e.probe.id} 原来会被分到${shape(Number(e.probe.before>=.5))}区，现在按实线分到${shape(e.probe.label)}区；测试没有再训练。`);
  set('guide-summary-limit','这轮是一个简单的位置分类例子，不是识别图案。一条直线不一定能分开任意涂鸦，也不保证每个新点都正确。');
  set('guide-map-text',`圆点应在圆区、方点应在方区。${before?e.mistakesBefore.length:e.mistakesNow.length} 个例子被当前分界分错。${showProbe?'新点 '+e.probe.id+' 按'+(before?'原来':'现在')+'的线判'+shape(viewLabel)+'区。':phase==='test'?'问号位于当前实线的'+shape(viewLabel)+'区一侧，请按同一分界给它分组。':'错点在图上标有“错”字。'}`);
  set('guide-math',`这里用直线分类器的 3 个参数表示线的方向和位置。原始分界是为演示指定的固定起点，有 2 个例子分错；不是随机抽到的案例。每步用 6 个例子的真实梯度、步长 0.15 更新参数，共 ${e.steps} / ${GUIDE_STEPS} 步。整组误差 ${e.lossBefore.toFixed(3)} → ${e.lossAfter.toFixed(3)}。新点的方倾向 ${pct(e.probe.before)} → ${pct(e.probe.after)}，不是正确率。它不是通过移动图上的点或切换预画图片来“学会”的。`);
  if(supported)paintGuide(canvas,s,{before,dark:document.documentElement.dataset.theme==='dark'});
  if(!supported)set('guide-status','此浏览器暂不支持 Canvas，无法显示这一轮地图。仍可打开下方自由涂鸦与说明。');
 }
 function run(){
  if(running||document.hidden||!supported)return;
  pauseAdvanced();running=true;before=false;render();showStep();set('guide-status','盯住标“错”的点，看线怎样把它们分回去。');
  const active=++token;
  const tick=()=>{
   if(active!==token||!running||document.hidden)return;
   teachGuide(s,window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?GUIDE_STEPS:1);
   render();
   if(s.phase==='trained'){running=false;render();set('guide-status','调线结束。可切换原来和现在，或用实线分一个新点。');return;}
   schedule(tick);
  };
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)tick();else schedule(tick);
 }
 $('guide-main').addEventListener('click',()=>{
  if(!supported||document.hidden)return;
  if(['intro','teaching'].includes(s.phase))run();
  else if(s.phase==='trained'){openGuideTest(s);before=false;render();showStep();set('guide-status','请选择圆或方，再看模型的答案。');}
  else if(s.phase==='reveal'){openGuideRecap(s);before=false;render();showStep();set('guide-status','选一个解释，完成这轮回顾。');}
 });
 for(const [id,label]of [['round',0],['square',1]])$('guide-guess-'+id).addEventListener('click',()=>{
  if(s.phase!=='test')return;guessGuide(s,label);render();showStep();set('guide-status','答案已揭示。先比较你的判断与模型输出，再回顾这一轮。');
 });
 for(const [id,answer]of [['memory','memorize'],['parameters','parameters']])$('guide-'+id).addEventListener('click',()=>{
  if(s.phase!=='reflect')return;finishGuide(s,answer);if(s.phase==='done')before=false;render();if(s.phase==='done')showStep();set('guide-status',s.phase==='done'?'本轮结束。你可以进入自由涂鸦，或换个位置再考。':'这个解释还不能回答新位置的问题，再试一次。');
 });
 $('guide-restart').addEventListener('click',()=>{pause();token++;s=createGuide();before=false;render();set('guide-status','新手小题已重置；自由涂鸦的草稿和模型没有改变。');});
 $('guide-retest').addEventListener('click',()=>{if(!['reveal','done'].includes(s.phase))return;openGuideTest(s,(s.probeIndex+1)%3);before=false;render();showStep();set('guide-status','换了一个新位置；没有重新训练。');});
 for(const [id,value]of [['before',true],['current',false]])$('guide-'+id).addEventListener('click',()=>{before=value;render();});
 function openAdvanced(target='field'){
  pause();advanced.open=true;const node=$(target);node?.scrollIntoView({block:'start'});node?.focus({preventScroll:true});
 }
 $('guide-open-free').addEventListener('click',()=>openAdvanced());
 $('guide-return').addEventListener('click',()=>{advanced.open=false;pauseAdvanced();$('first-lesson').scrollIntoView({block:'start'});$('first-lesson').focus({preventScroll:true});});
 advanced.addEventListener('toggle',()=>{if(advanced.open)pause();else pauseAdvanced();});
 const legacy=new Set(['field','label-lab','step-lab','model-comparison','comparison-title','bridge-title']);
 function route(){const target=window.location.hash.slice(1);if(target==='first-lesson')pauseAdvanced();else if(legacy.has(target))openAdvanced(target);}
 for(const link of document.querySelectorAll('a[href="#first-lesson"],a[href="#gradient-lesson"],a[href="#residual-lesson"]'))link.addEventListener('click',()=>{pause();pauseAdvanced();});
 for(const id of ['label-before-run','label-after-run','play','step','fast'])$(id).addEventListener('click',pause);
 window.addEventListener('hashchange',route);window.addEventListener('pagehide',pause);
 window.addEventListener('neural-gradient-open',pause);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 $('about').addEventListener('click',pause);
 if(typeof MutationObserver!=='undefined')new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 render();set('guide-status',supported?'只调整分界线，不移动圆点和方点。':$('guide-status').textContent);route();
 return {snapshot:()=>structuredClone(s)};
}
if(typeof document!=='undefined'&&document.getElementById('first-lesson'))mountNeuralGuide({document,window});
