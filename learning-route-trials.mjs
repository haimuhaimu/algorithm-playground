import {createLearningRoute,actLearningRoute} from './learning-route.mjs';
import {gradientEvidence} from './neural-gradient.mjs';
import {replayLearningReceipt} from './learning-tool.mjs';

const wire=n=>Number(n.toPrecision(12));

// An optional view over the existing receipt, not a new receipt or identity proof.
// Validate the whole v1 record before deriving any extra numerical evidence.
export function inspectLearningRouteTrials(receipt){
 if(receipt?.experimentId!=='learning-route')throw Error('Expected learning-route receipt');
 const {receipt:verified}=replayLearningReceipt(receipt),state=createLearningRoute(),trials=[];
 verified.actions.forEach((request,index)=>{
  if(verified.steps[index].status==='rejected')return;
  actLearningRoute(state,request.action,request.value);
  if(request.action==='reset')trials.length=0;
  if(request.action!=='step'||verified.steps[index].status!=='applied'||state.stage!=='gradient')return;
  const evidence=gradientEvidence(state.gradient);
  trials.push({ordinal:trials.length+1,rate:wire(evidence.rate),guess:state.stepGuess,
   lossBefore:wire(evidence.lossBefore),lossAfter:wire(evidence.lossAfter),
   weightsBefore:evidence.lastWeights.map(wire),weightsAfter:state.gradient.model.weights.map(wire)});
 });
 return trials;
}
