// One explicit round trip, not a permanent completion record or a draft store.
const KEY='algorithm-playground:route-return:v1',PARAM='route_resume',LIMIT=32768;
const tokenPattern=/^[a-zA-Z0-9-]{8,80}$/;
function sourceUrl(value,current){
 const url=new URL(value),expected=new URL('./learn.html',current);
 if(!['http:','https:'].includes(url.protocol)||url.origin!==expected.origin||url.pathname!==expected.pathname||url.username||url.password||url.href.length>8192)throw Error('Invalid route source');
 url.searchParams.delete(PARAM);return url;
}
function read(window){
 const current=new URL(window.location.href),token=current.searchParams.get(PARAM);
 if(!tokenPattern.test(token||''))return null;
 const raw=window.sessionStorage.getItem(KEY);if(!raw||raw.length>LIMIT)return null;
 const s=JSON.parse(raw);
 if(s?.format!=='algorithm-playground/route-return'||s.schemaVersion!==1||s.engineVersion!=='learning-route-v1'||s.token!==token||!Array.isArray(s.actions)||s.actions.length>256||typeof s.before!=='boolean'||typeof s.exported!=='boolean')return null;
 return {...s,source:sourceUrl(s.source,current).href};
}
export function saveRouteReturn(window,{actions,before,exported},validateActions){
 let written=false;
 try{
  const source=sourceUrl(window.location.href,window.location.href);
  if(!Array.isArray(actions)||actions.length>256||typeof before!=='boolean'||typeof exported!=='boolean'||typeof validateActions!=='function')return null;
  validateActions(actions);
  const token=window.crypto.randomUUID();if(!tokenPattern.test(token))return null;
  const raw=JSON.stringify({format:'algorithm-playground/route-return',schemaVersion:1,engineVersion:'learning-route-v1',token,source:source.href,actions,before,exported});
  if(raw.length>LIMIT)return null;
  const back=new URL(source);back.searchParams.set(PARAM,token);
  const experiment=new URL('./neural.html',source);experiment.searchParams.set(PARAM,token);experiment.hash='field';
  window.sessionStorage.setItem(KEY,raw);written=true;
  window.history.replaceState(window.history.state,'',back.href);
  return {experimentUrl:experiment.href,returnUrl:back.href};
 }catch{
  if(written)try{window.sessionStorage.removeItem(KEY);}catch{}
  return null;
 }
}
export function routeReturnHref(window){
 try{const s=read(window);if(!s)return null;const url=new URL(s.source);url.searchParams.set(PARAM,s.token);return url.href;}catch{return null;}
}
export function consumeRouteReturn(window,validateActions){
 try{
  const s=read(window);if(!s||typeof validateActions!=='function')return null;
  validateActions(s.actions);
  // Preserve the existing history state and source context; a refresh starts anew.
  try{window.history.replaceState(window.history.state,'',s.source);}catch{}
  try{window.sessionStorage.removeItem(KEY);}catch{}
  return {actions:s.actions,before:s.before,exported:s.exported};
 }catch{return null;}
}
