(function(){
  'use strict';
  const D=window.BCData;
  class Renderer{
    constructor(canvas,{alpha=false}={}){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha});this.assets={};this.effects=[];this.motes=[];this.stains=[];this.numbers=[];this.shake=0;this.flash=0;this.time=0;this.walk=0;this.lastX=480;this.lastWave=0;this.settings={shake:true,gore:true};this.ready=false;}
    async load(inspection=false,onProgress=()=>{}){
      const files={bg:'cathedral',surgery:'surgery',choir:'choir',heart:'heart',icons:'relics',fx:'effects',costumes:'costumes',enemies:'enemy-animation',bosses:'boss-animation',secretboss:'secret-boss',ultimateA:'ultimate-a',ultimateB:'ultimate-b',arrival:'arrival',weapons:'weapons',covenants:'covenants',altars:'altars',effigy:'effigy',achievements:'achievements',bestiary:'bestiary',aim:'aim',executioner:'executioner',reliquary:'reliquary',beam:'reliquary-beam',crowns:'crowns',relicA:'relics-blood',relicB:'relics-bone',relicC:'relics-spectral',relicD:'relics-rites',relicE:'relics-forbidden',projectiles:'projectiles',ash:'ash-orb',skillfx:'skillfx-clean',elites:'elites',combatfx:'combatfx',pillars:'pillars',evolutions:'evolutions',resonances:'resonances',resonancefx:'resonance-fx',cover:'cover',frame:'card-frame'};
      if(inspection)files.player='wraith';let loaded=0;const total=Object.keys(files).length;
      await Promise.all(Object.entries(files).map(([id,name])=>new Promise((resolve,reject)=>{const im=new Image();let original=name==='wraith';im.onload=()=>{this.assets[id]=im;onProgress(++loaded,total);resolve();};im.onerror=()=>{if(!original){original=true;im.src='assets/'+name+'.png';}else reject(new Error(name));};const extension=['cathedral','surgery','choir','heart','cover'].includes(name)?'.webp':'.png';im.src=original?'assets/'+name+'.png':'assets/runtime/'+name+extension;})));this.ready=true;
    }
    enemySprite(e){
      const elite=['leech','cantor','watcher','seraph'].indexOf(e.kind),flutter=Math.floor((e.age||0)*5)%4,pose=e.cast>.12?2:e.cast>0?3:e.shoot<.55?1:0;
      if(e.kind==='effigy')return{image:'effigy',index:0,cols:1,rows:1};
      if(e.kind==='butcher')return{image:'executioner',index:0,cols:1,rows:1};
      if(e.kind==='reliquary')return{image:'reliquary',index:0,cols:1,rows:1};
      if(e.kind==='oblivion')return{image:'secretboss',index:e.cast>.12?2:e.cast>0?3:e.gap&&e.shoot<1?1:0,cols:4,rows:1};
      const anim=e.boss?(e.sprite===10?flutter:pose):(e.sprite===4||e.sprite===7?flutter:pose);
      return{image:elite>=0?'elites':e.boss?'bosses':'enemies',index:elite>=0?elite*2+(e.cast>0?1:0):e.boss?(e.sprite-8)*4+anim:(e.sprite-4)*4+anim,cols:elite>=0?2:4};
    }
    event(e){
      const add=(kind,life,data)=>{if(this.effects.length<80)this.effects.push({kind,life,max:life,...data});};
      // 弾が弾を砕いた合図。小さな火花だけで、弾幕の読みを邪魔しない。
      if(e.type==='clash'){
        if(this.settings.effectOpacity!==0)for(let i=0;i<3;i++)if(this.motes.length<220)this.motes.push({x:e.x,y:e.y,vx:(Math.random()-.5)*150,vy:-Math.random()*110,life:.22+Math.random()*.2,size:1+Math.random()*2,color:i?'#e8d3ad':'#ffb26a'});
      }
      if(e.type==='hit'){
        if(this.effects.length<55)add('sprite',.2,{x:e.x,y:e.y,size:e.crit?60:40,row:0,image:'combatfx'});
        if(this.settings.damageNumbers!=='none'&&(this.settings.damageNumbers!=='critical'||e.crit))this.addNumber({id:e.id,x:e.x,y:e.y-20,n:e.n,color:e.crit?'#ffe4a8':'#eadbce',crit:e.crit});
      }
      if(e.type==='death'){
        const sprite=this.enemySprite(e.pose||{...e,kind:e.enemyKind});
        const bodyAlpha=e.pose?.arrival>0?.35+(1-e.pose.arrival/e.pose.arrivalDuration)*.65:1;
        add('corpse',e.boss?1.2:.4,{bodyAlpha,x:e.x,y:e.y,size:e.size||75,flip:e.flip,...sprite});
        add('sprite',e.boss?1:.46,{x:e.x,y:e.y,size:e.boss?210:85,row:0});this.shake=Math.max(this.shake,e.boss?8:1.3);
        if(this.settings.gore){for(let i=0;i<(e.boss?26:8);i++)if(this.motes.length<220)this.motes.push({x:e.x,y:e.y,vx:(Math.random()-.5)*(e.boss?320:180),vy:-Math.random()*170,life:1.1+Math.random(),size:2+Math.random()*4,color:i%3?'#912735':'#c7a998'});this.stains.push({x:e.x,w:e.boss?65:14+Math.random()*20,a:.3+Math.random()*.25});if(this.stains.length>45)this.stains.shift();}
      }
      if(e.type==='burst')add('sprite',.65,{x:e.x,y:e.y,size:e.r*1.9,row:e.row===0?1:e.row,image:e.row===0?'skillfx':'fx'});
      if(e.type==='resonance'){const row={sanguine:0,boneMass:1,rotMoon:2,requiem:3}[e.id];if(row!==undefined)add('sprite',e.id==='requiem'?.35:.5,{x:e.x,y:e.y,size:e.id==='boneMass'?185:e.id==='requiem'?75:95,row,image:'resonancefx'});}
      if(e.type==='crownPulse')add('sprite',.5,{x:e.x,y:e.y,size:145,row:1,image:'crowns',rows:2,hostile:true});
      if(e.type==='crownDeath')add('crownReward',.9,e);
      if(e.type==='plagueBurst')add('sprite',.55,{x:e.x,y:e.y,size:150,row:2,image:'skillfx'});
      if(e.type==='lightning'){add('lightning',.24,e);add('sprite',.3,{x:e.tx,y:e.ty,size:65,row:2});}
      if(e.type==='cleave')add('cleave',.32,e);
      if(e.type==='hurt'){this.shake=5;this.flash=.18;add('sprite',.3,{x:e.x,y:e.y,size:72,row:0});}
      if(e.type==='shield')add('sprite',.45,{x:e.x,y:e.y-20,size:100,row:3,image:'combatfx'});
      if(e.type==='combo')add('sprite',.5,{x:e.x,y:e.y-25,size:85,row:3,image:'combatfx'});
      if(e.type==='bossPhase'){add('sprite',1.15,{x:e.x,y:e.y,size:240,row:3,image:'skillfx',hostile:true});this.shake=4;}
      if(e.type==='bellPulse')add('sprite',.5,{x:e.x,y:e.y,size:160,row:3,image:'combatfx',hostile:true});
      if(e.type==='jump'||e.type==='dash')add('dust',.4,{x:e.x,y:e.y+15,dash:e.type==='dash'});
      if(e.type==='ultimate'){this.shake=9;const d=D.ultimates?.[e.weapon||'lantern'];add('sprite',1.05,{x:e.weapon==='needle'?480:e.x,y:e.weapon==='needle'?160:e.weapon==='scythe'?e.y:e.y-65,size:e.weapon==='scythe'?570:440,row:d?.row??3,image:d?.image||'skillfx',rows:d?3:4});}
      if(e.type==='ritualStrike')add('sprite',.38,{x:e.x,y:e.y,size:115,row:0,image:'ultimateB',rows:3});
      if(e.type==='heal')this.addNumber({id:'heal',x:e.x,y:e.y-25,n:e.n,color:'#bddf9b',heal:true});
      if(e.type==='revive')add('nova',1.2,{x:480,y:350});
      if(e.type==='evolve')add('nova',1.3,{x:480,y:270});
      if(e.type==='wave'){this.lastWave=e.wave;this.stains=this.stains.slice(-18);this.effects=[];this.numbers=[];this.motes=[];this.lastX=480;this.walk=0;}
    }
    addNumber(data){
      // 同じ標的への連射は短時間で合算し、密集時は空いた近傍へ出して数値の重なりを抑える。
      const pending=this.numbers.find(n=>n.id===data.id&&n.merge>0);
      if(pending){pending.n+=data.n;pending.crit||=data.crit;if(data.crit)pending.color='#ffe4a8';return;}
      this.numbers=this.numbers.filter(n=>n.life>0);
      if(this.numbers.length>=26){if(!data.heal)return;this.numbers.shift();}
      const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),offsets=[[0,0],[-20,-18],[20,-18],[0,-36],[-38,-36],[38,-36],[0,-54]];
      let best=null,bestCost=Infinity;
      for(const [dx,dy] of offsets){const x=clamp(data.x+dx,25,935),y=clamp(data.y+dy,24,515),cost=this.numbers.reduce((sum,n)=>sum+(Math.abs(n.x-x)<34&&Math.abs(n.y-y)<17?1:0),0);if(cost<bestCost){best={x,y};bestCost=cost;if(cost===0)break;}}
      this.numbers.push({...data,...best,merge:.18,life:data.heal?.9:.65,max:data.heal?.9:.65});
    }
    sprite(image,index,cols,rows,x,y,w,h,flip=false,alpha=1){
      const im=this.assets[image];if(!im)return;const c=this.ctx,cellW=im.width/cols,cellH=im.height/rows,rect=window.BCAtlas?.[image]?.[index];
      const sw=rect?.sw||Math.floor(cellW),sh=rect?.sh||Math.floor(cellH),scaleX=w/(rect?.referenceWidth||sw),scaleY=h/(rect?.referenceHeight||sh),dx=-(rect?.anchorX??sw/2)*scaleX,dy=-(rect?.anchorY??sh/2)*scaleY;
      c.save();c.globalAlpha=alpha*(this.effectAlpha??1);c.translate(Math.round(x),Math.round(y));if(flip)c.scale(-1,1);if(rect?.clip){c.beginPath();rect.clip.forEach(([px,py],i)=>c[i?'lineTo':'moveTo'](dx+px*scaleX,dy+py*scaleY));c.closePath();c.clip();}if(rect?.clipLeft){const cut=rect.clipLeft*scaleX;c.beginPath();c.rect(dx+cut,dy,sw*scaleX-cut,sh*scaleY);c.clip();}c.drawImage(im,rect?rect.sx:Math.floor(index%cols*cellW),rect?rect.sy:Math.floor(Math.floor(index/cols)*cellH),sw,sh,dx,dy,sw*scaleX,sh*scaleY);c.restore();
    }
    static aimPoint(run,input,pad=false){
      if(!run||!input||input.autoAim||!Number.isFinite(input.aimX)||!Number.isFinite(input.aimY))return null;
      const target={x:input.aimX,y:input.aimY};
      if(!pad)return target.x>=0&&target.x<=960&&target.y>=0&&target.y<=540?target:null;
      // スティックの照準は画面外へ伸びる。射出点から同じ射線上の近い位置へ印を置く。
      const from=run.playerPose().muzzle,dx=target.x-from.x,dy=target.y-from.y,distance=Math.hypot(dx,dy);if(distance<1)return null;
      let enter=0,exit=Math.min(1,180/distance);
      for(const [origin,delta,low,high]of [[from.x,dx,20,940],[from.y,dy,20,520]]){
        if(Math.abs(delta)<1e-9){if(origin<low||origin>high)return null;continue;}
        const a=(low-origin)/delta,b=(high-origin)/delta;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
      }
      // 杖先が画面端の余白へ出て外側を向く場合は、誤った射線上へ印を移さない。
      return exit>=enter&&exit>0?{x:from.x+dx*exit,y:from.y+dy*exit}:null;
    }
    draw(run,dt,settings,aim=null){
      if(!this.ready)return;this.settings=settings;this.time+=dt;const c=this.ctx,t=this.time,fx=Math.max(.35,Math.min(1,settings.effectOpacity??1));this.effectAlpha=1;c.imageSmoothingEnabled=false;c.fillStyle='#09090c';c.fillRect(0,0,960,540);
      c.save();if(settings.shake&&this.shake>.05)c.translate(Math.sin(t*137)*this.shake*.5,Math.sin(t*179)*this.shake*.5);this.shake*=Math.exp(-dt*12);
      const zone=run?Math.floor((run.wave-1)/8)%4:0,bg=this.assets[['bg','surgery','choir','heart'][zone]],floorY=zone===3?664:741;
      // 素材ごとに床の高さを登録し、人物の当たり判定と背景の接地を合わせる。
      c.drawImage(bg,0,0,bg.width,floorY,0,0,960,D.FLOOR);c.drawImage(bg,0,floorY,bg.width,bg.height-floorY,0,D.FLOOR,960,540-D.FLOOR);
      // 先に背景だけを暗くし、敵・弾・足場の明度を落とさず分離する。
      c.fillStyle='rgba(0,0,0,'+Math.max(0,Math.min(.6,settings.backgroundDim??.2))+')';c.fillRect(0,0,960,D.FLOOR);
      for(let i=0;i<24;i++){const x=(i*137+t*(3+i%3))%960,y=(i*79-t*(5+i%5)+1080)%500;c.globalAlpha=.15+.15*Math.sin(t+i);c.fillStyle=i%3?'#bf8b57':'#bb374f';c.fillRect(Math.round(x),Math.round(y),i%4===0?2:1,2);}c.globalAlpha=1;
      if(settings.gore)for(const s of this.stains){c.fillStyle=`rgba(100,9,27,${s.a})`;c.fillRect(s.x-s.w/2,D.FLOOR+2,s.w,4);c.fillRect(s.x-2,D.FLOOR+4,3,10);}
      if(run){
        for(const f of run.fields){
          const a=Math.min(.45,f.life*.5)*fx,rot=f.kind==='void'&&run.hasResonance('rotMoon');
          if(f.ritual){const d=D.ultimates[f.ritual],age=(f.maxLife||f.life)-f.life,phase=f.life<.45?3:age<.25?0:1+Math.floor(age*4)%2;this.sprite(d.image,d.row*4+phase,4,3,f.x,f.y,f.r*2.2,f.r*2.2,false,a+.08*fx);}
          else if(rot){const age=(f.maxLife||f.life)-f.life,phase=f.life<.3?3:age<.25?0:1+Math.floor(age*5)%2;this.sprite('resonancefx',8+phase,4,4,f.x,f.y,f.r*2.2,f.r*2.2,false,a+.08*fx);}
          else this.sprite(f.kind==='void'?'fx':'skillfx',Math.floor(t*7)%4+(f.kind==='void'?12:8),4,4,f.x,f.y,f.r*2.2,f.r*2.2,false,a);
        }
        for(const h of run.hazards){
          if(h.kind==='sweep')continue;
          c.fillStyle=h.active?'rgba(255,140,55,.14)':'rgba(255,178,82,.07)';c.fillRect(h.x-h.r,30,h.r*2,D.FLOOR-30);c.strokeStyle=h.active?'#ffc38eaa':'#ffc38e77';c.setLineDash(h.active?[]:[5,8]);c.strokeRect(h.x-h.r,30,h.r*2,D.FLOOR-30);c.setLineDash([]);
          this.sprite('pillars',4+(h.active?2:Math.min(3,Math.floor((1-Math.min(1,h.delay))*4))),4,2,h.x,D.FLOOR+1,h.r*3,110,false,h.active?.95:.6+.25*Math.sin(t*14)**2);
          if(h.active){const phase=Math.min(3,Math.floor(-h.delay/Math.max(.1,h.life-h.delay)*4));this.sprite('pillars',phase,4,2,h.x,D.FLOOR+1,h.r*3.2,440);}
        }
        for(const e of run.enemies){
          if(e.dead)continue;
          const sprite=this.enemySprite(e);
          const size=e.boss?e.r*3.05:e.r*3.25,flip=e.facing<0;
          const arriving=e.arrival>0,arrivalProgress=arriving?1-e.arrival/e.arrivalDuration:1;
          if(arriving)this.sprite('arrival',Math.min(3,Math.floor(arrivalProgress*4)),4,1,e.x,e.y,size*1.6,size*1.6,false,.85);
          if(e.shoot<.5){c.strokeStyle='rgba(255,184,97,.65)';c.lineWidth=1;c.beginPath();c.arc(e.x,e.y,e.r+7+Math.sin(t*20)*2,0,6.28);c.stroke();}
          if(e.windup>0){c.strokeStyle='rgba(255,166,90,.6)';c.setLineDash([4,5]);c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.targetX,e.targetY);c.stroke();c.setLineDash([]);}
          // 発光は輪郭を塗りつぶさず薄い重ね描きにとどめ、絵と敵弾を読めるようにする。
          if(e.enraged)this.sprite('skillfx',12+Math.floor(t*4)%4,4,4,e.x,e.y,size*1.35,size*1.35,false,e.phaseTimer>0?.6:.13);
          c.save();c.translate(e.x,e.y);if(e.hit>0)c.rotate((flip?-1:1)*e.hit*.55);
          this.sprite(sprite.image,sprite.index,sprite.cols,sprite.rows||4,0,0,size,size,flip,(e.hit>0?.7:1)*(arriving?.35+arrivalProgress*.65:1));c.restore();
          if(e.crown==='curse'&&e.curseWarn){const at=run.enemyMuzzle(e);this.sprite('crowns',e.curseCD>.4?4:5,4,2,at.x,at.y,size*1.6,size*1.6,false,.95);}
          if(e.requiem>0)this.sprite('resonances',3,2,2,e.x,e.y-e.r-25,22,22,false,.8);
          if(e.cast>0){const muzzle=run.enemyMuzzle(e);this.sprite('projectiles',11,6,2,muzzle.x,muzzle.y,e.r*1.3,e.r*1.3,false,Math.min(1,e.cast*4));}
          if(e.burn)this.sprite('fx',4+Math.floor(t*8)%4,4,4,e.x,e.y+12,size*.7,size*.7,false,.28);
          if(e.crown){const idx=D.crowns.findIndex(d=>d.id===e.crown),cy=Math.max(42,e.y-e.r-28);this.sprite('crowns',idx,4,2,e.x,cy,38,38);}
          if(!e.boss&&(e.hp<e.maxHp||e.crown)){const width=e.crown?44:34;c.fillStyle='#201217';c.fillRect(e.x-width/2,e.y-e.r-11,width,3);c.fillStyle=e.crown?D.crowns.find(d=>d.id===e.crown).color:e.poison?'#a4c280':'#bf5862';c.fillRect(e.x-width/2,e.y-e.r-11,width*Math.max(0,e.hp/e.maxHp),3);}
        }
        for(const b of run.bullets){
          c.strokeStyle=b.color;c.globalAlpha=.25*fx;c.lineWidth=b.r*1.4;c.beginPath();c.moveTo(b.x,b.y);
          // 直前の反射点を通し、残光が壁の外へ突き抜けたり角の内側を横切ったりしないようにする。
          let tail={x:b.x,y:b.y,vx:b.vx,vy:b.vy,age:0};for(let i=(b.trailBends?.length||0)-1;i>=0;i--){tail=b.trailBends[i];c.lineTo(tail.x,tail.y);}c.lineTo(tail.x-tail.vx*(.035-tail.age),tail.y-tail.vy*(.035-tail.age));c.stroke();c.globalAlpha=1;
          // 弾頭も画像素材を使用。敵弾は明るい橙の輪で見分ける。
          const kind=b.sprite??(run.has('ossuary')?1:['lantern','needle','censer','bell','book','scythe'].indexOf(run.weapon.id));
          c.save();c.translate(Math.round(b.x),Math.round(b.y));c.rotate(Math.atan2(b.vy,b.vx));this.sprite('projectiles',kind,6,2,0,0,b.r*6.4,b.r*6.4,false,.98*fx);c.restore();
        }
        for(const v of run.pickups){const bob=Math.sin(t*4+v.x)*1.4,fade=v.life<3?.5+Math.sin(t*10)*.3:1;
          if(v.souls)this.sprite('ash',0,1,1,v.x,v.y+bob,26,26,false,fade);
          else this.sprite('projectiles',10,6,2,v.x,v.y+bob,28,28,false,fade);}
        this.drawPlayer(run,dt);
        if(run.intro>0&&!run.training){c.save();c.globalAlpha=Math.min(1,run.intro*2);c.fillStyle='rgba(10,8,11,.86)';c.textAlign='center';
          if(run.wave%8===0){const boss=D.bossForWave(run.wave);c.fillRect(170,175,620,142);c.strokeStyle='#a3556355';c.strokeRect(170,175,620,142);c.fillStyle='#ba9870';c.font='11px Georgia';c.fillText('REQUIEM '+Math.ceil(run.wave/8)+' · '+boss.subtitle,480,202);c.fillStyle='#ecded0';c.font='bold 27px sans-serif';c.fillText(boss.name,480,249);c.fillStyle='#c5ada6';c.font='13px sans-serif';c.fillText(boss.tactic,480,287);}
          else{c.fillRect(240,205,480,100);c.fillStyle='#b1976b';c.font='12px Georgia';c.fillText(D.zones[zone],480,229);c.fillStyle='#e1d4be';c.font='32px Georgia';c.fillText('WAVE '+String(run.wave).padStart(2,'0'),480,274);}c.restore();}
      }
      for(const m of this.motes){m.life-=dt;m.x+=m.vx*dt;m.y+=m.vy*dt;m.vy+=410*dt;if(m.y>D.FLOOR+10){m.y=D.FLOOR+10;m.vx*=.8;m.vy=0;}c.globalAlpha=Math.min(1,m.life*2);c.fillStyle=m.color;c.fillRect(Math.round(m.x),Math.round(m.y),m.size,m.size);}c.globalAlpha=1;this.motes=this.motes.filter(m=>m.life>0);
      for(const e of this.effects){e.life-=dt;if(e.life<=0)continue;const progress=1-e.life/e.max;this.effectAlpha=e.hostile||e.kind==='corpse'?1:fx;c.globalAlpha=Math.min(1,e.life*5)*this.effectAlpha;
        if(e.kind==='crownReward'){this.sprite('crowns',3,4,2,e.x,e.y-progress*24,70,70,false,1-progress);c.font='12px serif';c.textAlign='center';c.fillStyle='#e9c685';c.fillText('+'+e.reward+' 遺灰',e.x,Math.max(24,e.y-42-progress*30));}
        if(e.kind==='corpse'){c.save();c.translate(e.x,e.y+progress*18);c.rotate((e.flip?-1:1)*progress*.12);this.sprite(e.image,e.index,e.cols,e.rows||4,0,0,e.size,e.size,e.flip,(1-progress)*.7*(e.bodyAlpha??1));c.restore();}
        if(e.kind==='sprite')this.sprite(e.image||'fx',e.row*4+Math.min(3,Math.floor(progress*4)),4,e.rows||4,e.x,e.y,e.size,e.size,false,Math.min(1,e.life*5));
        if(e.kind==='lightning'){const length=Math.hypot(e.tx-e.x,e.ty-e.y);c.save();c.translate((e.x+e.tx)/2,(e.y+e.ty)/2);c.rotate(Math.atan2(e.ty-e.y,e.tx-e.x));this.sprite('combatfx',8+Math.min(3,Math.floor(progress*4)),4,4,0,0,length*1.2,85,false,Math.min(.8,e.life*5));c.restore();c.strokeStyle='#fff1b8';c.lineWidth=1;c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.tx,e.ty);c.stroke();}
        if(e.kind==='cleave'){c.save();c.translate(e.x,e.y);c.rotate(progress*Math.PI*1.5);this.sprite('skillfx',Math.min(3,Math.floor(progress*4)),4,4,0,0,e.r*2.3,e.r*2.3);c.restore();}
        if(e.kind==='nova'){c.strokeStyle=D.weapons?.find(w=>w.id===e.weapon)?.color||'#dc858c';c.lineWidth=8*(1-progress);c.beginPath();c.arc(e.x,e.y,progress*720,0,6.28);c.stroke();}
        if(e.kind==='dust'){this.sprite('combatfx',4+Math.min(3,Math.floor(progress*4)),4,4,e.x,e.y,e.dash?110:65,70,false,e.life/e.max*.65);}
      }this.effectAlpha=1;c.globalAlpha=1;this.effects=this.effects.filter(e=>e.life>0);
      for(const n of this.numbers){n.life-=dt;n.merge-=dt;n.y-=dt*30;if(n.life<=0||!n.heal&&(settings.damageNumbers==='none'||settings.damageNumbers==='critical'&&!n.crit))continue;c.globalAlpha=Math.min(1,n.life*4);c.font=(n.crit?'bold 15px':'11px')+' monospace';c.textAlign='center';c.fillStyle='#120b10';const value=(n.heal?'+':'')+n.n;c.fillText(value,n.x+1,n.y+1);c.fillStyle=n.color;c.fillText(value,n.x,n.y);}c.globalAlpha=1;this.numbers=this.numbers.filter(n=>n.life>0);
      const vignette=c.createRadialGradient(480,280,180,480,280,580);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.7)');c.fillStyle=vignette;c.fillRect(0,0,960,540);
      // 敵弾と自分の中心点は攻撃演出より上へ。大きな斬撃でも回避の情報を隠さない。
      if(run){for(const b of run.hostile){c.fillStyle='#31101b';c.beginPath();c.arc(b.x,b.y,b.r+2,0,6.28);c.fill();c.save();c.translate(Math.round(b.x),Math.round(b.y));c.rotate(Math.atan2(b.vy,b.vx));this.sprite('projectiles',b.sprite??(b.r>5?8:6),6,2,0,0,b.r*5,b.r*5);c.restore();c.strokeStyle='#ffe0a7';c.lineWidth=1;c.beginPath();c.arc(b.x,b.y,b.r,0,6.28);c.stroke();}this.drawThreats(run,settings);}
      if(this.flash>0){this.flash-=dt;if(settings.flashes!==false){c.fillStyle=`rgba(170,15,37,${Math.max(0,this.flash)*1.1})`;c.fillRect(0,0,960,540);}}c.restore();
      // 照準は揺れや味方演出の濃度へ連動させず、マウスが指す位置を保つ。
      if(aim){this.effectAlpha=1;this.sprite('aim',0,1,1,aim.x,aim.y,34,34);}
    }
    drawThreats(run,settings){
      const c=this.ctx,p=run.p;
      // 攻撃予告と実寸の判定輪は、味方の大技を重ねた後にも読めるよう前面へ描く。
      for(const h of run.hazards){
        if(h.kind==='sweep'){
          const fading=h.delay<=-h.duration,phase=fading?3:h.active?2:h.delay<h.startDelay*.45?1:0;
          this.sprite('beam',phase,1,4,480,h.y,1020,80,false,fading?Math.max(0,h.life/.28):h.active?1:.85);
          // 光の飾りより判定帯を狭くし、上下端を常に同じ位置へ明示する。
          if(!fading){c.fillStyle=h.active?'#ee657322':'#ee657310';c.fillRect(0,h.y-h.r,960,h.r*2);c.strokeStyle=h.active?'#ffe2cb':'#ef8596bb';c.lineWidth=1;c.setLineDash(h.active?[]:[6,8]);c.strokeRect(-1,h.y-h.r,962,h.r*2);c.setLineDash([]);if(!h.active){c.fillStyle='#ef8596';c.fillRect(0,h.y+h.r+3,960*Math.max(0,Math.min(1,1-h.delay/h.startDelay)),2);}}
          continue;
        }
        c.strokeStyle=h.active?'#ffc38ed9':'#ffc38e99';c.lineWidth=1;c.setLineDash(h.active?[]:[5,8]);c.strokeRect(h.x-h.r,30,h.r*2,D.FLOOR-30);c.setLineDash([]);
        if(!h.active){c.fillStyle='#f4bf83';const progress=Math.max(0,Math.min(1,1-h.delay/1.2));c.fillRect(h.x-h.r,D.FLOOR+2,h.r*2*progress,2);}
      }
      for(const e of run.enemies)if(!e.dead&&e.windup>0){c.strokeStyle='#ffc98dbb';c.lineWidth=1;c.setLineDash([4,5]);c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.targetX,e.targetY);c.stroke();c.setLineDash([]);c.beginPath();c.arc(e.targetX,e.targetY,9,0,Math.PI*2);c.stroke();}
      for(const e of run.enemies)if(!e.dead&&e.kind==='oblivion'){
        const route=e.gap&&e.shoot<1?run.bellRoute(e):e.route?.life>0?e.route:null;if(!route)continue;
        c.strokeStyle='#b9ececaa';c.lineWidth=1;c.setLineDash([3,7]);c.beginPath();
        for(const side of [-1,1]){const angle=route.angle+side*route.width/2,dist=(D.FLOOR-22-route.y)/Math.max(.1,Math.sin(angle));c.moveTo(route.x,route.y);c.lineTo(Math.max(30,Math.min(930,route.x+Math.cos(angle)*dist)),D.FLOOR-22);}
        c.stroke();c.setLineDash([]);c.strokeStyle='#b9ecec';c.beginPath();c.moveTo(route.targetX-25,D.FLOOR-9);c.lineTo(route.targetX-25,D.FLOOR-4);c.lineTo(route.targetX+25,D.FLOOR-4);c.lineTo(route.targetX+25,D.FLOOR-9);c.stroke();
      }
      if(settings.hitRing!==false){c.beginPath();c.arc(p.x,p.y,p.r,0,Math.PI*2);c.strokeStyle='#100c16';c.lineWidth=3;c.stroke();c.strokeStyle=p.invuln>0?'#b3d8f3':'#ead7b1';c.lineWidth=1;c.stroke();}
      c.fillStyle='#170f18';c.fillRect(p.x-3,p.y-3,6,6);c.fillStyle='#fff1ce';c.fillRect(p.x-2,p.y-2,4,4);
    }
    drawPlayer(run,dt){
      const p=run.p,c=this.ctx,s=run.stats;
      const costume=Math.max(0,D.masks.findIndex(d=>d.id===run.mask.id));
      const flip=p.facing<0,alpha=this.settings.flashes!==false&&p.invuln>0&&Math.floor(this.time*14)%2===0?.5:1;
      c.fillStyle='rgba(0,0,0,.4)';c.beginPath();c.ellipse(p.x,D.FLOOR+1,21,5,0,0,6.28);c.fill();
      // 長衣の浮遊移動に統一し、生成コマ間の手足・顔の変形を避ける。
      const pose=run.playerPose();
      if(p.dashTime>0)for(let i=3;i>0;i--)this.sprite('costumes',costume,3,2,p.x-p.dashDir*i*19,p.y-22,76,86,flip,.08*(4-i));
      c.save();c.translate(pose.x,pose.y);c.rotate(pose.angle);this.sprite('costumes',costume,3,2,0,0,76,86,flip,alpha);c.restore();
      if(p.shotCD>1/s.rate-.065)this.sprite('projectiles',11,6,2,pose.muzzle.x,pose.muzzle.y,27,27,false,.85);
      if(p.shield>0){c.strokeStyle='rgba(211,203,159,.6)';c.lineWidth=1;c.beginPath();c.ellipse(p.x,p.y-9,27,39,0,0,6.28);c.stroke();}
      c.fillStyle='#fff1ce';c.fillRect(p.x-2,p.y-2,4,4);
      for(let i=0;i<s.familiar;i++){const a=(run.time+(run.clearElapsed||0))*1.4+i*6.28/s.familiar;this.sprite('icons',17,6,4,p.x+Math.cos(a)*52,p.y-24+Math.sin(a)*28,25,25,false,.85);}
    }
  }
  window.BCRenderer=Renderer;
})();
