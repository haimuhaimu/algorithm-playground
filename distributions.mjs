import {MODEL_INFO,createObservatory,actObservatory,observatoryEvidence} from './distributions-core.mjs?v=operator-collection-v1';

const IDS=['normal','exponential','pareto'];
const operators=Object.freeze({normal:'嘿姆',exponential:'波比',pareto:'臭臭'});
const machineName=id=>`${operators[id]}（${MODEL_INFO[id].label}）`;
const numbers=value=>value===null?'—':Math.abs(value)>=10000?value.toExponential(2).replace('e-','e−'):Number(value.toFixed(2)).toLocaleString('en-US');
const probability=value=>value===0?'小于当前数值精度':value<.00001?(value*100).toExponential(2).replace('e-','e−')+'%':(value*100).toFixed(value<.001?3:2)+'%';
const frequency=value=>value===0?'0%':probability(value);
const classifications={normal:'大多挤在中间',exponential:'往右拖着一条尾巴',pareto:'大数没那么罕见'};
const countString=rows=>rows.map(r=>`${machineName(r.id)} ${r.stats.tailCount} 次`).join('，');

function collectedSample(record,threshold,{full=false,pushed=false}={}){
 const current=record.after?`超过 ${threshold}`:`没超过 ${threshold}`;
 const comparison=pushed?`超过 4；${current}`:current;
 const value=full?String(record.value):`≈${numbers(record.value)}`;
 return `<li data-draw="${record.index+1}" data-sample-value="${record.value}"><small>第 ${record.index+1} 次</small><data value="${record.value}">${value}</data><span>${comparison}</span></li>`;
}

function renderCollection($,row,threshold,pushed){
 const id=row.id,c=row.collection,n=c.outside.length;
 $('collection-title-'+id).textContent=`${operators[id]}的图外大数`;
 $('collection-'+id).hidden=false;
 $('collection-count-'+id).textContent=`${n} 个`;
 $('collection-empty-'+id).hidden=n>0;
 $('collection-empty-'+id).textContent=n?'':'这一批没有落在主图右边的数。没碰上，不代表不可能。';
 $('collection-preview-'+id).innerHTML=c.outside.slice(0,6).map(r=>collectedSample(r,threshold)).join('');
 $('collection-preview-note-'+id).hidden=!n;
 $('collection-preview-note-'+id).textContent=n?`按抽取顺序，先看前 ${Math.min(6,n)} 个 / 共 ${n} 个。最大约 ${numbers(c.outsideMax)}。`:'';
 $('collection-details-'+id).hidden=!n;
 $('collection-summary-'+id).textContent=`核对${operators[id]}抽到的全部 ${n} 个图外数`;
 $('collection-all-'+id).innerHTML=c.outside.map(r=>collectedSample(r,threshold,{full:true,pushed})).join('');
 $('collection-split-'+id).hidden=!pushed;
 for(const [part,key]of [['inside','inChart'],['outside','outside']]){
  $('collection-'+part+'-before-'+id).textContent=String(c.before[key]);
  $('collection-'+part+'-after-'+id).textContent=String(c.current[key]);
 }
 const dropped=c.dropped[0];
 $('collection-shift-'+id).hidden=!pushed;
 $('collection-shift-'+id).textContent=dropped
  ?`比如第 ${dropped.index+1} 次的 ≈${numbers(dropped.value)}：比 4 大，但没超过 16。这次数不进去了，样本没有被删掉。`
  :`这批数里没有原先超过 4、这次没超过 16 的例子。没有为了演示另抽一批。`;
}

function histogram(stats,before,threshold,ceiling){
 const X=v=>16+(v+4)*22.4,Y=v=>145-128*v/ceiling;
 const grids=[0,ceiling/2,ceiling].map(v=>`<line x1="16" x2="464" y1="${Y(v)}" y2="${Y(v)}" class="histogram-grid"/>`).join('');
 const bars=stats.histogram.map((count,i)=>`<rect x="${X(i-4)+1}" y="${Y(count/stats.n)}" width="20.4" height="${145-Y(count/stats.n)}" class="histogram-bar${i-4>=threshold?' histogram-tail':''}"/>`).join('');
 const outline=before?before.histogram.map((count,i)=>`<rect x="${X(i-4)+3}" y="${Y(count/before.n)}" width="16.4" height="${145-Y(count/before.n)}" class="histogram-before"/>`).join(''):'';
 return `<svg viewBox="0 0 480 160" preserveAspectRatio="none" aria-hidden="true">${grids}${bars}${outline}<line x1="${X(threshold)}" x2="${X(threshold)}" y1="10" y2="145" class="threshold-line" vector-effect="non-scaling-stroke"/></svg>`;
}

