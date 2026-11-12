const art = Object.freeze({
 heim: Object.freeze({idleWidth:2.0, runWidth:2.45, idleFacing:1, runFacing:-1}),
 bobby: Object.freeze({idleWidth:1.65, runWidth:2.4, idleFacing:-1, runFacing:-1}),
 chouchou: Object.freeze({idleWidth:1.52, runWidth:1.46, idleFacing:1, runFacing:1}),
});

const asset=(id,kind)=>`./studio-${id}-${kind}.png`;
export const studioMotionAssets=Object.freeze(Object.keys(art).flatMap(id=>[asset(id,'idle'),asset(id,'run')]));
export function studioPortrait(id){
 return Object.hasOwn(art,id)?asset(id,'portrait'):null;
}
export function studioPose(cat){
 if(!cat||!Object.hasOwn(art,cat.id))return null;
 const moving=cat.from!==cat.to;
 const pose=art[cat.id];
 return {
  src:asset(cat.id,moving?'run':'idle'),
  width:moving?pose.runWidth:pose.idleWidth,
  facing:moving?pose.runFacing:pose.idleFacing,
  moving,
 };
}
