import {ISSUE_LABELS} from './rsi-core.mjs?v=rule-trial-1';
import {createPosterStory,posterStoryAction,posterStoryView} from './rsi-session.mjs?v=rule-trial-1';

const POSES={front:'正面打招呼',side:'侧身',jump:'跃起'};
export function poster(art){
 const fox=art.species==='fox',side=art.pose==='side',jump=art.pose==='jump',moon=art.scene==='moon',sea=art.scene==='sea';
 const fur=fox?'#d98043':'#f6eee0',dark='#493d34',cream='#ffebcd',coat=art.coat==='green'?'#597e63':'#c86e62';
 const bg=moon?'#263b50':sea?'#f1c8a1':'#e1e6c8',ink=moon?'#efe9ce':'#4f5941';
 const title=moon?'MOON WALK':sea?'SLOW SUNSET':'GARDEN CLUB';
 const scenery=moon?
  '<circle cx="185" cy="69" r="30" fill="#e4dab7"/><circle cx="195" cy="61" r="7" fill="#c5c1a1"/><path d="M0 256 Q100 218 240 252 V300 H0Z" fill="#8d9a96"/><ellipse cx="198" cy="267" rx="17" ry="5" fill="#697e7c"/><path d="M45 72v9m-4-4h8m130 43v8m-4-4h8m-64-57v5m-3-3h6" stroke="#e2dfc6" stroke-width="2"/>':
  sea?'<circle cx="180" cy="93" r="36" fill="#dc815f"/><path d="M0 155 Q55 140 120 154 T240 150 V300 H0Z" fill="#99bdba"/><path d="M0 183 Q60 168 130 184 T240 177M0 215 Q70 194 140 213 T240 207" fill="none" stroke="#d1e1cf" stroke-width="3"/><path d="M0 254 Q100 222 240 260 V300 H0Z" fill="#e9d9b5"/>':
  '<circle cx="179" cy="82" r="36" fill="#f1d282"/><path d="M0 214 Q70 160 141 215 T240 198 V300 H0Z" fill="#9ab48a"/><path d="M0 263 Q80 204 240 249 V300 H0Z" fill="#bcca95"/><path d="M30 243v-39m0 23q-22-2-16-15q21 0 16 15m0-10q20-2 16-15q-19 0-16 15m174 36v-28" stroke="#627d56" stroke-width="2" fill="#7d9b67"/><circle cx="204" cy="221" r="7" fill="#eee8c1"/>';
 const ears=fox?'<path d="M79 128 L73 72 L109 104 M131 104 L164 72 L160 132" fill="'+fur+'" stroke="'+dark+'" stroke-width="2.5"/><path d="M84 105 L81 85 L99 104 M140 104 L158 85 L153 108" fill="#76504a"/>':'<ellipse cx="96" cy="91" rx="12" ry="40" fill="'+fur+'" stroke="'+dark+'" stroke-width="2.5" transform="rotate(-12 96 91)"/><ellipse cx="142" cy="91" rx="12" ry="40" fill="'+fur+'" stroke="'+dark+'" stroke-width="2.5" transform="rotate(10 142 91)"/><path d="M95 66v36m47-36v36" stroke="#d9a7a0" stroke-width="6" stroke-linecap="round"/>';
 const arms=jump?'<path d="M91 179 L65 152 M149 179 L176 149" stroke="'+coat+'" stroke-width="15" stroke-linecap="round"/><circle cx="62" cy="149" r="8" fill="'+fur+'"/><circle cx="179" cy="146" r="8" fill="'+fur+'"/>':side?'<path d="M129 181 L159 207" stroke="'+coat+'" stroke-width="15" stroke-linecap="round"/><circle cx="162" cy="210" r="8" fill="'+fur+'"/>':'<path d="M88 180 L64 159 M150 180 L160 211" stroke="'+coat+'" stroke-width="15" stroke-linecap="round"/><circle cx="60" cy="155" r="8" fill="'+fur+'"/><circle cx="162" cy="215" r="8" fill="'+fur+'"/>';
 const legs=jump?'<path d="M105 220 L86 238 L70 229 M137 220 L154 235 L171 223" fill="none" stroke="'+dark+'" stroke-width="12" stroke-linecap="round"/>':'<path d="M107 218 V248 H95 M136 218 V248 H148" fill="none" stroke="'+dark+'" stroke-width="12" stroke-linecap="round"/>';
 const face=side?'<path d="M81 111 Q112 89 146 112 L173 140 L147 156 Q105 169 83 145Z" fill="'+fur+'" stroke="'+dark+'" stroke-width="2.5"/><path d="M134 130 L173 140 L147 156 L119 147Z" fill="'+cream+'"/><circle cx="135" cy="125" r="4" fill="'+dark+'"/><path d="M166 136l10 4-8 5Z" fill="'+dark+'"/>':
 '<path d="M78 112 Q119 91 162 112 L157 145 Q120 180 82 146Z" fill="'+fur+'" stroke="'+dark+'" stroke-width="2.5"/><path d="M83 135 Q101 132 120 150 Q139 132 157 135 Q144 160 120 165 Q96 160 83 135Z" fill="'+cream+'"/><circle cx="100" cy="127" r="4" fill="'+dark+'"/><circle cx="140" cy="127" r="4" fill="'+dark+'"/><path d="M115 146q5-5 10 0l-5 5Z" fill="'+dark+'"/><path d="M120 151v5m0-1q-5 5-9 0m9 0q5 5 9 0" fill="none" stroke="'+dark+'" stroke-width="1.5"/>';
 const label=(fox?'狐狸':'兔子')+'，'+(art.coat==='green'?'绿色':'珊瑚色')+'外套，'+POSES[art.pose];
 return '<svg viewBox="0 0 240 300" role="img" aria-label="'+label+'"><title>'+label+'</title><rect width="240" height="300" fill="'+bg+'"/><rect x="10" y="10" width="220" height="280" rx="2" fill="none" stroke="'+ink+'" opacity=".28"/><text x="22" y="35" fill="'+ink+'" font-family="Georgia,serif" font-size="17" letter-spacing="1">'+title+'</text><text x="23" y="49" fill="'+ink+'" font-family="sans-serif" font-size="6.5" letter-spacing="2.5">A LITTLE ADVENTURE / LILI</text>'+scenery+'<ellipse cx="120" cy="255" rx="'+(jump?30:43)+'" ry="7" fill="#354a35" opacity=".18"/><g transform="'+(jump?'translate(-13 -9) rotate(-7 120 170)':'translate(0 0)')+'"><path d="M149 208 Q213 198 193 158 Q168 158 151 193" fill="'+fur+'" stroke="'+dark+'" stroke-width="2.5"/><path d="M192 158 Q208 178 188 191 L180 173Z" fill="'+cream+'"/>'+legs+arms+'<path d="M91 168 Q120 158 149 168 L156 221 Q119 231 85 221Z" fill="'+coat+'" stroke="'+dark+'" stroke-width="2.5"/><path d="M120 172v51" stroke="'+dark+'" opacity=".35"/><circle cx="137" cy="184" r="7" fill="#efd98f"/><path d="M137 179v10m-5-5h10" stroke="'+dark+'" stroke-width="1.5"/>'+ears+face+'</g><text x="22" y="281" fill="'+ink+'" font-family="sans-serif" font-size="7" letter-spacing="1.8">LILI STUDIO — ORIGINAL CHARACTER</text></svg>';
}

