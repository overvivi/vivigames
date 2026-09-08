(function(root){
'use strict';
const GAMES={
 mail:{id:'mail',name:'夜ふかし郵便局',index:1,bpm:112,phrase:4,color:'#d86e52',light:'#fce2bf',mode:'タップ',intro:'コン、カン、…ポン！',description:'「コン・カン」を聴いたら、ひと呼吸。<br>4拍目でタップして、判子をぽん！<br>短い音がもう1つ鳴ったら、2回押し。',action:'音を聴いて、ぽん！',hint:'コン → カン → ひと呼吸 → タップ',pad:'判子を押す',guide:['コン','カン','…','ポン!'],guideSmall:['聴く','聴く','待つ','タップ']},
 soda:{id:'soda',name:'雲のソーダ屋',index:2,bpm:108,phrase:8,color:'#348d85',light:'#cde9dc',mode:'長押し → 離す',intro:'しゅわ〜…ぱっ！',description:'「ピン・ポン」の次の拍で長押し。<br>2拍数えたら、指をぱっと離そう。<br>「3拍」の注文は、もう1拍待ってね。',action:'押したまま、拍を数えよう',hint:'ピン → ポン → 押す → 2拍後に離す',pad:'長押し → 離す',guide:['ピン','ポン','押す','離す'],guideSmall:['聴く','聴く','長押し','2拍後']},
 moon:{id:'moon',name:'月面おそうじ隊',index:3,bpm:116,phrase:8,color:'#7c75ab',light:'#e3dbf3',mode:'リズムをまねっこ',intro:'きいて、こたえて。',description:'最初の4拍は、お手本の時間。<br>次の4拍で、同じリズムをタップ。<br>音の間隔まで、まねしてみよう。',action:'お手本と同じリズムでタップ',hint:'4拍聴く → 次の4拍でまねっこ',pad:'おそうじする',guide:['タン','タン','タン','…'],guideSmall:['お手本','お手本','お手本','次は自分']}
};
const WINDOW=.135,PERFECT=.052;
GAMES.remix={id:'remix',name:'真夜中のリミックス',index:4,bpm:136,phrase:4,color:'#b18132',light:'#f1dfad',mode:'FINAL MIX · むずかしい',intro:'今夜のおしごと、全部！',description:'郵便・ソーダ・月面が次々に交代！<br>速いテンポと裏拍に、ついてこられる？<br>後半のソーダは1拍で離す注文も登場。',action:'合図を聴き分けて、切り替えよう',hint:'タップ / 長押し → 離す / まねっこ',pad:'リミックスに挑戦',guide:['郵便','ソーダ','月面','MIX!'],guideSmall:['タップ','長押し','まねっこ','136 BPM']};
function sectionAt(chart,beat){return chart.sections.find(s=>beat>=s.beat&&beat<s.end)||(beat<0?chart.sections[0]:chart.sections.at(-1));}
function makeRemix(practice){
 const game=GAMES.remix,notes=[],cues=[],demos=[],sections=[];
 const order=practice?['mail','mail','soda','soda','moon','soda','soda','moon']:['mail','soda','moon','mail','moon','soda','mail','soda','moon','soda','mail','moon','mail','soda','mail','moon','soda','mail','soda','moon','mail','soda','moon','mail'];
 let beat=0;const patterns=[[0,.5,1.5,2.5],[0,1,1.5,3],[0,.5,2,3],[0,.5,1.5,2,3]];
 for(const [i,mode]of order.entries()){
  const short=mode==='soda'&&(practice?i>=5:i>=12),length=mode==='mail'||short?4:8;
  const demo=practice&&[0,2,5].includes(i),s={index:i,beat,end:beat+length,mode,demo};sections.push(s);
  const cue=(offset,type,extra={})=>cues.push({beat:beat+offset,type,section:i,...extra});
  const note=(offset,kind,holdId=null)=>{const n={beat:beat+offset,kind,section:i,holdId};if(demo)demos.push({...n,mode});else notes.push({...n,id:notes.length});};
  // 直前の拍で交代先を知らせ、テンポが速くても初見で構えられるようにする。
  cue(-1,'switch',{mode});
  if(mode==='mail'){
   s.double=true;cue(0,'wood1');cue(1,'wood2');cue(1.5,'wood3');note(3,'down');note(3.5,'down');
  }else if(mode==='soda'){
   s.hold=short?1:i%2?3:2;cue(0,'soda1',{hold:s.hold});cue(1,'soda2');cue(2,'pourCue');cue(2+s.hold,'releaseCue');note(2,'down',i);note(2+s.hold,'up',i);
  }else{
   s.pattern=patterns[i%patterns.length];cue(3.5,'yourTurn');s.pattern.forEach((p,k)=>{cue(p,'echo',{pitch:k});note(4+p,'down');});
  }
  beat+=length;
 }
 return {game,notes,cues:cues.sort((a,b)=>a.beat-b.beat),demos,sections,duration:beat,practice};
}
function makeBaseChart(id,practice=false){
 if(id==='remix')return makeRemix(practice);
 const game=GAMES[id];if(!game)throw Error('Unknown game');
 const notes=[],cues=[],demos=[],sections=[];let sequence=0;
 const add=(beat,kind,section,holdId=null)=>notes.push({id:sequence++,beat,kind,section,holdId});
 const cue=(beat,type,section,data={})=>cues.push({beat,type,section,...data});
 const count=practice?(id==='moon'?3:6):(id==='mail'?28:14);
 const patterns=[[0,1,2],[0,1,2],[0,.5,2],[0,1.5,2],[0,.5,1,2],[0,1,2.5],[0,.5,2],[0,1,2]];
 for(let p=0;p<count;p++){
  const b=p*game.phrase,demo=practice&&id!=='moon'&&p%2===0;
  const level=practice?Math.floor(p/2):p;
  const section={index:p,beat:b,end:b+game.phrase,demo};sections.push(section);
  if(id==='mail'){
   const double=practice?level===2:level>=6&&[2,3,6].includes(level%8);section.double=double;
   cue(b,'wood1',p);cue(b+1,'wood2',p);if(double)cue(b+1.5,'wood3',p);
   for(const target of double?[b+3,b+3.5]:[b+3]){if(demo)demos.push({beat:target,kind:'down',section:p});else add(target,'down',p);}
  }else if(id==='soda'){
   const hold=practice?(level===2?3:2):(level>=4&&level%3===1?3:2);section.hold=hold;
   cue(b,'soda1',p,{hold});cue(b+1,'soda2',p);cue(b+2,'pourCue',p);cue(b+2+hold,'releaseCue',p);
   if(demo){demos.push({beat:b+2,kind:'down',section:p},{beat:b+2+hold,kind:'up',section:p});}
   else{add(b+2,'down',p,p);add(b+2+hold,'up',p,p);}
  }else{
   const pattern=practice?patterns[[0,2,3][p]]:patterns[p%patterns.length];section.pattern=pattern;
   cue(b-.25,'listen',p);cue(b+3.5,'yourTurn',p);
   for(let i=0;i<pattern.length;i++){cue(b+pattern[i],'echo',p,{pitch:i});add(b+4+pattern[i],'down',p);}
  }
 }
 const duration=count*game.phrase;
 return {game,notes,cues:cues.sort((a,b)=>a.beat-b.beat),demos,sections,duration,practice};
}
const SHIFTS={mail:{name:'朝の速達便',bpm:128},soda:{name:'閉店前ラッシュ',bpm:124},moon:{name:'流星群のおそうじ',bpm:130}};
const ORDER=['mail','soda','moon','remix','fireworks','ghost','bakery'];
GAMES.fireworks={id:'fireworks',name:'星降る花火工房',index:5,bpm:112,phrase:8,color:'#bd6d67',light:'#f2d4c6',mode:'長押し → 打ち上げ',intro:'ためて、夜空にドン！',description:'2つの合図の次の拍で長押し。<br>注文の2・3・4拍を数えたら離そう。<br>最後は大きな花火を打ち上げるよ。',action:'火をつけて、合図で打ち上げ！',hint:'コン → キン → 長押し → 数えて離す',pad:'長押し → 打ち上げ',guide:['コン','キン','点火','ドン！'],guideSmall:['聴く','聴く','長押し','離す']};
GAMES.ghost={id:'ghost',name:'おばけ写真館',index:6,bpm:110,phrase:8,color:'#8874ac',light:'#e6dbf3',mode:'掛け声でタップ',intro:'はい、チーズ、パシャ！',description:'低い「はい」、高い「チーズ」。<br>チーズの1拍後にタップで撮影。<br>掛け声の間が変わるから、よく聴こう。',action:'チーズの1拍後に、パシャ！',hint:'はい → チーズ → 1拍後にタップ',pad:'シャッターを切る',guide:['はい','…','チーズ','パシャ'],guideSmall:['聴く','間が変わる','聴く','1拍後']};
GAMES.bakery={id:'bakery',name:'星のパン屋',index:7,bpm:118,phrase:12,color:'#b98746',light:'#f4e1bd',mode:'まねっこ＋長押し',intro:'こねて、のばして。',description:'4拍聴いて、同じリズムでこねよう。<br>「のばす」の合図で長押し。<br>2拍または3拍後に離して、焼き上がり！',action:'まねっこの後は、生地をのばそう',hint:'4拍聴く → まねっこ → 長押し → 離す',pad:'こねる / のばす',guide:['聴く','こねる','のばす','離す'],guideSmall:['4拍','まねっこ','合図で','2・3拍後']};
function makeNewChart(id,practice){
 const game=GAMES[id],notes=[],cues=[],demos=[],sections=[];
 const count=practice?(id==='bakery'?3:6):(id==='bakery'?10:14);
 for(let i=0;i<count;i++){
  const beat=i*game.phrase,demo=practice&&id!=='bakery'&&i%2===0,level=practice?Math.floor(i/2):i;
  const s={index:i,beat,end:beat+game.phrase,demo};sections.push(s);
  const cue=(p,type,extra={})=>cues.push({beat:beat+p,type,section:i,...extra});
  const note=(p,kind,holdId=null)=>{const n={beat:beat+p,kind,holdId,section:i};if(demo)demos.push({...n,mode:id});else notes.push({...n,id:notes.length});};
  if(id==='fireworks'){
   s.hold=[2,3,4][level%3];s.holdStart=2;cue(0,'fireOrder',{hold:s.hold});cue(1,'fireReady');cue(2,'ignite');cue(2+s.hold,'launch');note(2,'down',i);note(2+s.hold,'up',i);
  }else if(id==='ghost'){
   s.photoAt=2+[0,1,.5,1.5][level%4];cue(0,'sayHai');cue(s.photoAt-1,'sayCheese');note(s.photoAt,'down');
  }else{
   s.pattern=[[0,1,2],[0,.5,2],[0,1.5,2.5]][level%3];s.hold=level%2?3:2;s.holdStart=7;
   s.pattern.forEach((p,k)=>{cue(p,'kneadCue',{pitch:k});note(4+p,'down');});cue(3.5,'yourTurn');cue(6.5,'stretchReady',{hold:s.hold});cue(7,'stretch');cue(7+s.hold,'baked');note(7,'down',i);note(7+s.hold,'up',i);
  }
 }
 return {game,notes,cues:cues.sort((a,b)=>a.beat-b.beat),demos,sections,duration:count*game.phrase,practice};
}
function makeChart(id,practice=false,shift=false){
 let c=['fireworks','ghost','bakery'].includes(id)?makeNewChart(id,practice):makeBaseChart(id,practice);
 if(shift&&SHIFTS[id]){
  c.game={...c.game,...SHIFTS[id]};c.shift=true;
  // 別シフトは速度だけでなく注文・お手本を組み替え、独立した譜面にする。
  if(id==='moon'){for(const s of c.sections){s.pattern=[0,.5,1.5,2.5];c.notes=c.notes.filter(n=>n.section!==s.index);c.cues=c.cues.filter(n=>n.section!==s.index||n.type!=='echo');s.pattern.forEach((p,k)=>{c.notes.push({beat:s.beat+4+p,kind:'down',section:s.index,holdId:null});c.cues.push({beat:s.beat+p,type:'echo',pitch:k,section:s.index});});}}
  if(id==='mail'){for(const s of c.sections){if(!s.double){s.double=true;c.cues.push({beat:s.beat+1.5,type:'wood3',section:s.index});const n={beat:s.beat+3.5,kind:'down',section:s.index,holdId:null};(s.demo?c.demos:c.notes).push(n);}}}
  if(id==='soda'){for(const s of c.sections){const hold=[1,3,2,1][s.index%4];s.hold=hold;for(const n of [...c.notes,...c.demos])if(n.section===s.index&&n.kind==='up')n.beat=s.beat+2+hold;for(const q of c.cues)if(q.section===s.index){if(q.type==='soda1')q.hold=hold;if(q.type==='releaseCue')q.beat=s.beat+2+hold;}}}
 }
 if(!practice){for(const s of c.sections)s.finale=s.index>=c.sections.length-2;c.sections.at(-1).grand=true;
  if(id==='mail'){for(const s of c.sections.slice(-6)){if(s.grand){s.double=false;c.notes=c.notes.filter(n=>n.section!==s.index||n.beat===s.beat+3);c.cues=c.cues.filter(q=>q.section!==s.index||q.type!=='wood3');}else if(!s.double){s.double=true;c.notes.push({beat:s.beat+3.5,kind:'down',holdId:null,section:s.index});c.cues.push({beat:s.beat+1.5,type:'wood3',section:s.index});}}}
 }
 // 無音区間では合図だけを残す。拍の連続性を保ったまま最後のサビで全楽器を戻す。
 if(id==='remix'&&!practice){const from=c.sections[15].beat,to=c.sections[18].beat;c.quiet={from,to};for(const s of c.sections)if(s.beat>=from&&s.beat<to)s.quiet=true;}
 c.notes.sort((a,b)=>a.beat-b.beat);c.notes.forEach((n,i)=>n.id=i);c.cues.sort((a,b)=>a.beat-b.beat);c.demos.sort((a,b)=>a.beat-b.beat);
 return c;
}
const RECORD_KEYS=ORDER.flatMap(id=>SHIFTS[id]?[id,id+'-shift']:[id]);
function stampAwards(stats){return [stats.score>=65,stats.score>=85,stats.miss===0&&stats.extras===0&&stats.perfect+stats.good===stats.total];}
class Session{
 constructor(chart){this.chart=chart;this.results=new Map();this.extras=[];this.holds=new Set();this.combo=0;this.maxCombo=0;}
 result(note,error,miss=false,reason=''){
  if(this.results.has(note.id))return null;
  const grade=miss?'miss':Math.abs(error)<=PERFECT?'perfect':'good';
  const r={id:note.id,beat:note.beat,kind:note.kind,section:note.section,holdId:note.holdId,grade,error,reason};
  this.results.set(note.id,r);if(grade==='miss')this.combo=0;else this.maxCombo=Math.max(this.maxCombo,++this.combo);
  return r;
 }
 input(kind,beat){
  const spb=60/this.chart.game.bpm;
  if(kind==='down'&&this.holds.size)return null;
  const candidates=this.chart.notes.filter(n=>n.kind===kind&&!this.results.has(n.id)&&Math.abs(n.beat-beat)*spb<=WINDOW&&(kind!=='up'||this.holds.has(n.holdId)));
  candidates.sort((a,b)=>Math.abs(a.beat-beat)-Math.abs(b.beat-beat)||a.beat-b.beat);
  if(candidates.length){const n=candidates[0];if(n.holdId!==null){if(kind==='down')this.holds.add(n.holdId);else this.holds.delete(n.holdId);}return this.result(n,(beat-n.beat)*spb);}
  if(kind==='up'){
   const n=this.chart.notes.find(n=>n.kind==='up'&&!this.results.has(n.id)&&this.holds.has(n.holdId));
   if(n){this.holds.delete(n.holdId);return this.result(n,(beat-n.beat)*spb,true,'early-release');}return null;
  }
  const sec=this.chart.sections.find(s=>beat>=s.beat&&beat<s.end);
  // お手本やカウントインでは触って試せるよう、空振りを成績に入れない。
  if(!sec||sec.demo||beat<0||beat>=this.chart.duration)return null;
  const last=this.extras.at(-1);if(last&&beat-last.beat<.18)return null;
  this.extras.push({beat,section:sec.index});this.combo=0;return {grade:'extra',beat,kind,reason:'empty'};
 }
 advance(beat){
  const out=[],spb=60/this.chart.game.bpm;
  for(const n of this.chart.notes){if(!this.results.has(n.id)&&(beat-n.beat)*spb>WINDOW){if(n.kind==='up')this.holds.delete(n.holdId);out.push(this.result(n,(beat-n.beat)*spb,true,'timeout'));}}
  return out;
 }
 rewind(beat){
  for(const [id,r]of this.results)if(r.beat>=beat)this.results.delete(id);
  this.extras=this.extras.filter(x=>x.beat<beat);this.holds.clear();this.combo=0;this.maxCombo=0;
  for(const r of this.results.values()){if(r.grade==='miss')this.combo=0;else this.maxCombo=Math.max(this.maxCombo,++this.combo);}
  // 再開フレーズからコンボを始め、巻き戻しで最大コンボが膨らまないようにする。
  this.combo=0;
 }
 stats(){
  const a=Array.from(this.results.values());const perfect=a.filter(r=>r.grade==='perfect').length,good=a.filter(r=>r.grade==='good').length,miss=a.filter(r=>r.grade==='miss').length;
  const total=this.chart.notes.length,score=Math.max(0,Math.min(100,Math.round(100*(perfect+good*.72)/(total+this.extras.length*.5))));
  const errors=a.filter(r=>r.grade!=='miss').map(r=>r.error).sort((a,b)=>a-b);
  return {perfect,good,miss,extras:this.extras.length,total,score,maxCombo:this.maxCombo,median:errors.length?errors[Math.floor(errors.length/2)]:0};
 }
}
function validateChart(c){
 if(!c.notes.length||c.duration<=0)throw Error('Empty chart');
 const ids=new Set();for(const n of c.notes){if(ids.has(n.id)||n.beat<0||n.beat>=c.duration)throw Error('Invalid note');ids.add(n.id);if(n.kind==='up'&&!c.notes.some(d=>d.holdId===n.holdId&&d.kind==='down'&&d.beat<n.beat))throw Error('Orphan release');}
 return true;
}
const api={GAMES,SHIFTS,ORDER,RECORD_KEYS,stampAwards,WINDOW,PERFECT,makeChart,sectionAt,Session,validateChart};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RhythmCore=api;
})(typeof window!=='undefined'?window:globalThis);
