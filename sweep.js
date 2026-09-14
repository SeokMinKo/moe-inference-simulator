// Bounded parameter paths. Playback speed is UI time, never simulated hardware time.
function buildSweepValues(o){
 if(!['up','down'].includes(o.direction))throw new Error('Choose an increase or decrease direction.');
 let values;
 if(o.mode==='presets'){
  values=[...new Set(o.values||[])];
  if(!values.length)throw new Error('No common values are available for this parameter.');
 }else if(o.mode==='range'){
  const {start,end,step}=o;
  if(![start,end,step].every(Number.isFinite)||step<=0||end<start)throw new Error('Use finite From ≤ To values and a positive step.');
  if(o.integer&&![start,end,step].every(Number.isSafeInteger))throw new Error('Count parameters require whole-number endpoints and steps.');
  const count=Math.floor((end-start)/step+1e-10)+1;
  if(count>200)throw new Error('Use at most 200 points. Increase the step or shorten the range.');
  values=Array.from({length:count},(_,i)=>Number((start+i*step).toPrecision(12)));
  if(values.at(-1)<end-1e-10*Math.max(1,Math.abs(end)))values.push(end);
 }else throw new Error('Choose common values or a custom range.');
 if(values.length>200)throw new Error('Use at most 200 points.');
 for(const v of values){if(typeof v==='number'&&(!Number.isFinite(v)||v<(o.min??-Infinity)||v>(o.max??Infinity)||(o.integer&&!Number.isSafeInteger(v))))throw new Error('Sweep values exceed this parameter’s bounds.');}
 if(new Set(values).size!==values.length)throw new Error('Step is too small for the numerical precision.');
 return o.direction==='down'?values.reverse():values;
}
function mergeRoofDomains(domains){
 if(!domains.length)return null;
 return {xmin:Math.min(...domains.map(d=>d.xmin)),xmax:Math.max(...domains.map(d=>d.xmax)),ymin:Math.min(...domains.map(d=>d.ymin)),ymax:Math.max(...domains.map(d=>d.ymax))};
}
if(typeof module!=='undefined')module.exports={buildSweepValues,mergeRoofDomains};
