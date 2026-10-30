import {createLearningRoute,actLearningRoute,learningRouteEvidence} from './learning-route.mjs?v=learning-tool-v1';
import {paintGuide} from './neural-guide-view.mjs';
import {paintGeneralization} from './neural-generalization-view.mjs';
import {runLearningRoute} from './learning-tool.mjs?v=learning-tool-v1';
const shape=n=>n?'方':'圆';
function markExample(canvas,p,dark){
 if(!p)return;
 const ctx=canvas.getContext('2d'),x=(p.x+1)*canvas.width/2,y=(1-p.y)*canvas.height/2;
 ctx.strokeStyle=dark?'#ff91c5':'#ad2868';ctx.lineWidth=5;ctx.beginPath();ctx.arc(x,y,31,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle=dark?'#242028':'#ffffff';ctx.fillRect(x-35,y-72,70,33);ctx.fillStyle=dark?'#ff91c5':'#ad2868';ctx.font='700 25px system-ui';ctx.textAlign='center';ctx.fillText(p.id+'号',x,y-47);ctx.textAlign='start';
}

export function mountLearningRoute({document,window}){
 const $=id=>document.getElementById(id),set=(id,t)=>{$(id).textContent=t;},show=(id,value)=>{$(id).hidden=!value;};
 const s=createLearningRoute(),canvas=$('route-map'),supported=!!canvas.getContext('2d');let before=false,explicitTheme=false,journal=[],exportGeneration=0;
 const media=window.matchMedia('(prefers-color-scheme: dark)');
 function render(){
  const e=learningRouteEvidence(s),stage=s.stage,summary=stage==='summary';
  show('route-task',!summary);show('route-summary',summary);show('route-export',summary);show('route-back',e.index>0);show('route-continue',!summary);
  for(let i=0;i<3;i++){$('route-progress-'+i).setAttribute('aria-current',e.index===i?'step':'false');$('route-progress-'+i).dataset.complete=String(e.completed[i]);}
  $('route-continue').disabled=!e.canAdvance||!supported;
  set('route-continue',e.canAdvance?(stage==='classify'?'继续：亲手改一步 →':stage==='gradient'?'继续：拿新题检验 →':'看看这次的学习记录 →'):'完成这一站，再继续');
  for(const id of ['prediction','probe','test-guess','reflect','rate-control','retry','point-controls'])show('route-'+id,false);
  show('route-main',!summary&&!e.canAdvance);$('route-main').disabled=!supported;
  show('route-before',!summary&&stage!=='test'&&(stage==='classify'?e.guide.steps:e.gradient.steps)>0);
  $('route-before').setAttribute('aria-pressed',String(before));set('route-before',before?'回到现在的线':'单独看原来的线');
  set('route-explain-feedback','');set('route-formula','');
  set('route-boundary',stage==='test'?'新题来自 4×4 固定位置网格，与 6 个练习位置不重合。出题规则独立于模型：横坐标 + 纵坐标大于 0 判方，否则判圆。新题从未参加训练。它不是随机抽样的现实测试集，这份成绩不代表现实准确率，也不能单凭一次错题诊断过拟合。':'这是位置分类，不是识别手写图像。6 个例子、两个初始错点和起始分界是指定的教学案例，不是随机抽到的结果。各站使用独立模型，不读写自由涂鸦草稿；刷新会重来。');
  if(stage==='classify'){
   const phase=s.guide.phase,probe=['test','reveal','reflect','done'].includes(phase);
   set('route-station','看它学会分组');
   set('route-title',phase==='intro'?'这两个错点，能分回来吗？':phase==='trained'?'点没动，分界线变了。':phase==='test'?'新来的问号，应该分到哪边？':'它学到的是规则，不是新题答案。');
   set('route-description',phase==='intro'?'圆点进圆区，方点进方区。先找图上标“错”的两个点，再教它一次。':phase==='trained'?'虚线保留原来的分法，实线是学习后的分法。接着用它判断一个没教过的新位置。':phase==='test'?'沿着已经学到的实线，看问号落在圆区还是方区。你的判断不会改变模型。':'刚才没有继续训练，模型只用学到的那条线作出判断。');
   set('route-condition','固定 6 个例子，步长 0.15，真实更新 120 步。点的位置和标签不变。');
   set('route-main',phase==='intro'?'教它一次，看线怎样变化':'用这条线，分一个新点');show('route-main',['intro','trained'].includes(phase));
   show('route-probe',phase==='test');show('route-reflect',['reveal','reflect','done'].includes(phase));
   set('route-reflect-title','没见过的位置，它靠什么判断？');set('route-explain-bad','只记住了那 6 个例子的答案');set('route-explain-good','按学到的分界线，判断新位置');
   if(s.guide.reflection==='memorize')set('route-explain-feedback','问号没有给过答案。看看它落在实线哪一边，再试一次。');
   if(s.guide.phase==='done')set('route-explain-feedback','对。训练改变规则，使用时按这条规则判断。下一站亲手拆开一次改变。');
   set('route-metric',e.guide.steps?`练习分错：${e.guide.mistakesBefore.length} → ${e.guide.mistakesNow.length} 个`:`起点：${e.guide.mistakesBefore.length} 个练习点分错，尚未训练`);
   set('route-evidence',probe&&phase!=='test'?`你猜${shape(e.guide.guess)}区，模型判${shape(e.guide.probe.label)}区。${e.guide.matchesGuess?'这次判断一致。':'猜错也没关系，真实结果仍保留。'}新点没有参与训练。`:e.guide.steps?'图上的圆点和方点没有移动。学习只改变分界线的方向与位置；原来的线保留作对照。':'现在看到的是学习前的分法。先找到标“错”的两个点，再运行训练，才能比较线的变化。');
   set('route-map-label',before?'原来的分法':e.guide.steps?'学到的分法':'先看原来的分法');
   set('route-map-text',`${before?'原来': '现在'}有 ${before?e.guide.mistakesBefore.length:e.guide.mistakesNow.length} 个练习点分错。${probe?`问号在当前${shape(Number((before?e.guide.probe.before:e.guide.probe.after)>=.5))}区一侧。`:''}`);
   set('route-legend','圆点进圆区，方点进方区。实线是现在，虚线是原来。');
   if(supported)paintGuide(canvas,s.guide,{before,dark:document.documentElement.dataset.theme==='dark'});
  }else if(stage==='gradient'){
   const stepped=e.gradient.steps>0;show('route-rate-control',true);show('route-prediction',!stepped);show('route-retry',stepped);show('route-reflect',stepped);
   set('route-station','亲手改一步');set('route-title',stepped?'只走一步，究竟改了什么？':'先猜一次，再让它走一步。');
   set('route-description','还是同样 6 个例子。这一站退回共同起点，把上一站的连续训练拆开；可换步长重试。');
   set('route-condition','固定例子、固定起始参数，只改变步长。这里不接着上一站第 120 步继续训练。');
   $('route-rate').value=String(s.gradient.rate);$('route-rate').disabled=stepped;set('route-main','按这个步长，真实走一步');$('route-main').disabled=!supported||s.stepGuess===null;
   show('route-main',!stepped);for(const [id,value]of [['points','points'],['rule','parameters']])$('route-predict-'+id).setAttribute('aria-pressed',String(s.stepGuess===value));
   set('route-reflect-title','对照实线和虚线，现在能确定什么？');set('route-explain-bad','算法把例子移动到别的位置');set('route-explain-good','例子没动，算法调整了线的参数');
   if(s.gradient.answer==='points')set('route-explain-feedback','圆点和方点坐标没变。变化发生在决定这条线的参数上。');
   if(s.gradient.answer==='parameters')set('route-explain-feedback','对，这就是一次梯度更新。步长控制改多少，不代表越大越好。');
   set('route-metric',stepped?`练习误差：${e.gradient.lossBefore.toFixed(3)} → ${e.gradient.lossAfter.toFixed(3)}`:`起点练习误差：${e.gradient.lossBefore.toFixed(3)}，尚未更新`);
   set('route-evidence',stepped?`你猜${s.stepGuess==='points'?'点会移动':'分界线会变'}；实际只改了参数。分错数 ${e.gradient.mistakesBefore.length} → ${e.gradient.mistakesNow.length}，再看同一个点的读数。`:'先选一个预测，才能运行。误差来自模型真实计算，不是预设的进度分数。');
   set('route-map-label',before||!stepped?'共同起点的分界，尚未更新':'这一步之后的分界');set('route-map-text',`圆点、方点位置不变。${e.gradient.steps} 次真实更新，当前分错 ${e.gradient.mistakesNow.length} 个。`);
   set('route-legend',stepped?'实线是这一步的结果，虚线保留共同起点。可以单独看原来的线。':'这条实线是共同起点。运行后才会叠加前后两条线；现在还没有更新结果。');
   if(stepped)set('route-formula',`新参数 = 旧参数 − 步长 × 当前梯度。本次步长 ${e.gradient.rate}；横向权重 ${e.gradient.lastWeights[0].toFixed(4)} → ${s.gradient.model.weights[0].toFixed(4)}，纵向权重 ${e.gradient.lastWeights[1].toFixed(4)} → ${s.gradient.model.weights[1].toFixed(4)}。误差是练习题的平均交叉熵，不是新题正确率。`);
   if(supported)paintGuide(canvas,s.gradient,{before,dark:document.documentElement.dataset.theme==='dark'});
  }else if(stage==='test'){
   const phase=s.test.phase,revealed=!!e.test.test;
   set('route-station','拿新题检验');set('route-title',phase==='intro'?'练习全对，新题也一定全对吗？':phase==='guess'?'先留一个判断，再揭晓。':'分界没变，新位置却有错题。');
   set('route-description','这一站检验同一个冻结模型。揭开新位置只是在评估，不会给模型补答案。');
   set('route-condition','为公平复现，重新从共同起点以步长 0.15 学 120 步。不继承上一站选的步长或只走一步的模型。');
   set('route-main','用 6 个例子学一次，然后停住');show('route-main',phase==='intro');show('route-test-guess',phase==='guess');show('route-reflect',revealed);show('route-point-controls',revealed);
   set('route-reflect-title','明天拿到一批新位置，你会先做什么？');set('route-explain-bad','练习全对了，直接认定新题也全对');set('route-explain-good','用没参与训练的新题，单独检验');
   if(s.test.answer==='practice')set('route-explain-feedback','这次练习 6 个全对，新题仍有错。练习成绩不能替代新题检验。');
   if(s.test.phase==='done')set('route-explain-feedback','对。先冻结模型，再用新题检验；检查结果时别偷偷继续训练。');
   set('route-metric',revealed?`练习 ${e.test.train.correct} / 6 · 新题 ${e.test.test.correct} / 16`:phase==='intro'?'6 个练习点，16 个新位置':'练习 6 / 6 · 新题等你先猜');
   set('route-evidence',revealed?`你猜${s.test.guess==='all'?'新题会全对':'新题不一定全对'}。实际分对 ${e.test.test.correct} / ${e.test.test.total} 个。揭晓与换位置前后，模型始终停在第 120 步。`:'16 个新位置没有参加训练。先看练习成绩，再判断能不能直接推到新题。');
   if(revealed){const p=e.test.selected;set('route-point',`${p.id} 号新题：答案为${shape(p.label)}，模型判${shape(p.predicted)}。${p.correct?'这次一致。':'实线和出题规则虚线，在这个位置分到了不同侧。'}`);}
   set('route-map-label',revealed?'冻结模型，揭开新题':'只看练习点');set('route-map-text',revealed?`练习分对 6/6，新题分对 ${e.test.test.correct}/16。${$('route-point').textContent}`:'尚未揭晓新题，没有把新题交给模型学习。');
   set('route-legend','实心小点是练习题，空心编号是新题。实线是模型分界，虚线是固定出题规则。');
   if(supported)paintGeneralization(canvas,s.test,{dark:document.documentElement.dataset.theme==='dark',showRule:revealed});
  }
  if(summary){
   set('route-summary-guide',`6 个例子的位置没动，模型用 120 步调整分界，分错数从 ${e.guide.mistakesBefore.length} 个降到 ${e.guide.mistakesNow.length} 个。随后新位置只被判断，没有继续训练。`);
   set('route-summary-gradient',`你用步长 ${e.gradient.rate} 走了 ${e.gradient.steps} 步，练习误差从 ${e.gradient.lossBefore.toFixed(3)} 变成 ${e.gradient.lossAfter.toFixed(3)}。点和标签不变，变的是决定分界的参数。`);
   set('route-summary-test',`回到固定的 120 步模型，练习分对 ${e.test.train.correct} / 6，新题分对 ${e.test.test.correct} / 16。这不是“模型永远会错 ${e.test.test.total-e.test.test.correct} 题”，只是这组固定小题的实际结果。`);
  }
  show('route-inspector',!!e.point);show('route-after-reading',!!e.point?.after);
  if(e.point){
   const p=e.point,kind=shape(p.label),reading=r=>`判${shape(r.predicted)}区 · 给${kind}区 ${(r.towardLabel*100).toFixed(1)}%`;
   set('route-inspect-title',`盯住 ${p.id} 号${kind}点 · 答案是${kind}区`);
   for(const id of [3,6])$('route-inspect-'+id).setAttribute('aria-pressed',String(p.id===id));
   set('route-point-before',reading(p.before));set('route-point-after',p.after?reading(p.after):'尚未运行');
   $('route-score-before').value=p.before.towardLabel*100;$('route-score-after').value=p.after?p.after.towardLabel*100:0;
   for(const [name,value]of [['before',p.before],['after',p.after]])$('route-score-'+name).setAttribute('aria-label',`${p.id} 号${kind}点，${name==='before'?'起点':'运行后'}对${kind}区的倾向${value?' '+(value.towardLabel*100).toFixed(1)+'%':'尚未运行'}`);
   set('route-point-verdict',!p.after?'先运行，再看同一个点的判断怎样变化。':p.after.correct?'这个例子分对了。点没有移动，改变的是分界线。':p.after.towardLabel>p.before.towardLabel?`更偏向${kind}区了，但还没分对。学了一步，不等于立刻改对类别。`:`这个例子仍然分错。一次变化不能直接当作改进。`);
   set('route-view-note',before?'画布正在显示共同起点；运行后读数仍是保留的真实记录。':p.after?'画布显示运行后，虚线保留共同起点；两栏读的是同一个点。':'画布和起点读数来自同一个未更新模型。');
   if(supported)markExample(canvas,p,document.documentElement.dataset.theme==='dark');
  }
  if(before){
   set('route-metric','运行记录（画布看起点）：'+$('route-metric').textContent);
   set('route-legend','只显示共同起点的实线；运行后的分界没有覆盖这张起点图。');
   if(stage==='gradient')set('route-map-text',`画布显示未更新的共同起点，分错 ${e.gradient.mistakesBefore.length} 个；${e.gradient.steps} 次更新的实际结果仍保留在记录中。`);
  }
  set('route-status',!supported?'此浏览器不支持 Canvas，无法运行这条路线。完整实验与学习说明链接仍可打开。':e.canAdvance?'这一站已完成，可以继续下一站。':stage==='gradient'&&!e.gradient.steps?'选好步长和预测，再真实走一步。':stage==='classify'&&s.guide.phase==='trained'?'看清变化后，用这条线判断一个新点。':'按当前提示动手，再用看到的变化作判断。');
 }
 function move(action,value){
  if(document.hidden||!supported)return;
  const old=s.stage;actLearningRoute(s,action,value);
  if(action==='reset')journal=[];else journal.push(value===undefined?{action}:{action,value});
  clearExport();if(action!=='inspect')before=false;render();
  if(old!==s.stage||['train','probe','step','retry','reset'].includes(action)||(action==='guess'&&s.stage!=='gradient')){
   const observation=['train','step','retry'].includes(action),narrow=window.innerWidth<=760||window.innerHeight<=450;
   const target=$(s.stage==='summary'?'route-summary-title':observation?narrow?'route-metric':'route-map-label':'route-title');target.focus({preventScroll:true});
   $(s.stage==='summary'?'route-summary':observation?narrow?'route-metric':'route-observation':'route-task').scrollIntoView({block:'start',behavior:'instant'});
  }
 }
 function clearExport(){exportGeneration++;$('route-export-text').value='';show('route-export-record',false);set('route-export-status','');}
 $('route-export-generate').addEventListener('click',()=>{
  if(document.hidden||!supported||s.stage!=='summary')return;
  clearExport();
  try{
   $('route-export-text').value=JSON.stringify(runLearningRoute(journal,{producer:'browser-session'}),null,2);
   show('route-export-record',true);set('route-export-status','记录已生成，只在本页。复制给外部 AI 后才会离开这里；它不证明你已掌握，也不会导入 GenAI OS 进度。');
  }catch{set('route-export-status','这轮操作超出记录上限，暂未导出；当前实验结果仍保留，没有截断或伪造记录。');}
 });
 $('route-export-copy').addEventListener('click',async()=>{
  const text=$('route-export-text').value,generation=exportGeneration;if(!text||document.hidden)return;
  try{
   if(!window.navigator?.clipboard?.writeText)throw Error('Clipboard unavailable');
   await window.navigator.clipboard.writeText(text);
   if(generation===exportGeneration)set('route-export-status','已复制。可交给你自己的 AI，请它只根据本轮证据解释，并先重放核验，不要把完成流程当成已掌握。');
  }catch{
   if(generation!==exportGeneration)return;
   $('route-export-text').focus();$('route-export-text').select?.();set('route-export-status','浏览器未允许复制。记录仍保留，请在下方文本框手动全选、复制；没有自动发送。');
  }
 });
 $('route-main').addEventListener('click',()=>move(s.stage==='gradient'?'step':s.stage==='classify'&&s.guide.phase==='trained'?'probe':'train'));
 for(const [id,a,v]of [['continue','next'],['back','back'],['reset','reset'],['retry','retry'],['guess-round','guess',0],['guess-square','guess',1],['predict-points','guess','points'],['predict-rule','guess','parameters'],['guess-all','guess','all'],['guess-not-all','guess','not-all']])$('route-'+id).addEventListener('click',()=>move(a,v));
 for(const [id,good]of [['good',true],['bad',false]])$('route-explain-'+id).addEventListener('click',()=>move('explain',s.stage==='test'?(good?'unseen':'practice'):s.stage==='classify'?(good?'parameters':'memorize'):(good?'parameters':'points')));
 $('route-rate').addEventListener('change',()=>move('rate',Number($('route-rate').value)));
 $('route-point-next').addEventListener('click',()=>move('point',(s.test.selected+1)%s.test.test.length));
 $('route-before').addEventListener('click',()=>{if(document.hidden||!supported)return;before=!before;render();});
 for(const id of [3,6])$('route-inspect-'+id).addEventListener('click',()=>move('inspect',id-1));
 function theme(dark){document.documentElement.dataset.theme=dark?'dark':'light';$('home-theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');render();}
 $('home-theme').hidden=false;$('home-theme').addEventListener('click',()=>{explicitTheme=true;theme(document.documentElement.dataset.theme!=='dark');});
 media.addEventListener('change',()=>{if(!explicitTheme)theme(media.matches);});clearExport();theme(media.matches);
 return {snapshot:()=>structuredClone(s)};
}
if(typeof document!=='undefined'&&document.getElementById('route-task'))mountLearningRoute({document,window});
