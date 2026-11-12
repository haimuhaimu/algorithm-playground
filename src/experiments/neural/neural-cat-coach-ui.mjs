import {COACH_CARD,COACH_PAIR,coachBaseline,coachRound} from './neural-cat-coach.mjs';

const names={bobby:'波比',chouchou:'臭臭'};
const labels=['chouchou','bobby'];
const trials=['more','fluff'];
const sizes=[6,18],initialSize=18;
const pct=value=>`${(value*100).toFixed(1)}%`;
const svgNS='http://www.w3.org/2000/svg';
const corners=[[0,0],[10,0],[10,10],[0,10]];
const project=([x,y])=>[48+33.6*x,214-20*y];

function plotModel({weights:[a,b,c]}){
 const regions={bobby:[],chouchou:[]},edge=[];
 const logit=([x,y])=>a*((x-5)/5)+b*((y-5)/5)+c;
 const values=corners.map(logit);
 if(values.every(value=>value===0))return {regions:{bobby:[],chouchou:corners},edge};
 for(const [i,start] of corners.entries()){
  const j=(i+1)%corners.length,end=corners[j],u=values[i],v=values[j];
  if(u<=0)regions.bobby.push(start);
  if(u>=0)regions.chouchou.push(start);
  if(u===0)edge.push(start);
  if(u*v<0){
   const t=u/(u-v),cut=start.map((value,k)=>value+t*(end[k]-value));
   edge.push(cut);
   regions.bobby.push(cut);regions.chouchou.push(cut);
  }
 }
 return {regions,edge};
}

