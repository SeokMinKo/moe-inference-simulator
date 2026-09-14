// Uniform K/V precision. Format names do not imply backend/kernel support.
const KV_FORMAT_BITS=Object.freeze({fp16:16,bf16:16,fp8:8,int8:8,int4:4});
function calculateKV(v){
 const mode=v.kvMode??'reference',format=v.kvFormat??'fp16',bits=KV_FORMAT_BITS[format];
 if(!['reference','geometry'].includes(mode)||!bits)throw new Error('Choose a valid KV sizing method and format.');
 let referenceKB=v.kvKB;
 if(mode==='geometry'){
  for(const k of ['kvLayers','kvHeads','kvDim'])if(!Number.isSafeInteger(v[k])||v[k]<=0)throw new Error('KV layers, heads and head dimension must be positive whole numbers.');
  referenceKB=4*v.kvLayers*v.kvHeads*v.kvDim/1000;
 }
 if(!Number.isFinite(referenceKB)||referenceKB<0)throw new Error('16-bit KV reference must be a finite, nonnegative KB value.');
 const quantized=bits<16,metadataPct=quantized?(v.kvMetadataPct??0):0,extraUs=quantized?(v.kvExtraUs??0):0;
 if(!Number.isFinite(metadataPct)||metadataPct<0||metadataPct>100||!Number.isFinite(extraUs)||extraUs<0)throw new Error('KV metadata must be 0–100%; added quantization time must be nonnegative.');
 const payloadKB=referenceKB*bits/16,metadataKB=quantized?payloadKB*metadataPct/100:0;
 return {mode,format,bits,referenceKB,payloadKB,metadataKB,effectiveKB:payloadKB+metadataKB,extraSecondsPerToken:quantized?extraUs/1e6:0};
}

