import {COACH_CARD,COACH_PAIR,coachBaseline,coachRound} from './neural-cat-coach.mjs';

const names={bobby:'波比',chouchou:'臭臭'};
const labels=['chouchou','bobby'];
const size=18;

export function mountCatQuick({document}){
 const $=id=>document.getElementById('cat-quick'+(id?'-'+id:''));
 const text=(id,value)=>{$(id).textContent=value;};
 const visible=(id,value)=>{$(id).hidden=!value;};
 const pressed=(id,value)=>$(id).setAttribute('aria-pressed',String(value));
 let stage='teach',added=false,training=null;
 text('before',names[coachBaseline().prediction]);
 for(const card of [COACH_CARD,...COACH_PAIR])$('image-'+card.id).setAttribute('src',card.image);

 function showStage(next,focus=false){
  stage=next;
  visible('teach',stage==='teach');
  visible('test',stage==='test');
  text('step',stage==='teach'?'1 / 2 · 教它一次':'2 / 2 · 考它一次');
  if(focus)$(stage+'-title').focus();
 }

 function teach(){
  for(const label of labels)pressed('tag-'+label,training?.label===label);
  const feedback=training
   ?`你教它：${names[training.label]}。练完后，模型把这张练习卡判成${names[training.trainingCard.prediction]}。`
   :'';
  text('feedback',feedback);
  text('status',feedback);
  for(const part of ['feedback','next','reset'])visible(part,Boolean(training));
 }

 function testCards(){
  const result=added?coachRound(training.label,'fluff',size):training;
  pressed('clue-toggle',added);
  text('clue-toggle',added?'− 撤掉蓬松度':'+ 加上蓬松度');
  for(const card of result.test){
   const right=card.prediction===card.truth;
   const [cheek,ear,fluff]=card.features;
   text('input-'+card.id,`脸颊 ${cheek} · 耳尖 ${ear}`);
   text('fluff-'+card.id,added?`蓬松 ${fluff}`:'');
   visible('fluff-'+card.id,added);
   text('call-'+card.id,`模型猜${names[card.prediction]} · ${right?'猜对':'猜错'}`);
   $('call-'+card.id).setAttribute('data-correct',String(right));
  }
  const [a,b]=result.test;
  text('test-hint',added?'脸颊、耳尖照旧，加上蓬松度重新练。':'先只看脸颊和耳尖，试着多给一条线索。');
  const note=added
   ?`蓬松度一个 ${a.features[2]}、一个 ${b.features[2]}，${result.matches===2?'这次分对了两张。':a.prediction===b.prediction?'这次还是给了同一个名字。':'这次分开了，但没都分对。'}`
   :'两张卡给的是同一组分数，模型给了同一个答案。';
  text('note',note);
  text('status',result.test.map(card=>`${names[card.truth]}：${$('call-'+card.id).textContent}`).join('。')+'。'+note);
 }

 for(const label of labels)$('tag-'+label).addEventListener('click',()=>{
  if(stage!=='teach'||training?.label===label)return;
  training=coachRound(label,'first',size);
  added=false;
  teach();
 });
 $('next').addEventListener('click',()=>{
  if(stage!=='teach'||!training)return;
  testCards();
  showStage('test',true);
 });
 $('clue-toggle').addEventListener('click',()=>{
  if(stage!=='test')return;
  added=!added;
  testCards();
 });
 $('back').addEventListener('click',()=>showStage('teach',true));
 $('reset').addEventListener('click',()=>{
  training=null;
  added=false;
  teach();
  showStage('teach',true);
 });
 teach();
 showStage('teach');
 visible('',true);
}

if(typeof document!=='undefined'&&document.getElementById('cat-quick'))mountCatQuick({document});
