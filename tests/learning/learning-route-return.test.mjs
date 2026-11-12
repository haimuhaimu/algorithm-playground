import test from 'node:test';
import assert from 'node:assert/strict';
import {runLearningRoute} from '../../dist/learning-tool.mjs';
const api=await import('../../dist/learning-route-return.mjs').catch(()=>({}));
const ui=await import('../../dist/learning-route-return-ui.mjs').catch(()=>({}));
const key='algorithm-playground:route-return:v1';
const actions=[{action:'train'},{action:'probe'},{action:'guess',value:0},{action:'explain',value:'parameters'},{action:'next'},
 {action:'rate',value:.03},{action:'guess',value:'points'},{action:'step'},{action:'retry'},{action:'rate',value:.6},{action:'guess',value:'parameters'},{action:'step'},{action:'explain',value:'parameters'},{action:'next'},
 {action:'train'},{action:'guess',value:'all'},{action:'explain',value:'unseen'},{action:'next'}];
const validate=journal=>runLearningRoute(journal,{producer:'browser-session'});
function setup(href='https://haimuhaimu.github.io/algorithm-playground/learn.html?source=genai#route-task'){
 assert.equal(typeof api.saveRouteReturn,'function','the route needs a bounded same-tab return checkpoint');
 const values=new Map([['unrelated-record','keep']]);let n=0;
 const w={location:new URL(href),crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`},sessionStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 w.history={state:{unrelated:'keep'},replaceState(state,_,url){this.state=state;w.location=new URL(url,w.location);}};
 Object.defineProperty(w,'localStorage',{get(){throw Error('must not read or write permanent drafts');}});
 return {w,values};
}
test('a one-use return replays real actions and keeps source context out of the experiment URL',()=>{
 const {w,values}=setup();const saved=api.saveRouteReturn(w,{actions,before:false,exported:true},validate);
 assert.ok(saved);assert.match(w.location.search,/route_resume=/);assert.equal(w.history.state.unrelated,'keep');
 const experiment=new URL(saved.experimentUrl);assert.equal(experiment.pathname,'/algorithm-playground/neural.html');assert.equal(experiment.hash,'#field');
 assert.deepEqual([...experiment.searchParams.keys()],['route_resume']);assert.ok(!saved.experimentUrl.includes('actions'));
 w.location=experiment;assert.equal(api.routeReturnHref(w),saved.returnUrl);
 w.location=new URL(saved.returnUrl);const restored=api.consumeRouteReturn(w,validate);
 assert.deepEqual(restored.actions,actions);assert.equal(restored.exported,true);
 const result=validate(restored.actions);assert.equal(result.result.workflowComplete,true);assert.equal(result.result.mastery,'not-assessed');assert.equal(result.result.evidence.test.test.correct,13);
 assert.equal(w.location.search,'?source=genai');assert.equal(w.location.hash,'#route-task');
 assert.equal(values.has(key),false);assert.equal(values.get('unrelated-record'),'keep');
 assert.equal(api.consumeRouteReturn(w,validate),null,'a refresh must not restore again');
});
test('an unfinished lesson remains unfinished and a plain entry cannot consume a pending return',()=>{
 const {w,values}=setup();const saved=api.saveRouteReturn(w,{actions:[{action:'train'}],before:true,exported:false},validate);
 w.location=new URL('https://haimuhaimu.github.io/algorithm-playground/learn.html');
 assert.equal(api.consumeRouteReturn(w,validate),null);assert.ok(values.has(key));
 w.location=new URL(saved.returnUrl);const restored=api.consumeRouteReturn(w,validate);
 assert.equal(validate(restored.actions).result.workflowComplete,false);assert.equal(restored.before,true);assert.equal(restored.exported,false);
});
test('foreign source URLs, mismatched tokens and invalid action values cannot restore or redirect',()=>{
 for(const mutate of [s=>{s.source='https://evil.example/learn.html';},s=>{s.source='https://haimuhaimu.github.io/another/learn.html';},s=>{s.actions=[{action:'rate',value:999}];},s=>{s.engineVersion='future-engine';}]){
  const {w,values}=setup();const saved=api.saveRouteReturn(w,{actions,before:false,exported:true},validate);const state=JSON.parse(values.get(key));mutate(state);values.set(key,JSON.stringify(state));
  w.location=new URL(saved.experimentUrl);if(!state.source.includes('/algorithm-playground/learn.html'))assert.equal(api.routeReturnHref(w),null);
  w.location=new URL(saved.returnUrl);assert.equal(api.consumeRouteReturn(w,validate),null);assert.equal(values.get('unrelated-record'),'keep');
 }
 const {w,values}=setup();const saved=api.saveRouteReturn(w,{actions,before:false,exported:true},validate);
 w.location=new URL(saved.returnUrl);w.location.searchParams.set('route_resume','wrong-token');assert.equal(api.consumeRouteReturn(w,validate),null);assert.ok(values.has(key));
});
test('oversized journals and failing browser storage leave the current lesson URL and unrelated data intact',()=>{
 const {w,values}=setup();const original=w.location.href;
 assert.equal(api.saveRouteReturn(w,{actions:Array(257).fill({action:'train'}),before:false,exported:false},validate),null);
 assert.equal(w.location.href,original);assert.equal(values.has(key),false);
 w.sessionStorage.setItem=()=>{throw Error('Quota exceeded');};
 assert.equal(api.saveRouteReturn(w,{actions,before:false,exported:true},validate),null);assert.equal(w.location.href,original);assert.equal(values.get('unrelated-record'),'keep');
});
test('a direct experiment entry and a corrupt pending record do not invent a return destination',()=>{
 const {w,values}=setup('http://127.0.0.1:60064/neural.html#cat-lesson');assert.equal(api.routeReturnHref(w),null);
 values.set(key,'broken');w.location.searchParams.set('route_resume','00000000-0000-4000-8000-000000000001');assert.equal(api.routeReturnHref(w),null);
});
test('failure to remove a verified checkpoint cannot throw away its recovered lesson',()=>{
 const {w}=setup();const saved=api.saveRouteReturn(w,{actions,before:false,exported:true},validate);
 w.location=new URL(saved.returnUrl);w.sessionStorage.removeItem=()=>{throw Error('Storage became unavailable');};
 const restored=api.consumeRouteReturn(w,validate);assert.ok(restored);assert.deepEqual(restored.actions,actions);
 assert.equal(w.location.searchParams.has('route_resume'),false);assert.equal(api.consumeRouteReturn(w,validate),null);
});
test('history cleanup failure still returns verified work and consumes the temporary record',()=>{
 const {w,values}=setup();const saved=api.saveRouteReturn(w,{actions,before:false,exported:true},validate);
 w.location=new URL(saved.returnUrl);w.history.replaceState=()=>{throw Error('History unavailable');};
 const restored=api.consumeRouteReturn(w,validate);assert.ok(restored);assert.deepEqual(restored.actions,actions);assert.equal(values.has(key),false);
 assert.equal(api.consumeRouteReturn(w,validate),null,'a leftover URL token cannot recreate a consumed record');
});
test('experiment return links are real local exits and recheck a consumed token at click time',()=>{
 assert.equal(typeof ui.mountRouteReturnLinks,'function');
 class Link extends EventTarget{constructor(){super();this.attrs={href:'./#learning-routes'};}setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}}
 const {w}=setup();const saved=api.saveRouteReturn(w,{actions,before:false,exported:true},validate);w.location=new URL(saved.experimentUrl);
 const link=new Link(),doc={querySelectorAll:()=>[link]};ui.mountRouteReturnLinks({document:doc,window:w});assert.equal(link.attrs.href,saved.returnUrl);
 w.sessionStorage.removeItem(key);link.dispatchEvent(new Event('click'));
 assert.equal(new URL(link.attrs.href).hash,'#learning-routes');assert.ok(!link.attrs.href.includes('route_resume'));
});
