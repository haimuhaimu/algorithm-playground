import {runPixelDecode,pixelPresetForSnapshot} from './pixel-tool.mjs?v=pixel-ai-1';

export function setupPixelToolUI({document,window,getView,pause,available}){
 const $=id=>document.getElementById(id);let generation=0,lastView,lastSent;
 function clear(){
  generation++;$('pixel-ai-text').value='';$('pixel-ai-record').hidden=true;
  if($('pixel-ai-status').textContent)$('pixel-ai-status').textContent='';
 }
 function refresh(){
  const view=getView();if(view===lastView&&view?.sent===lastSent)return;
  const newSource=view!==lastView;lastView=view;lastSent=view?.sent;clear();
  if(newSource){
   const supported=view&&pixelPresetForSnapshot(view.parcel.snapshot);
   $('pixel-ai-generate').disabled=!supported||!available();
   $('pixel-ai-note').textContent=!view?'先寄一封内置图案，再生成记录。'
    :supported?'只记录这封内置图案的解码位置与单步。不会读取自由画纸或草稿，不记录停顿时长、全部鼠标操作。'
    :'这封信是自定义图案，玩法与草稿照常保留；首版不导出它，也不会替换成预设图案。';
  }
 }
 $('pixel-ai-generate').addEventListener('click',()=>{
  if(!available())return;
  const view=getView(),name=view&&pixelPresetForSnapshot(view.parcel.snapshot);
  if(!name)return;
  pause();refresh();
  try{
   const actions=view.aiActions.map(action=>({...action}));
   if(view.sent!==view.aiSent)actions.push({action:'seek',value:view.sent});
   const receipt=runPixelDecode({preset:name,mode:view.replay?'slow-replay':'delivery',actions},{producer:'browser-session'});
   // Compact JSON also keeps maximum supported records within the CLI's 64 KiB input.
   $('pixel-ai-text').value=JSON.stringify(receipt);$('pixel-ai-record').hidden=false;generation++;
   $('pixel-ai-status').textContent=`已暂停并生成：${receipt.result.evidence.sentBits} / ${receipt.result.evidence.totalBits} bit，${receipt.result.evidence.decodedCount} / 256 格。只在本页；复制给外部 AI 后才会离开这里。解码完成不代表已掌握，也不写入 GenAI OS 进度。`;
  }catch{
   clear();$('pixel-ai-status').textContent='这次观察超出记录范围，暂未导出；玩法、画纸和草稿仍保留，没有截断或替造记录。';
  }
 });
 $('pixel-ai-copy').addEventListener('click',async()=>{
  const text=$('pixel-ai-text').value,token=generation;if(!text||!available())return;
  try{
   if(!window.navigator?.clipboard?.writeText)throw Error('Clipboard unavailable');
   await window.navigator.clipboard.writeText(text);
   if(token===generation)$('pixel-ai-status').textContent='已复制。交给你自己的 AI，先用 replay 核验，再解释真实发生的变化；记录不认证操作者身份。';
  }catch{
   if(token!==generation)return;
   $('pixel-ai-text').focus();$('pixel-ai-text').select?.();
   $('pixel-ai-status').textContent='浏览器未允许复制。记录仍在文本框，可手动全选、复制；没有自动发送。';
  }
 });
 clear();refresh();return {refresh};
}
