const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
let html=fs.readFileSync(path.join(root,'source/shell.html'),'utf8');
html=html.replace('/* STYLES */',()=>fs.readFileSync(path.join(root,'source/style.css'),'utf8'));
for(const [key,file] of [['CORE','core.js'],['AUDIO','audio.js'],['APP','app.js']]){
  const p=path.join(root,'source',file);
  html=html.replace(`/* ${key} */`,()=>fs.readFileSync(p,'utf8'));
}
for(const id of ['mail','soda','moon','fireworks','ghost','bakery']){
  const p=path.join(root,'assets',id+'.webp');
  const uri='data:image/webp;base64,'+fs.readFileSync(p).toString('base64');
  html=html.replaceAll('@@'+id+'@@',uri);
}
fs.writeFileSync(path.join(root,'index.html'),html);
if(process.argv.includes('--publish'))fs.writeFileSync(path.join(root,'../../games/night-rhythm.html'),html);
console.log('Built projects/night-rhythm/index.html ('+Math.round(Buffer.byteLength(html)/1024)+' KB)');
