import {encode,decode} from './pixel-core.mjs?v=recipient-1';

const freeze=Object.freeze;
export function createCodeLesson(pixels){
 if(!Array.isArray(pixels)||pixels.length!==256)throw new TypeError('Expected 256 postcard pixels');
 const {counts}=encode(pixels);
 return freeze({snapshot:freeze([...pixels]),counts:freeze(counts),
  forest:freeze(counts.flatMap((weight,symbol)=>weight?[freeze({id:'c'+symbol,weight,min:symbol,symbol})]:[])),
  steps:freeze([]),past:freeze([])});
}
export function suggestCodePair(state){
 return state.forest.length<2?[]:[...state.forest].sort((a,b)=>a.weight-b.weight||a.min-b.min).slice(0,2).map(n=>n.id);
}
export function mergeCodeGroups(state,ids){
 if(!Array.isArray(ids)||ids.length!==2||ids[0]===ids[1])throw new TypeError('Choose two distinct groups');
 const [left,right]=ids.map(id=>state.forest.find(node=>node.id===id));
 if(!left||!right)throw new TypeError('Unknown or consumed group');
 const node=freeze({id:'n'+state.steps.length,left,right,weight:left.weight+right.weight,min:Math.min(left.min,right.min)});
 return freeze({...state,forest:freeze([...state.forest.filter(n=>!ids.includes(n.id)),node]),
  steps:freeze([...state.steps,node]),past:freeze([...state.past,state.forest])});
}
export function undoCodeMerge(state){
 if(!state.past.length)return state;
 return freeze({...state,forest:state.past.at(-1),steps:freeze(state.steps.slice(0,-1)),past:freeze(state.past.slice(0,-1))});
}

// These local prefixes become complete codes only after all groups share a root.
export function codeGroupCodes(state){
 const codes=[null,null,null,null];
 function visit(node,prefix){
  if(node.symbol!==undefined)codes[node.symbol]=prefix;
  else{visit(node.left,prefix+'0');visit(node.right,prefix+'1');}
 }
 for(const node of state.forest)visit(node,'');
 if(state.forest.length===1&&state.forest[0].symbol!==undefined)codes[state.forest[0].symbol]='0';
 return codes;
}
function packetForTree(state){
 const codes=codeGroupCodes(state);let header='';
 function visit(node){
  if(node.symbol!==undefined)header+='1'+node.symbol.toString(2).padStart(2,'0');
  else{header+='0';visit(node.left);visit(node.right);}
 }
 visit(state.forest[0]);
 const payload=state.snapshot.map(c=>codes[c]).join('');
 const paddingBits=(8-(header.length+payload.length)%8)%8;
 const bits=header+payload+'0'.repeat(paddingBits);
 const packet=Uint8Array.from({length:bits.length/8},(_,i)=>parseInt(bits.slice(i*8,i*8+8),2));
 return {packet,codes,counts:[...state.counts],treeBits:header.length,payloadBits:payload.length,paddingBits};
}
export function codeLessonResult(state){
 if(state.forest.length!==1)return null;
 const user=packetForTree(state),reference=encode(state.snapshot),decoded=decode(user.packet,256);
 return {user,reference,decoded,matches:decoded.filter((c,i)=>c===state.snapshot[i]).length,
  payloadDelta:user.payloadBits-reference.payloadBits,byteDelta:user.packet.length-reference.packet.length};
}
