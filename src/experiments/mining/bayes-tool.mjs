import {createBayesLesson,actBayesLesson,bayesLessonEvidence} from './mining-bayes.mjs?v=bayes-journey-v1';

const BASE='https://haimuhaimu.github.io/algorithm-playground/';
const FIXTURE={id:'two-mining-logs-beta-bernoulli-v1',prior:{distribution:'Beta',alpha:1,beta:1},logs:[{id:'little',successes:3,failures:2},{id:'many',successes:18,failures:12}],newFeedback:{successes:0,failures:1},assumptions:['fixed unknown success probability','conditionally independent Bernoulli observations'],randomness:'none; authored fixed fixture'};
const ACTIONS={guess:['little','many','same'],'change-guess':['little','many','same'],answer:['evidence','never','guarantee'],reveal:null,update:null,reset:null};
const BOUNDARIES=['固定的 Beta–Bernoulli 教学模型，不是自由探矿游戏的真实概率推断。','Beta(1,1) 是共同建模先验，不是实际多挖了两次。','样本比例、后验均值和真实成功率不同；90% 可信区间依赖本课先验与模型假设，不是现实保证。','一次空手反馈更新已有判断，不会抹掉旧观察；有限次空手不能证明成功概率为零。','流程完成或猜对不等于掌握；记录不认证操作者身份，不自动写入学习进度。','只记录本课操作，不读取自由探索、草稿或浏览器存储；主动分享后记录才会离开本页。'];
const GENAI=[{concept:'概率基础',url:'https://haimuhaimu.github.io/genai-learning-os/?page=foundation&node=probability'},{concept:'贝叶斯判断与放量决策',url:'https://haimuhaimu.github.io/genai-learning-os/?page=strategy-case&case=bayes-rollout'}];
const clone=value=>structuredClone(value);
function keys(value,allowed,name){if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.keys(value).some(k=>!allowed.includes(k))||Object.getOwnPropertySymbols(value).length)throw Error('Invalid '+name);}
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
function wire(value){if(typeof value==='number')return Number(value.toPrecision(12));if(Array.isArray(value))return value.map(wire);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='curve').map(([key,item])=>[key,wire(item)]));return value;}
function actionRequest(item){keys(item,['action','value'],'Bayes action');if(typeof item.action!=='string'||!Object.hasOwn(ACTIONS,item.action))throw Error('Unsupported Bayes action');const values=ACTIONS[item.action];if(values===null?Object.hasOwn(item,'value'):!values.includes(item.value))throw Error('Invalid Bayes action value');return values===null?{action:item.action}:{action:item.action,value:item.value};}
function available(state){const out=[{action:'reset'}],add=(action,values)=>out.push(values?{action,values:[...values]}:{action});if(state.phase==='predict'){add('guess',ACTIONS.guess);if(state.guess!==null)add('reveal');}else if(state.phase==='compare'){add('change-guess',ACTIONS['change-guess']);if(state.changeGuess!==null)add('update');}else if(state.phase==='updated')add('answer',ACTIONS.answer);return out;}

export function describeBayesTool(){return clone({id:'bayes-update',title:'同样一条线索，判断怎样更新？',engineVersion:'bayes-update-v1',url:BASE+'mining.html#bayes-lesson',operations:['list','describe','run','replay'],execution:'local-cli-or-library',maxActions:256,input:{actions:'ordered array of {action, value?}',allowedValues:ACTIONS},fixture:FIXTURE,boundaries:BOUNDARIES,genai:GENAI,mastery:'not-assessed',identity:'producer is a declared channel, not an authenticated identity'});}
export function runBayesTool(actions,options={}){
 keys(options,['producer'],'Bayes options');const producer=options.producer??'agent';if(!['agent','browser-session'].includes(producer))throw Error('Invalid producer');
 if(!Array.isArray(actions)||actions.length>256)throw Error('Invalid actions: limit 256');
 const requests=actions.map(actionRequest),steps=[];let state=createBayesLesson();
 for(const request of requests){
  const choice=available(state).find(item=>item.action===request.action&&(!item.values||item.values.includes(request.value)));
  if(!choice){steps.push({status:'rejected',reason:'Action not available in the current phase',stage:state.phase});continue;}
  const before=canonical(state);state=actBayesLesson(state,request.value===undefined?{type:request.action}:{type:request.action,value:request.value});steps.push({status:canonical(state)===before?'no-op':'applied',stage:state.phase});
 }
 return {format:'algorithm-playground/learning-run',schemaVersion:1,experimentId:'bayes-update',engineVersion:'bayes-update-v1',numericFormat:'decimal-12-significant-digits',producer,fixture:clone(FIXTURE),actions:requests,steps,result:{stage:state.phase,workflowComplete:state.phase==='done',mastery:'not-assessed',evidence:wire({...bayesLessonEvidence(state),attempts:state.attempts}),availableActions:available(state)},boundaries:clone(BOUNDARIES),genai:clone(GENAI)};
}
export function replayBayesReceipt(receipt){
 keys(receipt,['format','schemaVersion','experimentId','engineVersion','numericFormat','producer','fixture','actions','steps','result','boundaries','genai'],'Bayes receipt');
 if(receipt.format!=='algorithm-playground/learning-run'||receipt.schemaVersion!==1||receipt.experimentId!=='bayes-update'||receipt.engineVersion!=='bayes-update-v1')throw Error('Unsupported Bayes receipt version');
 const actual=runBayesTool(receipt.actions,{producer:receipt.producer});if(canonical(actual)!==canonical(receipt))throw Error('Receipt mismatch: recomputed Bayes actions and evidence differ');
 return {matches:true,authenticatesUser:false,receipt:actual};
}
