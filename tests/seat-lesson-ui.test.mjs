import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {POSTS,PRESETS,INITIAL_PROFILE} from '../data.mjs';
const ui=await import('../seat-lesson-ui.mjs').catch(()=>({}));
class Element extends EventTarget{
 constructor(){super();this.hidden=false;this.disabled=false;this.textContent='';this.innerHTML='';this.attributes={};this.focused=false;}
 setAttribute(k,v){this.attributes[k]=v;}focus(){this.focused=true;}scrollIntoView(options){this.scrollOptions=options;}click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
}
async function setup(weights=PRESETS.balanced.weights){
 assert.equal(typeof ui.mountSeatLesson,'function');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const e=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const inputs={posts:POSTS,weights:{...weights},profile:{...INITIAL_PROFILE}};
 const controller=ui.mountSeatLesson({document:{getElementById:id=>{assert.ok(e[id],id);return e[id];}},getInputs:()=>inputs});
 return {controller,e,inputs};
}
test('lesson starts only explicitly, reveals a real winner and every same-seat loser after a guess',async()=>{
 const {e}=await setup();assert.equal(e['seat-stage'].hidden,true);
 e['seat-start'].click();assert.equal(e['seat-stage'].hidden,false);
 assert.equal(e['seat-next'].hidden,true);assert.equal(e['seat-evidence'].hidden,true);
 e['seat-guess-1'].click();assert.equal(e['seat-evidence'].hidden,false);
 assert.match(e['seat-result-title'].textContent,/坐下/);
 assert.equal((e['seat-all'].innerHTML.match(/data-candidate=/g)||[]).length,48);
 assert.match(e['seat-all'].innerHTML,/本席落选/);
 assert.match(e['seat-all'].innerHTML,/点击/);
 assert.equal(e['seat-next'].hidden,false);
 const old=e['seat-result-title'].textContent;e['seat-guess-0'].click();assert.equal(e['seat-result-title'].textContent,old);
 e['seat-next'].click();assert.match(e['seat-turn'].textContent,/第 2/);assert.equal(e['seat-evidence'].hidden,true);
 e['seat-guess-0'].click();assert.equal((e['seat-all'].innerHTML.match(/data-candidate=/g)||[]).length,47);
 assert.match(e['seat-change'].textContent,/多样性分/);
});
test('changing free controls preserves lesson evidence and example mode never changes app input',async()=>{
 const {controller,e,inputs}=await setup();e['seat-start'].click();e['seat-guess-0'].click();
 const old=e['seat-all'].innerHTML;inputs.weights.click=10;controller.sync();
 assert.match(e['seat-state'].textContent,/已变化/);assert.equal(e['seat-all'].innerHTML,old);
 inputs.weights.click=80;controller.sync();assert.match(e['seat-state'].textContent,/一致/);
 const before=structuredClone(inputs);e['seat-example'].click();assert.deepEqual(inputs,before);
 assert.match(e['seat-state'].textContent,/演示规则/);
 controller.reset();assert.equal(e['seat-stage'].hidden,true);assert.equal(e['seat-ending'].hidden,true);
});
test('six seats lead to a genuine isolated counterfactual and independent judgment; restart clears answers',async()=>{
 const {e}=await setup();e['seat-start'].click();
 for(let i=0;i<6;i++){e['seat-guess-0'].click();if(i<5)e['seat-next'].click();}
 assert.equal(e['seat-ending'].hidden,false);assert.equal(e['seat-next'].hidden,true);
 assert.equal((e['seat-row'].innerHTML.match(/data-seated=/g)||[]).length,6);
 assert.equal(e['seat-counterfactual'].hidden,true);e['seat-compare'].click();
 assert.equal(e['seat-counterfactual'].hidden,false);assert.match(e['seat-counterfactual-note'].textContent,/第 2/);
 assert.equal((e['seat-alternative'].innerHTML.match(/<li/g)||[]).length,6);
 e['seat-answer-taste'].click();assert.match(e['seat-judgment'].textContent,/口味没有/);
 e['seat-answer-seats'].click();assert.match(e['seat-judgment'].textContent,/答对/);
 e['seat-start'].click();assert.equal(e['seat-ending'].hidden,true);assert.equal(e['seat-judgment'].textContent,'');
});
test('zero diversity and ties do not invent penalties, score advantages or a counterfactual change',async()=>{
 const {e}=await setup({click:0,diversity:0,newcomer:0});e['seat-start'].click();
 for(let i=0;i<6;i++){e['seat-guess-0'].click();if(i<5)e['seat-next'].click();}
 assert.match(e['seat-reason'].textContent,/同分/);assert.match(e['seat-change'].textContent,/权重为 0/);
 e['seat-compare'].click();assert.match(e['seat-counterfactual-note'].textContent,/本来就是 0/);
});
test('each user-driven step brings its heading to the top so choices and next action are not left below the viewport',async()=>{
 const {e}=await setup();e['seat-start'].click();
 assert.equal(e['seat-turn'].scrollOptions?.block,'start');
 e['seat-guess-0'].click();assert.equal(e['seat-result-title'].scrollOptions?.block,'start');
 e['seat-next'].click();assert.equal(e['seat-turn'].focused,true);
});
test('zero-diversity lessons explain unchanged scores rather than teaching a nonexistent occupation penalty',async()=>{
 const {e}=await setup(PRESETS.click.weights);e['seat-start'].click();e['seat-guess-0'].click();e['seat-next'].click();
 assert.match(e['seat-context'].textContent,/多样权重为 0/);
 assert.match(e['seat-context'].textContent,/点击 100/,'the rule is visible beside the active question after scrolling');
 for(let i=1;i<6;i++){e['seat-guess-0'].click();if(i<5)e['seat-next'].click();}
 assert.match(e['seat-conclusion'].textContent,/等同于按固定点击分排序/);
});
