const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sharp=require('sharp');
const root=__dirname;
(async()=>{
  const file=path.join(root,'art/archers-v1.png');
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const frames=[];
  for(let row=0;row<2;row++)for(let col=0;col<4;col++){
    const x=Math.round(col*info.width/4),y=Math.round(row*info.height/2),w=Math.round((col+1)*info.width/4)-x,h=Math.round((row+1)*info.height/2)-y;
    let bottom=0,min=Infinity,max=-Infinity;
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(data[((y+yy)*info.width+x+xx)*4+3]>160)bottom=Math.max(bottom,yy);
    // 再生成や背景色抜きは行わず、原本の足底をメタデータとして求める。
    for(let yy=bottom-12;yy<=bottom;yy++)for(let xx=0;xx<w;xx++)if(data[((y+yy)*info.width+x+xx)*4+3]>160){min=Math.min(min,xx);max=Math.max(max,xx);}
    frames.push({x,y,w,h,footX:(min+max)/2,footY:bottom});
  }
  const assets='const SPRITE_DATA="data:image/png;base64,'+fs.readFileSync(file).toString('base64')+'";\nconst SPRITE_FRAMES='+JSON.stringify(frames)+';\nconst BACKGROUND_DATA="data:image/png;base64,'+fs.readFileSync(path.join(root,'art/dusk-forest-v1.png')).toString('base64')+'";';
  const engine=fs.readFileSync(path.join(root,'source/engine.js'),'utf8'),app=fs.readFileSync(path.join(root,'source/app.js'),'utf8');
  new vm.Script(engine);new vm.Script(app);
  const html=fs.readFileSync(path.join(root,'source/shell.html'),'utf8').replace('/* STYLE */',()=>fs.readFileSync(path.join(root,'source/style.css'),'utf8')).replace('/* ENGINE */',()=>engine).replace('/* ASSETS */',()=>assets).replace('/* APP */',()=>app);
  if(!html.trim().endsWith('</html>')||(html.match(/<script>/g)||[]).length!==3||(html.match(/<\/script>/g)||[]).length!==3)throw Error('HTML structure');
  fs.writeFileSync(path.join(root,'index.html'),html);
  // 配置階層が違っても、ゲームセンターへ戻るリンクだけを正しい相対位置に揃える。
  fs.writeFileSync(path.join(root,'../../games/amber-bow.html'),html.replace('href="../../index.html"','href="../index.html"'));
  console.log('Built standalone index.html: '+Buffer.byteLength(html)+' bytes. Syntax, 3 scripts, end tag OK.');
  console.log('Original sprite alpha range includes transparent pixels: '+data.some((v,i)=>i%4===3&&v===0));
})();
