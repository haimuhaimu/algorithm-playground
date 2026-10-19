export const PLANETS=5;
export const BUDGET=30;

function randomStream(seed){
 let state=seed>>>0;
 return ()=>{
  state=(state+0x6D2B79F5)>>>0;let n=state;
  n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);
  return ((n^(n>>>14))>>>0)/4294967296;
 };
}
export function createWorld(seed){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid seed');
 const random=randomStream(seed),probabilities=[.15,.3,.45,.6,.8];
 for(let i=PLANETS-1;i>0;i--){const j=Math.floor(random()*(i+1));[probabilities[i],probabilities[j]]=[probabilities[j],probabilities[i]];}
 const outcomes=Array.from({length:BUDGET},()=>probabilities.map(p=>Number(random()<p)));
 return {seed,probabilities,outcomes};
}
export function createRecord(){return {counts:Array(PLANETS).fill(0),wins:Array(PLANETS).fill(0),total:0,history:[]};}
export function pull(world,record,arm){
 if(!Number.isInteger(arm)||arm<0||arm>=PLANETS)throw Error('Invalid arm');
 if(record.history.length>=BUDGET)throw Error('Mission complete');
 const reward=world.outcomes[record.history.length][arm];
 const counts=[...record.counts],wins=[...record.wins];counts[arm]++;wins[arm]+=reward;
 return {counts,wins,total:record.total+reward,history:[...record.history,{arm,reward}]};
}
function observations(record){
 return {counts:[...record.counts],wins:[...record.wins],means:record.counts.map((n,i)=>n?record.wins[i]/n:null),totalBefore:record.total};
}
export function chooseDecision(record,strategy,random=Math.random){
 if(!['greedy','epsilon','ucb'].includes(strategy))throw Error('Unknown strategy');
 const evidence=observations(record),empty=()=>Array(PLANETS).fill(null);
 const cold=record.counts.indexOf(0);
 if(cold!==-1)return {...evidence,arm:cold,kind:'initial',bonuses:empty(),scores:empty(),ties:[]};
 if(strategy==='epsilon'&&random()<.2)return {...evidence,arm:Math.floor(random()*PLANETS),kind:'explore',bonuses:empty(),scores:empty(),ties:[]};
 const n=record.counts.reduce((a,b)=>a+b,0);
 const bonuses=record.counts.map(count=>strategy==='ucb'?Math.sqrt(2*Math.log(n)/count):0);
 const scores=evidence.means.map((mean,i)=>mean+bonuses[i]),best=Math.max(...scores);
 const ties=scores.flatMap((score,i)=>score===best?[i]:[]);
 return {...evidence,arm:ties[0],kind:strategy==='ucb'?'ucb':'exploit',bonuses,scores,ties};
}
export function chooseArm(record,strategy,random=Math.random){
 return chooseDecision(record,strategy,random).arm;
}
export function runPolicy(world,strategy){
 return runPolicyTrace(world,strategy).record;
}
export function runPolicyTrace(world,strategy){
 const random=randomStream((world.seed^0x9E3779B9)>>>0),steps=[];let record=createRecord();
 for(let i=0;i<BUDGET;i++){
  const decision=chooseDecision(record,strategy,random);
  record=pull(world,record,decision.arm);
  steps.push({...decision,round:i+1,reward:record.history[i].reward,totalAfter:record.total});
 }
 return {record,steps};
}
export function traceChoices(history){
 const record=createRecord();
 return history.map(({arm,reward},i)=>{
  const evidence=observations(record);record.counts[arm]++;record.wins[arm]+=reward;record.total+=reward;
  return {...evidence,arm,reward,round:i+1,kind:'human',bonuses:Array(PLANETS).fill(null),scores:Array(PLANETS).fill(null),ties:[],totalAfter:record.total};
 });
}