export function mountCatCoach({document,window}){
 const $=id=>document.getElementById(id);
 const set=(id,text)=>{$(id).textContent=text;};
 const show=(id,visible)=>{$(id).hidden=!visible;};
 const pressed=(id,value)=>$(id).setAttribute('aria-pressed',String(value));
 const baseline=coachBaseline();
 const taught=new Map();
 let current=null, attempts={}, transfer=null, size=initialSize, selected=COACH_CARD.id, plotted=null;
 let markers=[];
 $('cat-coach-first-image').src=COACH_CARD.image;
 for(const card of COACH_PAIR)$('cat-coach-pair-image-'+card.id).src=card.image;
 set('cat-coach-before',names[baseline.prediction]);

 function renderPopulation(){
  show('cat-coach-population',Boolean(current));
  if(!current){plotted=null;return;}
  const picker=$('cat-coach-sample');
  const svg=(tag,attrs)=>{
   const element=document.createElementNS(svgNS,tag);
   for(const [name,value] of Object.entries(attrs))element.setAttribute(name,value);
   return element;
  };
  if(plotted!==current){
   const before=plotModel(current.baseline),after=plotModel(current.model);
   for(const [type,model] of [['before',before],['after',after]]){
    const line=$('cat-coach-boundary-'+type);
    line.setAttribute('visibility',model.edge.length===2?'visible':'hidden');
    model.edge.slice(0,2).map(project).forEach(([x,y],i)=>{
     line.setAttribute('x'+(i+1),x);line.setAttribute('y'+(i+1),y);
    });
   }
   for(const label of labels)$('cat-coach-region-'+label).setAttribute('points',after.regions[label].map(point=>project(point).join(',')).join(' '));
   const options=[];
   markers=current.points.map(point=>{
    const option=document.createElement('option');
    option.value=point.id;
    option.textContent=`${point.id} · ${names[point.truth]}${point.id===COACH_CARD.id?'（你贴的那张）':''}`;
    options.push(option);
    const mismatch=point.prediction!==point.label;
    const mark=svg('g',{class:'cat-coach-mark','data-id':point.id,'data-label':point.label,transform:`translate(${project(point.features).join(' ')})`});
    if(mismatch)mark.append(svg('circle',{class:'cat-coach-mismatch-ring',r:10}));
    mark.append(point.label==='bobby'
     ?svg('circle',{class:'cat-marker cat-marker-bobby',r:6})
     :svg('rect',{class:'cat-marker cat-marker-chouchou',x:-5.5,y:-5.5,width:11,height:11,rx:1}));
    if(point.id===COACH_CARD.id)mark.append(svg('circle',{class:'cat-coach-tag-ring',r:13}));
    const target=svg('circle',{class:'cat-coach-hit',r:12});
    mark.append(target);
    mark.addEventListener('click',()=>chooseSample(point.id));
    return mark;
   });
   $('cat-coach-population-points').replaceChildren(...markers);
   picker.replaceChildren(...options);
   show('cat-coach-mismatch-key',current.trainingMatches<current.size);
   plotted=current;
  }
  for(const value of sizes)pressed('cat-coach-size-'+value,value===size);
  const point=current.points.find(point=>point.id===selected)??current.points.find(point=>point.id===COACH_CARD.id);
  selected=point.id;
  picker.value=selected;
  for(const mark of markers)mark.setAttribute('data-selected',String(mark.getAttribute('data-id')===selected));
  const image=$('cat-coach-sample-image');
  if(image.getAttribute('src')!==point.image)image.setAttribute('src',point.image);
  image.alt=`三猫工作室原画：${names[point.truth]}`;
  set('cat-coach-sample-name',`${point.id} 号原画 · ${names[point.truth]}`);
  set('cat-coach-sample-features',`脸颊 ${point.features[0]} · 耳尖 ${point.features[1]}`);
  set('cat-coach-sample-reading',`贴${names[point.label]}；模型：${names[point.before]} → ${names[point.prediction]}`);
  set('cat-coach-population-score',`符合训练标签：${current.beforeMatches} / ${current.size} → ${current.trainingMatches} / ${current.size}`);
 }
 function chooseSample(id){
  if(!current?.points.some(point=>point.id===id))return;
  selected=id;
  renderPopulation();
  set('cat-coach-status', ['name','features','reading']
   .map(key=>$('cat-coach-sample-'+key).textContent).join('。'));
 }
 const trialKey=label=>`${size}:${label}`;
 function learn(label){
  const key=trialKey(label);
  const result=taught.get(key)??coachRound(label,'first',size);
  taught.set(key,result);
  current=result;attempts={};transfer=null;
  $('cat-coach-evidence').open=false;
  render();
 }

 function renderTrial(mode,result){
  show(`cat-coach-${mode}-result`,Boolean(result));
  show(`cat-coach-${mode}-evidence`,Boolean(result));
  pressed('cat-coach-'+mode,Boolean(result));
  if(!result){
   for(const suffix of ['outcome','note','evidence'])set(`cat-coach-${mode}-${suffix}`,'');
   return;
  }
  const [a,b]=result.test, same=a.prediction===b.prediction;
  const pair=same
   ?`还是同一个答案：都叫「${names[a.prediction]}」。`
   :`现在分开了：「${names[a.prediction]}」和「${names[b.prediction]}」。`;
  set(`cat-coach-${mode}-outcome`,pair);
  const explanation=mode==='more'
   ?`把训练从 ${current.steps} 步加到 ${result.steps} 步，两个输入仍一模一样。`
   :`脸颊、耳尖分不变。加上的蓬松度：${names[a.truth]}是 ${a.features[2]}，${names[b.truth]}是 ${b.features[2]}。用原来的步数重新学，${same?`${a.score!==b.score?'倾向分数有差别，但':''}这次仍没分开。`:result.matches===2?'这次两只都叫对了。':'这次分开了，但没都叫对。'}`;
  set(`cat-coach-${mode}-note`,explanation);
  const evidence=result.test.map(card=>{
   const [cheek,ear,fluff]=card.features;
   const inputs=`脸颊 ${cheek}，耳尖 ${ear}${mode==='fluff'?`，蓬松度 ${fluff}`:''}`;
   return `${names[card.truth]}卡：${inputs}，臭臭倾向 ${pct(card.score)}`;
  }).join('；');
  set(`cat-coach-${mode}-evidence`,`${mode==='more'?'再练':'加上第三项'} · ${result.size} 张训练卡 · ${result.steps} 步。${evidence}。`);
 }
 function render(){
  for(const label of labels){
   pressed('cat-coach-label-'+label,current?.label===label);
   const result=taught.get(trialKey(label));
   set('cat-coach-tag-'+label,result?`贴「${names[label]}」 → 判「${names[result.trainingCard.prediction]}」`:'');
  }
  for(const id of ['cat-coach-first-result','cat-coach-try-other','cat-coach-next','cat-coach-pair'])show(id,Boolean(current));
  show('cat-coach-tag-comparison',labels.every(label=>taught.has(trialKey(label))));
  renderPopulation();
  if(current){
   const {trainingCard}=current;
   const changed=trainingCard.prediction!==baseline.prediction;
   set('cat-coach-first-outcome',changed
    ?`它改口了：${names[baseline.prediction]} → ${names[trainingCard.prediction]}`
    :`它没改口，仍叫「${names[trainingCard.prediction]}」。`);
   set('cat-coach-first-note',`原画里是${names[trainingCard.truth]}，你贴的是${names[current.label]}。${current.label===trainingCard.truth?'标签告诉它该把什么当作正确答案。':'它把你贴的名字当答案，不知道标签贴反了。'}`);
   for(const card of current.test){
    set('cat-coach-pair-truth-'+card.id,`原画 · ${names[card.truth]}`);
    set('cat-coach-pair-call-'+card.id,`刚才判「${names[card.prediction]}」`);
   }
   const [a,b]=current.test;
   const sameInputs=a.features[0]===b.features[0]&&a.features[1]===b.features[1];
   set('cat-coach-pair-input',sameInputs?`模型看见的都一样：脸颊 ${a.features[0]} / 10，耳尖 ${a.features[1]} / 10。`:'模型按卡片给出的脸颊和耳尖分数来分组。');
   set('cat-coach-first-evidence',`第一次用你贴的「${names[current.label]}」和其余 ${current.size-1} 张参考标签训练 ${current.steps} 步。新卡没参与训练；它只看每张卡的两个手填分数。`);
  }else{
   for(const id of ['cat-coach-first-outcome','cat-coach-first-note','cat-coach-first-evidence','cat-coach-pair-input'])set(id,'');
  }
  for(const mode of trials)renderTrial(mode,attempts[mode]);
  show('cat-coach-evidence',trials.some(mode=>Boolean(attempts[mode])));
  show('cat-coach-transfer',trials.every(mode=>Boolean(attempts[mode])));
  for(const choice of ['same','more'])pressed('cat-coach-transfer-'+choice,transfer===choice);
  set('cat-coach-transfer-feedback',transfer===null?'':transfer==='same'
   ?'对。给这个模型完全相同的三项分数，答案也一样。'
   :'再练能改变分组规则，但两张卡的输入相同，输出还是相同。');
 }
 for(const label of labels)$('cat-coach-label-'+label).addEventListener('click',()=>{
  if(current?.label===label)return;
  learn(label);
  set('cat-coach-status',`${$('cat-coach-first-outcome').textContent} ${$('cat-coach-first-note').textContent}`);
 });
 for(const value of sizes)$('cat-coach-size-'+value).addEventListener('click',()=>{
  if(!current||size===value)return;
  size=value;
  learn(current.label);
  set('cat-coach-status',`已用 ${size} 张卡从头训练。${$('cat-coach-population-score').textContent}。两张新卡的对照已重置。`);
 });
 $('cat-coach-sample').addEventListener('change',()=>chooseSample($('cat-coach-sample').value));
 for(const mode of trials)$('cat-coach-'+mode).addEventListener('click',()=>{
  if(!current||attempts[mode])return;
  attempts[mode]=coachRound(current.label,mode,size);
  render();
  set('cat-coach-status',`${$(`cat-coach-${mode}-outcome`).textContent} ${$(`cat-coach-${mode}-note`).textContent}`);
 });
 for(const choice of ['same','more'])$('cat-coach-transfer-'+choice).addEventListener('click',()=>{
  if(!trials.every(mode=>Boolean(attempts[mode])))return;
  transfer=choice;
  render();
 });
 $('cat-coach-next').addEventListener('click',()=>{
  if(current)$('cat-coach-pair-title').focus();
 });
 $('cat-coach-reset').addEventListener('click',()=>{
  current=null;attempts={};transfer=null;taught.clear();size=initialSize;selected=COACH_CARD.id;
  $('cat-coach-evidence').open=false;
  render();
  set('cat-coach-status','回到这张被叫错的猫卡。');
 });
 $('cat-coach-free').addEventListener('click',()=>{
  if(window.location.hash==='#field')$('guide-open-free')?.click();
 });
 render();
 show('cat-coach',true);
}

if(typeof document!=='undefined'&&document.getElementById('cat-coach'))mountCatCoach({document,window});
