import {createGuide} from './neural-guide.mjs';
import {createResidualModel,residualForward,residualMetrics,trainResidual} from './neural-residual-core.mjs';
const PICKS=[2,0,4];
export function createResidualLesson(){
 const models={plain:createResidualModel(false),residual:createResidualModel(true)},points=createGuide().points;
 return {stage:'signal',points,models,baseline:structuredClone(models),skip:false,zeroBranch:true,sawIdentity:false,selected:0,answer:null};
}
export function setResidualShortcut(s,on){
 if(s.stage!=='signal')throw Error('Shortcut is a demo control');if(typeof on!=='boolean')throw Error('Invalid shortcut');
 s.skip=on;if(on&&s.zeroBranch)s.sawIdentity=true;
}
export function setResidualZero(s,on){
 if(s.stage!=='signal')throw Error('Zero branch is a demo control');if(typeof on!=='boolean')throw Error('Invalid branch');
 s.zeroBranch=on;if(on&&s.skip)s.sawIdentity=true;
}
export function selectResidualSignal(s,index){if(!Number.isInteger(index)||index<0||index>=PICKS.length)throw Error('Invalid signal');s.selected=index;}
export function openResidualTraining(s){
 if(s.stage!=='signal'||!s.sawIdentity)throw Error('Witness the shortcut before training');s.stage='learn';s.zeroBranch=false;s.skip=true;
}
export function stepResidualPair(s,count){
 if(s.stage!=='learn')throw Error('Open training first');
 const next=structuredClone(s.models);for(const m of Object.values(next))trainResidual(m,s.points,count);
 s.models=next;s.answer=null;
}
export function answerResidual(s,answer){
 if(s.stage!=='learn'||!s.models.residual.epoch)throw Error('Train before reflecting');
 if(!['carry','perfect'].includes(answer))throw Error('Invalid answer');s.answer=answer;
}
export function resetResidual(s){Object.assign(s,createResidualLesson());}
export function residualEvidence(s){
 const point=s.points[PICKS[s.selected]],m=s.models[s.skip?'residual':'plain'];
 const result={stage:s.stage,steps:s.models.residual.epoch,signalId:String.fromCharCode(65+s.selected),signal:residualForward(m,point.x,point.y,{zeroBranch:s.zeroBranch})};
 for(const name of ['plain','residual'])result[name]={before:residualMetrics(s.baseline[name],s.points),now:residualMetrics(s.models[name],s.points)};
 return result;
}