export function initDistributions(){
 const doc=document,$=id=>doc.getElementById(id),media=matchMedia('(prefers-color-scheme: dark)');
 let state=createObservatory(),explicitTheme=false;
 const active=()=>!doc.hidden&&!$('guide').open;
 function render(){
  const e=observatoryEvidence(state),pushed=['pushed','done'].includes(e.phase),done=e.phase==='done';
  const step=e.phase==='ready'?1:e.phase==='grown'?2:3;
  $('sample-count').textContent=String(e.count);$('seed-value').textContent=String(e.seed);
  for(const n of [1,2,3])$('step-'+n).setAttribute('aria-current',!done&&n===step?'step':'false');
  $('step-label').textContent=done?'这一轮看完了':`第 ${step} 步 / 共 3 步`;
  $('step-title').textContent={ready:'才抽了 30 次，再多抽一点呢？',grown:'数不变，只把红线挪远一点呢？',pushed:'还是刚才那批数，结果变了。',done:'这一轮，就看到这里。'}[e.phase];
  $('step-copy').textContent={ready:'下面已经各抽了 30 次。点一下，每台再抽 3,000 次，看看会多碰到多少大数字。',grown:'现在每台抽了 3,030 次。这些数都留着，不再抽新的。把红线从 4 挪到 16，只数比 16 还大的。',pushed:'刚才数的是大于 4 的，现在只数大于 16 的。下方两边放着前后的次数，看看还剩多少。',done:'刚才的数和前后对比都在下面。你可以回头看看，也可以从头再玩一次。'}[e.phase];
  $('observation-result').textContent=e.phase==='ready'?'':!pushed?`这次比 4 大的数：${countString(e.rows)}。`:`红线从 4 挪到 16 后：${e.rows.map((r,i)=>`${machineName(r.id)} ${e.comparison[i].stats.tailCount} → ${r.stats.tailCount}`).join('；')} 次。`;
  $('next-step').hidden=pushed;$('next-step').textContent=step===1?'每台再抽 3,000 次 →':'把红线挪到 16 →';
  $('answer-panel').hidden=!pushed||done;
  for(const a of ['sample','zero']){$('answer-'+a).disabled=!pushed||done;$('answer-'+a).setAttribute('aria-pressed',String(state.attempts.at(-1)===a));}
  $('answer-feedback').textContent=state.attempts.at(-1)==='zero'?'没抽到，只能说明这次没碰上。按正态分布的公式，比 16 大的数仍可能出现，只是机会非常小。再想想？':'';
  $('ending').hidden=!done;$('optional-exploration').hidden=!done;$('transfer-lab').hidden=!e.transfer;$('inspect-transfer').disabled=!done||Boolean(e.transfer);
  $('threshold-note').textContent=`· 只数比 ${e.threshold} 大的`;
  const ceiling=Math.min(1,Math.max(.3,...[...e.rows,...e.baseline,...(e.transfer?[e.transfer]:[])].flatMap(r=>r.stats.histogram.map(n=>Math.ceil(n/r.stats.n*10)/10))));
  $('scale-note').textContent=`柱子越高就越常见 · 三张图都按 0–${Math.round(ceiling*100)}% 来画`;
  for(const row of e.rows){
   const id=row.id,s=row.stats,old=e.baseline.find(r=>r.id===id).stats,previous=e.comparison?.find(r=>r.id===id).stats;
   $('model-'+id).textContent=MODEL_INFO[id].label;$('class-'+id).textContent=classifications[id];
   $('tail-'+id).textContent=`${s.tailCount} 次`;$('rate-'+id).textContent=`超过红线，占 ${frequency(s.tailRate)}`;
   $('comparison-'+id).hidden=e.phase==='ready';
   $('previous-label-'+id).textContent=pushed?'红线 +4':'最初 30 次';$('current-label-'+id).textContent=pushed?'红线 +16':'现在 3,030 次';
   $('previous-'+id).textContent=String((pushed?previous:old).tailCount);$('current-'+id).textContent=String(s.tailCount);
   $('max-'+id).textContent=numbers(s.max);$('mean-'+id).textContent=numbers(s.mean);
   $('chart-'+id).innerHTML=histogram(s,e.phase==='ready'?null:old,e.threshold,ceiling);
   $('chart-'+id).setAttribute('aria-label',`${MODEL_INFO[id].label}：抽了 ${s.n} 次，${s.tailCount} 次比 ${e.threshold} 大。图外左侧还有 ${s.below} 个，右侧 ${s.above} 个；最大的数是 ${numbers(s.max)}。`);
   $('overflow-'+id).textContent=`图外还有：左边 ${s.below} 个、右边 ${s.above} 个，也都算在内。`;
   $('before-'+id).textContent=`最开始 30 次里，比 4 大的有 ${old.tailCount} 个；最大的数是 ${numbers(old.max)}。`;
   $('probability-'+id).textContent=`理论上，比 ${e.threshold} 大的数出现的概率约是 ${probability(row.theoreticalTail)}。这是数学公式给出的，不是这批数里出现的比例；电脑抽数还有精度限制，见下方说明。`;
   $('latest-'+id).textContent=`${operators[id]}最近抽到：`+s.latest.map(numbers).join(' · ');
   renderCollection($,row,e.threshold,pushed);
  }
  if(e.transfer){
   const t=e.transfer,s=t.stats;$('transfer-model').textContent='对数正态';$('chart-lognormal').innerHTML=histogram(s,null,16,ceiling);
   $('chart-lognormal').setAttribute('aria-label',`对数正态：抽了 ${s.n} 次，${s.tailCount} 次比 16 大；最大的数是 ${numbers(s.max)}。`);
   $('transfer-tail').textContent=`抽了 3,030 次，比 16 大的有 ${s.tailCount} 个`;
   $('transfer-probability').textContent=`这次有 ${frequency(s.tailRate)} 超过红线，公式算出的概率约是 ${probability(t.theoreticalTail)}。它的做法是先抽一个正态数 Z，再算 e 的 Z 次方。`;
   $('transfer-overflow').textContent=`和上面用同样的画法。图外左边还有 ${s.below} 个，右边 ${s.above} 个，也都算在内。最大的数是 ${numbers(s.max)}。`;
  }else{$('chart-lognormal').innerHTML='';for(const id of ['transfer-tail','transfer-probability','transfer-overflow'])$(id).textContent='';}
  $('answer-history').textContent=e.ending?(e.ending.firstAttemptCorrect?'你选了“只是这次没碰上”。对，没遇上，不等于以后不可能遇上。':'你一开始选了“没抽到就是不可能”，后来改选了“只是这次没碰上”。没遇上，确实不等于不可能。'):'';
  $('ending-summary').textContent=done?`三台各抽了 3,030 次。把红线从 4 挪到 16 后，超过它的次数变了：${e.rows.map((r,i)=>`${machineName(r.id)} ${e.comparison[i].stats.tailCount} → ${r.stats.tailCount} 次`).join('，')}。换一批数，具体次数可能不同。`:'';
 }
 function act(action){if(!active())return;state=actObservatory(state,action);render();}
 $('next-step').addEventListener('click',event=>{if(!active()||event.detail>1)return;const phase=state.phase;if(phase==='ready'||phase==='grown'){act({type:phase==='ready'?'grow':'push'});$('step-title').focus({preventScroll:true});}});
 for(const value of ['sample','zero'])$('answer-'+value).addEventListener('click',()=>{act({type:'answer',value});if(state.phase==='done'&&active()){$('ending-title').focus({preventScroll:true});$('ending-title').scrollIntoView({block:'start',behavior:'instant'});}});
 $('inspect-transfer').addEventListener('click',()=>act({type:'inspect'}));
 function restart(action){if(!active())return;for(const id of IDS)$('collection-details-'+id).open=false;act(action);$('step-title').focus({preventScroll:true});$('observation-title').scrollIntoView({block:'start',behavior:'instant'});}
 $('reset-sample').addEventListener('click',()=>restart({type:'reset'}));
 $('new-sample').addEventListener('click',()=>{if(!active())return;let value=crypto.getRandomValues(new Uint32Array(1))[0];if(value===state.seed)value=(value+1)>>>0;restart({type:'new-seed',value});});
 $('about').addEventListener('click',()=>{if(!doc.hidden)$('guide').showModal();});$('close-guide').addEventListener('click',()=>$('guide').close());
 function theme(dark){doc.documentElement.dataset.theme=dark?'dark':'light';$('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');}
 theme(media.matches);media.addEventListener('change',()=>{if(!explicitTheme)theme(media.matches);});$('theme').addEventListener('click',()=>{explicitTheme=true;theme(doc.documentElement.dataset.theme!=='dark');});
 render();
}
if(typeof document!=='undefined'&&document.getElementById('distribution-app'))initDistributions();
