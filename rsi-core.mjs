// A deterministic, finite illustration interpreter. No model, generated code or external data.
export const ISSUE_LABELS=Object.freeze({identity:'角色变了',outfit:'衣服变了',pose:'动作不对'});
export const PATCH_LABELS=Object.freeze({frontPose:'所有图都改成正面',lockOutfit:'服装只用角色母版',lockIdentity:'角色只用身份母版',readPose:'动作读委托，不照抄参考'});
export const METHOD_LABELS=Object.freeze({cycle:'按固定顺序试',diagnose:'先归因，再试改法'});
const PATCHES={frontPose:{pose:'front'},lockOutfit:{outfit:'locked'},lockIdentity:{identity:'locked'},readPose:{pose:'brief'}};
const FIELDS={identity:'species',outfit:'coat',pose:'pose'};
const groups={
 first:[['花园打招呼','garden','front','fox','green','front'],['海边看日落','sea','side','rabbit','green','side'],['月球跳一跳','moon','jump','fox','coral','jump']],
 method:[['雨后散步','garden','side','rabbit','green','side'],['海浪上起跳','sea','jump','fox','coral','jump'],['月球合影','moon','front','rabbit','coral','front']],
 transfer:[['花园跃起','garden','jump','rabbit','coral','front'],['海边侧身','sea','side','fox','green','front'],['月面腾空','moon','jump','rabbit','coral','front']]
};
export function createWorkflow(){return {version:0,identity:'mixed',outfit:'mixed',pose:'reference',improver:'cycle'};}
export function briefs(group){
 if(!Object.hasOwn(groups,group))throw Error('Unknown brief group');
 return groups[group].map(([title,scene,pose,species,coat,refPose],i)=>({id:group+'-'+i,title,scene,target:{species:'fox',coat:'green',pose},reference:{species,coat,pose:refPose}}));
}
export function draw(workflow,job,variation=0){
 if(!Number.isInteger(variation)||variation<0)throw Error('Invalid variation');
 const v=variation%3,ref=job.reference;
 return {id:job.id,scene:job.scene,species:workflow.identity==='locked'?job.target.species:[ref.species,ref.species==='fox'?'rabbit':'fox',ref.species][v],
 coat:workflow.outfit==='locked'?job.target.coat:[ref.coat,ref.coat==='green'?'coral':'green',ref.coat][v],
 pose:workflow.pose==='brief'?job.target.pose:workflow.pose==='front'?'front':[ref.pose,ref.pose,ref.pose==='front'?'jump':'front'][v],variation};
}
export function produce(workflow,jobs){return jobs.map(job=>draw(workflow,job));}
export function assess(art,jobs){
 if(art.length!==jobs.length||art.some((a,i)=>a.id!==jobs[i].id))throw Error('Artwork and briefs must align');
 const counts={identity:0,outfit:0,pose:0};
 const issues=art.map((a,i)=>Object.entries(FIELDS).filter(([,field])=>a[field]!==jobs[i].target[field]).map(([key])=>{counts[key]++;return key;}));
 return {art:structuredClone(art),issues,counts,passed:issues.filter(a=>!a.length).length,total:jobs.length};
}
export function retouch(art,job,issue){
 if(!Object.hasOwn(FIELDS,issue)||art.id!==job.id)throw Error('Invalid retouch');
 const field=FIELDS[issue];return {...art,[field]:job.target[field]};
}
export function improve(workflow,jobs,method=workflow.improver,budget=2){
 if(!Object.hasOwn(METHOD_LABELS,method)||!Number.isInteger(budget)||budget<0||budget>4)throw Error('Invalid improvement trial');
 const before=assess(produce(workflow,jobs),jobs),attempts=[],used=new Set();
 let current={...workflow,improver:method},after=before;
 while(attempts.length<budget){
  const choices=method==='cycle'?['frontPose','lockOutfit','lockIdentity','readPose']:
   Object.entries(after.counts).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).map(([key])=>({identity:'lockIdentity',outfit:'lockOutfit',pose:'readPose'})[key]);
  const patch=choices.find(p=>!used.has(p)&&Object.entries(PATCHES[p]).some(([k,v])=>current[k]!==v));
  if(!patch)break;
  used.add(patch);
  const proposed={...current,...PATCHES[patch],version:current.version+1},result=assess(produce(proposed,jobs),jobs);
  const accepted=result.passed>after.passed;
  attempts.push({patch,accepted,workflow:proposed,before:after,after:result});
  if(accepted){current=proposed;after=result;}
 }
 return {method,budget,before,after,attempts,workflow:current};
}