function simulateMoE(v){
 const integer=['batch','prompt','layers','experts','active','window'];
 const positive=['batch','prompt','layers','experts','active','expertM','bits','decodeTops','prefillTops','dramBW','dramUse','dramGB','cacheGB','ufs','window'];
 const nonnegative=['sharedB','predictorMs','startup','buffersGB'];
 for(const k of [...positive,...nonnegative,'hit','initialHit'])if(!Number.isFinite(v[k]))throw new Error('Complete every numeric field.');
 if(positive.some(k=>v[k]<=0)||nonnegative.some(k=>v[k]<0))throw new Error('Rates and counts must be positive; delays and shared weights may be zero.');
 if(integer.some(k=>!Number.isSafeInteger(v[k])))throw new Error('Prompt, layers, experts and window must be safe whole numbers.');
 if(v.active>v.experts)throw new Error('Active experts cannot exceed experts per layer.');
 if(v.hit<0||v.hit>100||v.initialHit<0||v.initialHit>100||v.dramUse>100||v.bits<1||v.bits>64)throw new Error('Hits must be 0–100%, utilization >0–100%, and weight bits 1–64.');
 if(![0,1,2].includes(v.sharing))throw new Error('Choose an expert-sharing scenario.');
 const output=1000,repicks=Math.floor((output-1)/v.window),windows=repicks+1;
 const totalB=v.sharedB+v.layers*v.experts*v.expertM/1000;
 const activeB=v.sharedB+v.layers*v.active*v.expertM/1000;
 const batch=v.batch,totalOutput=batch*output;
 // Rounded expected union is an explicit scenario, not a measured routing trace.
 const unionExperts=v.sharing===0?v.active:v.sharing===2?Math.min(v.experts,batch*v.active):Math.min(v.experts,Math.ceil(v.experts*(1-(1-v.active/v.experts)**batch)-1e-9));
 const expertGB=v.expertM*v.bits/8000,selectedGB=v.layers*unionExperts*expertGB;
 const sharedGB=v.sharedB*v.bits/8,weightGB=sharedGB+selectedGB;
 const kv=calculateKV(v);
 const bankGB=v.layers*v.experts*expertGB,kvGB=batch*kv.effectiveKB/1e6;
 const finalKV=(v.prompt+output-1)*kvGB;
 const bw=v.dramBW*v.dramUse/100;
 const resident=sharedGB+v.cacheGB+finalKV+v.buffersGB;
 // Previous selected sets are retained until repick: sets of k from E overlap by at least 2k-E.
 const minimumHit=100*Math.max(0,2-v.experts/unionExperts);
 const effectiveHit=Math.max(minimumHit,v.hit);
 const missGB=selectedGB*(1-effectiveHit/100),initialGB=selectedGB*(1-v.initialHit/100);
 const predictor=batch*v.predictorMs/1000;
 // Effective UFS speed is bytes delivered into final DRAM cache, not raw link rate.
 // Count the fill once. The destination bandwidth is also a physical limit.
 const loadBW=Math.min(v.ufs,bw);
 const refillRead=missGB/loadBW,refillWrite=0;
 const refill=refillRead+refillWrite+predictor;
 const kvPrefillSeconds=batch*v.prompt*kv.extraSecondsPerToken,kvDecodeSeconds=batch*(output-1)*kv.extraSecondsPerToken;
 const prefill=kvPrefillSeconds+Math.max(2*activeB*batch*v.prompt/(v.prefillTops*1000),(weightGB+v.prompt*kvGB)/bw);
 const ttft=v.startup+predictor+initialGB/loadBW+prefill;
 let decode=kvDecodeSeconds;
 for(let j=1;j<output;j++)decode+=Math.max(2*activeB*batch/(v.decodeTops*1000),weightGB/bw)+(v.prompt+j)*kvGB/bw;
 const refillTotal=repicks*refill,requestSeconds=ttft+decode+refillTotal;
 // An invented score, not accuracy. No fixed-set penalty when there is no excluded expert.
 const qualityPenalty=v.active===v.experts?0:3*Math.log2(Math.min(v.window,output));
 const quality=Math.max(0,Math.min(100,20+50*(1-Math.exp(-totalB/20))+25*(1-Math.exp(-activeB/5))-qualityPenalty));
 if(![totalB,activeB,expertGB,bankGB,resident,loadBW,prefill,decode,ttft,requestSeconds].every(Number.isFinite)||requestSeconds<=0||weightGB<=0)throw new Error('Inputs exceed the numerical range of this teaching model.');
 const issues=[];
 if(selectedGB>v.cacheGB+1e-9)issues.push(`Selected experts need ${selectedGB.toFixed(3)} GB of cache; increase Expert Cache or reduce the selected set.`);
 if(resident>v.dramGB+1e-9)issues.push(`Resident allocation needs ${resident.toFixed(2)} GB; only ${v.dramGB.toFixed(2)} GB of DRAM is available.`);
 const feasible=issues.length===0;
 return {kv,kvPrefillSeconds,kvDecodeSeconds,batch,totalOutput,unionExperts,kvGB,perSequenceTPS:feasible?output/requestSeconds:null,tpot:feasible?(decode+refillTotal)/(output-1):null,output,repicks,windows,totalB,activeB,expertGB,selectedGB,sharedGB,weightGB,bankGB,finalKV,bw,loadBW,resident,minimumHit,effectiveHit,missGB,initialGB,prefill,ttft,decode,refill,refillRead,refillWrite,refillTotal,requestSeconds,quality,qualityPenalty,feasible,issues,tps:feasible?totalOutput/requestSeconds:null,decodeTPS:feasible?batch*(output-1)/(decode+refillTotal):null,ufsTotal:initialGB+repicks*missGB,ufsSeconds:repicks*refillRead,fillSeconds:repicks*refillWrite,predictorSeconds:repicks*predictor,avgStep:decode/(output-1)};
}

