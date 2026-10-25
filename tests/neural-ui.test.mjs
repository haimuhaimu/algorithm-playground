import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {memoryStorage} from './storage-helper.mjs';
import {DRAFT_KEYS} from '../local-drafts.mjs';
let serial=0;
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
  u.click('step-rewind');assert.deepEqual(saved(),before);assert.equal(u.elements.get('step-run').disabled,true);
  u.change('rate','0.6');assert.equal(saved().model.epoch,1);u.click('step-A-up');u.click('step-B-down');u.click('step-run');
  assert.equal(saved().model.epoch,2);assert.notDeepEqual(saved().model.weights,first.model.weights);assert.deepEqual(saved().points,before.points);
  assert.equal(u.elements.get('step-attempts').hidden,false);assert.match(u.elements.get('step-last-result').textContent,/0.15/);assert.match(u.elements.get('step-current-result').textContent,/0.6/);
  assert.equal(u.elements.get('step-run').disabled,true);assert.equal(u.frames.size,0);
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
 const css=await readFile(new URL('../neural.css',import.meta.url),'utf8');
 const rules=[...css.matchAll(/#field\s*\{([^}]+)\}/g)].map(([,body])=>body);
 assert.ok(rules.length);
 for(const body of rules){
  const height=body.match(/(?:^|;)\s*height\s*:\s*([^;]+)/)?.[1];
  if(height)assert.equal(height.trim(),'auto','canvas height must follow its width, including desktop overrides');
  assert.doesNotMatch(body,/aspect-ratio\s*:\s*auto/);
 }
});
test('model and learning-rate controls occur once beside the canvas, before training and results',async()=>{
 const html=await readFile(new URL('../neural.html',import.meta.url),'utf8');
 const canvas=html.indexOf('id="field"'),actions=html.indexOf('class="training-actions"');
 for(const id of ['model','rate']){
  assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1);
  const control=html.indexOf('id="'+id+'"');
  assert.ok(control>canvas&&control<actions,id+' must stay between canvas and training actions');
 }
 assert.ok(actions<html.indexOf('class="prediction"'),'optional guess must not separate settings from training');
});
async function boot({noCanvas=false,hidden=false,storage=memoryStorage()}={}){
 const html=await readFile(new URL('../neural.html',import.meta.url),'utf8').catch(()=>'');
 assert.ok(html.includes('id="field"'),'new playable page must exist');
 const frames=new Map();let next=0;
 const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{})});
 class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attributes=new Map();this.width=900;this.height=560;this.value='';this.checked=false;}
  set value(v){this._value=this.options&&!this.options.includes(v)?'':v;}get value(){return this._value;}
  setAttribute(k,v){this.attributes.set(k,v);}getAttribute(k){return this.attributes.get(k);}
  getContext(){return noCanvas?null:ctx;}getBoundingClientRect(){return {left:0,top:0,width:900,height:560};}
  setPointerCapture(){}releasePointerCapture(){}focus(){}showModal(){}close(){}
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
 try{await import(new URL('../neural.mjs?test='+ ++serial,import.meta.url));}catch(e){restore();throw e;}
 const fire=(el,type,props={})=>el.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),props));
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
