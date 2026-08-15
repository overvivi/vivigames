const fs = require('fs');
const vm = require('vm');

const files = ['games/temple-run-clone.html','games/boss-battle-demo.html'];
let scriptCount = 0;
for(const file of files){
  const html = fs.readFileSync(file,'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match=>match[1]).filter(script=>script.trim());
  for(let i=0;i<scripts.length;i++){
    new vm.Script(scripts[i],{filename:`${file}-inline-${i+1}.js`});
    scriptCount++;
  }
}
console.log(`${scriptCount} inline script(s) in ${files.length} file(s): syntax OK`);
