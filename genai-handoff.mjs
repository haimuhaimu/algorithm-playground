import {replayLearningReceipt} from './learning-tool.mjs?v=agent-frames-v1';

const JOURNEY='model-learning';
const BAYES='bayes-learning';
const ROUTES={
 [JOURNEY]:{section:'journey',experiment:'learning-route',engine:'learning-route-v1',stage:'summary'},
 [BAYES]:{section:'bayes-journey',experiment:'bayes-update',engine:'bayes-update-v1',stage:'done'},
 'agent-learning':{section:'agent-journey',experiment:'agent-tool-loop',engine:'agent-tool-loop-v1',stage:'done'},
 'agent-reroute':{section:'agent-reroute-journey',experiment:'agent-reroute',engine:'agent-reroute-v1',stage:'done'},
 'agent-frames':{section:'agent-frames-journey',experiment:'agent-frames',engine:'agent-frames-v1',stage:'done'}
};
const FORMAT='genai-learning-os/playground-handoff';
const MAX_BYTES=65536;
const REQUEST=/^[A-Za-z0-9_-]{16,80}$/;

function destination(value,journeyId=JOURNEY){
 try{
  if(!Object.hasOwn(ROUTES,journeyId))return null;
  const url=new URL(value);
  if(url.username||url.password)return null;
  const published=url.protocol==='https:'&&url.hostname==='haimuhaimu.github.io'&&!url.port&&url.pathname==='/genai-learning-os/';
  const preview=url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&Number(url.port)>=1024&&Number(url.port)<=65535&&url.pathname==='/';
  if(!published&&!preview)return null;
  url.search='?page=routes&section='+ROUTES[journeyId].section;url.hash='';return url.href;
 }catch{return null;}
}

export function readGenaiHandoffContext(location){
 try{
  const url=new URL(typeof location==='string'?location:location.href),params=url.searchParams;
  if(['genaiReturn','genaiRequest','genaiJourney'].some(key=>params.getAll(key).length!==1))return null;
  const requestId=params.get('genaiRequest'),journeyId=params.get('genaiJourney'),returnURL=destination(params.get('genaiReturn'),journeyId);
  return REQUEST.test(requestId??'')&&returnURL?{journeyId,requestId,returnURL}:null;
 }catch{return null;}
}

export function createGenaiReturnUrl(context,receipt){
 if(!context||!Object.hasOwn(ROUTES,context.journeyId)||typeof context.requestId!=='string'||!REQUEST.test(context.requestId)||destination(context.returnURL,context.journeyId)!==context.returnURL)throw Error('Invalid GenAI return context or target');
 const route=ROUTES[context.journeyId];
 if(receipt?.experimentId!==route.experiment||receipt?.engineVersion!==route.engine)throw Error('Unsupported learning experiment or version');
 if(receipt.result?.workflowComplete!==true||receipt.result?.stage!==route.stage)throw Error('Learning route must be complete before returning');
 const envelope={format:FORMAT,schemaVersion:1,journeyId:context.journeyId,requestId:context.requestId,receipt};
 const bytes=new TextEncoder().encode(JSON.stringify(envelope));
 if(bytes.length>MAX_BYTES)throw Error('Learning return exceeds the 65536 byte size limit');
 // Recompute the current journal's result rather than trusting a completion flag.
 replayLearningReceipt(receipt);
 let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 const encoded=btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 return context.returnURL+'#playground='+encoded;
}
