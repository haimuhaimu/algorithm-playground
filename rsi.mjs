import {PATCH_LABELS} from './rsi-core.mjs?v=single-poster-1';
import {createPosterStory,posterStoryAction,posterStoryView} from './rsi-session.mjs?v=single-poster-1';

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

const ISSUE_NAMES={identity:'角色',outfit:'衣服',pose:'动作'};
const NEXT={mistake:'fix',repaired:'redraw',repeat:'propose',proof:'challenge'};
function storyCopy(s){
 const kept=s.decision==='keep';
 const pages={
  mistake:['01 / 先看这张图','栗栗怎么变成兔子了？','要求是狐狸，它却画了一只兔子。先只修角色，别动衣服和姿势。','把兔子修回狐狸 →'],
  repaired:['01 / 你修好了作品','这张好了。助手也学会了吗？','刚才改的是这张海报。再给它同一份要求，看看下一张会怎样。','让助手再画一次 →'],
  repeat:['02 / 还是同一份要求','怎么又是兔子？','因为你只修了作品，没改它的做法。这次，让助手先检查哪里不对，再试一个改法。','让助手先找错，再试改 →'],
  decision:['02 / 现在由你做决定','这条改法，要留下吗？','看看前后：角色变回狐狸，衣服和姿势没动。你决定把这个办法带到下一次，还是撤回。',''],
  proof:['03 / 按你的选择重新画',kept?'这次没再画成兔子。':'撤回后，它又画成了兔子。',
   kept?'你保留了新办法。这是助手重新画的，不是刚才那张修过的图。':'你没有留下新办法。助手仍按旧做法画，所以同一个错误又回来了。','换一个错误，看看它会不会处理 →'],
  challenge:['03 / 同一张海报，换个错误','这次哪里不对？','要求还是上方那一份。先选出你看到的问题，再让助手按你留下的办法处理。',''],
  ending:['本轮结束',kept?'它换了问题，也换了改法。':'旧办法没有解决这次的问题。',
   kept?'这次不再是角色错了。助手先找到衣服问题，再试着锁定绿色外套。':'它还在按固定顺序试：先改成正面。但要求是侧身，衣服也依然不对，因此没有留下这次试改。','']
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
  const v=posterStoryView(state),[stage,title,copy,next]=storyCopy(state),s=state;
  for(let n=1;n<=3;n++){if(n===v.chapter)$('chapter-'+n).setAttribute('aria-current','step');else $('chapter-'+n).removeAttribute('aria-current');}
  $('guide-stage').textContent=stage;$('guide-title').textContent=title;$('guide-copy').textContent=copy;
  $('master-art').innerHTML=poster({...s.job.target,scene:s.job.scene});
  $('before-figure').hidden=!v.before;$('art-pair').dataset.single=String(!v.before);
  $('before-art').innerHTML=v.before?poster(v.before):'';$('after-art').innerHTML=poster(v.after);
  const captions={
   mistake:['','助手刚画的'],repaired:['你动手前','你修好这张'],repeat:['你刚修好的','助手重新画的'],
   decision:['试改前','试改后 · 等你决定'],
   proof:s.decision==='keep'?['改助手之前','保留后，重新画']:['刚才的试改','撤回后，重新画'],
   challenge:['','新的参考，让它画成这样'],ending:['处理前','助手处理后']
  };
  [$('before-label').textContent,$('after-label').textContent]=captions[s.stage];
  $('art-status').hidden=s.stage==='challenge';
  $('art-status').textContent=v.issues.length?'这张还不符合：'+v.issues.map(i=>ISSUE_NAMES[i]).join('、'):'角色、衣服、姿势都符合这份要求。';
  $('story-next').hidden=!NEXT[s.stage];$('story-next').textContent=next;
  $('choice-controls').hidden=s.stage!=='decision';$('challenge-controls').hidden=s.stage!=='challenge';
  $('ending-controls').hidden=s.stage!=='ending';
  $('assistant-note').hidden=s.stage!=='decision';
  $('assistant-copy').textContent='我发现角色不像栗栗。先试“画角色时只用栗栗的母版”。如果你留下，以后我也先检查错在哪里，再选改法。';
  for(const issue of Object.keys(ISSUE_NAMES))$('guess-'+issue).setAttribute('aria-pressed',String(s.prediction===issue));
  $('run-assistant').disabled=!s.prediction;
  $('prediction-note').textContent=s.prediction?'你猜是'+ISSUE_NAMES[s.prediction]+'。先不公布答案，看看助手会怎么做。':'先选一个。你的猜测不会改变助手的做法。';
  $('revisit').hidden=!['proof','challenge','ending'].includes(s.stage);
  $('evidence').hidden=!['decision','proof','ending'].includes(s.stage);
  $('evidence-copy').textContent=s.stage==='ending'&&s.transfer
   ?'你'+(s.decision==='keep'?'保留':'撤回')+'了新办法。新参考只有衣服不符合要求；你猜的是'+ISSUE_NAMES[s.prediction]+'。助手实际试了「'+PATCH_LABELS[s.transfer.attempts[0].patch]+'」。符合全部要求的图片：'+s.transfer.before.passed+' → '+s.transfer.after.passed+' / 1。'
   :s.stage==='proof'?(s.decision==='keep'
    ?'已保留“角色只用栗栗母版”和“先找错再选改法”。现在这张狐狸是用新办法重新画的，不是把刚才修过的图拿回来。'
    :'未保留这次试改，也未改变助手找改法的方式。现在这只兔子是按旧办法重新画的；你刚才手动修好的那张仍留在本次故事记录里。')
   :'同一份花园委托，只试“角色只用栗栗母版”。其他条件没有变。试改前是一只兔子，试改后是一只狐狸；在你做决定前，助手的旧办法保持不变。';
  if(s.stage==='ending'){
   const correct=s.prediction==='outfit';
   $('outcome-label').textContent=correct?'你找对了：是衣服。':'你猜的是'+ISSUE_NAMES[s.prediction]+'，实际变的是衣服。';
   $('outcome-copy').textContent=s.decision==='keep'
    ?'你保留的“先找错再改”起作用了：它这次选的是衣服规则，而不是重复改角色。绿色外套回来了。'
    :'你撤回了“先找错再改”，它仍先试正面构图。衣服没有修好；撤回保护了旧做法，也放弃了这次改进。';
   $('takeaway').textContent='修图，只救回这一张。保留一个找错再改的办法，才可能帮助下一次。这个小实验有固定规则，不代表 AI 已能无限进化。';
  }
  measureArt();
 }
 function act(type,extra={}){
  const old=state,next=posterStoryAction(state,{type,...extra});if(next===state)return;
  state=next;render();
  if(old.stage!==state.stage){
   $('guide-title').focus({preventScroll:true});
   if(win.innerWidth<=700||win.innerHeight<=500)$('guide-title').scrollIntoView({block:'start',behavior:'instant'});
  }
 }
 $('story-next').addEventListener('click',()=>act(NEXT[state.stage]));
 for(const decision of ['keep','withdraw'])$(decision+'-rule').addEventListener('click',()=>act('decide',{decision}));
 for(const issue of Object.keys(ISSUE_NAMES))$('guess-'+issue).addEventListener('click',()=>act('predict',{issue}));
 $('run-assistant').addEventListener('click',()=>act('run'));
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
