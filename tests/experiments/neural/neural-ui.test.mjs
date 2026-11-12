import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {memoryStorage} from '../../helpers/storage-helper.mjs';
import {DRAFT_KEYS} from '../../../dist/local-drafts.mjs';
let serial=0;
test('one ordinary step reports its actual change beside training without interrupting another action',async()=>{
 const storage=memoryStorage(),u=await boot({storage});try{
  window.innerHeight=844;u.elements.get('status').getBoundingClientRect=()=>({top:500,bottom:570});
  u.click('step');
  assert.equal(u.elements.get('epoch').textContent,'1');
  assert.equal(JSON.parse(storage.getItem(DRAFT_KEYS.neural)).value.model.epoch,1);
  assert.match(u.elements.get('status').textContent,/第 0 → 1 步/);
  assert.match(u.elements.get('status').textContent,/0\.717 → 0\.711/);
  assert.match(u.elements.get('status').textContent,/点.*没动|不移动/);
  assert.equal(u.elements.get('status').scrolled,undefined,'ordinary training feedback should stay nearby, not jump away from the button');
 }finally{u.restore();}
});
test('short-screen training nudges an offscreen message into view without stealing keyboard focus',async()=>{
 const u=await boot();try{
  window.innerHeight=390;
  const status=u.elements.get('status');status.getBoundingClientRect=()=>({top:400,bottom:470});
  u.click('step');assert.equal(u.elements.get('epoch').textContent,'1');
  assert.equal(status.scrolled,true);assert.equal(status.scrollOptions.block,'nearest');
  assert.equal(status.focused,undefined,'ordinary updates keep keyboard focus on the clicked control');
 }finally{u.restore();}
});
test('inspected-step transitions reveal the next real control and the computed result, then restore the same draft',async()=>{
 const storage=memoryStorage(),u=await boot({storage});const saved=()=>JSON.parse(storage.getItem(DRAFT_KEYS.neural)).value;
 try{
  u.click('step');const before=saved();u.click('step-capture');
  assert.ok(document.activeElement===u.elements.get('step-rate'),'the first run starts at its own step size');
  u.elements.get('step-rate').scrolled=false;
  u.click('step-A-up');u.click('step-B-down');u.click('step-run');
  assert.equal(u.elements.get('step-result').hidden,false);assert.equal(u.elements.get('step-result').scrolled,true);
  assert.equal(saved().model.epoch,2);
  u.click('step-rewind');assert.deepEqual(saved(),before);
  assert.ok(document.activeElement===u.elements.get('step-rate'),'rewind focuses the step size inside this experiment');
  assert.equal(u.elements.get('step-rate').scrolled,true);
  assert.equal(u.elements.get('rate').scrolled,undefined,'rewind does not send the learner out of the experiment');
  assert.match(u.elements.get('status').textContent,/退回.*第 1 步/);
 }finally{u.restore();}
});
test('resetting and clearing from remote settings reveal the actual outcome rather than silently changing a distant canvas',async()=>{
 const u=await boot();try{
  u.click('play');u.frame();u.click('reset');
  assert.equal(u.elements.get('epoch').textContent,'0');assert.equal(u.frames.size,0);
  assert.equal(u.elements.get('point-count').textContent,'48 / 160 个点');
  assert.equal(u.elements.get('status').focused,true);assert.equal(u.elements.get('status').scrolled,true);
  u.click('clear');assert.equal(u.elements.get('point-count').textContent,'0 / 160 个点');
  assert.equal(u.elements.get('undo').disabled,false);
  assert.match(u.elements.get('status').textContent,/空白.*圆点.*方点/);
 }finally{u.restore();}
});
test('the model-comparison disabled reason follows initial, running, paused and reset conditions',async()=>{
 const u=await boot();try{
  const button=u.elements.get('compare-model'),hint=u.elements.get('compare-model-hint');
  assert.ok(hint,'comparison has a local explanation');
  assert.equal(button.disabled,true);assert.match(hint.textContent,/先.*训练/);
  u.click('play');u.frame();assert.equal(button.disabled,true);assert.match(hint.textContent,/先.*暂停/);
  u.click('play');assert.equal(button.disabled,false);assert.match(hint.textContent,/可.*比较/);
  u.click('reset');assert.equal(button.disabled,true);assert.match(hint.textContent,/先.*训练/);
  u.click('clear');assert.equal(button.disabled,true);assert.match(hint.textContent,/先.*圆点.*方点.*训练/);
 }finally{u.restore();}
 const v=await boot({noCanvas:true});try{
  assert.equal(v.elements.get('compare-model').disabled,true);
  assert.match(v.elements.get('compare-model-hint').textContent,/浏览器.*无法|浏览器.*不能/);
 }finally{v.restore();}
});
test('a perfect training batch invites a new test rather than looking for nonexistent mistakes',async()=>{
 const u=await boot();try{u.click('fast');for(let i=0;i<20;i++)u.frame();
  assert.equal(u.elements.get('accuracy').textContent,'100%');assert.doesNotMatch(u.elements.get('status').textContent,/看看分错/);
  assert.match(u.elements.get('status').textContent,/全部|没有分错/);
 }finally{u.restore();}
});
test('returning to the newcomer flow checkpoints and stops free-drawing training',async()=>{
 const storage=memoryStorage(),u=await boot({storage});try{
  u.click('play');u.frame();const stale=[...u.frames.values()][0];
  window.dispatchEvent(new Event('neural-guide-pause'));stale();
  assert.equal(u.elements.get('epoch').textContent,'8');assert.equal(u.frames.size,0);
  assert.equal(JSON.parse(storage.getItem(DRAFT_KEYS.neural)).value.model.epoch,8);
 }finally{u.restore();}
});
for(const [label,interrupt] of [
 ['opening help',u=>u.click('about')],
 ['hiding the page',u=>{u.hide();u.show();}],
 ['leaving the page',()=>window.dispatchEvent(new Event('pagehide'))],
 ['closing advanced drawing',()=>window.dispatchEvent(new Event('neural-guide-pause'))],
])test(`${label} reports a real pause without overwriting an already-paused result`,async()=>{
 const storage=memoryStorage(),u=await boot({storage});try{
  const status=u.elements.get('status'),draft=()=>storage.getItem(DRAFT_KEYS.neural);
  u.click('play');u.frame();const stale=[...u.frames.values()][0],writes=storage.writes;
  interrupt(u);stale();
  assert.equal(u.frames.size,0);
  assert.equal(u.elements.get('play').getAttribute('aria-pressed'),'false');
  assert.equal(JSON.parse(draft()).value.model.epoch,8);
  assert.equal(storage.writes,writes+1,'only the existing pause checkpoint is saved');
  assert.match(status.textContent,/已暂停.*第 8 步/);
  assert.equal(status.focused,undefined);
  assert.equal(status.scrolled,undefined);
  u.click('step');
  const priorStatus=status.textContent,priorDraft=draft(),priorWrites=storage.writes;
  assert.match(priorStatus,/第 8 → 9 步/);
  interrupt(u);
  assert.equal(status.textContent,priorStatus);
  assert.equal(draft(),priorDraft);
  assert.equal(storage.writes,priorWrites);
 }finally{u.restore();}
});
test('a newer ordinary prediction cannot be overwritten by an older one-step checkpoint',async()=>{
 const storage=memoryStorage(),u=await boot({storage});const saved=()=>JSON.parse(storage.getItem(DRAFT_KEYS.neural)).value;
 try{
  u.click('step-capture');u.choose('guess','yes');assert.equal(saved().guess,'yes');
  assert.equal(u.elements.get('step-body').hidden,true,'changing the ordinary guess invalidates its frozen version');
  u.click('step-A-up');u.click('step-B-down');u.click('step-run');assert.equal(saved().guess,'yes');assert.equal(saved().model.epoch,0);
  u.click('step-capture');u.click('step-A-up');u.click('step-B-down');u.click('step-run');assert.equal(saved().guess,'yes');
  u.click('step-rewind');assert.equal(saved().guess,'yes');assert.match(u.elements.get('prediction-result').textContent,/你猜/);
 }finally{u.restore();}
});
test('inspected step requires guesses, trains once, rewinds exact draft state and retries at a different rate',async()=>{
 const storage=memoryStorage(),u=await boot({storage});const saved=()=>JSON.parse(storage.getItem(DRAFT_KEYS.neural)).value;
 try{
  assert.ok(u.elements.get('step-capture'),'one-step inspection entry exists');
  u.click('step');const before=saved();u.click('step-capture');
  assert.equal(u.elements.get('step-run').disabled,true);u.click('step-run');assert.equal(saved().model.epoch,1);
  u.click('step-A-up');assert.equal(u.elements.get('step-run').disabled,true);u.click('step-B-down');assert.equal(u.elements.get('step-run').disabled,false);
  u.click('step-run');const first=saved();assert.equal(first.model.epoch,2);u.click('step-run');assert.deepEqual(saved(),first);
  assert.equal(u.elements.get('step-result').hidden,false);assert.match(u.elements.get('step-A-result').textContent,/方倾向/);
  assert.equal(u.elements.get('step-attempts').hidden,true,'one result is not yet a comparison');
  u.click('step-rewind');assert.deepEqual(saved(),before);assert.equal(u.elements.get('step-run').disabled,true);
  assert.equal(u.elements.get('step-attempts').hidden,true,'rewinding must not show a stale current result');
  assert.match(u.elements.get('step-last-result').textContent,/0\.15.*尚未再走/);
  assert.ok(u.elements.get('step-rate'),'retry has a local step size control');
  u.click('step-A-up');u.click('step-B-down');
  window.innerHeight=390;u.elements.get('status').getBoundingClientRect=()=>({top:-600,bottom:-550});
  u.change('step-rate','0.6');
  assert.deepEqual(saved(),{...before,rate:0.6},'choosing a different size does not train or alter the checkpoint');
  assert.equal(u.elements.get('rate').value,'0.6');
  assert.equal(u.elements.get('step-run').disabled,true,'old guesses cannot be used for the new step size');
  assert.equal(u.elements.get('status').scrolled,undefined,'selecting a size does not scroll to general training feedback');
  u.click('step-A-up');u.click('step-B-down');u.click('step-run');
  assert.equal(saved().model.epoch,2);assert.notDeepEqual(saved().model.weights,first.model.weights);assert.deepEqual(saved().points,before.points);
  assert.equal(u.elements.get('step-attempts').hidden,false);
  assert.equal(u.elements.get('step-last-rate').textContent,'0.15');
  assert.equal(u.elements.get('step-current-rate').textContent,'0.60');
  assert.equal(u.elements.get('step-run').disabled,true);assert.equal(u.frames.size,0);
 }finally{u.restore();}
});
test('the comparison shows each real outcome and signed change from the same checkpoint',async()=>{
 const u=await boot();try{
  u.click('step');u.click('step-capture');u.click('step-A-up');u.click('step-B-down');u.click('step-run');
  u.click('step-rewind');u.change('step-rate','0.6');u.click('step-A-up');u.click('step-B-down');u.click('step-run');
  const shown=id=>u.elements.get(id)?.textContent;
  assert.equal(document.activeElement,u.elements.get('step-result'));
  assert.match(shown('step-compare-origin')??'',/第 1.*2 步/);
  const fields=['base','last','last-delta','current','current-delta'];
  // Default islands, a single ordinary 0.15 update before capture.
  assert.deepEqual(fields.map(key=>shown('step-compare-loss-'+key)),['0.710972','0.705827','−0.005145','0.691920','−0.019052']);
  assert.deepEqual(fields.map(key=>shown('step-compare-A-'+key)),['53.951%','54.535%','+0.584','56.253%','+2.302']);
  assert.deepEqual(fields.map(key=>shown('step-compare-B-'+key)),['61.369%','60.863%','−0.506','59.335%','−2.034']);
  u.change('rate','0.03');
  assert.equal(shown('step-current-rate'),'0.60','the future setting is not an executed step');
  u.click('step-capture');
  assert.equal(u.elements.get('step-attempts').hidden,true,'a new checkpoint cannot compare the old runs');
  assert.equal(u.elements.get('step-last-result').hidden,true);
 }finally{u.restore();}
});
test('the revealed result separates a changed tendency from a changed class',async()=>{
 const u=await boot();try{
  u.click('step');u.click('step-capture');u.click('step-A-up');u.click('step-B-down');u.click('step-run');
  const takeaway=()=>u.elements.get('step-takeaway')?.textContent??'';
  assert.match(takeaway(),/A、B 都没换类.*B 没参加训练.*方倾向也变了/);
  u.click('step-rewind');u.change('step-rate','0.6');u.click('step-A-up');u.click('step-B-down');u.click('step-run');
  assert.match(takeaway(),/两次 A、B 都没换类.*B 没参加训练.*两次的方倾向都变了/);
 }finally{u.restore();}
});
test('the comparison identifies which real step crossed the decision boundary',async()=>{
 const u=await boot();try{
  for(let i=0;i<5;i++)u.click('step');
  u.click('step-capture');u.click('step-A-down');u.click('step-B-down');u.click('step-run');
  u.click('step-rewind');u.change('step-rate','0.6');u.click('step-A-down');u.click('step-B-down');u.click('step-run');
  assert.match(u.elements.get('step-takeaway')?.textContent??'',/上次都没换类；这次 A 从方改判为圆/);
  assert.equal(u.elements.get('step-compare-A-current').textContent,'49.943%');
  assert.equal(u.elements.get('step-compare-A-last').textContent,'52.037%');
 }finally{u.restore();}
});
test('changing the future step size after a result keeps the actual result and carries the new setting into retry',async()=>{
 const storage=memoryStorage(),u=await boot({storage});const saved=()=>JSON.parse(storage.getItem(DRAFT_KEYS.neural)).value;
 try{
  u.click('step-capture');u.click('step-A-up');u.click('step-B-down');u.click('step-run');
  const result=u.elements.get('step-loss-result').textContent,trained=saved();
  u.change('rate','0.03');
  assert.deepEqual(saved(),{...trained,rate:0.03});
  assert.equal(u.elements.get('step-loss-result').textContent,result);
  u.click('step-rewind');
  assert.equal(saved().model.epoch,0);
  assert.equal(u.elements.get('step-rate')?.value,'0.03');
  assert.match(u.elements.get('step-last-result').textContent,/0\.15/);
 }finally{u.restore();}
});
test('ordinary edits and training invalidate rewind, but a cancelled stroke preserves the comparison',async()=>{
 const u=await boot();try{
  assert.ok(u.elements.get('step-capture'));u.click('step-capture');u.click('step-A-up');u.click('step-B-down');u.click('step-run');
  u.choose('tool','0');u.pointer('pointerdown');u.pointer('pointercancel');assert.equal(u.elements.get('step-rewind').disabled,false);
  u.pointer('pointerdown');u.pointer('pointerup');assert.equal(u.elements.get('step-rewind').disabled,true);assert.equal(u.elements.get('step-body').hidden,true);
  u.click('step-capture');u.click('step-A-up');u.click('step-B-down');u.click('step-run');u.click('step');
  assert.equal(u.elements.get('step-body').hidden,true);const epoch=u.elements.get('epoch').textContent;u.click('step-rewind');assert.equal(u.elements.get('epoch').textContent,epoch);
  u.click('step-capture');u.choose('preset','ring');assert.equal(u.elements.get('step-body').hidden,true);
  u.click('step-capture');u.change('model','linear');assert.equal(u.elements.get('step-body').hidden,true);
 }finally{u.restore();}
});
test('inspection cancels pending training, handles empty data and restores the actual stepped draft on reload',async()=>{
 const storage=memoryStorage(),u=await boot({storage});let expected;
 try{
  assert.ok(u.elements.get('step-capture'));u.click('play');const stale=[...u.frames.values()][0];u.click('step-capture');stale(100);assert.equal(u.frames.size,0);assert.equal(u.elements.get('epoch').textContent,'0');
  u.click('step-A-up');u.click('step-B-up');u.click('step-run');expected=JSON.parse(storage.getItem(DRAFT_KEYS.neural)).value;
 }finally{u.restore();}
 const v=await boot({storage});try{
  assert.equal(v.elements.get('epoch').textContent,'1');assert.equal(v.elements.get('step-body').hidden,true);assert.equal(v.elements.get('step-rewind').disabled,true);
  assert.match(v.elements.get('step-note').textContent,/临时.*重新留档/);
  assert.deepEqual(JSON.parse(storage.getItem(DRAFT_KEYS.neural)).value,expected);
  v.click('clear');v.click('step-capture');assert.equal(v.elements.get('step-body').hidden,true);assert.match(v.elements.get('step-note').textContent,/两类/);
 }finally{v.restore();}
 const w=await boot({noCanvas:true});try{assert.equal(w.elements.get('step-capture').disabled,true);}finally{w.restore();}
});
test('canvas layout never overrides its intrinsic proportions with an independent height',async()=>{
 const css=await readFile(new URL('../../../dist/neural.css',import.meta.url),'utf8');
 const rules=[...css.matchAll(/#field\s*\{([^}]+)\}/g)].map(([,body])=>body);
 assert.ok(rules.length);
 for(const body of rules){
  const height=body.match(/(?:^|;)\s*height\s*:\s*([^;]+)/)?.[1];
  if(height)assert.equal(height.trim(),'auto','canvas height must follow its width, including desktop overrides');
  assert.doesNotMatch(body,/aspect-ratio\s*:\s*auto/);
 }
});
test('model and learning-rate controls occur once beside the canvas, before training and results',async()=>{
 const html=await readFile(new URL('../../../dist/neural.html',import.meta.url),'utf8');
 const canvas=html.indexOf('id="field"'),actions=html.indexOf('class="training-actions"');
 for(const id of ['model','rate']){
  assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1);
  const control=html.indexOf('id="'+id+'"');
  assert.ok(control>canvas&&control<actions,id+' must stay between canvas and training actions');
 }
 assert.ok(actions<html.indexOf('class="prediction"'),'optional guess must not separate settings from training');
});
async function boot({noCanvas=false,hidden=false,storage=memoryStorage()}={}){
 const html=await readFile(new URL('../../../dist/neural.html',import.meta.url),'utf8').catch(()=>'');
 assert.ok(html.includes('id="field"'),'new playable page must exist');
 const frames=new Map();let next=0;
 const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{})});
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attributes=new Map();this.width=900;this.height=560;this.value='';this.checked=false;}
  set value(v){this._value=this.options&&!this.options.includes(v)?'':v;}get value(){return this._value;}
  setAttribute(k,v){this.attributes.set(k,v);}getAttribute(k){return this.attributes.get(k);}
  getContext(){return noCanvas?null:ctx;}getBoundingClientRect(){return {left:0,top:0,width:900,height:560};}
  setPointerCapture(){}releasePointerCapture(){}focus(options){this.focused=true;this.focusOptions=options;doc.activeElement=this;}scrollIntoView(options){this.scrolled=true;this.scrollOptions=options;}showModal(){}close(){}
 }
 const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
 for(const [,id,options]of html.matchAll(/<select id="([^"]+)">([\s\S]*?)<\/select>/g))elements.get(id).options=[...options.matchAll(/value="([^"]+)"/g)].map(([,v])=>v);
 const groups={};
 for(const key of ['tool','preset','guess'])groups[key]=[...html.matchAll(new RegExp('data-'+key+'="([^"]+)"','g'))].map(([,v])=>Object.assign(new Element(),{dataset:{[key]:v}}));
 const doc=Object.assign(new EventTarget(),{hidden,documentElement:new Element(),getElementById:id=>elements.get(id),querySelectorAll:s=>groups[s.match(/data-(\w+)/)?.[1]]??[]});
 const globals={document:doc,window:Object.assign(new EventTarget(),{localStorage:storage}),matchMedia:()=>Object.assign(new EventTarget(),{matches:false}),getComputedStyle:()=>({getPropertyValue:()=>'#25271f'}),requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const restore=()=>{for(const[k,d]of old)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];};
 Object.assign(globalThis,globals);
 try{await import(new URL('../../../dist/neural.mjs?test='+ ++serial,import.meta.url));}catch(e){restore();throw e;}
 const fire=(el,type,props={})=>type==='click'&&el.disabled?false:el.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),props));
 return {elements,frames,restore,fire,click:id=>fire(elements.get(id),'click'),choose:(key,value)=>fire(groups[key].find(e=>e.dataset[key]===value),'click'),
  change(id,value){elements.get(id).value=value;fire(elements.get(id),'change');},
  pointer(type,x=450,y=280,extra={}){fire(elements.get('field'),type,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,...extra});},
  frame(){const first=frames.entries().next().value;if(first){frames.delete(first[0]);first[1](100);}},
  hide(){doc.hidden=true;fire(doc,'visibilitychange');},show(){doc.hidden=false;fire(doc,'visibilitychange');}};
}
test('undoing a preset change restores exact custom samples and cancels obsolete training',async()=>{
 const storage=memoryStorage(),u=await boot({storage});
 const saved=()=>JSON.parse(storage.getItem(DRAFT_KEYS.neural)).value;
 try{
  u.choose('tool','0');u.pointer('pointerdown',240,110);u.pointer('pointerup',240,110);
  const original=saved().points;
  u.click('step');u.click('compare-model');u.click('fast');
  const stale=[...u.frames.values()][0];
  u.choose('preset','ring');stale(100);
  assert.equal(u.elements.get('undo').disabled,false,'switching questions must remain recoverable');
  u.click('undo');
  assert.deepEqual(saved().points,original);
  assert.equal(u.elements.get('dataset-name').textContent,'我的涂鸦');
  assert.equal(u.elements.get('test-accuracy').textContent,'未设答案');
  assert.equal(u.elements.get('epoch').textContent,'0');assert.equal(u.frames.size,0);
  assert.equal(u.elements.get('model-comparison').hidden,true);
  assert.match(u.elements.get('status').textContent,/撤销.*题目|撤销.*改题/);
 }finally{u.restore();}
});
test('several question switches survive reload and undo in reverse order before the original stroke',async()=>{
 const storage=memoryStorage();let original;
 const u=await boot({storage});try{
  u.choose('tool','1');u.pointer('pointerdown',240,110);u.pointer('pointerup',240,110);
  original=JSON.parse(storage.getItem(DRAFT_KEYS.neural)).value.points;
  u.choose('preset','ring');u.choose('preset','diagonal');
 }finally{u.restore();}
 const v=await boot({storage});try{
  assert.equal(v.elements.get('dataset-name').textContent,'一分为二');
  v.click('undo');assert.equal(v.elements.get('dataset-name').textContent,'甜甜圈');
  assert.notEqual(v.elements.get('test-accuracy').textContent,'未设答案');
  v.click('undo');assert.equal(v.elements.get('dataset-name').textContent,'我的涂鸦');
  assert.deepEqual(JSON.parse(storage.getItem(DRAFT_KEYS.neural)).value.points,original);
  assert.equal(v.elements.get('test-accuracy').textContent,'未设答案');
  v.click('undo');assert.equal(v.elements.get('dataset-name').textContent,'四个小岛');
  assert.equal(v.elements.get('undo').disabled,true);assert.equal(v.frames.size,0);
 }finally{v.restore();}
});
test('preset history is bounded and does not include a cancelled in-progress stroke',async()=>{
 const storage=memoryStorage(),u=await boot({storage});
 try{
  u.choose('tool','0');u.pointer('pointerdown',240,110);
  u.choose('preset','ring');u.pointer('pointerup',240,110);u.click('undo');
  assert.equal(u.elements.get('dataset-name').textContent,'四个小岛');
  assert.equal(u.elements.get('point-count').textContent,'48 / 160 个点');
  for(let i=0;i<35;i++)u.choose('preset',i%2?'diagonal':'ring');
  const saved=JSON.parse(storage.getItem(DRAFT_KEYS.neural)).value;
  assert.equal(saved.undo.length,30);assert.match(u.elements.get('draft-status').textContent,/已保留/);
  for(let i=0;i<30;i++)u.click('undo');
  assert.equal(u.elements.get('undo').disabled,true);
 }finally{u.restore();}
});
test('reload restores committed custom work, trained model, learning rate and undo, always paused',async()=>{
 const storage=memoryStorage();let expected;
 const u=await boot({storage});try{
  u.choose('tool','0');u.pointer('pointerdown');u.pointer('pointerup');u.change('rate','0.6');u.click('fast');
  for(let i=0;i<20;i++)u.frame();
  expected=['epoch','accuracy','loss','point-count','test-accuracy'].map(id=>u.elements.get(id).textContent);
  const before=storage.writes;u.pointer('pointerdown',300,100);u.pointer('pointermove',500,100);u.pointer('pointercancel',500,100);
  assert.equal(storage.writes,before,'transient strokes are not saved');
 }finally{u.restore();}
 const v=await boot({storage});try{
  assert.deepEqual(['epoch','accuracy','loss','point-count','test-accuracy'].map(id=>v.elements.get(id).textContent),expected);
  assert.equal(v.elements.get('rate').value,'0.6');assert.equal(v.frames.size,0);
  assert.match(v.elements.get('draft-status').textContent,/恢复/);
  v.click('undo');assert.equal(v.elements.get('dataset-name').textContent,'四个小岛');
 }finally{v.restore();}
});
test('hiding checkpoints training, deleting the draft keeps current work and does not resave on hide',async()=>{
 const storage=memoryStorage(),u=await boot({storage});try{
  u.click('play');u.frame();u.hide();assert.equal(u.elements.get('epoch').textContent,'8');u.show();
  assert.ok(storage.records.size);assert.ok(u.elements.get('forget-draft'));
  u.click('forget-draft');assert.equal(storage.records.size,0);assert.equal(u.elements.get('epoch').textContent,'8');
  u.hide();assert.equal(storage.records.size,0);
 }finally{u.restore();}
 const v=await boot({storage});try{assert.equal(v.elements.get('epoch').textContent,'0');}finally{v.restore();}
});
test('storage failure cannot prevent learning and never claims a draft was saved',async()=>{
 const storage={getItem(){throw Error('denied');},setItem(){throw Error('quota');},removeItem(){throw Error('denied');}};
 const u=await boot({storage});try{u.click('step');assert.equal(u.elements.get('epoch').textContent,'1');assert.match(u.elements.get('draft-status').textContent,/无法|未保存/);}finally{u.restore();}
});
test('same-question card freezes prior model scores and survives reload without automatically training',async()=>{
 const storage=memoryStorage();let previousScore,previousLoss;
 const u=await boot({storage});try{
  assert.ok(u.elements.get('model-comparison'),'comparison card exists');assert.equal(u.elements.get('model-comparison').hidden,true);
  u.click('fast');for(let i=0;i<20;i++)u.frame();previousScore=u.elements.get('test-accuracy').textContent;previousLoss=u.elements.get('loss').textContent;
  u.click('compare-model');assert.equal(u.elements.get('model-comparison').hidden,false);
  assert.equal(u.elements.get('previous-test').textContent,previousScore);assert.equal(u.elements.get('current-test').textContent,'待训练');
  u.click('fast');for(let i=0;i<20;i++)u.frame();
  assert.equal(u.elements.get('previous-test').textContent,previousScore);assert.equal(u.elements.get('previous-loss').textContent,previousLoss);
  assert.equal(u.elements.get('current-test').textContent,u.elements.get('test-accuracy').textContent);
  assert.match(u.elements.get('comparison-note').textContent,/相同步数.*固定步子/);
 }finally{u.restore();}
 const v=await boot({storage});try{
  assert.equal(v.elements.get('previous-test').textContent,previousScore);assert.equal(v.elements.get('epoch').textContent,'500');assert.equal(v.frames.size,0);
  v.change('rate','0.6');v.click('step');assert.match(v.elements.get('comparison-note').textContent,/条件不同|多种/);
  v.choose('tool','0');v.pointer('pointerdown');v.pointer('pointercancel');assert.equal(v.elements.get('model-comparison').hidden,false);
  v.pointer('pointerdown');v.pointer('pointerup');assert.equal(v.elements.get('model-comparison').hidden,true);
  v.click('undo');assert.equal(v.elements.get('model-comparison').hidden,true,'undo cannot resurrect an old comparison');
 }finally{v.restore();}
});
test('dropdown switching preserves a trained result, while custom questions never invent test answers',async()=>{
 const u=await boot();try{
  u.choose('tool','0');u.pointer('pointerdown');u.pointer('pointerup');u.click('step');u.change('model','linear');
  assert.ok(u.elements.get('previous-test'));assert.equal(u.elements.get('previous-test').textContent,'未设答案');
  u.click('step');assert.equal(u.elements.get('current-test').textContent,'未设答案');
  assert.match(u.elements.get('comparison-note').textContent,/没有标准答案/);
  u.choose('preset','ring');assert.equal(u.elements.get('model-comparison').hidden,true);
 }finally{u.restore();}
});
test('switching back before training recovers the retained model instead of discarding its learned result',async()=>{
 const u=await boot();try{
  u.click('step');const score=u.elements.get('loss').textContent;u.change('model','linear');u.change('model','network');
  assert.equal(u.elements.get('epoch').textContent,'1');assert.equal(u.elements.get('loss').textContent,score);assert.equal(u.frames.size,0);
  assert.equal(u.elements.get('model-comparison').hidden,true);
 }finally{u.restore();}
});
test('forgetting a draft pauses active training so an old callback cannot recreate it',async()=>{
 const storage=memoryStorage(),u=await boot({storage});try{
  u.click('play');u.frame();const pending=[...u.frames.values()][0];u.click('forget-draft');
  assert.equal(u.frames.size,0);pending(100);u.hide();assert.equal(storage.records.size,0);
 }finally{u.restore();}
});
test('comparison action changes only the model, retaining the same question and clearing the old prediction',async()=>{
 const ui=await boot();try{
  const compare=ui.elements.get('compare-model');assert.ok(compare,'a nearby model comparison action must exist');
  assert.equal(compare.disabled,true);assert.match(ui.elements.get('prediction-model').textContent,/8/);
  ui.choose('guess','yes');ui.click('fast');for(let i=0;i<25;i++)ui.frame();
  const count=ui.elements.get('point-count').textContent;
  assert.equal(compare.disabled,false);ui.click('compare-model');
  assert.equal(ui.elements.get('model').value,'linear');assert.equal(ui.elements.get('epoch').textContent,'0');
  assert.equal(ui.elements.get('point-count').textContent,count);assert.equal(ui.elements.get('dataset-name').textContent,'四个小岛');
  assert.notEqual(ui.elements.get('test-accuracy').textContent,'未设答案');assert.doesNotMatch(ui.elements.get('prediction-result').textContent,/你猜/);
  assert.equal(ui.frames.size,0);assert.match(ui.elements.get('prediction-model').textContent,/直线/);
  ui.click('step');ui.click('compare-model');assert.equal(ui.elements.get('model').value,'network');
 }finally{ui.restore();}
});
test('comparison keeps custom drawings and undo history instead of restoring a preset',async()=>{
 const ui=await boot();try{
  assert.ok(ui.elements.get('compare-model'),'comparison action exists');
  ui.choose('tool','0');ui.pointer('pointerdown');ui.pointer('pointerup');
  const count=ui.elements.get('point-count').textContent;ui.click('step');ui.click('compare-model');
  assert.equal(ui.elements.get('point-count').textContent,count);assert.equal(ui.elements.get('test-accuracy').textContent,'未设答案');
  ui.click('undo');assert.equal(ui.elements.get('dataset-name').textContent,'四个小岛');
 }finally{ui.restore();}
});
test('starts paused, trains by real model steps, and pauses without an extra loop',async()=>{
 const ui=await boot();try{
  assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('epoch').textContent,'0');
  ui.click('step');assert.equal(ui.elements.get('epoch').textContent,'1');
  ui.click('play');ui.frame();assert.equal(ui.elements.get('epoch').textContent,'9');
  ui.click('play');assert.equal(ui.frames.size,0);assert.equal(ui.elements.get('play').getAttribute('aria-pressed'),'false');
 }finally{ui.restore();}
});
test('fast-forward is exactly 500 real epochs and repeated clicks do not queue duplicate work',async()=>{
 const ui=await boot();try{ui.click('fast');ui.click('fast');assert.equal(ui.frames.size,1);
  for(let i=0;i<25;i++)ui.frame();assert.equal(ui.elements.get('epoch').textContent,'500');assert.equal(ui.frames.size,0);
 }finally{ui.restore();}
});
test('backgrounding, help and resetting invalidate stale callbacks',async()=>{
 const ui=await boot();try{
  ui.click('fast');const stale=[...ui.frames.values()][0];ui.hide();ui.show();stale(100);
  assert.equal(ui.elements.get('epoch').textContent,'0');assert.equal(ui.frames.size,0);
  ui.click('play');ui.click('about');assert.equal(ui.frames.size,0);
  ui.click('fast');const stale2=[...ui.frames.values()][0];ui.choose('preset','ring');stale2(200);
  assert.equal(ui.elements.get('epoch').textContent,'0');assert.equal(ui.frames.size,0);
 }finally{ui.restore();}
});
test('committed painting resets training and removes unsupported held-out scores; undo restores preset',async()=>{
 const ui=await boot();try{
  ui.click('step');const oldCount=ui.elements.get('point-count').textContent;
  ui.choose('tool','0');ui.pointer('pointerdown',450,280);ui.pointer('pointerup',450,280);
  assert.equal(ui.elements.get('epoch').textContent,'0');
  assert.equal(ui.elements.get('test-accuracy').textContent,'未设答案');
  assert.notEqual(ui.elements.get('point-count').textContent,oldCount);
  ui.click('undo');assert.equal(ui.elements.get('point-count').textContent,oldCount);
  assert.notEqual(ui.elements.get('test-accuracy').textContent,'未设答案');
 }finally{ui.restore();}
});
test('cancelled drawing and extra pointers preserve the last successful data and evidence',async()=>{
 const ui=await boot();try{
  ui.click('step');const score=ui.elements.get('test-accuracy').textContent,count=ui.elements.get('point-count').textContent;
  ui.choose('tool','1');ui.pointer('pointerdown',450,280);ui.pointer('pointermove',500,300);
  ui.pointer('pointerup',600,400,{pointerId:2,isPrimary:false});ui.pointer('pointercancel');
  assert.equal(ui.elements.get('epoch').textContent,'1');assert.equal(ui.elements.get('point-count').textContent,count);
  assert.equal(ui.elements.get('test-accuracy').textContent,score);
 }finally{ui.restore();}
});
test('empty and single-class drawings explain limits; keyboard can add both classes',async()=>{
 const ui=await boot();try{
  ui.click('clear');ui.click('play');assert.equal(ui.frames.size,0);
  assert.equal(ui.elements.get('accuracy').textContent,'无样本');
  const field=ui.elements.get('field');ui.choose('tool','0');ui.fire(field,'keydown',{key:'Enter'});
  ui.click('step');assert.equal(ui.elements.get('epoch').textContent,'0');assert.match(ui.elements.get('status').textContent,/两类/);
  ui.choose('tool','1');ui.fire(field,'keydown',{key:'ArrowRight'});ui.fire(field,'keydown',{key:'Enter'});
  ui.click('step');assert.equal(ui.elements.get('epoch').textContent,'1');
 }finally{ui.restore();}
});
test('model changes reset the evidence but learning-rate changes preserve it',async()=>{
 const ui=await boot();try{
  ui.click('step');ui.change('rate','.6');assert.equal(ui.elements.get('epoch').textContent,'1');
  ui.change('model','linear');assert.equal(ui.elements.get('epoch').textContent,'0');
  ui.choose('guess','no');ui.click('step');assert.match(ui.elements.get('prediction-result').textContent,/分不开/);
 }finally{ui.restore();}
});
test('missing Canvas gives a readable fallback and disables training',async()=>{
 const ui=await boot({noCanvas:true});try{
  assert.match(ui.elements.get('status').textContent,/Canvas/);
  assert.equal(ui.elements.get('play').disabled,true);assert.equal(ui.frames.size,0);
 }finally{ui.restore();}
});
test('the learning-rate control always has an actual selected option after rendering',async()=>{
 const ui=await boot();try{
  assert.notEqual(ui.elements.get('rate').value,'');
  ui.change('rate','0.6');ui.click('step');
  assert.equal(ui.elements.get('rate').value,'0.6');
 }finally{ui.restore();}
});
test('clearing after a prediction and training resets both evidence and the previous guess',async()=>{
 const ui=await boot();try{
  ui.choose('guess','yes');ui.click('step');ui.click('clear');
  assert.equal(ui.elements.get('epoch').textContent,'0');
  assert.equal(ui.elements.get('accuracy').textContent,'无样本');
  assert.doesNotMatch(ui.elements.get('prediction-result').textContent,/你猜/);
 }finally{ui.restore();}
});
test('an active probe follows the current trained model without a second click',async()=>{
 const ui=await boot();try{
  ui.choose('tool','probe');ui.pointer('pointerdown',675,140);
  const before=ui.elements.get('probe-result').textContent;assert.match(before,/59%/);
  ui.click('fast');for(let i=0;i<20;i++)ui.frame();
  const after=ui.elements.get('probe-result').textContent;
  assert.notEqual(after,before);assert.match(after,/98%/);
  ui.pointer('pointerdown',675,140);assert.equal(ui.elements.get('probe-result').textContent,after);
  ui.choose('tool','0');ui.pointer('pointerdown',450,280);ui.pointer('pointercancel');
  assert.equal(ui.elements.get('probe-result').textContent,after);
  ui.click('reset');assert.doesNotMatch(ui.elements.get('probe-result').textContent,/98%/);
 }finally{ui.restore();}
});
