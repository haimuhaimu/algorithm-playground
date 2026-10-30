import {createLearningRoute,actLearningRoute,learningRouteEvidence} from './learning-route.mjs';

const BASE='https://haimuhaimu.github.io/algorithm-playground/';
const OS='https://haimuhaimu.github.io/genai-learning-os/';
const GENAI=[
 {concept:'数学符号与学习基础',url:OS+'?page=math-primer'},
 {concept:'梯度下降',url:OS+'?page=foundation&node=gradient-descent'},
 {concept:'残差与 Transformer Block（进阶）',url:OS+'?page=foundation&node=transformer-block'}
];
const EXPERIMENTS=[
 ['recommendation','推荐系统','推荐与逐席排序','recommendation.html#seat-lesson'],
 ['pathfinding','寻路竞技场','BFS / A* 与搜索顺序','pathfinding.html#arena'],
 ['sand','落沙实验室','细胞自动机与局部更新','sand.html#grain-lab'],
 ['firefly','萤火虫合奏','相位耦合与局部/整体同步','firefly.html#fireflies'],
 ['evolution','遗传赛车','选择、交叉、变异与重新评分','evolution.html#roadblock-lab'],
 ['neural','涂鸦训练场','分类、梯度、残差与新题评估','neural.html#first-lesson'],
 ['mining','盲盒探矿','探索与利用、样本与反馈','mining.html#shared-title'],
 ['pixel','像素邮局','前缀码与无损压缩','pixel.html#code-start'],
 ['world-model','脑内预演室','模型学习、预测与规划的区别','world-model.html#planning-lab'],
 ['rsi','AI 创作室','有限规则改进与验证，不是通用 RSI','rsi.html#workshop']
].map(([id,title,concept,path])=>({id,title,concept,url:BASE+path,execution:'browser-only'}));
const BOUNDARIES=[
 '固定合成教学案例，不是图像识别或生产模型性能。',
 '分类、一步更新和新题检验使用独立模型；测试站固定以步长 0.15 训练 120 步，不继承梯度站的步长。',
 '16 个新位置是固定网格，不是现实准确率估计；揭晓或选择新题不会训练模型。',
 '完成流程、猜对一次与掌握概念不同；本记录不认证操作者身份，也不写入 GenAI OS 进度。',
 '记录只含这条固定路线的操作与计算；未读取自由画布、草稿或浏览器存储。主动复制给外部 AI 后，记录将离开本页。'
];
const FIXTURE={id:'six-spatial-points-v1',randomness:'none; authored fixed fixture',trainingExamples:6,initialWeights:[1,-1,0],heldOutGrid:16};
const ACTIONS={
 train:null,probe:null,next:null,back:null,step:null,retry:null,reset:null,
 guess:[0,1,'points','parameters','all','not-all'],
 explain:['memorize','parameters','points','practice','unseen'],rate:[.03,.15,.6],inspect:[2,5],point:Array.from({length:16},(_,i)=>i)
};
const clone=value=>structuredClone(value);
function record(value,name){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Invalid '+name);
}
function keys(value,allowed,name){
 record(value,name);
 if(Object.keys(value).some(k=>!allowed.includes(k))||Object.getOwnPropertySymbols(value).length)throw Error('Unknown field in '+name);
}
function actionRequest(item){
 keys(item,['action','value'],'action');
 if(typeof item.action!=='string'||!Object.hasOwn(ACTIONS,item.action))throw Error('Unsupported action');
 const choices=ACTIONS[item.action];
 if(choices===null?Object.hasOwn(item,'value'):!choices.includes(item.value))throw Error('Invalid action value');
 return choices===null?{action:item.action}:{action:item.action,value:item.value};
}
function available(s){
 const out=[{action:'reset'}],add=(action,values)=>out.push(values?{action,values:[...values]}:{action});
 const e=learningRouteEvidence(s);if(e.index>0)add('back');if(e.canAdvance)add('next');
 if(s.stage==='classify'){
  if(['intro','trained'].includes(s.guide.phase))add('inspect',[2,5]);
  if(s.guide.phase==='intro')add('train');
  if(s.guide.phase==='trained')add('probe');
  if(s.guide.phase==='test')add('guess',[0,1]);
  if(['reveal','reflect'].includes(s.guide.phase))add('explain',['memorize','parameters']);
 }else if(s.stage==='gradient'){
  add('inspect',[2,5]);add('retry');
  if(!s.gradient.model.epoch){add('rate',[.03,.15,.6]);add('guess',['points','parameters']);if(s.stepGuess!==null)add('step');}
  else add('explain',['points','parameters']);
 }else if(s.stage==='test'){
  if(s.test.phase==='intro')add('train');
  if(s.test.phase==='guess')add('guess',['all','not-all']);
  if(['reveal','done'].includes(s.test.phase))add('point',ACTIONS.point);
  if(s.test.phase==='reveal')add('explain',['practice','unseen']);
 }
 return out;
}
function evidence(s){
 const e=learningRouteEvidence(s);
 e.guide.reflection=s.guide.reflection;e.gradient.answer=s.gradient.answer;e.test.guess=s.test.guess;e.test.answer=s.test.answer;
 return e;
}
function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
// Math.exp may differ by one ULP across JS runtimes. Normalize only the
// interchange evidence, never the model or its class/score decisions.
function wireEvidence(value){
 if(typeof value==='number')return Number(value.toPrecision(12));
 if(Array.isArray(value))return value.map(wireEvidence);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,wireEvidence(item)]));
 return value;
}
export function listLearningTools(){
 return clone({schemaVersion:1,experiments:EXPERIMENTS,runnables:[{id:'learning-route',title:'AI 怎么从例子里学会？',transport:'local-cli-or-library',url:BASE+'learn.html#route-task'}]});
}
export function describeLearningTool(id){
 if(id!=='learning-route'){
  const experiment=EXPERIMENTS.find(e=>e.id===id);if(!experiment)throw Error('Unknown learning tool');return clone(experiment);
 }
 return clone({id,title:'AI 怎么从例子里学会？',engineVersion:'learning-route-v1',url:BASE+'learn.html#route-task',
  operations:['list','describe','run','replay'],execution:'local-cli-or-library',maxActions:256,fixture:FIXTURE,
  input:{actions:'ordered array of {action, value?}',allowedValues:ACTIONS},genai:GENAI,boundaries:BOUNDARIES,
  genaiIntegration:{mode:'concept-links-and-explicit-receipt',importsProgress:false,importsReceipt:false},
  identity:'producer describes the channel, not an authenticated human or agent',mastery:'not-assessed'});
}
export function runLearningRoute(actions,options={}){
 keys(options,['producer'],'options');const producer=options.producer??'agent';
 if(!['agent','browser-session'].includes(producer))throw Error('Invalid producer');
 if(!Array.isArray(actions)||actions.length>256)throw Error('Invalid actions: limit 256');
 const requests=actions.map(actionRequest),s=createLearningRoute(),steps=[];
 for(const request of requests){
  const choice=available(s).find(a=>a.action===request.action&&(!a.values||a.values.includes(request.value)));
  if(!choice){steps.push({status:'rejected',reason:'Action not available in the current phase',stage:s.stage});continue;}
  const before=canonical(s);actLearningRoute(s,request.action,request.value);
  steps.push({status:before===canonical(s)?'no-op':'applied',stage:s.stage});
 }
 return {format:'algorithm-playground/learning-run',schemaVersion:1,experimentId:'learning-route',engineVersion:'learning-route-v1',numericFormat:'decimal-12-significant-digits',producer,
  fixture:clone(FIXTURE),actions:requests,steps,result:{stage:s.stage,workflowComplete:s.stage==='summary',mastery:'not-assessed',evidence:wireEvidence(evidence(s)),availableActions:available(s)},
  boundaries:clone(BOUNDARIES),genai:clone(GENAI)};
}
export function replayLearningReceipt(receipt){
 keys(receipt,['format','schemaVersion','experimentId','engineVersion','numericFormat','producer','fixture','actions','steps','result','boundaries','genai'],'receipt');
 if(receipt.format!=='algorithm-playground/learning-run'||receipt.schemaVersion!==1||receipt.experimentId!=='learning-route'||receipt.engineVersion!=='learning-route-v1')throw Error('Unsupported receipt version');
 const actual=runLearningRoute(receipt.actions,{producer:receipt.producer});
 if(canonical(actual)!==canonical(receipt))throw Error('Receipt mismatch: recomputed actions and evidence differ');
 return {matches:true,authenticatesUser:false,receipt:actual};
}
