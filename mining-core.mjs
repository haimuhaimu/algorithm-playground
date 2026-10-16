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
export function chooseArm(record,strategy,random=Math.random){
 if(!['greedy','epsilon','ucb'].includes(strategy))throw Error('Unknown strategy');
 const cold=record.counts.indexOf(0);if(cold!==-1)return cold;
 if(strategy==='epsilon'&&random()<.2)return Math.floor(random()*PLANETS);
 const n=record.counts.reduce((a,b)=>a+b,0);
 const scores=record.counts.map((count,i)=>record.wins[i]/count+(strategy==='ucb'?Math.sqrt(2*Math.log(n)/count):0));
 return scores.indexOf(Math.max(...scores));
}
export function runPolicy(world,strategy){
 const random=randomStream((world.seed^0x9E3779B9)>>>0);let record=createRecord();
 for(let i=0;i<BUDGET;i++)record=pull(world,record,chooseArm(record,strategy,random));
 return record;
}
