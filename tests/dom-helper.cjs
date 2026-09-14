const {parseHTML}=require('linkedom');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
function boot(){
 const {window}=parseHTML(fs.readFileSync(path.join(root,'index.html'),'utf8')),document=window.document;
 // linkedom does not implement writable select.value / timer scheduling.
 for(const n of document.querySelectorAll('select')){let val=n.querySelector('option[selected]')?.getAttribute('value')||n.querySelector('option')?.getAttribute('value')||'';Object.defineProperty(n,'value',{get:()=>val,set:x=>val=String(x)});}
 let next=0;const timers=new Map();
 const c=vm.createContext({document,Event:window.Event,matchMedia:()=>({matches:false}),console,setTimeout:fn=>{const id=++next;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 for(const n of document.querySelectorAll('script[src]'))vm.runInContext(fs.readFileSync(path.join(root,n.getAttribute('src')),'utf8'),c);
 const el=id=>document.getElementById('lab-'+id);const set=(id,v)=>{el(id).value=String(v);el(id).dispatchEvent(new window.Event(el(id).tagName==='SELECT'?'change':'input'));};
 const click=id=>el(id).dispatchEvent(new window.Event('click'));const tick=()=>{const tasks=[...timers.values()];timers.clear();tasks.forEach(fn=>fn());};
 return {document,window,el,set,click,tick,timers};
}
module.exports={boot};
