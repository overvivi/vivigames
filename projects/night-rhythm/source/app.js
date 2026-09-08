(function(){
'use strict';
const {GAMES,SHIFTS,ORDER,RECORD_KEYS,stampAwards,Session,makeChart,sectionAt}=RhythmCore;
const $=id=>document.getElementById(id),audio=new RhythmAudio(),canvas=$('gameCanvas'),ctx=canvas.getContext('2d');
let selected='mail',state='menu',session=null,chart=null,practice=false,pressed=false,pointerId=null,rewindBeat=0,frameId=0,lastBeat=-99,lastSection=-1,lastDemo=-1,feedbackUntil=0,effects=[],lastHit=null,rafNow=0,toastTimer=0,calibration=null,settingsPaused=false,startPending=false;
let prefs={volume:70,offset:0,help:true},bests={},transition=0,shift=false,stamps={};
try{const p=JSON.parse(localStorage.getItem('nightRhythmPrefs_v1')||'null');if(p){prefs.volume=Number.isFinite(p.volume)?Math.max(0,Math.min(100,p.volume)):70;prefs.offset=Number.isFinite(p.offset)?Math.max(-250,Math.min(250,p.offset)):0;prefs.help=p.help!==false;}}catch{}
try{bests=JSON.parse(localStorage.getItem('nightRhythmBests_v1')||'{}')||{};}catch{}
// 保存領域が古い形式でも、遊び終わった瞬間に記録処理で停止させない。
bests=Object.fromEntries(RECORD_KEYS.filter(id=>Number.isFinite(bests?.[id])).map(id=>[id,Math.max(0,Math.min(100,bests[id]))]));
try{stamps=JSON.parse(localStorage.getItem('nightRhythmStamps_v1'))||{};}catch{}
stamps=Object.fromEntries(RECORD_KEYS.map(k=>[k,[0,1,2].map(i=>stamps?.[k]?.[i]===true||(i<2&&(bests[k]||0)>=[65,85][i]))]));
function recordKey(){return selected+(shift?'-shift':'');}
function collection(){
 const total=Object.values(stamps).flat().filter(Boolean).length;$('stampTotal').textContent=total+' / '+RECORD_KEYS.length*3;
 $('stampGrid').innerHTML=RECORD_KEYS.map(k=>{const base=k.replace('-shift',''),name=k.endsWith('-shift')?SHIFTS[base].name:GAMES[base].name;return '<div class="stamp-row"><b>'+name+'</b>'+['初クリア','85点','ノーミス'].map((label,i)=>'<span class="postage '+(stamps[k][i]?'earned':'')+'" title="'+label+'">'+['✉','✦','♛'][i]+'<small>'+label+'</small></span>').join('')+'</div>';}).join('');
 $('nightTown').innerHTML=Array.from({length:10},(_,i)=>'<span class="town-house '+(total>i*3?'lit':'')+'" style="--h:'+(27+(i*17)%35)+'px"><i></i><i></i><i></i></span>').join('');$('townCaption').textContent=total===0?'切手を集めて、街に灯りをともそう。':total>=25?'街じゅう、お祭りみたい！':total>=12?'夜の街が、にぎやかになってきた。':'おしごとの灯りが、ともりはじめた。';
}
const assets={};document.querySelectorAll('[data-game]').forEach(b=>{const id=b.dataset.game;assets[id]=b.closest('article').querySelector('img')?.src;b.addEventListener('click',()=>select(id));});assets.remix=assets.mail;
function save(){try{localStorage.setItem('nightRhythmPrefs_v1',JSON.stringify(prefs));localStorage.setItem('nightRhythmBests_v1',JSON.stringify(bests));localStorage.setItem('nightRhythmStamps_v1',JSON.stringify(stamps));}catch{}}
function updateBests(){document.querySelectorAll('[data-best]').forEach(n=>{const v=bests[n.dataset.best];n.textContent=Number.isFinite(v)?'BEST '+v+' 点':'はじめてのおしごと';});collection();}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function applyPrefs(){audio.setVolume(prefs.volume/100);$('volume').value=prefs.volume;$('volumeOutput').value=prefs.volume+'%';$('offset').value=prefs.offset;$('offsetOutput').value=(prefs.offset>0?'+':'')+prefs.offset+' ms';$('visualHelp').checked=prefs.help;$('playboard').classList.toggle('no-hints',!prefs.help);}
function select(id,keepShift=false){if(!GAMES[id])return;stop();selected=id;if(!keepShift)shift=false;const g=GAMES[id];$('menu').hidden=true;$('playScreen').hidden=false;$('playScreen').className='play-screen '+id+(shift?' shift':'');$('gameTitle').textContent=shift?SHIFTS[id].name:g.name;$('gameIndex').textContent='0'+g.index+' / 07';$('stageArt').src=assets[id];$('stageArt').alt=g.name+'のおしごと風景';$('actionTitle').textContent=g.action;$('actionHint').textContent=g.hint;$('padText').textContent=g.pad;$('phaseLabel').textContent='READY';$('comboLabel').textContent='音を聴いてみよう';$('songProgress').style.width='0%';$('result').hidden=true;$('pauseButton').disabled=true;showBrief(false);window.scrollTo({top:0,behavior:'instant'});drawStatic();}
function showBrief(done){
 $('resultStamps').textContent='';$('stage').classList.remove('on-a-roll','oops');
 state='brief';$('briefing').hidden=false;$('tapPad').disabled=true;const g=GAMES[selected];
 $('briefType').textContent=done?'れんしゅう、おつかれさま！':g.mode;
 $('briefTitle').textContent=done?'曲にのって、やってみよう。':g.intro;
 $('briefText').innerHTML=done?'本番は約1分。失敗しても大丈夫。<br>次の合図から、またリズムにのろう。':g.description;
 $('patternGuide').innerHTML=g.guide.map((s,i)=>'<span class="'+((selected==='soda'?i>=2:i===3)?'you':'')+'">'+s+'<small>'+g.guideSmall[i]+'</small></span>').join('');
 $('practiceButton').textContent=done?'もう一度れんしゅう':'れんしゅうする ♪';$('startButton').textContent=done?'本番へ ♪':'本番へ →';$('startButton').className=done?'primary-button':'text-button';$('briefFoot').textContent=done?'いつでも一時停止できます。':'お手本のあとに、まねしてみよう。';
 $('stageCaption').textContent=g.action;$('feedback').textContent='';
 $('shiftButton').hidden=!SHIFTS[selected];$('shiftButton').textContent=shift?'☾ 通常のシフトへ':'☀ 別シフト：'+(SHIFTS[selected]?.name||'');
 if(shift&&!done){$('briefType').textContent='ANOTHER SHIFT · '+SHIFTS[selected].bpm+' BPM';$('briefTitle').textContent=SHIFTS[selected].name;$('briefText').innerHTML=selected==='mail'?'今朝は速達便。2連続の注文が続くよ。<br>コン・カン・キンのあと、ポン・ポン！':selected==='soda'?'閉店前は1・2・3拍の注文が交代。<br>1拍は高い音、3拍は最初に2音。<br>表示と合図を聴いて、離す拍を変えよう。':'流星群が到着！ 裏拍を含む4打。<br>お手本の間隔をよく聴いて、まねしよう。';}
}
function stop(){transition++;audio.stop();cancelAnimationFrame(frameId);pressed=false;pointerId=null;$('tapPad').classList.remove('pressed');effects=[];lastHit=null;}
function menu(){stop();stopCalibration();for(const d of document.querySelectorAll('dialog[open]'))d.close();state='menu';$('playScreen').hidden=true;$('menu').hidden=false;updateBests();window.scrollTo({top:0,behavior:'instant'});}
async function begin(isPractice){
 if(startPending)return;const request=transition;startPending=true;$('practiceButton').disabled=true;$('startButton').disabled=true;
 try{
  await audio.unlock();if(request!==transition)return;practice=isPractice;chart=makeChart(selected,isPractice,shift);session=new Session(chart);startRun(0);
 }catch(e){toast(e.message||'音を開始できませんでした。もう一度お試しください。');}
 finally{startPending=false;$('practiceButton').disabled=false;$('startButton').disabled=false;}
}
function startRun(start){
 $('resultStamps').textContent='';$('stage').classList.remove('on-a-roll','oops');
 pressed=false;pointerId=null;rewindBeat=start;state='running';lastBeat=-99;lastSection=-1;lastDemo=-1;effects=[];lastHit=null;
 $('tapPad').classList.remove('pressed');$('briefing').hidden=true;$('result').hidden=true;$('tapPad').disabled=false;$('pauseButton').disabled=false;$('feedback').textContent='';feedbackUntil=0;
 audio.start(chart,start);cancelAnimationFrame(frameId);frameId=requestAnimationFrame(frame);
}
function pause(show=true){if(state!=='running')return;const beat=Math.max(rewindBeat,audio.beat());rewindBeat=sectionAt(chart,beat).beat;audio.stop();cancelAnimationFrame(frameId);pressed=false;pointerId=null;$('tapPad').classList.remove('pressed');$('tapPad').disabled=true;state='paused';if(show&&!$('pauseDialog').open)$('pauseDialog').showModal();}
async function resume(){if(state!=='paused')return;try{await audio.unlock();session.rewind(rewindBeat);$('pauseDialog').close();startRun(rewindBeat);}catch(e){toast(e.message);}}
function inputTime(e){return Number.isFinite(e?.timeStamp)&&Math.abs(e.timeStamp-performance.now())<60000?e.timeStamp:performance.now();}
function input(kind,e){
 if(state!=='running')return;const b=audio.beat(inputTime(e),prefs.offset);
 if(kind==='down'){if(pressed)return;pressed=true;$('tapPad').classList.add('pressed');}else{if(!pressed)return;pressed=false;$('tapPad').classList.remove('pressed');}
 if(b<rewindBeat||b>=chart.duration)return;
 const sec=chart.sections.find(s=>b>=s.beat&&b<s.end);
 const id=sec?.mode||selected;
 if(sec?.demo)return;
 if(['moon','bakery'].includes(id)&&b-sec.beat<3.72){if(kind==='down')feedback('いまは聴く時間 ♪','listen');return;}
 const r=session.input(kind,b);
 // タップの指離しは判定しない。音も二重に鳴らさない。
 if(!['soda','fireworks','bakery'].includes(id)&&kind==='up')return;
 if(r){if(r.grade==='perfect'||r.grade==='good'){audio.hit(id,kind);react(r,b);}else if(r.grade==='extra'){audio.miss();feedback('合図を聴いてみよう','miss');}else{audio.miss();react(r,b);}}
 else if(['soda','fireworks','bakery'].includes(id)&&kind==='up'&&session.holds.size){lastHit={beat:b,grade:'miss',kind:'up'};}
}
function feedback(text,grade='perfect'){const f=$('feedback');f.textContent=text;f.style.color=grade==='miss'?'#807d88':grade==='listen'?'#617c91':GAMES[selected].color;f.classList.remove('pop');void f.offsetWidth;f.classList.add('pop');feedbackUntil=performance.now()+750;}
function react(r,beat){
 const ok=r.grade!=='miss';lastHit={beat,grade:r.grade,kind:r.kind,section:r.section};
 feedback(ok?(r.grade==='perfect'?(r.kind==='up'?'できあがり！':'ぴったり！'):r.error<0?'ちょっと はやい':'ちょっと おそい'):(r.reason==='early-release'?'もう少し、待って！':'つぎ、いこう！'),ok?r.grade:'miss');
 const art=$('stageArt');art.classList.remove('pulse','mistake');void art.offsetWidth;art.classList.add(ok?'pulse':'mistake');
 if(ok){for(let i=0;i<10;i++)effects.push({birth:performance.now(),angle:(i/10)*Math.PI*2,speed:25+(i%3)*18,color:[GAMES[selected].color,'#f3cb62','#fff8e9'][i%3]});}
 $('stage').classList.toggle('on-a-roll',session.combo>=5);$('stage').classList.remove('oops');if(!ok){void $('stage').offsetWidth;$('stage').classList.add('oops');}
}
function frame(now){
 if(state!=='running')return;rafNow=now;
 if(audio.ctx.state!=='running'){pause();return;}
 const b=audio.beat(now),judgeBeat=audio.beat(now,prefs.offset),spb=60/chart.game.bpm;
 if(b>=rewindBeat){const missed=session.advance(judgeBeat);if(missed.length){react(missed[missed.length-1],b);audio.miss();}}
 const beat=Math.floor(b),sec=sectionAt(chart,Math.max(rewindBeat,b)),id=sec.mode||selected;
 if(selected==='remix'&&lastSection!==sec.index){lastSection=sec.index;lastHit=null;$('stageArt').src=assets[id];$('stageArt').alt=GAMES[id].name+'のおしごと風景';$('playScreen').className='play-screen '+id;$('actionTitle').textContent=GAMES[id].name;$('actionHint').textContent=id==='soda'?'ピン → ポン → 押す → '+sec.hold+'拍後に離す':GAMES[id].hint;}
 if(beat!==lastBeat){lastBeat=beat;document.querySelectorAll('.beat-dots i').forEach((d,i)=>d.classList.toggle('on',i===((beat%4)+4)%4));}
 const count=b<rewindBeat;
 $('phaseLabel').textContent=count?'せーの、の準備':practice?(sec.demo?'お手本を見てね':'れんしゅう'):'本番';
 $('comboLabel').textContent=session.combo>1?session.combo+' COMBO':practice?'音をよく聴いてね':'あと '+Math.max(0,Math.ceil((chart.duration-Math.max(0,b))*spb))+' 秒';
 $('songProgress').style.width=Math.max(0,Math.min(100,b/chart.duration*100))+'%';
 if(count){$('stageCaption').textContent='あと '+Math.min(4,Math.max(1,Math.ceil(rewindBeat-b)))+' 拍でスタート';$('padText').textContent='聴いて、準備 ♪';}
 else{
  $('padText').textContent=id==='soda'?(pressed?'押したまま…':'長押し → 離す'):GAMES[id].pad;
  const p=b-sec.beat;
  if(id==='mail')$('stageCaption').textContent=sec.demo?'お手本：コン、カン、… ポン！':sec.double?'短い音がもう1つ → ポン、ポン！':p<1?'コン ♪':p<2?'カン ♪':p<3?'ひと呼吸…':'ここで、ポン！';
  if(id==='soda')$('stageCaption').textContent=sec.demo?'お手本：注いで、'+sec.hold+'拍後に離す':p<2?'この注文は '+sec.hold+' 拍。ピン、ポン…':p<2+sec.hold?pressed?'注いで… '+Math.max(1,Math.ceil(2+sec.hold-p))+' 拍':'押したまま、'+sec.hold+' 拍':p<3+sec.hold?'ぱっと離して、できあがり！':'つぎの注文を待とう ♪';
  if(id==='moon')$('stageCaption').textContent=p<3.5?'♪ お手本。リズムを聴こう':p<4?'つぎは、あなたの番！':'同じリズムで、まねっこ！';
  if(id==='fireworks')$('stageCaption').textContent=sec.demo?'お手本：'+sec.hold+'拍ためて打ち上げ':p<2?sec.hold+'拍の花火。次の合図で点火！':p<2+sec.hold?'押したまま… '+Math.ceil(2+sec.hold-p)+'拍':'ぱっと離して、ドン！';
  if(id==='ghost')$('stageCaption').textContent=p<sec.photoAt-1?'「チーズ」を待とう…':p<sec.photoAt?'チーズ ♪ 次の拍！':'パシャ！ おばけもにっこり';
  if(id==='bakery'){$('padText').textContent=p<7?'タップでこねる':pressed?'押したまま、のばす…':'長押し → 離す';$('stageCaption').textContent=p<4?'♪ こねるお手本を聴こう':p<6.8?'同じリズムで、こねこね！':p<7+sec.hold?'長押しして、'+sec.hold+'拍のばす':'離して、焼き上がり！';}
  if(sec.quiet)$('phaseLabel').textContent='伴奏なし · 拍を感じて';else if(chart.quiet&&b>=chart.quiet.to)$('phaseLabel').textContent='全楽器、カムバック！';else if(sec.finale)$('phaseLabel').textContent=sec.grand?'最後の大仕事！':'ラストスパート！';
 }
 const demo=chart.demos.findIndex((d,i)=>i>lastDemo&&d.beat<=b);
 if(demo>=0){lastDemo=demo;lastHit={beat:chart.demos[demo].beat,kind:chart.demos[demo].kind,grade:'perfect',demo:true};}
 if(now>feedbackUntil)$('feedback').textContent='';
 draw(b,count);
 if(judgeBeat>chart.duration+.5){complete();return;}
 frameId=requestAnimationFrame(frame);
}
function complete(){
 audio.stop();pressed=false;pointerId=null;$('tapPad').classList.remove('pressed');$('tapPad').disabled=true;$('pauseButton').disabled=true;$('songProgress').style.width='100%';
 session.advance(chart.duration+1);const s=session.stats();audio.finish(s.score>=65);
 if(practice){showBrief(true);$('phaseLabel').textContent='練習完了';$('comboLabel').textContent=s.perfect+s.good+' / '+s.total+' 成功';return;}
 state='result';$('result').hidden=false;$('briefing').hidden=true;$('feedback').textContent='';$('phaseLabel').textContent='おしごと完了';$('stageCaption').textContent='また遊びにきてね。';$('resultScore').textContent=s.score;
 const key=recordKey(),best=Number(bests[key])||0,newBest=s.score>best;bests[key]=Math.max(best,s.score);
 const awarded=stampAwards(s),fresh=awarded.map((v,i)=>v&&!stamps[key][i]);stamps[key]=awarded.map((v,i)=>v||stamps[key][i]);save();updateBests();
 $('resultStamps').textContent=fresh.some(Boolean)?'切手 GET！ '+['初クリア','85点','ノーミス'].filter((_,i)=>fresh[i]).join('・'):'切手：65点でクリア / 85点 / ノーミス';
 $('resultSubtitle').textContent=newBest?'ベスト更新！ おつかれさま。':'おしごと、おつかれさま！';
 $('resultTitle').textContent=s.score===100?'パーフェクト！':s.score>=85?'とびきりのリズム！':s.score>=65?'いいリズム！':s.score>=40?'だんだん、いい感じ。':'次は、きっとうまくいく。';
 $('perfectCount').textContent=s.perfect;$('goodCount').textContent=s.good;$('missCount').textContent=s.miss+s.extras;
 $('resultAdvice').textContent=s.score>=85?'気持ちよく決まったね。またこの曲で遊ぼう！':s.extras>4?'押さない時間もリズム。合図を待ってみよう。':s.miss>s.total*.4?'「れんしゅう」でお手本を聴くと、つかみやすいよ。':s.median<-.025?'少し早めかも。音を聴いて、ひと呼吸。':s.median>.025?'少し遅めかも。次の拍を感じながら押してみよう。':'いい調子！つぎは「ぴったり」を増やそう。';
}
function rounded(x,y,w,h,r,fill,stroke=null,width=2){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}}
function text(t,x,y,size=20,color=GAMES[selected].color,weight=800){ctx.fillStyle=color;ctx.font=weight+' '+size+'px "Hiragino Maru Gothic ProN","Yu Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,x,y);}
function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
function drawStatic(){resize();ctx.clearRect(0,0,canvas.width,canvas.height);}
let logicalW=900,logicalH=530;
function resize(){const box=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);if(!box.width)return;const w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}logicalW=box.width;logicalH=box.height;ctx.setTransform(dpr,0,0,dpr,0,0);}
function draw(beat,count){
 resize();const W=logicalW,H=logicalH;ctx.clearRect(0,0,W,H);const mobile=W<550,x=W*.71,y=H*.55,scale=mobile?.79:1,size=Math.min(W*.34,260);
 if(count){circle(W*.68,H*.42,44*scale,'#fff9edf0');text(Math.min(4,Math.max(1,Math.ceil(rewindBeat-beat))),W*.68,H*.42,45*scale);return;}
 const sec=sectionAt(chart,beat),p=beat-sec.beat,id=sec.mode||selected;
 if(id==='mail'){
  const next=chart.notes.find(n=>n.beat>=beat-.65)||chart.notes[chart.notes.length-1];
  const target=sec.beat+3,hit=lastHit&&beat-lastHit.beat<.85&&lastHit.kind==='down',age=hit?beat-lastHit.beat:0;
  const approach=Math.max(0,Math.min(1,(p+.1)/2.6));const slide=(1-approach)*size*1.2;
  ctx.save();ctx.translate(x+slide,y+Math.sin(p*Math.PI)*2);ctx.rotate(hit&&lastHit.grade==='miss'?-.08:Math.sin(p)*.018);
  const w=size,h=size*.69;ctx.shadowColor='#53463b24';ctx.shadowBlur=15;ctx.shadowOffsetY=8;
  rounded(-w/2,-h/2,w,h,8,'#fffcef','#b8a183',2);ctx.shadowColor='transparent';
  ctx.strokeStyle='#d9c7a8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-w/2+7,-h/2+7);ctx.lineTo(0,h*.12);ctx.lineTo(w/2-7,-h/2+7);ctx.stroke();
  rounded(w*.27,-h*.36,w*.15,w*.16,3,'#c0d5d0');text('✦',w*.345,-h*.245,w*.11,'#6b8e88');
  if(hit){ctx.save();ctx.translate(w*.12,h*.11);ctx.rotate(-.22);ctx.globalAlpha=Math.min(1,age*8+.3);circle(0,0,w*.18,null,lastHit.grade==='miss'?'#ab9693':'#d76553');circle(0,0,w*.145,null,lastHit.grade==='miss'?'#ab9693':'#d76553');text(lastHit.grade==='miss'?'…':'OK',0,0,w*.11,'#d76553');ctx.restore();}
  ctx.restore();
  if(p>1.75&&p<3.6){const drop=hit?Math.max(0,1-age*6):0;const sy=y-size*.55+drop*size*.37;ctx.save();ctx.translate(x+size*.11,sy);rounded(-size*.11,-size*.22,size*.22,size*.23,12,'#a94d3b','#803b30');rounded(-size*.19,-size*.015,size*.38,size*.1,5,'#d6795f','#a04e3b');ctx.restore();}
  if(prefs.help){text(sec.double?'2通のお手紙':'1通のお手紙',x,H*.29,mobile?12:15,'#987550');const labels=['コン','カン','…',sec.double?'ポン ポン':'ポン'];drawSteps(labels,Math.floor(p),x,H*.78,size*1.06);}
 }else if(id==='soda'){
  const held=sec.demo?p>=2&&p<2+sec.hold:session.holds.has(sec.index)&&pressed;
  let fill=held?Math.max(0,Math.min(1.15,(p-2)/sec.hold)):0;
  const released=lastHit?.kind==='up'&&lastHit.beat>=sec.beat&&beat-lastHit.beat<2;
  if(released)fill=lastHit.grade==='miss'?.25:1;
  const w=size*.55,h=size*.97,left=x-w/2,top=y-h*.5;
  ctx.shadowColor='#48695920';ctx.shadowBlur=18;rounded(left-6,top-6,w+12,h+12,20,'#ffffff90');ctx.shadowColor='transparent';
  ctx.save();ctx.beginPath();ctx.roundRect(left,top,w,h,15);ctx.clip();ctx.fillStyle='#eefbf580';ctx.fillRect(left,top,w,h);const fh=h*.82*Math.min(1,fill);ctx.fillStyle=sec.hold===3?'#f3bd70':'#79c7bc';ctx.fillRect(left,top+h-fh,w,fh);
  if(fh>4){for(let i=0;i<11;i++){const bx=left+9+((i*37)%Math.max(1,w-18));const by=top+h-((beat*27+i*23)%fh);circle(bx,by,2+i%3,'#ffffff88');}ctx.fillStyle='#fff9e9';ctx.fillRect(left,top+h-fh-3,w,7);}
  ctx.restore();rounded(left,top,w,h,15,null,'#609e96',3);ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(left-8,top+h*.18);ctx.lineTo(left+w+8,top+h*.18);ctx.strokeStyle='#b98f47';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);
  if(held){ctx.fillStyle='#9ad7cabb';ctx.fillRect(x-5,top-35,10,45);for(let i=0;i<4;i++)circle(x+Math.sin(i+beat*8)*7,top-28+i*10,2,'#fff9d6');}
  text(released&&lastHit.grade!=='miss'?'✦':held?'…':'♪',x,y+2,mobile?28:36,held?'#fffaf0':'#74aaa0');
  if(prefs.help){rounded(x-size*.42,H*.19,size*.84,38,19,'#fff9ebe8');text(sec.hold+' 拍のソーダ',x,H*.19+19,mobile?12:15,'#6a948b');for(let i=0;i<sec.hold;i++)circle(x+(i-(sec.hold-1)/2)*23,H*.81,6,p>=2+i&&p<2+sec.hold?'#45998d':'#fff9e9','#8eb4a0');}
 }else if(id==='fireworks'){
  const held=sec.demo?p>=2&&p<2+sec.hold:session.holds.has(sec.index)&&pressed;
  const fired=lastHit?.kind==='up'&&lastHit.grade!=='miss'&&lastHit.beat>=sec.beat,age=fired?beat-lastHit.beat:99;
  if(age<2.8){const radius=(sec.grand?W*.5:W*.31)*Math.min(1,age*1.7+.08);for(let k=0;k<32;k++){const a=k*Math.PI/16,r=radius*(.65+(k%3)*.15);ctx.globalAlpha=Math.max(0,1-age/3);circle(x+Math.cos(a)*r,y-H*.18+Math.sin(a)*r+age*age*5,2+(k%3),['#ffeaa5','#ffb1a5','#cbd1ff'][k%3]);}ctx.globalAlpha=1;text(sec.grand?'大輪、満開！':'ドーン！',x,H*.23,sec.grand?25:20,'#ffeab3');}
  else{rounded(x-size*.14,y-size*.17,size*.28,size*.48,6,'#df806d','#ffe3aa');ctx.beginPath();ctx.moveTo(x-size*.17,y-size*.17);ctx.lineTo(x,y-size*.42);ctx.lineTo(x+size*.17,y-size*.17);ctx.closePath();ctx.fillStyle='#efcc87';ctx.fill();text('✦',x,y,size*.17,'#fff4dc');if(held){const burn=Math.min(1,(p-2)/sec.hold);text('✷',x+Math.sin(beat*19)*5,y+size*.42,20+burn*15,'#ffe494');}}
  if(prefs.help)text(sec.hold+'拍ためて、離す',x,H*.78,13,'#ffe9bc');
 }else if(id==='ghost'){
  const shot=lastHit&&lastHit.beat>=sec.beat&&lastHit.grade!=='miss',bad=lastHit&&lastHit.beat>=sec.beat&&lastHit.grade==='miss';
  const bob=shot?0:Math.sin(beat*2)*9,w=size*.8,h=size*.98;
  if(shot){ctx.save();ctx.translate(x,y);ctx.rotate(-.08);rounded(-w*.63,-h*.64,w*1.26,h*1.35,4,'#fff9ee','#d1c1d2');text('NIGHT PHOTO',0,h*.52,8,'#9d89a9');ctx.restore();}
  ctx.save();ctx.translate(x+(bad?Math.sin(beat*30)*8:0),y+bob);ctx.beginPath();ctx.arc(0,-h*.15,w*.45,Math.PI,0);ctx.lineTo(w*.45,h*.32);for(let i=4;i>=-4;i--)ctx.lineTo(i*w*.1125,h*(i%2?.2:.32));ctx.closePath();ctx.fillStyle=shot?'#f9fcff':'#e9f5ffd9';ctx.fill();
  for(const side of [-1,1]){circle(side*w*.16,-h*.12,shot?3:4,'#706789');circle(side*w*.28,h*.04,5,'#e7b4c5');}text(bad?'O':shot?'⌣':'·',0,h*.02,22,'#807299');ctx.restore();
  if(shot&&beat-lastHit.beat<.3){ctx.fillStyle='#ffffffa0';ctx.fillRect(0,0,W,H);}if(sec.grand&&shot)for(let i=0;i<5;i++)text('♡',x+(i-2)*25,H*.25+Math.sin(i)*10,18,'#aa8bb5');
  if(prefs.help)text(p<sec.photoAt?'チーズの1拍後！':shot?'いい顔、いただき！':'シャッターチャンス',x,H*.8,12,'#8b789d');
 }else if(id==='bakery'){
  const held=sec.demo?p>=7&&p<7+sec.hold:session.holds.has(sec.index)&&pressed;
  const baked=lastHit?.kind==='up'&&lastHit.grade!=='miss'&&lastHit.beat>=sec.beat,stretch=held?Math.min(1,(p-7)/sec.hold):0;
  rounded(x-size*.67,y-size*.37,size*1.34,size*.82,16,'#d3a476','#b58b61');
  const pulse=lastHit&&beat-lastHit.beat<.35?Math.sin((beat-lastHit.beat)*Math.PI/.35)*.12:0;
  ctx.beginPath();ctx.ellipse(x,y,size*(.39+stretch*.18+pulse),size*(.25-stretch*.09-pulse*.3),0,0,Math.PI*2);ctx.fillStyle=baked?'#d99a48':'#ffe5b0';ctx.fill();text(baked?'✦':'·  ·',x,y,sec.grand?35:26,baked?'#fff0bd':'#b38b5d');
  if(held){rounded(x-size*.67,y-8,20,16,7,'#cf9c7f');rounded(x+size*.51,y-8,20,16,7,'#cf9c7f');}
  if(p<4&&prefs.help){text('♪ お手本',x,H*.26,15,'#ac8753');for(let i=0;i<sec.pattern.length;i++)circle(x+(i-(sec.pattern.length-1)/2)*25,H*.33,6,p>=sec.pattern[i]&&p<sec.pattern[i]+.3?'#e3b665':'#eee0c4');}
  if(baked){for(let i=0;i<3;i++)text('〜',x+(i-1)*23,y-size*.35-((beat*16+i*9)%24),17,'#fff6da');}if(prefs.help)text(p<7?'聴いたリズムで、こねこね':sec.hold+'拍のばして、離す',x,H*.8,12,'#a08156');
 }else{
  const pattern=sec.pattern,answer=p>=4;
  const w=size*1.05,h=Math.min(170,H*.37);rounded(x-w/2,y-h/2,w,h,23,'#fff9edc9','#c8badd',2);
  text(answer?'あなたの番':'♪ お手本',x,y-h*.29,mobile?14:19,'#857aa8');
  const count=pattern.length;for(let i=0;i<count;i++){
   const target=sec.beat+(answer?4:0)+pattern[i],diff=beat-target;
   const n=chart.notes.find(n=>n.section===sec.index&&n.beat===sec.beat+4+pattern[i]);
   const r=n?session.results.get(n.id):null;
   const px=x+(i-(count-1)/2)*(w*.2),lit=!answer?diff>=0&&diff<.28:r&&r.grade!=='miss';
   circle(px,y+7,Math.min(16,w*.073)+(lit?2:0),lit?'#efd079':r?.grade==='miss'?'#d5c9d8':'#ded4e9');
   if(lit)text('✦',px,y+7,18,'#fff9e9');else if(r?.grade==='miss')text('·',px,y+7,20,'#a19aaf');
  }
  if(prefs.help){const phase=p%4;for(let i=0;i<4;i++){const px=x+(i-1.5)*w*.2;circle(px,y+h*.31,4,Math.floor(phase)===i?'#8c7daf':'#cec5d6');}text(answer?'同じ間隔で、タップ！':'次の4拍で、まねっこ',x,H*.8,mobile?11:14,'#887b9f');}
 }
 if(sec.demo){rounded(W*.5-43,12,86,25,13,'#fff9ebee');text('お手本',W*.5,25,11,'#7a8e89');}
 if(selected==='remix'&&prefs.help){const next=chart.sections[sec.index+1],warn=next&&sec.end-beat<=1;rounded(W*.5-110,12,220,27,13,'#fff9ebed');text(warn?'つぎ → '+GAMES[next.mode].name:'MIX  '+(sec.index+1)+' / '+chart.sections.length+'  ·  '+GAMES[id].name,W*.5,26,11,warn?'#b18132':GAMES[id].color);}
 drawRewards(beat,sec,id,W,H,x,y,size);
 effects=effects.filter(e=>rafNow-e.birth<700);for(const e of effects){const age=(rafNow-e.birth)/700;ctx.globalAlpha=1-age;const px=x+Math.cos(e.angle)*e.speed*age*2,py=y+Math.sin(e.angle)*e.speed*age*2-age*35;text('✦',px,py,8+6*(1-age),e.color);}ctx.globalAlpha=1;
}
function drawRewards(beat,sec,id,W,H,x,y,size){
 const recent=lastHit&&beat-lastHit.beat<1.5&&lastHit.beat>=sec.beat,good=recent&&lastHit.grade!=='miss',bad=recent&&!good;
 if(session.combo>=5){for(let i=0;i<4;i++)text('♪',W*.13+i*18,H*(.59+(i%2)*.04)-Math.sin(beat*5+i)*12,16,['#d86e52','#348d85','#b8954d','#7c75ab'][i]);}
 if(session.combo>=5&&good)drawDancer(id,W*.2,H*.81,Math.min(25,W*.063),beat);
 if(id==='soda'&&session.combo>=5){ctx.save();ctx.globalAlpha=.42;for(let i=0;i<6;i++){ctx.fillStyle=['#f6c779','#e89d9d','#c49edb','#91c4dc','#8dc8ae','#ebdb94'][i];ctx.fillRect(x-size*.2,y+size*.3-i*size*.1,size*.4,size*.09);}ctx.restore();}
 if(id==='moon'){const stars=Math.min(12,Math.floor(session.stats().perfect/3));for(let i=0;i<stars;i++)text('✦',W*(.1+((i*23)%80)/100),H*(.06+((i*7)%19)/100),8+i%3*3,'#e6c971');}
 if(bad){const quips={mail:'あっ、鼻に判子！',soda:'泡のひげ、できちゃった',moon:'ほこりが、ふわっ',fireworks:'ぷす… 次こそ！',ghost:'目をつぶっちゃった',bakery:'もちもち、のびすぎ！'};rounded(10,H*.68,Math.min(160,W*.46),29,15,'#fff9edf0');text(quips[id],10+Math.min(160,W*.46)/2,H*.68+15,10,'#9a7f78');if(id==='mail'){circle(W*.19,H*.48,10,null,'#d7655399');text('〒',W*.19,H*.48,12,'#d76553');}}
 if(sec.grand){if(id==='mail'){rounded(x-size*.59,y-size*.38,size*1.18,size*.76,6,'#d8ac74','#9c7952');rounded(x-7,y-size*.38,14,size*.76,0,'#f5dfb6');text(good?'配送完了！':'最後の大きな荷物',x,y,13,'#896540');}if(good){for(let i=0;i<18;i++)text('✦',((i*47+beat*13)%W),H*.1+((i*29+beat*25)%(H*.67)),10+i%3*3,['#e4b962','#dca197','#a7cbbb'][i%3]);}}
 if(sec.quiet){rounded(W*.5-92,48,184,27,14,'#344656dd');text('伴奏が消えても、拍は続く…',W*.5,62,11,'#fff4d4');}
 else if(chart.quiet&&beat>=chart.quiet.to&&beat<chart.quiet.to+4){text('全楽器、カムバック！',W*.5,H*.13,18,'#b18a36');}
}
function drawSteps(labels,current,x,y,w){const width=w/4;for(let i=0;i<4;i++){rounded(x-w/2+i*width+2,y-15,width-4,30,10,i===current?GAMES[selected].color:'#fff8e8d9');text(labels[i],x-w/2+(i+.5)*width,y,Math.min(13,width/4),i===current?'#fff8eb':'#a39278');}}
function drawDancer(id,x,y,r,beat){
 // 背景とは独立した相棒を跳ねさせ、入力位置を隠さず手足と表情を読ませる。
 ctx.save();ctx.translate(x,y-Math.abs(Math.sin(beat*Math.PI))*r*.35);ctx.rotate(Math.sin(beat*Math.PI)*.12);
 circle(0,0,r*1.6,'#fff8e8ee');const fur=id==='soda'?'#fffdf4':id==='fireworks'?'#bd7850':id==='ghost'?'#dcedf3':'#f4d9a1',accent=GAMES[id].color;
 if(id==='moon'){rounded(-r*.65,-r*1.65,r*.42,r*1.1,r*.2,fur);rounded(r*.2,-r*1.7,r*.42,r*1.15,r*.2,fur);}else{circle(-r*.7,-r*.7,r*.38,fur);circle(r*.7,-r*.7,r*.38,fur);}
 rounded(-r*.48,r*.35,r*.96,r*.85,r*.3,accent);circle(0,-r*.16,r*.88,fur);
 for(const side of [-1,1]){circle(side*r*.31,-r*.25,r*.065,'#5e504b');circle(side*r*.57,r*.02,r*.13,'#e8a993');circle(side*r*.75,r*(.75+Math.sin(beat*Math.PI+side)*.3),r*.21,fur);circle(side*r*.33,r*1.17,r*.18,fur);}
 text('⌣',0,r*.1,r*.65,'#725b4f');if(id==='mail')rounded(-r*.7,-r*.94,r*1.4,r*.23,r*.1,accent);ctx.restore();
}
async function soundTest(){try{await audio.unlock();if(calibration)return;const t=audio.ctx.currentTime+.12;for(let i=0;i<4;i++){audio.chime(76,t+i*.5,.11);if(i%2===0)audio.keys(60+i*2,t+i*.5,.4,.065);}}catch(e){toast(e.message);}}
async function startCalibration(){
 stopCalibration();try{await audio.unlock();}catch(e){toast(e.message);return;}
 audio.stop();const start=audio.ctx.currentTime+.25;calibration={start,errors:[],accepted:new Set(),timer:0};$('calibration').hidden=false;$('calibrationText').textContent='まず4拍聴いて、そのあと音に合わせて16回タップ。';
 for(let i=0;i<24;i++)audio.chime(i<4?72:79,start+i*.5,.11);
 calibration.timer=setTimeout(()=>{if(calibration){$('calibrationText').textContent='途中で終わりました。もう一度、タップで調整をお試しください。';stopCalibration(false);}},12500);
}
function calibrationTap(e){if(!calibration)return;e.preventDefault();const t=audio.outputTime(inputTime(e));const i=Math.round((t-calibration.start)/.5);if(i<4||i>23||calibration.accepted.has(i))return;const delta=(t-(calibration.start+i*.5))*1000;if(Math.abs(delta)>240)return;calibration.accepted.add(i);calibration.errors.push(delta);$('calibrationText').textContent=calibration.errors.length+' / 16 回。音に合わせて、そのまま。';if(calibration.errors.length>=16){const values=calibration.errors.slice().sort((a,b)=>a-b),median=(values[7]+values[8])/2,spread=values[13]-values[2];if(spread>100){stopCalibration(false);$('calibrationText').textContent='少しばらつきがありました。設定はそのまま。音を聴いて再挑戦してみよう。';return;}prefs.offset=Math.max(-250,Math.min(250,Math.round(median/5)*5));stopCalibration();applyPrefs();save();toast('タイミングを '+(prefs.offset>0?'+':'')+prefs.offset+' ms に調整しました。');}}
function stopCalibration(hide=true){if(calibration){clearTimeout(calibration.timer);calibration=null;audio.stop();}if(hide)$('calibration').hidden=true;}
$('tapPad').addEventListener('pointerdown',e=>{if(e.button!==0||pointerId!==null)return;e.preventDefault();pointerId=e.pointerId;try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}input('down',e);});
function endPointer(e){if(pointerId!==e.pointerId)return;e.preventDefault();pointerId=null;input('up',e);}
$('tapPad').addEventListener('pointerup',endPointer);$('tapPad').addEventListener('pointercancel',e=>{if(pointerId===e.pointerId){pointerId=null;pause();}});
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!document.querySelector('dialog[open]')&&state==='running'){e.preventDefault();input('down',e);}if(e.code==='Escape'&&state==='running'){e.preventDefault();pause();}});
window.addEventListener('keyup',e=>{if(e.code==='Space'&&state==='running'){e.preventDefault();input('up',e);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();stopCalibration();}});window.addEventListener('blur',()=>{pause();stopCalibration();});
$('shiftButton').addEventListener('click',()=>{shift=!shift;select(selected,true);});
$('practiceButton').addEventListener('click',()=>begin(true));$('startButton').addEventListener('click',()=>begin(false));$('retryButton').addEventListener('click',()=>begin(false));$('nextButton').addEventListener('click',()=>select(ORDER[GAMES[selected].index%ORDER.length]));
for(const id of ['homeButton','backButton','resultMenu','pauseMenu'])$(id).addEventListener('click',menu);
$('pauseButton').addEventListener('click',()=>pause());$('resumeButton').addEventListener('click',resume);$('restartButton').addEventListener('click',()=>{$('pauseDialog').close();begin(practice);});
$('pauseDialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
$('settingsButton').addEventListener('click',()=>{settingsPaused=state==='running';if(settingsPaused)pause(false);$('settingsDialog').showModal();});
$('settingsDialog').addEventListener('close',()=>{stopCalibration();save();if(settingsPaused&&state==='paused')$('pauseDialog').showModal();settingsPaused=false;});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
$('volume').addEventListener('input',e=>{prefs.volume=+e.target.value;applyPrefs();save();});$('offset').addEventListener('input',e=>{prefs.offset=+e.target.value;applyPrefs();save();});$('visualHelp').addEventListener('change',e=>{prefs.help=e.target.checked;applyPrefs();save();});
$('soundTest').addEventListener('click',soundTest);$('calibrateButton').addEventListener('click',startCalibration);$('calibrationPad').addEventListener('pointerdown',calibrationTap);$('cancelCalibration').addEventListener('click',()=>stopCalibration());
window.addEventListener('resize',()=>{if(state!=='running')drawStatic();});applyPrefs();updateBests();
// 開発用の再現入口を通常プレイへ公開しない。自動入力は記録保存の対象外にする。
if(new URLSearchParams(location.search).has('debug'))window.__nightRhythmDebug={getState:()=>({state,selected,practice,beat:audio.ctx&&audio.active?audio.beat():null,stats:session?.stats(),notes:chart?.notes,rewindBeat,pressed,audioState:audio.ctx?.state}),select,begin,pause,resume,finish:()=>{if(session){session.advance(chart.duration+1);complete();}},perfect:()=>{if(!session)return;practice=true;for(const n of chart.notes)if(!session.results.has(n.id))session.input(n.kind,n.beat);},input:(kind,beat)=>session?.input(kind,beat)};
const mc=document.modelContext;
if(mc?.registerTool){const lifecycle=new AbortController();for(const tool of [
 {name:'view_rhythm_game',title:'おしごとを選ぶ',description:'指定したリズムゲームの説明画面を開きます。演奏は開始しません。',inputSchema:{type:'object',properties:{game:{type:'string',enum:Object.keys(GAMES)}},required:['game'],additionalProperties:false},execute:input=>{if(!input||!GAMES[input.game]||Object.keys(input).some(k=>k!=='game'))throw Error('Unknown game');select(input.game);return {game:selected,screen:state};}},
 {name:'read_rhythm_progress',title:'リズム便の状態を読む',description:'現在のおしごとと画面、端末のベスト記録を読みます。',annotations:{readOnlyHint:true},inputSchema:{type:'object',properties:{},additionalProperties:false},execute:()=>({game:selected,screen:state,bests:{...bests}})}
 ]){try{Promise.resolve(mc.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
})();
