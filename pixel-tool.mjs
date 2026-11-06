import {encode,preset,EDITOR_POSTCARD_PRESETS} from './pixel-core.mjs?v=studio-postcards-v2';
import {createDelivery,deliveryAt} from './pixel-delivery.mjs?v=delivery-1';

const LEGACY_PRESETS=['chouchou','cat'];
const PRESETS=[...EDITOR_POSTCARD_PRESETS,...LEGACY_PRESETS];
const MODES=['delivery','slow-replay'];
const GENAI=[{concept:'熵与信息量',url:'https://haimuhaimu.github.io/genai-learning-os/?page=strategy-case&case=entropy-kl-tradeoff'}];
// Earlier receipts include these exact strings in their replay contract.
const HISTORICAL_BOUNDARIES=[
 '只运行四个固定内置图案，不读取或导出自由画纸、草稿、浏览器存储。',
 'seek 是明确的快进/回退位置，不证明中间的位被逐位阅读；slow-replay 的初始前缀也被快进。',
 '这是正常字节解析器的同一轨迹，不是 PNG/JPEG 文件大小或网络传输、算法性能基准。',
 '工具不修改网页的成功来信或草稿；packetComplete 只说明字节包读完，不是一次邮递操作。',
 '完成、猜测和掌握不同；producer 只标记渠道，不认证身份，不导入 GenAI OS 进度。',
 '记录仅在主动生成时产生；没有自动上传或复制。交给外部 AI 后，记录离开本页。'
];
const CHOUCHOU_BOUNDARIES=[
 '只运行编辑器的四个固定图案，以及为兼容旧收据保留的旧版小猫。不读取或导出自由画纸、草稿、浏览器存储。',
 ...HISTORICAL_BOUNDARIES.slice(1)
];
const STUDIO_V1_BOUNDARIES=[
 '只运行编辑器的五个固定图案，以及为兼容旧收据保留的两张旧版猫图。不读取或导出自由画纸、草稿、浏览器存储。',
 ...HISTORICAL_BOUNDARIES.slice(1)
];
const CURRENT_BOUNDARIES=[
 '只运行编辑器的六个固定图案，以及为兼容旧收据保留的两张旧版猫图。不读取或导出自由画纸、草稿、浏览器存储。',
 ...HISTORICAL_BOUNDARIES.slice(1)
];
const BOUNDARIES_BY_PRESET={heim:STUDIO_V1_BOUNDARIES,bobby:STUDIO_V1_BOUNDARIES,chouchou:CHOUCHOU_BOUNDARIES,'chouchou-studio':CURRENT_BOUNDARIES};
const clone=x=>structuredClone(x);
function keys(value,allowed,name){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Invalid '+name);
 if(Reflect.ownKeys(value).some(k=>typeof k!=='string'||!allowed.includes(k)))throw Error('Unknown field in '+name);
}
function canonical(x){
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 return JSON.stringify(x);
}
export function pixelPresetForSnapshot(pixels){
 if(!Array.isArray(pixels)||pixels.length!==256)return null;
 return PRESETS.find(name=>preset(name).every((color,i)=>pixels[i]===color))??null;
}
export function describePixelDecode(){
 return clone({id:'pixel-decode',title:'像素邮局：真实解码轨迹',engineVersion:'pixel-decode-v1',numericFormat:'integer-bits',
  url:'https://haimuhaimu.github.io/algorithm-playground/pixel.html#pixel-delivery-entry',execution:'local-cli-or-library',operations:['list','describe','run','replay'],maxActions:600,inputLimitBytes:65536,
  input:{preset:PRESETS,mode:MODES,defaultMode:'delivery',actions:{read:{value:'integer 1..528; capped at remaining bits'},seek:{value:'integer 0..528; rejected if beyond this packet'},reset:{value:'omit'}}},
  presetGroups:{editor:EDITOR_POSTCARD_PRESETS,legacy:LEGACY_PRESETS},
  steps:{format:['status','sentBits','decodedCount','reason?'],statuses:['applied','no-op','rejected']},
  boundaries:CURRENT_BOUNDARIES,genai:GENAI,identity:'channel-only; not authenticated',mastery:'not-assessed'});
}
export function runPixelDecode(request,options={}){
 keys(request,['preset','mode','actions'],'pixel request');keys(options,['producer'],'options');
 const {preset:name,actions}=request,mode=request.mode??'delivery',producer=options.producer??'agent';
 if(!PRESETS.includes(name)||!MODES.includes(mode))throw Error('Invalid pixel preset or mode');
 if(!['agent','browser-session'].includes(producer))throw Error('Invalid producer');
 if(!Array.isArray(actions)||actions.length>600)throw Error('Invalid actions: limit 600');
 const requests=Array.from(actions,item=>{
  keys(item,['action','value'],'action');
  if(!['read','seek','reset'].includes(item.action))throw Error('Unsupported pixel action');
  if(item.action==='reset'){
   if(Object.hasOwn(item,'value'))throw Error('Invalid reset value');return {action:'reset'};
  }
  if(!Number.isInteger(item.value)||item.value<(item.action==='read'?1:0)||item.value>528)throw Error('Invalid pixel action value');
  return {action:item.action,value:item.value};
 });
 const encoded=encode(preset(name)),trace=createDelivery(encoded.packet,256);
 const sample=trace.entries.find(e=>e.color!==trace.pixels[0]&&e.code.length>1)??trace.entries[0];
 const start=mode==='slow-replay'?sample.startBit:0;
 const initial=deliveryAt(trace,start);let sent=start;const steps=[];
 for(const action of requests){
  const before=sent;
  if(action.action==='seek'&&action.value>trace.bits.length){steps.push(['rejected',sent,deliveryAt(trace,sent).decoded,'past-packet-end']);continue;}
  sent=action.action==='reset'?start:action.action==='read'?Math.min(trace.bits.length,sent+action.value):action.value;
  steps.push([before===sent?'no-op':'applied',sent,deliveryAt(trace,sent).decoded]);
 }
 const state=deliveryAt(trace,sent);
 // Match the webpage's explicitly selected target at the slow replay's entry.
 const target=mode==='slow-replay'&&sent===sample.startBit?sample:state.focus;
 const focus=target?{...target,row:Math.floor(target.index/16)+1,column:target.index%16+1,ready:sent>=target.endBit}:null;
 const prefix=target?trace.bits.slice(target.startBit,Math.min(sent,target.endBit)):'';
 const receipt={format:'algorithm-playground/learning-run',schemaVersion:1,experimentId:'pixel-decode',engineVersion:'pixel-decode-v1',numericFormat:'integer-bits',producer,
  fixture:{id:'pixel-'+name+'-v1',preset:name,pixelCount:256,protocol:'four-color-huffman-v1'},input:{preset:name,mode},
  initialCursor:{sentBits:start,skippedPixels:initial.decoded,reason:start?'disclosed-prefix-skip':'packet-start'},actions:requests,
  stepFormat:['status','sentBits','decodedCount','reason?'],steps,
  result:{packetComplete:state.complete,allPixelsDecoded:state.decoded===256,postalDelivery:'not-performed-by-tool',mastery:'not-assessed',
   evidence:{sentBits:sent,decodedCount:state.decoded,phase:state.phase,prefix,focus,pixels:state.pixels,
    decodedEntries:trace.entries.slice(0,state.decoded).map(e=>({...e})),packetBytes:encoded.packet.length,totalBits:trace.bits.length,
    treeBits:trace.treeBits,payloadEnd:trace.payloadEnd,payloadBits:encoded.payloadBits,paddingBits:encoded.paddingBits,codes:[...encoded.codes]},
   availableActions:[{action:'read',min:1,max:528},{action:'seek',min:0,max:trace.bits.length},{action:'reset'}]},
  boundaries:clone(BOUNDARIES_BY_PRESET[name]??HISTORICAL_BOUNDARIES),genai:clone(GENAI)};
 if(new TextEncoder().encode(JSON.stringify(receipt)).length>65536)throw Error('Receipt exceeds 64 KiB replay limit');
 return receipt;
}
export function replayPixelReceipt(receipt){
 keys(receipt,['format','schemaVersion','experimentId','engineVersion','numericFormat','producer','fixture','input','initialCursor','actions','stepFormat','steps','result','boundaries','genai'],'receipt');
 if(receipt.format!=='algorithm-playground/learning-run'||receipt.schemaVersion!==1||receipt.experimentId!=='pixel-decode'||receipt.engineVersion!=='pixel-decode-v1')throw Error('Unsupported receipt version');
 keys(receipt.input,['preset','mode'],'receipt input');
 const actual=runPixelDecode({...receipt.input,actions:receipt.actions},{producer:receipt.producer});
 if(canonical(actual)!==canonical(receipt))throw Error('Receipt mismatch: recomputed pixel actions and evidence differ');
 return {matches:true,authenticatesUser:false,receipt:actual};
}
