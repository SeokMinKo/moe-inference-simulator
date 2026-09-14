(()=>{
 const defaults=LAB_DEFAULTS
,keys=Object.keys(defaults),el=id=>document.getElementById('lab-'+id);let initialized=false,lastTrigger=null;
 function flash(node){if(!initialized||!node||matchMedia('(prefers-reduced-motion: reduce)').matches)return;node.classList.remove('lab-flash');void node.offsetWidth;node.classList.add('lab-flash');}
 function show(id,value){const n=el(id);if(n.textContent!==String(value)){n.textContent=String(value);flash(n);}}
 function drawRoof(v,r){
  const z=labRoof(v,r,sweep.domain),fmt=v=>v<1000?Number(v.toPrecision(3)).toString():Number((v/1000).toPrecision(3))+'k';
  el('roof-current').setAttribute('points',z.current);el('roof-reference').setAttribute('points',z.prefillCurve);
  el('roof-grid').innerHTML=z.xticks.map(t=>`<path d="M${t.p},34 V169" stroke="#dce5ed"/><text x="${t.p}" y="186" text-anchor="middle" font-size="12" fill="#536776">${fmt(t.v)}</text>`).join('')+z.yticks.map(t=>`<path d="M48,${t.p} H422" stroke="#dce5ed"/><text x="41" y="${t.p+4}" text-anchor="end" font-size="12" fill="#536776">${fmt(t.v)}</text>`).join('');
  const dot=el('roof-dot');dot.setAttribute('cx',z.point.x);dot.setAttribute('cy',z.point.y);dot.setAttribute('visibility',r.feasible?'visible':'hidden');
  dot.querySelector('title').textContent=`Decode phase: ${z.intensity.toFixed(3)} ops/byte, ${z.tops.toFixed(3)} TOPS. Main-model decode operations / (decode + repick pauses); excludes TTFT.`;
  const pre=el('roof-prefill-dot');pre.setAttribute('cx',z.prefillPoint.x);pre.setAttribute('cy',z.prefillPoint.y);pre.setAttribute('visibility',r.feasible?'visible':'hidden');
  pre.querySelector('title').textContent=`Prefill phase: ${z.prefillIntensity.toFixed(2)} ops/B, ${z.prefillTops.toFixed(3)} TOPS. Prefill operations / prefill time; excludes initial loading.`;
  show('roof-readout',r.feasible?`Decode ${z.tops.toFixed(3)} · Prefill ${z.prefillTops.toFixed(3)} TOPS`:'No phase points: allocation does not fit');
 }
 function update(){
  try{
   const v=Object.fromEntries(keys.map(k=>[k,typeof defaults[k]==='string'?el(k).value:(el(k).value.trim()===''?NaN:Number(el(k).value))]));
   if(Number.isInteger(v.experts)&&v.experts>0&&v.active>v.experts){v.active=v.experts;el('active').value=String(v.active);flash(el('active'));}
   el('active').setAttribute('max',String(v.experts));
   if(Number.isSafeInteger(v.active)&&v.active>0&&Number.isSafeInteger(v.experts)&&v.experts>=v.active&&Number.isFinite(v.hit)&&v.hit>=0&&v.hit<=100){const floor=100*Math.max(0,2-v.experts/v.active);if(v.hit<floor){v.hit=floor;el('hit').value=String(floor);flash(el('hit'));}}
   const geometry=v.kvMode==='geometry';el('kvKB').disabled=geometry;for(const k of ['kvLayers','kvHeads','kvDim'])el(k).disabled=!geometry;
   for(const k of ['kvMetadataPct','kvExtraUs'])el(k).disabled=KV_FORMAT_BITS[v.kvFormat]===16;
   document.querySelectorAll('[data-preset],[data-labstep]').forEach(b=>{b.disabled=el(b.dataset.preset||b.dataset.labstep).disabled;});
   const r=simulateMoE(v);
   show('kvEffective',r.kv.effectiveKB.toFixed(3)+' KB');show('kvPayload',((v.prompt+999)*v.batch*r.kv.payloadKB/1e6).toFixed(3)+' GB');show('kvMetadata',((v.prompt+999)*v.batch*r.kv.metadataKB/1e6).toFixed(3)+' GB');show('kvRatio',r.kv.referenceKB?((r.kv.effectiveKB/r.kv.referenceKB)*100).toFixed(1)+'%':'—');
   show('kvFormula',`16-bit reference ${r.kv.referenceKB.toFixed(3)} KB × ${r.kv.bits}/16 + metadata = ${r.kv.effectiveKB.toFixed(3)} KB per token. Final KV: batch × (prompt + 999) × this size.`);
if(v.hit<r.minimumHit){el('hit').value=String(r.minimumHit);flash(el('hit'));}drawRoof(v,r);keys.forEach(k=>el(k).removeAttribute('aria-invalid'));
   show('unionExperts',r.unionExperts);show('totalOutput',r.totalOutput.toLocaleString('en-US'));show('perSequenceTPS',r.feasible?r.perSequenceTPS.toFixed(2):'—');show('tpot',r.feasible?(r.tpot*1000).toFixed(1)+' ms':'—');
   show('tps',r.feasible?r.tps.toFixed(2):'—');show('ttft',r.feasible?r.ttft.toFixed(2):'—');show('quality',r.quality.toFixed(1));
   show('totalB',r.totalB.toFixed(3)+' B');show('activeB',r.activeB.toFixed(3)+' B');show('selectedGB',r.selectedGB.toFixed(3)+' GB');show('missGB',r.missGB.toFixed(3)+' GB');show('finalKV',r.finalKV.toFixed(3)+' GB');show('resident',r.resident.toFixed(2)+' / '+v.dramGB+' GB');show('repicks',r.repicks);
   show('refill',(r.refill*1000).toFixed(1)+' ms');show('avgStep',(r.avgStep*1000).toFixed(1)+' ms');show('requestSeconds',r.feasible?r.requestSeconds.toFixed(2)+' s':'—');show('decodeTPS',r.feasible?r.decodeTPS.toFixed(2):'—');show('ufsTotal',r.ufsTotal.toFixed(3)+' GB');
   const times={ttft:r.ttft,decode:r.decode,ufs:r.ufsSeconds+r.fillSeconds,predictor:r.predictorSeconds};
   for(const [k,t] of Object.entries(times)){const b=el('bar-'+k);b.style.width=(r.feasible?t/r.requestSeconds*100:0)+'%';b.setAttribute('title',`${k}: ${t.toFixed(3)} s`);}
   show('time-note',r.feasible?`TTFT ${r.ttft.toFixed(1)}s · Decode ${r.decode.toFixed(1)}s · Repicks ${r.refillTotal.toFixed(1)}s`:'Allocation does not fit');
   el('status').classList.toggle('invalid',!r.feasible);
   const all=r.minimumHit>0?` Retained-set overlap: hits ≥ ${r.minimumHit.toFixed(1)}%.`:'';
   el('status').textContent=r.feasible?`Initial pick + ${r.repicks} repicks. ${r.missGB.toFixed(3)} GB miss/pick ÷ ${r.loadBW.toFixed(2)} GB/s load BW + predictor = ${(r.refill*1000).toFixed(1)} ms/pick.${all}`:r.issues.join(' ');
  }catch(error){
   el('roof-dot').setAttribute('visibility','hidden');el('roof-prefill-dot').setAttribute('visibility','hidden');show('roof-readout','Complete the inputs to plot a result.');
   for(const id of ['kvEffective','kvPayload','kvMetadata','kvRatio','kvFormula','unionExperts','totalOutput','perSequenceTPS','tpot','tps','ttft','quality','totalB','activeB','selectedGB','missGB','finalKV','resident','repicks','refill','avgStep','requestSeconds','decodeTPS','ufsTotal'])show(id,'—');
   ['ttft','decode','ufs','predictor'].forEach(k=>el('bar-'+k).style.width='0%');
   el('status').classList.add('invalid');el('status').textContent=error.message;show('time-note','Complete the inputs to simulate.');
   keys.forEach(k=>{if(typeof defaults[k]!=='string'&&(el(k).value.trim()===''||!Number.isFinite(Number(el(k).value))))el(k).setAttribute('aria-invalid','true');});
  }
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(el(b.dataset.preset).value===b.dataset.value)));
  initialized=true;
 }
 for(const [key,values] of Object.entries(LAB_PRESETS)){
  const input=el(key);if(input.tagName==='SELECT')continue;
  const row=document.createElement('div');row.className='lab-presets';row.setAttribute('aria-label','Common values: '+document.querySelector(`label[for="lab-${key}"]`).textContent);
  values.forEach(value=>{const b=document.createElement('button');b.type='button';b.dataset.preset=key;b.dataset.value=String(value);b.textContent=String(value);b.addEventListener('click',()=>{input.value=String(value);flash(input);input.dispatchEvent(new Event('input',{bubbles:true}));});row.appendChild(b);});input.closest('.lab-field').appendChild(row);
 }
 // All playback belongs to this one controller. No timers survive Pause/Reset.
 const sweep={timer:null,rows:[],index:-1,baseline:null,key:null,domain:null,running:false};
 function readInputs(){return Object.fromEntries(keys.map(k=>[k,typeof defaults[k]==='string'?el(k).value:(el(k).value.trim()===''?NaN:Number(el(k).value))]));}
 function applyInputs(values){keys.forEach(k=>{if(el(k).value!==String(values[k])){el(k).value=String(values[k]);flash(el(k));}});}
 function normalizeInputs(v){if(Number.isInteger(v.experts)&&v.experts>0&&v.active>v.experts)v.active=v.experts;return v;}
 function labelFor(k){return document.querySelector(`label[for="lab-${k}"]`).textContent;}
 function stopTimer(){if(sweep.timer!==null)clearTimeout(sweep.timer);sweep.timer=null;sweep.running=false;el('sweep-pause').textContent='Resume';}
 function pauseSweep(message){stopTimer();if(message)el('sweep-status').textContent=message;}
 function clearSweep(message){stopTimer();sweep.rows=[];sweep.index=-1;sweep.domain=null;el('sweep-pause').disabled=true;el('sweep-pause').textContent='Pause';el('roof-scale').textContent='Log · auto scale';if(message)el('sweep-status').textContent=message;drawHistory();}
 function syncSweepControls(resetRange=false){
  const key=el('sweep-param').value,input=el(key),values=LAB_PRESETS[key];
  if(!input||!values)return;
  const discrete=input.tagName==='SELECT';el('sweep-mode').disabled=discrete;if(discrete)el('sweep-mode').value='presets';
  el('sweep-range').classList.toggle('hidden',el('sweep-mode').value!=='range');
  el('sweep-values').textContent=el('sweep-mode').value==='presets'?values.map(v=>typeof v==='string'?v.toUpperCase():v).join(' → '):'Custom numeric range';
  if(resetRange&&!discrete){el('sweep-from').value=String(values[0]);el('sweep-to').value=String(values.at(-1));const step=(values.at(-1)-values[0])/20;el('sweep-step').value=String(LAB_INTEGERS.has(key)?Math.max(1,Math.ceil(step)):Number(step.toPrecision(3)));}
 }
 function drawHistory(){
  const svg=el('sweep-chart'),metric=el('sweep-metric').value;
  if(!sweep.rows.length||sweep.index<0){svg.innerHTML='<text x="230" y="74" text-anchor="middle" fill="#536776" font-size="13">Press Start to trace performance.</text>';return;}
  const read=r=>!r?null:metric==='finalKV'?r.finalKV:!r.feasible?null:metric==='tpot'?r.tpot*1000:r[metric];
  const ys=sweep.rows.map(row=>read(row.r)).filter(y=>Number.isFinite(y));const ymax=Math.max(.000001,...ys)*1.12;
  const vals=sweep.rows.map(row=>row.value),numeric=vals.every(v=>typeof v==='number'),lo=numeric?Math.min(...vals):0,hi=numeric?Math.max(...vals):Math.max(1,vals.length-1);
  const x=(v,i)=>50+((numeric?v:i)-lo)/(hi-lo||1)*386,y=v=>109-v/ymax*83;
  const fmt=v=>typeof v==='string'?v.toUpperCase():Number(v.toPrecision(4)).toLocaleString('en-US');
  let html=[0,.5,1].map(t=>`<path d="M50 ${y(ymax*t)} H436" stroke="#dce5ed"/><text x="44" y="${y(ymax*t)+4}" text-anchor="end" font-size="10" fill="#536776">${fmt(ymax*t)}</text>`).join('');
  const left=numeric?lo:vals[0],right=numeric?hi:vals.at(-1);html+=`<text x="50" y="130" font-size="10" fill="#536776">${fmt(left)}</text><text x="436" y="130" text-anchor="end" font-size="10" fill="#536776">${fmt(right)}</text>`;
  let segment=[];const flush=()=>{if(segment.length)html+=`<polyline fill="none" stroke="#2e60c2" stroke-width="2" points="${segment.join(' ')}"/>`;segment=[];};
  for(let i=0;i<=sweep.index;i++){
   const row=sweep.rows[i],value=read(row.r),px=x(row.value,i);
   if(!Number.isFinite(value)){flush();html+=`<path d="M${px-3} 105 L${px+3} 111 M${px-3} 111 L${px+3} 105" stroke="#a65b21" stroke-width="1.5"><title>${fmt(row.value)}: unavailable</title></path>`;continue;}
   const py=y(value);segment.push(`${px},${py}`);html+=`<circle cx="${px}" cy="${py}" r="${i===sweep.index?4.5:2.5}" fill="#2e60c2"><title>${fmt(row.value)}: ${fmt(value)}</title></circle>`;
  }flush();svg.innerHTML=html;
  const current=sweep.rows[sweep.index],value=read(current.r),unit={tps:'tokens/s',ttft:'s',tpot:'ms',finalKV:'GB'}[metric];
  el('sweep-note').textContent=`${labelFor(sweep.key)} = ${fmt(current.value)} · ${Number.isFinite(value)?fmt(value)+' '+unit:'unavailable (invalid input or allocation)'}. Fixed chart axes; × marks unavailable speed samples.`;
  svg.setAttribute('aria-label',el('sweep-note').textContent);
 }
 function scheduleNext(){if(!sweep.running)return;sweep.timer=setTimeout(()=>{sweep.timer=null;advanceSweep();},Number(el('sweep-pace').value));}
 function advanceSweep(){
  if(!sweep.running)return;
  sweep.index++;const row=sweep.rows[sweep.index];applyInputs(row.v);update();drawHistory();
  el('sweep-status').textContent=`${sweep.index+1} / ${sweep.rows.length} · ${labelFor(sweep.key)} = ${row.value}${row.r?.feasible?'':' · allocation/input unavailable'}`;
  if(sweep.index>=sweep.rows.length-1){stopTimer();el('sweep-status').textContent+=' · Complete';el('sweep-pause').disabled=true;el('sweep-pause').textContent='Pause';}else scheduleNext();
 }
 function startSweep(){
  stopTimer();
  try{
   const key=el('sweep-param').value,input=el(key);if(!LAB_PRESETS[key]||input.disabled)throw new Error('Enable this parameter first using the KV sizing method or format.');
   const baseline=readInputs();simulateMoE(normalizeInputs({...baseline})); // Reject malformed inputs; an infeasible baseline can still be explored.
   const values=buildSweepValues({mode:el('sweep-mode').value,values:LAB_PRESETS[key].filter(x=>typeof x==='string'||(!input.hasAttribute('max')||x<=Number(input.max||input.getAttribute('max')))),start:el('sweep-from').value.trim()===''?NaN:Number(el('sweep-from').value),end:el('sweep-to').value.trim()===''?NaN:Number(el('sweep-to').value),step:el('sweep-step').value.trim()===''?NaN:Number(el('sweep-step').value),direction:el('sweep-direction').value,integer:LAB_INTEGERS.has(key),min:input.hasAttribute('min')?Number(input.getAttribute('min')):-Infinity,max:input.hasAttribute('max')?Number(input.getAttribute('max')):Infinity});
   sweep.baseline=baseline;sweep.key=key;sweep.index=-1;
   sweep.rows=values.map(value=>{const v=normalizeInputs({...baseline,[key]:value});try{const r=simulateMoE(v);return {value,v,r,z:labRoof(v,r)};}catch(error){return {value,v,r:null,error:error.message};}});
   sweep.domain=mergeRoofDomains(sweep.rows.filter(row=>row.r?.feasible).map(row=>row.z.domain));
   el('roof-scale').textContent='Log · fixed for sweep';el('sweep-restore').disabled=false;el('sweep-pause').disabled=false;el('sweep-pause').textContent='Pause';sweep.running=true;advanceSweep();
  }catch(error){clearSweep(error.message);update();}
 }
 el('sweep-start').addEventListener('click',startSweep);
 el('sweep-pause').addEventListener('click',()=>{
  if(sweep.running){pauseSweep('Paused. Resume to continue from this sample.');return;}
  if(sweep.index>=0&&sweep.index<sweep.rows.length-1){sweep.running=true;el('sweep-pause').textContent='Pause';el('sweep-status').textContent='Resuming…';scheduleNext();}
 });
 el('sweep-restore').addEventListener('click',()=>{if(!sweep.baseline)return;applyInputs(sweep.baseline);clearSweep('Baseline restored.');sweep.baseline=null;el('sweep-restore').disabled=true;update();});
 ['sweep-param','sweep-mode','sweep-direction','sweep-from','sweep-to','sweep-step'].forEach(id=>el(id).addEventListener(el(id).tagName==='SELECT'?'change':'input',()=>{clearSweep('Settings changed. Press Start to begin a new sweep.');syncSweepControls(id==='sweep-param');update();}));
 el('sweep-pace').addEventListener('change',()=>{if(sweep.running){clearTimeout(sweep.timer);sweep.timer=null;scheduleNext();}});
 el('sweep-metric').addEventListener('change',drawHistory);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&sweep.running)pauseSweep('Paused while this tab is hidden. Press Resume to continue.');});
 syncSweepControls();
 keys.forEach(k=>el(k).addEventListener(el(k).tagName==='SELECT'?'change':'input',()=>{clearSweep('Input changed. Press Start for a new sweep.');update();}));
 document.querySelectorAll('[data-labstep]').forEach(btn=>btn.addEventListener('click',()=>{
  const n=el(btn.dataset.labstep);let v=Number(n.value);if(!Number.isFinite(v))v=0;
  const min=n.hasAttribute('min')?Number(n.getAttribute('min')):-Infinity,max=n.hasAttribute('max')?Number(n.getAttribute('max')):Infinity;
  n.value=String(Math.round(Math.min(max,Math.max(min,v+Number(btn.dataset.delta)))*1e6)/1e6);flash(n);n.dispatchEvent(new Event('input',{bubbles:true}));
 }));
 el('reset').addEventListener('click',()=>{clearSweep('Defaults restored.');sweep.baseline=null;el('sweep-restore').disabled=true;keys.forEach(k=>{if(el(k).value!==String(defaults[k])){el(k).value=String(defaults[k]);flash(el(k));}});update();});
 function close(){el('modal').classList.add('hidden');if(lastTrigger){lastTrigger.focus();lastTrigger=null;}}
 el('how').addEventListener('click',()=>{if(sweep.running)pauseSweep('Paused while viewing assumptions.');lastTrigger=el('how');el('modal').classList.remove('hidden');el('close').focus();});el('close').addEventListener('click',close);
 el('modal').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){e.preventDefault();el('close').focus();}});
 document.addEventListener('deck-change',()=>{if(!el('modal').classList.contains('hidden'))close();});
 document.querySelectorAll('#slide-10 input,#slide-10 output,#lab-roof-readout').forEach(n=>n.addEventListener('animationend',()=>n.classList.remove('lab-flash')));
 update();
})();
