import test from 'node:test';
import assert from 'node:assert/strict';

for(const [page,hash] of [
 ['learn.html',''],['learn.html','#route-task'],['recommendation.html','#seat-lesson'],
 ['firefly.html','#listening-lesson'],['distributions.html','#observation-title'],['agent-frames.html',''],
]){
 test(`navigation leaves the lesson and native anchor intact on ${page}${hash}`,async()=>{
  const added=[],scrolled=[];
  const task={before:node=>added.push(node),contains:()=>false};
  const intro={querySelector:()=>true,after:node=>added.push(node)};
  const doc={
   location:{pathname:'/algorithm-playground/'+page,hash},
   querySelectorAll:()=>[],
   querySelector:()=>intro,
   getElementById:()=>({closest:selector=>selector==='section'?task:null}),
   defaultView:{requestAnimationFrame:callback=>callback()},
   createElement:tag=>({tag,dataset:{},classList:{add(){}},append(){},setAttribute(){},scrollIntoView:()=>scrolled.push(tag)}),
  };
  globalThis.document=doc;
  try{await import(`../navigation.mjs?lesson-boot=${encodeURIComponent(page+hash)}`);}
  finally{delete globalThis.document;}
  assert.deepEqual(added,[]);
  assert.deepEqual(scrolled,[]);
 });
}
