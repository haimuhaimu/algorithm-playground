import {CAT_TRAIN,CAT_TEST,makeCatLesson,labelCat,guessCatTraining,trainCats,guessCatTest,catTestEvidence,predictCat} from './neural-cat-lesson.mjs';

const names={bobby:'波比',chouchou:'臭臭'};
const comicDescription={
 '01':'绿色靠垫旁，一只奶白短毛猫转过头，灰色脸和两只大尖耳很显眼。',
 '02':'一只猫正面望着你，眼睛是蓝色的，白鼻梁连着蓬松白胸口。',
 '03':'一只猫趴在织垫上，露出两只白爪，蓝眼睛之间有一道白鼻梁。',
 '04':'一只短毛猫转向右边，竖起两只尖耳，浅灰色脸上有一双深色大眼。',
 '05':'一只奶白短毛猫低头坐着，两只大耳朵张开，爪子是灰色的。',
 '06':'一只蓝眼睛的猫从橙色围布中探头，白鼻梁下有两只白爪。',
 '07':'一只短毛猫伏低伸出前爪，大尖耳竖着，四只爪都是深灰色。',
 '08':'一只猫侧身往左看，身体是蓬松白毛，身后立着深色大尾巴。',
};
const trainingChoices=['moves','stays'];
const testChoices=['same','different'];
const svgNS='http://www.w3.org/2000/svg';
const plotCorners=[[0,0],[10,0],[10,10],[0,10]];
const plotX=x=>43+30.3*x;
const plotY=y=>212-19.9*y;
const projected=point=>[plotX(point[0]),plotY(point[1])];
const place=point=>`translate(${projected(point).join(' ')})`;
const plotValue=([a,b,c],[x,y])=>a*(x-5)/5+b*(y-5)/5+c;

function separate(model){
 const bobby=[],chouchou=[],boundary=[];
 const values=plotCorners.map(point=>plotValue(model.weights,point));
 for(let i=0;i<plotCorners.length;i++){
  const a=plotCorners[i],b=plotCorners[(i+1)%4],fa=values[i],fb=values[(i+1)%4];
  if(fa<=0)bobby.push(a);
  if(fa>=0)chouchou.push(a);
  if(fa===0&&!boundary.includes(a))boundary.push(a);
  if(fa*fb<0){
   const t=fa/(fa-fb),cut=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
   bobby.push(cut);chouchou.push(cut);boundary.push(cut);
  }
 }
 if(values.every(value=>value===0))return {bobby:[],chouchou:plotCorners,boundary:[]};
 return {bobby,chouchou,boundary};
}

