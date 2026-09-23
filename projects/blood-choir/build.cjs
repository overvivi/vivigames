const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=__dirname, source=path.join(root,'source'), out=path.resolve(root,'../../games/blood-choir/index.html');
const names=['data.js','atlas.js','engine.js','storage.js','controller.js','audio.js','render.js','ui.js'];
const code=names.map(n=>{const s=fs.readFileSync(path.join(source,n),'utf8');new vm.Script(s,{filename:n});return s;}).join('\n');
const html=fs.readFileSync(path.join(source,'shell.html'),'utf8').replace('/* STYLES */',['style.css','polish.css'].map(n=>fs.readFileSync(path.join(source,n),'utf8')).join('\n')).replace('/* SCRIPTS */',code);
fs.writeFileSync(out,html);
console.log('BLOOD CHOIR build: '+Buffer.byteLength(html)+' bytes / '+names.length+' scripts');
