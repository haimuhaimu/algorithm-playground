import {routeReturnHref} from './learning-route-return.mjs?v=route-return-v1';
export function mountRouteReturnLinks({document,window}){
 for(const link of document.querySelectorAll('[data-learning-return]')){
  function update(){
   const href=routeReturnHref(window);
   link.setAttribute('href',href||new URL('./#learning-routes',window.location.href).href);
   link.textContent=href?'← 回到刚才的学习路线':'← 回到学习路线';
  }
  update();link.addEventListener('click',update);window.addEventListener?.('pageshow',update);
 }
}
if(typeof document!=='undefined')mountRouteReturnLinks({document,window});