const NEXT={mistake:'fix',repaired:'redraw',repeat:'propose',trial:'challenge'};
function storyCopy(s){
 const kept=s.decision==='keep';
 const pages={
  mistake:['01 / 先修这张图','这次，外套颜色画错了。','委托要绿色外套，助手却用了珊瑚色。先只改这张海报，角色和姿势都保留。','把这张外套改成绿色 →'],
  repaired:['01 / 你修好了作品','这张好了，下一张呢？','刚才只修了作品，没有改助手的规则。用同一份要求重新画一次。','让助手再画一次 →'],
  repeat:['01 / 错误又回来了','它还是照着参考图用色。','助手提出一个办法：“以后不管收到什么要求，外套都固定绿色。”先试，不急着留下。','先试“固定绿色”这个办法 →'],
  trial:['02 / 只在旧委托上试过','这张对了，就能留下吗？','这条规则确实修好了绿色委托。但它说的是“以后都绿色”。先换一份要求，看看有没有副作用。','先试一份新委托 →'],
  challenge:['02 / 新委托，只换外套颜色','这次要珊瑚色，它会听吗？','还是同一张花园海报，角色和姿势不变。只把外套要求换成珊瑚色：用“固定绿色”重画，会发生什么？',''],
  decision:['03 / 看过副作用，再取舍','这条改法，真该留下吗？','左边是旧办法，右边是候选规则，拿到完全相同的新委托。旧任务变好了，新任务却被改错了。你还要把这条规则带到以后吗？',''],
  ending:['本轮结束',kept?'规则留下了，副作用也留下了。':'撤回规则，修好的作品还在。',
   kept?'接到同一份珊瑚色委托，助手依然固定画绿色。保留会真的改变以后的做法，但不保证符合新要求。':'你没有安装“固定绿色”。助手继续按旧办法用参考图的颜色，这次恰好符合珊瑚色要求。撤回不是丢掉你修好的图。','']
 };
 return pages[s.stage];
}
export function initStudio(doc=document,win=window){
 let state=createPosterStory();
 const $=id=>doc.getElementById(id);
 function measureArt(){
  const box=$('art-desk').getBoundingClientRect?.();
  if(box&&doc.documentElement.style)doc.documentElement.style.setProperty('--pinned-art-height',Math.ceil(box.height+18)+'px');
 }
 function render(){
  const v=posterStoryView(state),[stage,title,copy,next]=storyCopy(state),s=state,newBrief=s.job.target.coat==='coral';
  for(let n=1;n<=3;n++){if(n===v.chapter)$('chapter-'+n).setAttribute('aria-current','step');else $('chapter-'+n).removeAttribute('aria-current');}
  $('guide-stage').textContent=stage;$('guide-title').textContent=title;$('guide-copy').textContent=copy;
  $('master-art').innerHTML=poster({...s.job.target,scene:s.job.scene});
  $('brief-title').textContent=newBrief?'新委托 · 只换外套颜色':'旧委托 · 先要绿色';
  $('brief-copy').textContent='狐狸 · '+(newBrief?'珊瑚色':'绿色')+'外套 · 侧身';
  $('before-figure').hidden=!v.before;$('art-pair').dataset.single=String(!v.before);
  $('before-art').innerHTML=v.before?poster(v.before):'';$('after-art').innerHTML=poster(v.after);
  const captions={
   mistake:['','助手刚画的'],repaired:['你动手前','你修好这张'],repeat:['你刚修好的','旧办法重新画'],
   trial:['旧办法 · 旧委托','候选规则 · 只试不保存'],
   challenge:['','新委托 · 用旧办法画'],
   decision:['旧办法 · 同一份新委托','候选规则 · 同一份新委托'],
   ending:['旧办法 · 同一份新委托',s.decision==='keep'?'保留规则后，重新画':'撤回规则后，重新画']
  };
  [$('before-label').textContent,$('after-label').textContent]=captions[s.stage];
  $('art-status').hidden=s.stage==='challenge';
  $('art-status').textContent=v.issues.length?'与当前要求不符：'+v.issues.map(i=>ISSUE_LABELS[i]).join('、'):'角色、衣服、姿势都符合当前委托。';
  $('story-next').hidden=!NEXT[s.stage];$('story-next').textContent=next;
  $('choice-controls').hidden=s.stage!=='decision';$('challenge-controls').hidden=s.stage!=='challenge';
  $('ending-controls').hidden=s.stage!=='ending';
  $('assistant-note').hidden=!['trial','challenge','decision'].includes(s.stage);
  $('assistant-copy').textContent='候选规则：外套永远固定绿色。只改衣服，不改变角色、姿势，也不改变助手找改法的方法。现在只是试用，尚未保存。';
  for(const prediction of ['green','brief'])$('predict-'+prediction).setAttribute('aria-pressed',String(s.prediction===prediction));
  $('run-trial').disabled=!s.prediction;
  $('prediction-note').textContent=s.prediction?'你猜它会'+(s.prediction==='green'?'仍画绿色':'按新要求画珊瑚色')+'。试一次，看实际结果。':'先猜一下，再亲手试。你的猜测不会改变规则的输出。';
  $('revisit').hidden=s.stage!=='ending';
  $('rule-evidence').hidden=!s.transfer;
  if(s.transfer){
   $('trial-summary').textContent='同一条候选规则：旧委托（要绿色）'+(s.proposal.after.passed?'通过':'未通过')+'；新委托（要珊瑚色）'+(s.transfer.after.passed?'通过':'未通过')+'。';
   $('prediction-result').textContent=s.prediction==='green'?'你猜对了：它仍画绿色，没有读取新的颜色要求。':'你猜它会听新要求，实际仍是绿色：固定颜色覆盖了新要求。';
  }
  $('evidence').hidden=!s.proposal;
  $('evidence-copy').textContent=s.proposal
   ?'固定绿色规则只改外套，未改变角色、动作或改进方法。旧委托通过数：'+s.proposal.before.passed+' → '+s.proposal.after.passed+' / 1。'+(s.transfer?'同一份新委托、同一张参考图，旧办法通过 '+s.transfer.before.passed+' / 1，候选规则通过 '+s.transfer.after.passed+' / 1。':'尚未测试新委托。')+(s.decision==='keep'?'你已保留这条规则。':s.decision==='withdraw'?'你已撤回这条规则，旧办法未改变。':'助手仍用旧办法；候选规则没有安装。')
   :'';
  if(s.stage==='ending'){
   $('outcome-label').textContent=s.decision==='keep'?'已保留：以后仍固定绿色。':'已撤回：不安装固定绿色规则。';
   $('outcome-copy').textContent=s.decision==='keep'
    ?'试用发现的问题没有消失：助手仍忽略珊瑚色要求。这是保留后的真实输出，不会为了奖励你的选择而改成正确颜色。'
    :'旧办法未被覆盖。这次按参考图画出了珊瑚色；它也并非总是正确——之前的绿色委托就画错过。';
   $('saved-repair').textContent='你最初手动修好的绿色海报仍保留在本轮记录里，保留或撤回规则都不会改写它。';
   $('takeaway').textContent='修好当前作品，不代表这条办法值得带到以后。先试新要求，看有没有副作用，再决定保留或撤回。两份委托只是有限证据，不代表规则在所有任务上都有效。';
  }
  measureArt();
 }
 function act(type,extra={}){
  const old=state,next=posterStoryAction(state,{type,...extra});if(next===state)return;
  state=next;render();
  if(old.stage!==state.stage){
   $('guide-title').focus({preventScroll:true});
   $('guide-title').scrollIntoView({block:'start',behavior:'instant'});
  }
 }
 $('story-next').addEventListener('click',()=>act(NEXT[state.stage]));
 for(const decision of ['keep','withdraw'])$(decision+'-rule').addEventListener('click',()=>act('decide',{decision}));
 for(const prediction of ['green','brief'])$('predict-'+prediction).addEventListener('click',()=>act('predict',{prediction}));
 $('run-trial').addEventListener('click',()=>act('run'));
 $('revisit').addEventListener('click',()=>act('revisit'));
 $('reset').addEventListener('click',()=>act('reset'));
 $('theme').addEventListener('click',()=>{
  const dark=doc.documentElement.dataset.theme!=='dark';
  doc.documentElement.dataset.theme=dark?'dark':'light';
  $('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');
 });
 if(win.ResizeObserver){const observer=new win.ResizeObserver(measureArt);observer.observe($('art-desk'));}
 render();return {get state(){return state;}};
}
if(typeof document!=='undefined'&&typeof window!=='undefined')initStudio();
