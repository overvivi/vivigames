'use strict';
const E=AmberEngine,$=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
const W=480,H=270,G=E.GROUND,art=new Image(),background=new Image();
let duel=new E.Duel(8026),started=false,paused=false,menuKind='title',helpReturn='',difficulty='normal',angle=45,power=72;
let camera={x:-20,y:0},scouting=false,showTrace=true,clock=0,accumulator=0,last=0,settleTime=0,aiTime=0,introTime=0;
let shotPose=[0,0],hurt=[0,0],recoil=[0,0],fall=[0,0],particles=[],stains=[],stuck=[],numbers=[],shake=0,ring=null;
let audioCtx=null,soundOn=false,ready=false,previousHud='',held=new Set();
let pull=null;
// 草や飛沫は専用乱数を使い、CPUの判断と次ラウンドの風に影響させない。
const visualRandom=E.rng(92483),scenery=Array.from({length:180},(_,i)=>({x:i*11-180,h:9+visualRandom()*28,k:visualRandom(),phase:visualRandom()*6.28}));
const leafSeeds=Array.from({length:27},()=>({x:visualRandom()*1200,y:45+visualRandom()*169,s:.5+visualRandom(),p:visualRandom()*6}));
const color={cream:'#f5dfae',gold:'#e8b76c',teal:'#8dbdb0'};
function sound(kind){
  if(!soundOn)return;
  try{
    if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    audioCtx.resume();
    const notes={shoot:[420,95,.16,'triangle'],hit:[150,55,.16,'sawtooth'],head:[650,130,.22,'square'],miss:[70,35,.09,'triangle'],menu:[430,640,.07,'sine'],win:[523,1046,.4,'triangle'],lose:[220,110,.4,'triangle']}[kind];
    const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime;
    o.type=notes[3];o.frequency.setValueAtTime(notes[0],t);o.frequency.exponentialRampToValueAtTime(notes[1],t+notes[2]);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.075,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+notes[2]);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+notes[2]+.01);
  }catch{soundOn=false;}
}
function message(text){$('message').textContent=text;}
function resetEffects(){cancelPull();shotPose=[0,0];hurt=[0,0];recoil=[0,0];fall=[0,0];particles=[];stains=[];stuck=[];numbers=[];ring=null;shake=0;settleTime=0;aiTime=0;scouting=false;introTime=2.2;held.clear();}
function start(){duel=new E.Duel(Date.now(),difficulty);started=true;paused=false;resetEffects();closeMenu();message('まずは偵察。敵までの距離と風向きを確かめよう。');sound('menu');sync();}
function nextRound(){duel.newRound();resetEffects();closeMenu();message('風と距離が変わった。新しい一射目を。');sync();}
function closeMenu(){menuKind='';$('overlay').hidden=true;paused=false;held.clear();}
function showMenu(kind){
  cancelPull();
  menuKind=kind;held.clear();$('overlay').hidden=false;const menu=$('menu');
  const title='<div class="crest">↗</div><div class="eyebrow">AMBER BOW / 黄昏の弓くらべ</div>';
  if(kind==='title'){
    menu.innerHTML=title+'<h2>風を読む、弓の決闘。</h2><p>画面を押して、左下へ引っぱる。離すと発射。<br>引く方向で射角、長さで威力が変わります。</p><div class="difficulties" role="group" aria-label="難易度"><button data-level="easy">やさしい</button><button data-level="normal">ふつう</button><button data-level="hard">むずかしい</button></div><button class="primary" id="begin">決闘をはじめる ↗</button><p class="subtle">2ラウンド先取 · マウス / タッチ両対応</p>';
    menu.querySelectorAll('[data-level]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.level===difficulty));b.onclick=()=>{difficulty=b.dataset.level;showMenu('title');sound('menu');};});
    $('begin').disabled=!ready;$('begin').textContent=ready?'決闘をはじめる ↗':'射手を準備中…';$('begin').onclick=start;
  }else if(kind==='pause'){
    menu.innerHTML=title+'<h2>ひと休み。</h2><p>風も矢も、そのままで待っています。</p><button class="primary" id="resume">決闘に戻る</button><button class="secondary" id="to-title">タイトルへ</button>';
    $('resume').onclick=()=>{closeMenu();sync();};$('to-title').onclick=()=>{started=false;paused=false;showMenu('title');sync();};
  }else if(kind==='help'){
    menu.innerHTML='<div class="eyebrow">HOW TO PLAY</div><h2>引いて、狙って、放つ。</h2><p class="tips">① 画面を押したまま、左下へ引っぱる。<br>② 引く方向で射角、長さで威力を調整。<br>③ 離すと発射。押した位置へ戻すとキャンセル。<br>微調整は下のスライダーでもできます。<br>風と青い前回の軌跡を参考に、2ラウンド先取。</p><div class="help-grid"><span><strong>↑ ↓</strong> 射角</span><span><strong>← →</strong> 威力</span><span><strong>Z / Space</strong> 発射</span><span><strong>E</strong> 敵を見る（長押し）</span><span><strong>X＋方向</strong> 大きく調整</span><span><strong>Esc</strong> 引っぱりを中止</span></div><button class="primary" id="help-close">戻る</button>';
    $('help-close').onclick=()=>{if(helpReturn){showMenu(helpReturn);sync();}else if(started){closeMenu();sync();}else showMenu('title');};
  }else{
    const win=duel.turn===0,match=kind==='match';
    menu.innerHTML='<div class="eyebrow">'+(match?'MATCH COMPLETE':'ROUND '+String(duel.round).padStart(2,'0')+' COMPLETE')+'</div><h2>'+(win?(match?'黄昏の勝者。':'この一本を、制した。'):(match?'次の風で、再戦を。':'この勝負は、相手に。'))+'</h2><div class="result-score">'+duel.score[0]+' : '+duel.score[1]+'</div><p>'+(match?'ローワンとレイヴン、黄昏の決闘。':'次のラウンドでは、風と距離が変わります。')+'</p><button class="primary" id="continue">'+(match?'もう一度、決闘する':'次のラウンドへ ↗')+'</button><button class="secondary" id="to-title">タイトルへ</button>';
    $('continue').onclick=match?start:nextRound;$('to-title').onclick=()=>{started=false;showMenu('title');sync();};sound(win?'win':'lose');
  }
}
function togglePause(){if(!started||['round','match'].includes(duel.phase))return;if(menuKind==='pause'){closeMenu();}else if(!menuKind){paused=true;showMenu('pause');}sync();}
function canAim(){return started&&!menuKind&&!paused&&duel.phase==='aim'&&duel.turn===0&&introTime<=0;}
function fire(){if(!canAim()||scouting||pull)return;duel.fire(angle,power);shotPose[0]=.48;recoil[0]=-3;sound('shoot');burst(duel.x[0]+22,G-36,5,1,'#edc995');burst(duel.x[0],G,7,-1,'#bc9368');message('矢の行方を見届けよう。');sync();}
function sync(){
  const data=[...duel.hp,...duel.score,duel.round,duel.wind,duel.distance,duel.phase,duel.turn,canAim(),scouting,showTrace,menuKind,!!pull].join('|');
  if(data===previousHud)return;previousHud=data;
  for(let i=0;i<2;i++){const key=i?'enemy':'player';$(key+'-hp').textContent=duel.hp[i]+' / 100';$(key+'-bar').style.transform='scaleX('+duel.hp[i]/100+')';$(key+'-trail').style.transform='scaleX('+duel.hp[i]/100+')';}
  $('round').textContent='ROUND '+String(duel.round).padStart(2,'0');$('score').innerHTML=(duel.score[0]>=1?'●':'○')+' '+(duel.score[0]>=2?'●':'○')+' <span>—</span> '+(duel.score[1]>=1?'●':'○')+' '+(duel.score[1]>=2?'●':'○');
  $('wind').textContent=duel.wind===0?'− 無風':(duel.wind>0?'→ 追い風 ':'← 向かい風 ')+Math.abs(duel.wind);$('distance').textContent='距離 '+duel.distance+' px';
  $('fire').disabled=!canAim()||scouting||!!pull;$('angle').disabled=!canAim()||!!pull;$('power').disabled=!canAim()||!!pull;$('scout').disabled=!canAim()||!!pull;$('trace').disabled=!started||!!menuKind;
  $('scout').setAttribute('aria-pressed',String(scouting));$('scout').innerHTML=scouting?'照準に戻る <kbd>E</kbd>':'敵を見る <kbd>E</kbd>';$('scout-note').hidden=!scouting;
  $('trace').textContent='軌跡 '+(showTrace?'ON':'OFF');$('trace').setAttribute('aria-pressed',String(showTrace));
  $('turn-label').textContent=!started?'風を読む、小さな決闘。':introTime>0?'ROUND '+duel.round+' · 敵の位置を確認':duel.phase==='flight'?'ARROW IN FLIGHT':duel.phase==='aim'?(duel.turn===0?'YOUR TURN · あなたの番':'RAVEN IS AIMING · 相手の番'):'一射の行方。';
  $('pause').disabled=!started||['round','match'].includes(duel.phase);
}
function adjust(){angle=Number($('angle').value);power=Number($('power').value);$('angle-value').textContent=angle+'°';$('power-value').textContent=power+'%';}
function aimValues(a,p){$('angle').value=a;$('power').value=p;adjust();}
function cancelPull(restore=true){
  if(!pull)return;const active=pull;pull=null;
  if(restore)aimValues(active.beforeAngle,active.beforePower);
  $('pull-readout').hidden=true;canvas.classList.remove('dragging');
  if(canvas.hasPointerCapture(active.id))canvas.releasePointerCapture(active.id);
}
function movePull(e){
  if(!pull||e.pointerId!==pull.id)return;
  pull.x=e.clientX;pull.y=e.clientY;pull.aim=E.pullAim(pull.x-pull.startX,pull.y-pull.startY,pull.width);
  if(pull.aim.valid)aimValues(pull.aim.angle,pull.aim.power);
  $('pull-values').textContent=pull.aim.valid?angle+'° / '+power+'%':'↙ 引いて狙う';
  $('pull-state').textContent=pull.aim.valid?'離して発射 · 元の位置で取消':pull.aim.distance<12?'左下へ引っぱる / 離すと取消':'左下へ引いてください';
  $('pull-fill').style.transform='scaleX('+(pull.aim.valid?power/100:0)+')';$('pull-readout').classList.toggle('invalid',!pull.aim.valid);
  render();
}
canvas.addEventListener('pointerdown',e=>{
  if(pull){if(e.pointerId!==pull.id){cancelPull();sync();}return;}
  if(!e.isPrimary||e.button!==0||!canAim()||scouting)return;
  e.preventDefault();canvas.focus({preventScroll:true});
  const r=canvas.getBoundingClientRect();pull={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,width:r.width,beforeAngle:angle,beforePower:power};
  canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');$('pull-readout').hidden=false;movePull(e);sync();
});
canvas.addEventListener('pointermove',e=>{if(pull&&e.pointerId===pull.id){e.preventDefault();movePull(e);}});
canvas.addEventListener('pointerup',e=>{
  if(!pull||e.pointerId!==pull.id)return;e.preventDefault();movePull(e);const shoot=pull.aim.valid&&canAim()&&!scouting;cancelPull(!shoot);if(shoot)fire();else {message('引っぱりをキャンセル。もう一度狙えます。');sync();}
});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(pull&&e.pointerId===pull.id){cancelPull();sync();}});
window.addEventListener('resize',()=>{cancelPull();sync();});
$('angle').oninput=adjust;$('power').oninput=adjust;$('fire').onclick=fire;$('pause').onclick=togglePause;
$('scout').onclick=()=>{if(canAim()){scouting=!scouting;sync();}};$('trace').onclick=()=>{showTrace=!showTrace;sync();};
$('sound').onclick=()=>{soundOn=!soundOn;$('sound').textContent='音 '+(soundOn?'ON':'OFF');$('sound').setAttribute('aria-label','音を'+(soundOn?'オフ':'オン')+'にする');sound('menu');};
$('help').onclick=()=>{if(menuKind==='help')return;helpReturn=menuKind;paused=started;showMenu('help');sync();};
window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if(pull){if(key==='escape'){e.preventDefault();cancelPull();sync();}return;}
  if(e.target.matches('button,input,a')&&(key===' '||key==='enter'))return;
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','enter'].includes(key))e.preventDefault();
  if(key==='enter'||key==='escape'){if(!e.repeat)togglePause();return;}
  if(menuKind)return;
  if(key==='v'&&!e.repeat){showTrace=!showTrace;sync();}
  if(key==='e'&&canAim()){scouting=true;sync();}
  if(key==='z'||key===' '){if(!e.repeat)fire();return;}
  held.add(key);
  if(canAim()&&key.startsWith('arrow')){const step=held.has('x')?5:1;if(key==='arrowup')angle+=step;if(key==='arrowdown')angle-=step;if(key==='arrowright')power+=step;if(key==='arrowleft')power-=step;angle=E.clamp(angle,5,80);power=E.clamp(power,20,100);$('angle').value=angle;$('power').value=power;adjust();}
});
window.addEventListener('keyup',e=>{held.delete(e.key.toLowerCase());if(e.key.toLowerCase()==='e'){scouting=false;sync();}});
window.addEventListener('blur',()=>{cancelPull();held.clear();scouting=false;if(started&&!menuKind){paused=true;showMenu('pause');sync();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!menuKind){paused=true;showMenu('pause');sync();}});
function burst(x,y,count,direction,c){for(let i=0;i<count;i++){if(particles.length>=220)particles.shift();particles.push({x,y,vx:direction*(10+visualRandom()*50)+(visualRandom()-.5)*25,vy:-10-visualRandom()*45,life:.4+visualRandom()*.6,max:1,c,size:visualRandom()>.8?2:1,blood:false});}}
function impactFx(hit){
  const direction=hit.shooter===0?1:-1;settleTime=1.55;aiTime=0;
  if(hit.damage){
    const target=1-hit.shooter;hurt[target]=.5;recoil[target]=direction*6;shake=hit.kind==='head'?4:2;ring={x:hit.x,y:hit.y,t:.24};
    const count=duel.hp[target]===0?55:hit.kind==='head'?38:23;
    for(let i=0;i<count;i++)particles.push({x:hit.x,y:hit.y,vx:direction*(12+visualRandom()*80)+(visualRandom()-.5)*40,vy:-10-visualRandom()*60,life:2,max:2,c:i%3===0?'#e27d65':'#a64445',size:i%6===0?2:1,blood:true,bounce:i%6===0});
    numbers.push({x:hit.x,y:hit.y-7,t:1.4,value:hit.damage,head:hit.kind==='head'});sound(hit.kind==='head'?'head':'hit');
    message((hit.shooter===0?'あなた':'レイヴン')+'の'+(hit.kind==='head'?'ヘッドショット！':'命中！')+' −'+hit.damage+' HP');
  }else{
    if(hit.kind==='ground'){stuck.push({x:hit.x,y:G,dir:direction});if(stuck.length>22)stuck.shift();burst(hit.x,G,13,direction,'#c4986b');}
    const difference=(hit.x-duel.x[1-hit.shooter])*direction;message((hit.shooter===0?'あなた':'レイヴン')+'の矢は'+(hit.kind==='out'?'場外へ。':difference<0?'あと '+Math.round(-difference)+' px 手前。':'約 '+Math.round(difference)+' px 奥へ。')+(hit.shooter===0?' 次の一射で調整しよう。':''));sound('miss');
  }
}
function update(dt){
  clock+=dt;
  if(started&&!paused&&!menuKind){
    if(introTime>0){introTime=Math.max(0,introTime-dt);if(introTime===0)message('あなたの番。まずは射角45°前後で試してみよう。');}
    if(duel.phase==='flight'){const hit=duel.tick();if(hit)impactFx(hit);}
    else if(duel.phase==='settle'){settleTime-=dt;if(settleTime<=0){duel.finishShot();if(['round','match'].includes(duel.phase))showMenu(duel.phase);}}
    else if(duel.phase==='aim'&&duel.turn===1){aiTime+=dt;if(aiTime>1.35){const aim=duel.enemyAim();duel.fire(aim.angle,aim.power);shotPose[1]=.5;recoil[1]=3;sound('shoot');burst(duel.x[1]-22,G-36,5,-1,'#edc995');aiTime=0;}}
  }
  for(let i=0;i<2;i++){shotPose[i]=Math.max(0,shotPose[i]-dt);hurt[i]=Math.max(0,hurt[i]-dt);recoil[i]*=Math.exp(-dt*5);if(duel.hp[i]===0)fall[i]=Math.min(1,fall[i]+dt*1.7);}
  for(const p of particles){p.life-=dt;p.vy+=120*dt;p.vx*=Math.exp(-dt*.8);p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.y>=G){p.y=G;if(p.blood){stains.push({x:p.x,w:p.size+visualRandom()*3,t:0});if(stains.length>150)stains.shift();}if(p.bounce){p.vy=-p.vy*.2;p.vx*=.3;p.bounce=false;}else p.life=0;}}
  particles=particles.filter(p=>p.life>0);for(const stain of stains)stain.t+=dt;for(const n of numbers){n.t-=dt;n.y-=dt*10;}numbers=numbers.filter(n=>n.t>0);if(ring){ring.t-=dt;if(ring.t<=0)ring=null;}shake*=Math.exp(-dt*8);
  const enemyView=scouting||duel.turn===1||introTime>1;
  let tx=duel.x[enemyView?1:0]-(enemyView?W*.74:W*.25),ty=0;
  if(duel.arrow){tx=duel.arrow.x-W*.5;ty=Math.min(0,duel.arrow.y-95);}
  if(!pull){camera.x+=(E.clamp(tx,-90,duel.x[1]-210)-camera.x)*(1-Math.exp(-dt*5));camera.y+=(ty-camera.y)*(1-Math.exp(-dt*6));}
  sync();
}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));}
function line(x,y,x2,y2,c,width=1){ctx.strokeStyle=c;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(Math.round(x)+.5,Math.round(y)+.5);ctx.lineTo(Math.round(x2)+.5,Math.round(y2)+.5);ctx.stroke();}
function poly(points,c){ctx.fillStyle=c;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(Math.round(x),Math.round(y)):ctx.moveTo(Math.round(x),Math.round(y)));ctx.closePath();ctx.fill();}
function landscape(){
  // 高弾道で画像の上を越えても、夕空の同系色で視界を保つ。
  rect(0,0,W,H,'#a8787e');
  if(background.complete&&background.naturalWidth)ctx.drawImage(background,Math.round(-20-camera.x*.14),Math.round(-55-camera.y*.35),600,400);
  ctx.fillStyle='#152c2c28';ctx.fillRect(0,0,W,H);
}
function drawArcher(i){
  const x=duel.x[i]+recoil[i],dir=i===0?1:-1;
  let pose=0;if(hurt[i]>0||fall[i]>0)pose=3;else if(shotPose[i]>0)pose=2;else if(started&&duel.phase==='aim'&&duel.turn===i&&introTime<=0)pose=1;
  const frame=SPRITE_FRAMES[i*4+pose],scale=.132,bob=pose===0?Math.round(Math.sin(clock*2.8+i)*.6):0;
  ctx.save();ctx.translate(Math.round(x),G);ctx.scale(dir,1);if(fall[i]>0)ctx.rotate(-fall[i]*1.35);
  if(ready){ctx.drawImage(art,frame.x,frame.y,frame.w,frame.h,Math.round(-frame.footX*scale),Math.round(-frame.footY*scale+bob),Math.round(frame.w*scale),Math.round(frame.h*scale));if(hurt[i]>.32&&Math.floor(clock*30)%2){ctx.globalAlpha=.23;ctx.globalCompositeOperation='source-atop';rect(-8,-45,17,42,'#fff0c2');}}
  ctx.restore();
}
function drawArrow(a,alpha=1){ctx.save();ctx.translate(Math.round(a.x),Math.round(a.y));ctx.rotate(Math.atan2(a.vy,a.vx));ctx.globalAlpha=alpha;line(-9,0,3,0,'#fff0cb');line(-9,1,1,1,'#997045');poly([[5,0],[1,-2],[1,2]],'#fff0cb');line(-8,-2,-5,0,'#e5b36b');ctx.restore();}
function render(){
  const diagnostics=$('qa-motion');if(diagnostics)diagnostics.textContent='ROUND '+duel.round+' / t '+clock.toFixed(2)+' / grass '+E.grassSway(clock,duel.wind,0).toFixed(2);
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,W,H);landscape();
  ctx.save();ctx.translate(Math.round(-camera.x+(visualRandom()-.5)*shake),Math.round(-camera.y+(visualRandom()-.5)*shake));
  rect(camera.x-6,G,W+12,46,'#263b36');rect(camera.x-6,G,W+12,3,'#b4a366');rect(camera.x-6,G+3,W+12,3,'#758250');rect(camera.x-6,G+6,W+12,5,'#485e3d');
  for(const s of scenery){if(s.x<camera.x-20||s.x>camera.x+W+20)continue;rect(s.x,G+12+s.k*26,2+s.k*6,2,'#3a4940');if(duel.x.some(x=>Math.abs(x-s.x)<29))continue;const sway=E.grassSway(clock,duel.wind,s.phase);for(let k=0;k<3;k++){const x=s.x+k*3;line(x,G,x+sway+k-1,G-3-s.k*7,['#9b9c60','#c3b675','#72874f'][k]);}}
  for(const stain of stains)rect(stain.x,G+1,stain.w,1,stain.t<1?'#bc5950':'#6f4140');
  if(duel.wind!==0)for(const seed of leafSeeds){const speed=duel.wind*(.75+seed.s*.5),x=((seed.x+clock*speed)%1300+1300)%1300-100,y=seed.y+Math.sin(clock*1.1+seed.p)*5;rect(x,y,Math.floor(clock*3+seed.p)%3===0?1:3,1,seed.s>1?'#dcb46c':'#a79463');}
  for(const a of stuck){line(a.x,G,a.x-a.dir*9,G-7,'#d2ba89');}
  if(showTrace&&started){ctx.globalAlpha=.5;for(const p of duel.previous[0])rect(p.x,p.y,1,1,'#9ccfc0');ctx.globalAlpha=1;}
  drawArcher(0);drawArcher(1);
  if(duel.arrow){const points=duel.path.slice(-28);for(let i=1;i<points.length;i++){ctx.globalAlpha=i/points.length*.65;line(points[i-1].x,points[i-1].y,points[i].x,points[i].y,i>points.length*.6?'#f9dfa6':'#b68451');}ctx.globalAlpha=1;drawArrow(duel.arrow);}
  for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*3);if(p.blood)line(p.x,p.y,p.x-p.vx*.025,p.y-p.vy*.025,'#713c40');rect(p.x,p.y,p.size,p.size,p.c);}ctx.globalAlpha=1;
  if(ring){ctx.strokeStyle='#ffe6b4';ctx.globalAlpha=ring.t/.24;ctx.beginPath();ctx.arc(ring.x,ring.y,2+(1-ring.t/.24)*10,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  for(const n of numbers){ctx.font='bold '+(n.head&&n.t>1.1?14:11)+'px monospace';ctx.textAlign='center';ctx.fillStyle='#24312d';ctx.fillText('-'+n.value,Math.round(n.x)+1,Math.round(n.y)+1);ctx.fillStyle=n.head?'#ffd18e':'#fff1cd';ctx.fillText('-'+n.value,Math.round(n.x),Math.round(n.y));}
  // 画面外の相手の向きを表示し、スクロール中でも位置を見失わせない。
  ctx.restore();
  if(pull){
    const bounds=canvas.getBoundingClientRect(),sx=(pull.startX-bounds.left)*W/bounds.width,sy=(pull.startY-bounds.top)*H/bounds.height,px=(pull.x-bounds.left)*W/bounds.width,py=(pull.y-bounds.top)*H/bounds.height;
    ctx.globalAlpha=.8;line(sx,sy,px,py,pull.aim.valid?'#f7d69a':'#adc3b7',2);ctx.strokeStyle='#f7d69a';ctx.lineWidth=1;
    for(const [x,y,r] of [[sx,sy,6],[px,py,4]]){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
  }
  // 引っぱり用の実線が旧点線を塗りつぶしていたため、照準は同じ点線を最後に描く。
  // スライダーでもドラッグでも、角度は向き・威力は長さとして即座に反映する。
  if(canAim()&&!scouting){
    const a=E.launch(duel.x[0],1,angle,power),r=angle*Math.PI/180,length=19+power*.4;
    for(let i=1;i<=9;i++){const d=length*i/9,x=a.x-camera.x+Math.cos(r)*d,y=a.y-camera.y-Math.sin(r)*d;rect(x-1,y,3,3,'#253831');rect(x,y,2,2,'#ffe1a0');}
  }
  if(started&&!menuKind){for(let i=0;i<2;i++){const x=duel.x[i]-camera.x;if(x<10||x>W-10){const left=x<10;ctx.fillStyle='#f2dbad';ctx.font='9px monospace';ctx.textAlign=left?'left':'right';ctx.fillText(left?'◀ ROWAN':'RAVEN ▶',left?8:W-8,Math.min(208,G-33-camera.y));}}}
}
function frame(now){const elapsed=Math.min(.06,(now-(last||now))/1000);last=now;if(!paused&&(!menuKind||menuKind==='title')){accumulator+=elapsed;while(accumulator>=E.STEP){update(E.STEP);accumulator-=E.STEP;}}else accumulator=0;render();requestAnimationFrame(frame);}
art.onload=()=>{ready=true;if(menuKind==='title')showMenu('title');const params=new URLSearchParams(location.search);if(params.get('qa')==='1'&&['finish','match','aim'].includes(params.get('scene')))window.__amberQA.setScene(params.get('scene'));};art.onerror=()=>{message('射手の画像を読み込めませんでした。ページを開き直してください。');};art.src=SPRITE_DATA;background.src=BACKGROUND_DATA;
showMenu('title');sync();requestAnimationFrame(frame);
// 通常URLに検証用の状態操作を公開しない。
if(new URLSearchParams(location.search).get('qa')==='1')window.__amberQA={snapshot:()=>({phase:duel.phase,turn:duel.turn,hp:[...duel.hp],score:[...duel.score],wind:duel.wind,distance:duel.distance,ready,paused,scouting,angle,power,camera:{...camera},particles:particles.length,menu:menuKind}),setScene:(name)=>{start();introTime=0;duel.wind=0;duel.distance=450;duel.x=[115,565];if(name==='finish')duel.hp[1]=30;if(name==='match'){duel.hp[1]=30;duel.score[0]=1;}const aim=E.solve(duel.x[0],1,duel.wind,duel.x[1]);angle=aim.angle;power=aim.power;$('angle').value=angle;$('power').value=power;adjust();sync();},step:(seconds)=>{for(let i=0;i<seconds/E.STEP;i++)if(!paused&&(!menuKind||menuKind==='title'))update(E.STEP);render();}};
if(window.__amberQA){
  // 非表示タブのフレーム抑制に依存せず、同じ更新処理で決着まで検査できる入口。
  const panel=document.createElement('div');panel.style.cssText='display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:10px';
  for(const seconds of [.25,10]){const button=document.createElement('button');button.textContent='検証: '+seconds+'秒進める';button.onclick=()=>window.__amberQA.step(seconds);panel.append(button);}
  const calm=document.createElement('button');calm.textContent='検証: 無風';calm.onclick=()=>{duel.wind=0;sync();};panel.append(calm);
  const diagnostics=document.createElement('output');diagnostics.id='qa-motion';diagnostics.style.cssText='font-size:10px;width:100%;text-align:center';panel.append(diagnostics);document.querySelector('.app').append(panel);
}
