import {predict,train} from './neural-core.mjs';
import {CAT_TRAIN,CAT_TEST,makeCatLesson} from './neural-cat-lesson.mjs';

export const COACH_CARD=CAT_TRAIN.find(card=>card.id==='03');
export const COACH_PAIR=CAT_TEST;
const RATE=.15,STEPS=120;
// Hand-assigned lesson inputs; these are not image measurements or an identity lookup.
const EXTRA_TRAIN=[
 ['09','bobby',2,8,2],['10','chouchou',8,2.5,9],
 ['11','bobby',3,6,2],['12','chouchou',7,4,9],
 ['13','bobby',4,5,3],['14','chouchou',7.5,6,8],
 ['15','bobby',5,8,2],['16','chouchou',5.5,3,7],
 ['17','bobby',5,4,3],['18','chouchou',6.2,4.2,9],
 ['19','bobby',6,6.5,4],['20','chouchou',8.8,5,8],
].map(([id,truth,x,y,fluff])=>({id,truth,features:[x,y],image:`./neural-cat-${id}.jpg`,fluff}));
const FLUFF=Object.freeze({'01':2,'02':10,'03':8,'04':3,'05':2,'06':9,'07':2,'08':9});
const scale=score=>(score-5)/5;
const inputsFor=(card,feature)=>feature==='fluff'?[...card.features,card.fluff??FLUFF[card.id]]:[...card.features];
const vector=features=>[...features.map(scale),1];
const linearScore=(weights,input)=>1/(1+Math.exp(-input.reduce((z,value,i)=>z+value*weights[i],0)));

function trainWithAddedFeature(baseline,examples){
 // The same starting rule, now with a zero coefficient for the new input.
 const [cheek,ear,bias]=baseline.weights;
 let weights=[cheek,ear,0,bias];
 for(let step=0;step<STEPS;step++){
  const gradient=[0,0,0,0];
  for(const {input,label} of examples){
   const error=linearScore(weights,input)-label;
   input.forEach((value,i)=>{gradient[i]+=error*value;});
  }
  weights=weights.map((weight,i)=>weight-RATE*gradient[i]/examples.length);
 }
 return {kind:'linear-3d',weights,epoch:STEPS};
}

function estimate(model,features){
 const score=model.kind==='linear-3d'?linearScore(model.weights,vector(features))
  :predict(model,scale(features[0]),scale(features[1]));
 return {prediction:score>=.5?'chouchou':'bobby',score};
}
function readCard(model,card,feature){
 const features=inputsFor(card,feature);
 return {id:card.id,truth:card.truth,features,...estimate(model,features)};
}

export function coachBaseline(){
 return estimate(makeCatLesson().baseline,COACH_CARD.features);
}

export function coachRound(label,mode='first',size=6){
 if(!['bobby','chouchou'].includes(label)||!['first','more','fluff'].includes(mode)||![6,18].includes(size))throw new RangeError('Unknown cat coach trial');
 const feature=mode==='fluff'?'fluff':'ears';
 const baseline=makeCatLesson().baseline;
 let model;
 const reference=size===18?[...CAT_TRAIN,...EXTRA_TRAIN]:CAT_TRAIN;
 const training=reference.map(card=>{
  const tag=card===COACH_CARD?label:card.truth;
  return {input:vector(inputsFor(card,feature)),label:Number(tag==='chouchou')};
 });
 if(feature==='fluff'){
  model=trainWithAddedFeature(baseline,training);
 }else{
  const points=training.map(({input:[x,y],label})=>({x,y,label}));
  model=train({...baseline,weights:[...baseline.weights]},points,RATE,STEPS);
  if(mode==='more')train(model,points,RATE,STEPS);
 }
 const points=reference.map(card=>{
  const result=readCard(model,card,feature);
  return {...result,image:card.image,label:card===COACH_CARD?label:card.truth,
   before:estimate(baseline,result.features).prediction};
 });
 // Both held-out cards are read only after the actual updates finish.
 const test=COACH_PAIR.map(card=>readCard(model,card,feature));
 return {label,mode,feature,size,steps:model.epoch,baseline,model,points,
  beforeMatches:points.filter(point=>point.before===point.label).length,
  trainingMatches:points.filter(point=>point.prediction===point.label).length,
  trainingCard:readCard(model,COACH_CARD,feature),test,
  matches:test.filter(card=>card.prediction===card.truth).length};
}
