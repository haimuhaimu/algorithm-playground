import {ISSUE_LABELS,PATCH_LABELS,METHOD_LABELS,assess} from './rsi-core.mjs';
import {createStudio,studioAction} from './rsi-session.mjs';

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
function guide(s){
 const first=s.firstRecord;
 const copy={
 welcome:['01 / 创作总监就位','三张图，你敢交哪张？','栗栗要去花园、海边和月球。助手把角色参考和场景参考混用了。先看看：它们还是同一只狐狸吗？'],
 curate:['01 / 选片与定点返修','先救作品，最多改三次。','点击缩略图换片，对照母版和动作要求。选进精选，或花一次机会只修一处；整张重画也花一次，但会重新组合细节。'],
 method:['02 / 下一组又出问题了',first?.passed===3?'图修好了，方法却没变。':'换了委托，同类问题还在。',(first?.spent?'上次的操作只作用于那几张作品。':'你没有返修，直接接了新一组委托。')+'现在让助手改可复用的出图规则；你来决定它怎样寻找改法。'],
 trial:['02 / 两次小样的真实记录',s.method==='diagnose'?'先找原因，少走弯路。':'按顺序试，也可能试错方向。','左边始终是同一批原始出图，右边是这套方法留下的最佳版本。没有更好的候选会被拒绝，不会偷偷装上。'],
 transfer:['03 / 陌生的动作委托','这次，换你没教过的动作。','新的任务没有参与刚才的试验。角色和衣服只是第一关：参考图都是正面，新委托却要侧身与跃起。'],
 judgment:['03 / 独立判断','这次真的值得升级吗？','你没有手动点“修动作”。助手用继承的方法选了一条规则，并在这批新图上实际试过。看画面、看结果，再决定安装。'],
 ending:['本轮结束','留下的不只是一组图。','下面保留了你这轮的作品、方法和新委托记录。可以换一种选择重玩，比较不同路径。']
 };
 return {chapter:['welcome','curate'].includes(s.stage)?1:['method','trial'].includes(s.stage)?2:3,lines:copy[s.stage],first};
}
const flowLabel=w=>[
 w.identity==='locked'?'角色锁母版':'角色混用参考',
 w.outfit==='locked'?'服装锁母版':'服装混用参考',
 w.pose==='brief'?'动作读委托':w.pose==='front'?'统一正面':'动作照参考'
].join(' · ');
function reportHTML(r){
 return '<div class="score-line"><strong>'+r.before.passed+' → '+r.after.passed+'</strong><span>三张中符合委托的张数<br>实际用了 '+r.attempts.length+' / '+r.budget+' 次小样</span></div><ol class="attempt-list">'+r.attempts.map((a,i)=>'<li><b>'+String(i+1).padStart(2,'0')+' / '+PATCH_LABELS[a.patch]+'</b><small>'+a.before.passed+'/3 → '+a.after.passed+'/3 · <em>'+(a.accepted?'有提升，留在候选里':'没有提升，拒绝这条修改')+'</em></small></li>').join('')+'</ol>';
}
export function initStudio(doc=document,win=window){
 let state=createStudio();
 const $=id=>doc.getElementById(id);
 function render(){
  const g=guide(state),[step,title,copy]=g.lines,index=state.active,art=state.art[index],job=state.jobs[index],phase=state.stage;
  for(let n=1;n<=3;n++){if(n===g.chapter)$('chapter-'+n).setAttribute('aria-current','step');else $('chapter-'+n).removeAttribute('aria-current');}
  $('guide-stage').textContent=step;$('guide-title').textContent=title;$('guide-copy').textContent=copy;
  $('batch-label').textContent=g.chapter===1?'首批委托 / 选片与返修':g.chapter===2?'第二批 / 方法试验':'新委托 / 检验迁移';
  $('master-art').innerHTML=poster({species:'fox',coat:'green',pose:'front',scene:'garden'});
  $('brief-copy').textContent='这张要：'+POSES[job.target.pose];
  $('before-art').innerHTML=poster(state.before[index]);$('after-art').innerHTML=poster(art);
  $('before-label').textContent=g.chapter===1?'原始出图':'本轮改进前';
  $('after-label').textContent=['trial','judgment'].includes(phase)?'候选效果 · 未安装':phase==='ending'?'最终采用版本':'你的当前版本';
  const quality=assess(state.art,state.jobs);
  $('art-mark').textContent=g.chapter===1?(state.selected[index]?'已精选':'待你选片'):(quality.issues[index].length?quality.issues[index].map(i=>ISSUE_LABELS[i]).join(' / '):'符合委托 ✓');
  for(let i=0;i<3;i++){
   $('pick-'+i).setAttribute('aria-pressed',String(index===i));$('pick-'+i).setAttribute('aria-label','查看第 '+(i+1)+' 张：'+state.jobs[i].title);
   $('thumb-'+i).innerHTML=poster(state.art[i]);$('name-'+i).textContent=state.jobs[i].title;
   $('picked-'+i).textContent=g.chapter===1?(state.selected[i]?'已精选 ✓':'待选片'):(quality.issues[i].length?'待改进':'符合委托 ✓');
  }
  const visible={start:phase==='welcome','edit-controls':phase==='curate','method-controls':phase==='method','trial-controls':phase==='trial','transfer-controls':phase==='transfer','judgment-controls':phase==='judgment',ending:phase==='ending'};
  for(const [id,show]of Object.entries(visible))$(id).hidden=!show;
  $('budget').textContent=state.credits+' / 3';
  $('desk-budget').hidden=phase!=='curate';$('desk-budget').textContent='剩余 '+state.credits+' 次';
  for(const id of ['fix-identity','fix-outfit','fix-pose','redraw'])$(id).disabled=phase!=='curate'||state.credits===0;
  $('curate').setAttribute('aria-pressed',String(state.selected[index]));$('curate').textContent=state.selected[index]?'已精选 · 点击撤回 ✓':'加入精选 ＋';
  $('pick-count').textContent='已精选 '+state.selected.filter(Boolean).length+' / 3 张 · 不花返修预算';
  for(const method of ['cycle','diagnose'])$('method-'+method).setAttribute('aria-pressed',String(state.method===method));
  if(state.firstRecord)$('first-receipt').textContent='上一组：你精选了 '+state.firstRecord.picked+' 张，其中 '+state.firstRecord.qualified+' 张符合委托。用了 '+state.firstRecord.spent+' 次操作；这一组仍按旧方法出图。';
  if(phase==='trial'){
   $('trial-report').innerHTML=reportHTML(state.candidate)+'<p class="comparison-note">'+(Object.keys(state.methodReports).length===2?'同一批图、各两次机会：固定顺序 '+state.methodReports.cycle.after.passed+'/3；先归因 '+state.methodReports.diagnose.after.passed+'/3。':'另一套方法还没试；可以在相同任务和预算下对照。')+'</p>';
   $('adopt').textContent='保留「'+METHOD_LABELS[state.method]+'」，接新委托 →';
  }
  if(phase==='judgment')$('transfer-report').innerHTML=reportHTML(state.transferRecord);
  $('notice').textContent=state.notice||(phase==='curate'&&state.credits===0?'预算用完了。仍可选片或撤回精选，再交这一组。':'');
  $('workflow-label').textContent=flowLabel(state.workflow);$('improver-label').textContent=METHOD_LABELS[state.workflow.improver];
  $('candidate-note').textContent=['trial','judgment'].includes(phase)?'右侧画面是试验候选，尚未替换当前安装的方法。':'只修一张作品，不会自动改变这里的规则。';
  $('desk-caption').textContent=g.chapter===1?'点击缩略图换片。对照母版，再决定哪张值得留下。':'前后使用同一份委托。切换三张作品，看看究竟改了什么。';
  if(phase==='ending')renderEnding();
 }
 function renderEnding(){
  const s=state,f=s.firstRecord,t=s.transferRecord,chosen=s.methodReports[s.workflow.improver];
  $('ending-summary').textContent='你把「'+METHOD_LABELS[s.workflow.improver]+'」带到了新委托。最终'+(s.decision==='adopt'?'采用试验候选':'保留原版')+'，三张中有 '+s.finalRecord.passed+' 张符合角色、服装和动作要求。分数不评价审美。';
  $('recap-first').textContent=f.qualified+' / 3 张精选合格';
  $('recap-first-copy').textContent='你用了 '+f.spent+' 次操作，精选 '+f.picked+' 张；当前作品共有 '+f.passed+' 张符合要求。但下一组仍回到混用参考的旧流程：单张返修没有被写进方法。';
  $('recap-method').textContent=Object.keys(s.methodReports).length===2?'固定 '+s.methodReports.cycle.after.passed+' / '+s.methodReports.cycle.after.total+' · 归因 '+s.methodReports.diagnose.after.passed+' / '+s.methodReports.diagnose.after.total:chosen.before.passed+' → '+chosen.after.passed+' / '+chosen.after.total;
  $('recap-method-copy').textContent=(s.workflow.improver==='diagnose'?'你保留了“先统计失败类型，再选择对应规则”。它同时改变出图流程和寻找改法的方式。':'你保留了固定顺序。它能改进某些图，但并没有获得根据问题选择改法的能力。')+(Object.keys(s.methodReports).length<2?'另一方法未运行，不替它填成绩。':'两者使用同一批图和相同预算。');
  $('recap-transfer').textContent=t.before.passed+' → '+t.after.passed+' / 3';
  $('recap-transfer-copy').textContent=(s.workflow.improver==='diagnose'?'继承的改进器从“动作不对”出发，选择“动作读委托”，而不是复读上一轮的锁脸规则。':'固定顺序又先试了正面构图，没有解决新任务的动作问题。')+'上方是候选的试验结果；你选择'+(s.decision==='adopt'?'采用候选':'保留原版')+'，最终 '+s.finalRecord.passed+'/'+s.finalRecord.total+' 张符合委托。';
  for(const answer of ['picture','method','unlimited'])$('answer-'+answer).setAttribute('aria-pressed',String(s.answer===answer));
  $('answer-feedback').textContent=s.answer==='method'?(s.workflow.improver==='diagnose'?'对：关注的是“寻找下一次改法的方法”也被改变，并在新任务里被使用。一次有限模拟仍不能证明开放式 RSI。':'这是核心关注点。不过你这轮保留了固定顺序，没有改变寻找改法的方法；可以换成“先归因”再比较。'):s.answer==='picture'?'不只是这几张图。单张返修改变作品；RSI 更关心系统怎样改进自己的改进能力。':s.answer==='unlimited'?'还不能这样下结论。这里的规则和候选都是预设的，一次成功不意味着无限变强。':'选一个，用这轮实际发生的事来判断。';
 }
 function act(type,extra={}){
  const old=state,next=studioAction(state,{type,...extra});if(next===state)return;
  state=next;render();
  if(state.stage==='ending'&&old.stage!=='ending'){$('ending-title').focus({preventScroll:true});$('ending').scrollIntoView({block:'start',behavior:'instant'});}
  else if(state.stage!==old.stage){$('guide-title').focus({preventScroll:true});if(win.innerWidth<=700)$('guide-stage').scrollIntoView({block:'start',behavior:'instant'});}
 }
 for(let i=0;i<3;i++)$('pick-'+i).addEventListener('click',()=>act('select',{index:i}));
 for(const issue of ['identity','outfit','pose'])$('fix-'+issue).addEventListener('click',()=>act('retouch',{issue}));
 for(const type of ['start','redraw','curate','next','trial','alternate','adopt','repair-next'])$(type).addEventListener('click',()=>act(type));
 for(const method of ['cycle','diagnose'])$('method-'+method).addEventListener('click',()=>act('method',{method}));
 for(const decision of ['adopt','keep'])$('finish-'+decision).addEventListener('click',()=>act('finish',{decision}));
 for(const answer of ['picture','method','unlimited'])$('answer-'+answer).addEventListener('click',()=>act('answer',{answer}));
 for(const id of ['reset','replay'])$(id).addEventListener('click',()=>{act('reset');$('start').focus({preventScroll:true});$('workshop').scrollIntoView({block:'start',behavior:'instant'});});
 $('theme').addEventListener('click',()=>{const dark=doc.documentElement.dataset.theme!=='dark';doc.documentElement.dataset.theme=dark?'dark':'light';$('theme').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');});
 render();return {get state(){return state;}};
}
if(typeof document!=='undefined'&&typeof window!=='undefined')initStudio();
