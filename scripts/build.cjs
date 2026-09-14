const fs=require('node:fs');const path=require('node:path');const root=path.join(__dirname,'..');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="styles.css">',()=>'<style>'+fs.readFileSync(path.join(root,'styles.css'),'utf8')+'</style>');
for(const name of ['config.js','model.js','sweep.js','app.js'])html=html.replace(`<script src="${name}"></script>`,()=>'<script>'+fs.readFileSync(path.join(root,name),'utf8')+'</script>');
fs.writeFileSync(path.join(root,'moe-inference-simulator.html'),html);