export function mountCatLesson({document,window}){
 const $=id=>document.getElementById(id);
 const disclosure=$('cat-lesson');
 const set=(id,text)=>{$(id).textContent=text;};
 const show=(id,visible)=>{$(id).hidden=!visible;};
 const pressed=(id,active)=>$(id).setAttribute('aria-pressed',String(active));
 const visibleSVG=(id,visible)=>$(id).setAttribute('visibility',visible?'visible':'hidden');
 const svg=(tag,attributes,text)=>{
  const node=document.createElementNS(svgNS,tag);
  for(const [name,value] of Object.entries(attributes))node.setAttribute(name,String(value));
  if(text!==undefined)node.textContent=text;
  return node;
 };
 let state=makeCatLesson(),selected=0,compared=null,note='',shownImage='';

 function line(id,points){
  visibleSVG(id,points.length===2);
  if(points.length!==2)return;
  points.forEach((point,index)=>{
   const [x,y]=projected(point);
   $(id).setAttribute('x'+(index+1),String(x));
   $(id).setAttribute('y'+(index+1),String(y));
  });
 }
 function renderPlot(before,after){
  const base=separate(before),current=after?separate(after):base;
  for(const side of Object.keys(names))$('cat-plot-'+side).setAttribute('points',current[side].map(point=>projected(point).join(',')).join(' '));
  line('cat-plot-before',base.boundary);
  line('cat-plot-after',after?current.boundary:[]);
  const marks=CAT_TRAIN.map((sample,i)=>{
   const label=state.labels[sample.id],active=compared===i;
   const point=svg('g',{transform:place(sample.features),class:'cat-point'+(active?' is-selected':'')});
   if(label==='bobby')point.append(svg('circle',{r:10,class:'cat-marker cat-marker-bobby'}));
   else point.append(svg('rect',{x:-9,y:-9,width:18,height:18,rx:2,class:'cat-marker cat-marker-chouchou'}));
   point.append(svg('text',{'text-anchor':'middle',y:3.4},String(i+1)));
   return point;
  });
  $('cat-plot-points').replaceChildren(...marks);
  $('cat-plot-test').setAttribute('transform',place(CAT_TEST[0].features));
  visibleSVG('cat-plot-test',Boolean(after));
  let notes=after
   ?'底色是学完后的分法。训练卡没挪；07 和 08 两张新卡落在同一点，没参加训练。'
   :'底色是原来的分法：只看脸颊，低于 5 判波比，5 分及以上判臭臭。';
  if(after&&current.boundary.length!==2)notes+=` 学完后实线没穿过这张图，整个图都判${names[predictCat(after,[5,5])]}。`;
  set('cat-map-notes',notes);
 }
 function renderComparison(result){
  if(compared===null){
   const wrong=CAT_TRAIN.findIndex(sample=>predictCat(state.baseline,sample.features)!==state.labels[sample.id]);
   compared=wrong===-1?0:wrong;
  }
  const sample=CAT_TRAIN[compared],label=names[state.labels[sample.id]],row=result?.rows.find(item=>item.id===sample.id);
  const old=names[row?.before??predictCat(state.baseline,sample.features)];
  const photo=$('cat-compare-image');
  if(photo.getAttribute('src')!==sample.image)photo.setAttribute('src',sample.image);
  set('cat-compare-title',`对照 ${sample.id} 号卡`);
  set('cat-compare-features',`脸颊 ${sample.features[0]} / 10 · 耳尖 ${sample.features[1]} / 10`);
  set('cat-compare-reading',row
   ?`模型：${old} → ${names[row.after]}；你贴的是${label}。`
   :`原来判${old}；你贴的是${label}。`);
  CAT_TRAIN.forEach((card,i)=>{
   const id='cat-compare-'+card.id;
   $(id).setAttribute('aria-label',`对照 ${card.id} 号卡`);
   pressed(id,compared===i);
  });
 }
 function renderRows(result){
  const rows=result?.rows??[];
  $('cat-training-rows').replaceChildren(...rows.map(row=>{
   const li=document.createElement('li'),title=document.createElement('b'),evidence=document.createElement('span');
   title.textContent=`${row.id} · 你贴${names[row.label]}`;
   evidence.textContent=`原画是${names[row.truth]}；模型 ${names[row.before]} → ${names[row.after]}`;
   li.append(title,evidence);
   return li;
  }));
 }
 function render(){
  const sample=CAT_TRAIN[selected];
  if(shownImage!==sample.id){
   const image=$('cat-image');
   shownImage=sample.id;
   image.alt=comicDescription[sample.id];
   image.src=sample.image;
  }
  set('cat-image-caption',`训练卡 ${sample.id} / 06`);
  set('cat-cheeks',`${sample.features[0]} / 10`);
  set('cat-ears',`${sample.features[1]} / 10`);
  const labels=CAT_TRAIN.map(card=>state.labels[card.id]);
  const count=labels.filter(Boolean).length,complete=count===CAT_TRAIN.length;
  const eligible=complete&&new Set(labels).size===2;
  set('cat-label-count',`已贴 ${count} / ${CAT_TRAIN.length} 张`);
  for(const label of Object.keys(names))pressed('cat-label-'+label,state.labels[sample.id]===label);
  CAT_TRAIN.forEach((card,i)=>{
   const label=state.labels[card.id],id='cat-sample-'+card.id,button=$(id);
   button.setAttribute('aria-label',`第 ${card.id} 张：${label?'已贴'+names[label]:'还没贴标签'}`);
   button.dataset.catLabel=label??'';
   pressed(id,i===selected);
  });
  set('cat-status',!eligible&&complete?'需要两种标签才能学分组。点卡号，改一下之前贴的标签。':note||'点下面的卡号，可回看或改标签。');
  show('cat-train-stage',eligible);
  $('cat-train').disabled=!eligible||state.guess===null;
  for(const choice of trainingChoices)pressed('cat-train-guess-'+choice,state.guess===choice);
  const result=state.result;
  show('cat-train-predict',!result);
  show('cat-results',Boolean(result));
  show('cat-test-stage',Boolean(result));
  if(eligible){
   renderComparison(result);
   renderPlot(state.baseline,result?.after);
  }
  if(result){
   set('cat-score',`${result.correctBefore} / ${count} → ${result.correctAfter} / ${count} 张贴合你的标签`);
   const correct=(result.changed>0)===(state.guess==='moves');
   const moved=result.rows.filter(row=>row.before!==row.after).map(row=>row.id);
   const movement=moved.length?`${moved.join('、')} 号卡换了边。`:'这次没有卡换边，但模型的参数也可以变。';
   set('cat-change-summary',`${correct?'你猜对了。':'和你猜的不一样。'}${movement}只用你贴的 6 张卡学了 ${result.steps} 步。`);
   set('cat-loss',`每一步都按这 6 个标签调整参数。训练误差 ${result.lossBefore.toFixed(3)} → ${result.lossAfter.toFixed(3)}；它衡量的是模型离你贴的标签有多远。`);
   const mislabeled=result.rows.filter(row=>row.label!==row.truth);
   set('cat-mislabels',mislabeled.length?`${mislabeled.map(row=>row.id).join('、')} 号卡的标签和原画身份不同，模型仍按你贴的学。`:'你的标签都和原画身份一致。这个分数不是新题成绩。');
   CAT_TEST.forEach(card=>{
    const img=$('cat-test-image-'+card.id);
    if(img.getAttribute('src')!==card.image)img.setAttribute('src',card.image);
    img.alt=comicDescription[card.id];
    set('cat-test-caption-'+card.id,`${card.id} 号 · 脸颊 ${card.features[0]} / 10 · 耳尖 ${card.features[1]} / 10`);
   });
  }else{
   for(const id of ['cat-score','cat-change-summary','cat-loss','cat-mislabels'])set(id,'');
  }
  renderRows(result);
  const test=catTestEvidence(state);
  show('cat-reveal',Boolean(test));
  if(!test)$('cat-takeaway').open=false;
  for(const choice of testChoices){
   const id='cat-test-guess-'+choice;
   pressed(id,state.testGuess===choice);
   $(id).disabled=Boolean(test);
  }
  set('cat-test-feedback',!test?'':state.testGuess==='same'?'猜对了：模型给了同一个答案。':'模型给了同一个答案。看它拿到的两个数。');
  CAT_TEST.forEach((card,i)=>{
   const item=test?.[i];
   set('cat-test-result-'+card.id,item?`${card.id} 号 · 模型判${names[item.prediction]}（臭臭倾向 ${(item.score*100).toFixed(1)}%）；原画是${names[item.truth]}。`:'');
  });
 }
 for(const [i,card] of CAT_TRAIN.entries())$('cat-sample-'+card.id).addEventListener('click',()=>{
  selected=i;note=state.labels[card.id]?`已回到 ${card.id} 号卡；现在贴的是${names[state.labels[card.id]]}。`:`正在看 ${card.id} 号卡，还没贴标签。`;render();
 });
 for(const [i,card] of CAT_TRAIN.entries())$('cat-compare-'+card.id).addEventListener('click',()=>{
  compared=i;render();
 });
 for(const label of Object.keys(names))$('cat-label-'+label).addEventListener('click',()=>{
  const {id}=CAT_TRAIN[selected],old=state.labels[id],hadResult=Boolean(state.result);
  labelCat(state,id,label);
  if(old!==label)compared=null;
  const next=CAT_TRAIN.findIndex(card=>!state.labels[card.id]);
  if(old===undefined&&next!==-1)selected=next;
  note=hadResult&&old!==label?'标签改了，旧对照已收起。请用这组新标签重新猜、再训练。'
   :`${id} 号卡已贴${names[label]}。${next===-1?'六张都贴好了，可回看，也可以到下方训练。':`现在看 ${CAT_TRAIN[selected].id} 号卡。`}`;
  render();
 });
 for(const choice of trainingChoices)$('cat-train-guess-'+choice).addEventListener('click',()=>{
  guessCatTraining(state,choice);render();
 });
 $('cat-train').addEventListener('click',()=>{
  if(!trainCats(state))return;
  render();$('cat-score').focus();
 });
 for(const choice of testChoices)$('cat-test-guess-'+choice).addEventListener('click',()=>{
  if(!guessCatTest(state,choice))return;
  render();$('cat-test-feedback').focus();
 });
 $('cat-reset').addEventListener('click',()=>{state=makeCatLesson();selected=0;compared=null;note='这道题重置了。自由涂鸦的草稿不变。';render();});
 $('cat-free').addEventListener('click',()=>{if(window.location.hash==='#field')$('guide-open-free')?.click();});
 $('cat-image').addEventListener('error',()=>{set('cat-image-caption',`训练卡 ${CAT_TRAIN[selected].id} · 原画暂时没加载，可用右侧线索继续。`);});
 const route=()=>{if(window.location.hash==='#cat-lesson')disclosure.open=true;};
 window.addEventListener('hashchange',route);
 render();show('cat-unavailable',false);show('cat-lesson-content',true);route();
}

if(typeof document!=='undefined'&&document.getElementById('cat-lesson'))mountCatLesson({document,window});
