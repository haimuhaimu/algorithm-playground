import {predict} from './neural-core.mjs';

// One display grid, not training state. Theme, points and cursor do not change
// these probabilities; compare the actual weights so rewind and in-place edits
// cannot reuse another model's field. Consumers treat the returned grid as read-only.
export function createPredictionField(cols,rows){
 let kind,weights=[],values;
 return model=>{
  if(values&&kind===model.kind&&weights.length===model.weights.length
   &&weights.every((w,i)=>Object.is(w,model.weights[i])))return values;
  const next=new Float64Array(cols*rows);
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   next[row*cols+col]=predict(model,(col+.5)/cols*2-1,1-(row+.5)/rows*2);
  }
  kind=model.kind;weights=[...model.weights];values=next;
  return values;
 };
}
