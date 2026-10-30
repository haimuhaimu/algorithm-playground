import {listLearningTools,describeLearningTool,runLearningRoute,replayLearningReceipt} from '../learning-tool.mjs';

async function input(){
 const chunks=[];let bytes=0;
 for await(const chunk of process.stdin){
  bytes+=chunk.length;if(bytes>65536)throw Error('Input exceeds 64 KiB limit');chunks.push(chunk);
 }
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Invalid JSON request');}
}
try{
 const [command,...args]=process.argv.slice(2);let data;
 if(command==='describe'&&args.length===1)data=describeLearningTool(args[0]);
 else if(args.length)throw Error('Unexpected command arguments');
 else if(command==='list')data=listLearningTools();
 else if(command==='run'){
  const request=await input();
  if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(k=>k!=='actions'))throw Error('Invalid run request: only actions are accepted');
  data=runLearningRoute(request.actions,{producer:'agent'});
 }else if(command==='replay')data=replayLearningReceipt(await input());
 else throw Error('Unsupported operation; use list, describe learning-route, run or replay');
 process.stdout.write(JSON.stringify({ok:true,data})+'\n');
}catch(error){
 process.stdout.write(JSON.stringify({ok:false,error:error instanceof Error?error.message:'Tool request failed'})+'\n');process.exitCode=1;
}