// TOPS roofs depend on compute and bandwidth; phase points depend on work, traffic and time.
function labRoof(v,r,fixedDomain=null){
 const n=r.output-1,opsG=2*r.activeB*r.batch*n;
 const decodeBytesGB=n*r.weightGB+r.kvGB*(n*v.prompt+n*(n+1)/2)+r.repicks*r.missGB;
 const intensity=opsG/decodeBytesGB;
 const decodeSeconds=r.decode+r.refillTotal;
 const tops=opsG/(1000*decodeSeconds);
 const tpsScale=1000/(2*r.activeB),tps=r.batch*n/decodeSeconds;
 const prefillIntensity=2*r.activeB*r.batch*v.prompt/(r.weightGB+v.prompt*r.kvGB);
 const prefillTPS=r.batch*v.prompt/r.prefill;
 const prefillTops=2*r.activeB*r.batch*v.prompt/(1000*r.prefill);
 const c=v.decodeTops,bw=r.bw,knee=c*1000/bw;
 if(![intensity,tops,tpsScale,tps,knee,prefillIntensity,prefillTPS,prefillTops,v.prefillTops*1000/bw].every(a=>Number.isFinite(a)&&a>0))throw new Error('Inputs exceed the numerical range of the Roofline.');
 let xmin=Math.min(.25,2**Math.floor(Math.log2(Math.min(intensity,prefillIntensity)/2))),xmax=2**Math.ceil(Math.log2(Math.max(4096,knee*2,v.prefillTops*2000/bw,intensity*2,prefillIntensity*2)));
 let ymin=10**Math.floor(Math.log10(Math.min(.01,Math.max(Math.min(tops,prefillTops),1e-12)/4)));
 let ymax=2**Math.ceil(Math.log2(Math.max(32,Math.max(c,v.prefillTops,8)*1.5)));
 if(fixedDomain)({xmin,xmax,ymin,ymax}=fixedDomain);
 if(![xmin,xmax,ymin,ymax].every(a=>Number.isFinite(a)&&a>0))throw new Error('Inputs exceed the numerical range of the Roofline.');
 const x=a=>48+(Math.log2(a)-Math.log2(xmin))/(Math.log2(xmax)-Math.log2(xmin))*374;
 const y=p=>169-(Math.log10(p)-Math.log10(ymin))/(Math.log10(ymax)-Math.log10(ymin))*135;
 const curve=(b,compute)=>{
  const k=compute*1000/b,vals=[xmin,xmax];if(k>xmin&&k<xmax)vals.push(k);
  const bottom=ymin*1000/b;if(bottom>xmin&&bottom<xmax)vals.push(bottom);
  return vals.sort((a,b)=>a-b).filter(a=>Math.min(compute,b*a/1000)>=ymin).map(a=>`${x(a).toFixed(2)},${y(Math.min(compute,b*a/1000)).toFixed(2)}`).join(' ');
 };
 const xticks=[],yticks=[];
 for(let e=0;e<=Math.log2(xmax);e+=4){const a=2**e;if(a>=xmin)xticks.push({v:a,p:x(a)});}
 const ystart=Math.ceil(Math.log10(ymin)),ystep=Math.max(1,Math.ceil((Math.log10(ymax)-ystart)/4));
 for(let e=ystart;e<=Math.log10(ymax);e+=ystep)yticks.push({v:10**e,p:y(10**e)});
 return {intensity,tops,tps,tpsScale,ceilingTPS:Math.min(c,bw*intensity/1000)*tpsScale,knee,ceiling:Math.min(c,bw*intensity/1000),point:{x:x(intensity),y:y(tops)},current:curve(bw,c),reference:curve(44.8,8),prefillCurve:curve(bw,v.prefillTops),prefillIntensity,prefillTPS,prefillTops,prefillCeiling:Math.min(v.prefillTops,bw*prefillIntensity/1000),prefillCeilingTPS:Math.min(v.prefillTops,bw*prefillIntensity/1000)*tpsScale,prefillPoint:{x:x(prefillIntensity),y:y(prefillTops)},xticks,yticks,domain:{xmin,xmax,ymin,ymax}};
}

if(typeof module!=="undefined")module.exports={simulateMoE,labRoof,calculateKV};
