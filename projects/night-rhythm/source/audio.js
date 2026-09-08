(function(root){
'use strict';
const midi=n=>440*Math.pow(2,(n-69)/12);
class RhythmAudio{
 constructor(){this.ctx=null;this.nodes=new Set();this.volume=.7;this.origin=0;this.bpm=112;this.chart=null;this.nextStep=0;this.cueIndex=0;this.timer=null;this.active=false;this.lastDemo=-1;this.onDemo=null;this.runId=0;}
 async unlock(){
  if(!this.ctx){
   this.ctx=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});
   this.master=this.ctx.createGain();this.master.gain.value=this.volume*.7;
   this.compressor=this.ctx.createDynamicsCompressor();this.compressor.threshold.value=-12;this.compressor.knee.value=16;this.compressor.ratio.value=3;
   this.master.connect(this.compressor);this.compressor.connect(this.ctx.destination);
   this.music=this.ctx.createGain();this.music.gain.value=.66;this.music.connect(this.master);
   this.cues=this.ctx.createGain();this.cues.gain.value=.82;this.cues.connect(this.master);
   this.fx=this.ctx.createGain();this.fx.gain.value=.86;this.fx.connect(this.master);
   this.delay=this.ctx.createDelay(.5);this.delay.delayTime.value=.145;const wet=this.ctx.createGain();wet.gain.value=.12;this.delay.connect(wet);wet.connect(this.music);
   this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);let seed=831;
   const a=this.noise.getChannelData(0);for(let i=0;i<a.length;i++){seed=(seed*1664525+1013904223)>>>0;a[i]=(seed/4294967296)*2-1;}
  }
  await this.ctx.resume();if(this.ctx.state!=='running')throw Error('音を開始できませんでした。もう一度押してください。');
 }
 setVolume(v){this.volume=v;if(this.master)this.master.gain.setTargetAtTime(v*.7,this.ctx.currentTime,.03);}
 track(node){this.nodes.add(node);node.onended=()=>{this.nodes.delete(node);try{node.disconnect();}catch{}};return node;}
 tone(freq,t,d=.15,level=.1,type='sine',bus=this.music,slide=null){
  if(!this.ctx||t<this.ctx.currentTime-.06)return;
  t=Math.max(this.ctx.currentTime,t);const o=this.track(this.ctx.createOscillator()),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,level),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(bus);o.start(t);o.stop(t+d+.03);
 }
 noiseHit(t,d,level,freq,type='highpass',bus=this.music){
  if(!this.ctx||t<this.ctx.currentTime-.06)return;t=Math.max(t,this.ctx.currentTime);
  const n=this.track(this.ctx.createBufferSource()),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();n.buffer=this.noise;f.type=type;f.frequency.value=freq;f.Q.value=.7;
  g.gain.setValueAtTime(level,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);n.connect(f);f.connect(g);g.connect(bus);n.start(t);n.stop(t+d+.02);
 }
 keys(note,t,d=.65,level=.065){
  this.tone(midi(note),t,d,level,'sine');this.tone(midi(note)*2,t,d*.52,level*.2,'sine');this.tone(midi(note)*3,t,d*.25,level*.065,'sine');
 }
 pluck(note,t,d=.32,level=.08){this.tone(midi(note),t,d,level,'triangle');this.tone(midi(note)*2,t,.075,level*.18,'sine');}
 bass(note,t,d=.32){this.tone(midi(note),t,d,.14,'sine');this.tone(midi(note)*2,t,d*.6,.023,'triangle');}
 kick(t,soft=false){this.tone(135,t,.19,soft?.16:.24,'sine',this.music,43);this.noiseHit(t,.018,.04,1400,'lowpass');}
 snare(t,soft=false){this.noiseHit(t,.12,soft?.035:.07,1700,'highpass');this.tone(170,t,.09,.04,'triangle');}
 hat(t,level=.026){this.noiseHit(t,.042,level,6400,'highpass');}
 chime(note,t,level=.13){this.tone(midi(note),t,.26,level,'sine',this.cues);this.tone(midi(note)*2.76,t,.11,level*.11,'sine',this.cues);}
 cue(c,t){
  switch(c.type){
   case'fireOrder':this.chime(67+c.hold*3,t,.15);this.noiseHit(t,.045,.1,750,'lowpass',this.cues);break;
   case'fireReady':this.chime(79,t,.13);break;
   case'ignite':this.noiseHit(t,.16,.08,2800,'bandpass',this.cues);break;
   case'launch':this.tone(600,t,.17,.1,'sine',this.cues,1200);break;
   case'sayHai':this.syllable(185,t,.16,[1,.35,.6,.15]);break;
   case'sayCheese':this.noiseHit(t,.05,.06,4200,'highpass',this.cues);this.syllable(260,t+.035,.3,[.4,.15,.7,.3]);break;
   case'kneadCue':this.tone(220+c.pitch*90,t,.09,.16,'triangle',this.cues);this.noiseHit(t,.045,.09,700,'lowpass',this.cues);break;
   case'stretchReady':this.chime(c.hold===3?84:79,t,.16);break;
   case'stretch':this.tone(330,t,.18,.08,'sine',this.cues,540);break;
   case'baked':this.chime(88,t,.12);break;
   case'switch':{const n={mail:67,soda:74,moon:81}[c.mode];this.chime(n,t,.16);this.chime(n+7,t+.085,.12);break;}
   case'wood1':this.tone(560,t,.07,.21,'sine',this.cues);this.tone(840,t,.04,.065,'triangle',this.cues);break;
   case'wood2':this.tone(820,t,.085,.2,'sine',this.cues);this.tone(1240,t,.04,.05,'triangle',this.cues);break;
   case'wood3':this.tone(1120,t,.045,.15,'sine',this.cues);break;
   case'soda1':this.chime(c.hold===1?88:c.hold===3?81:76,t);if(c.hold===3)this.chime(84,t+.11,.075);break;
   case'soda2':this.chime(79,t);break;
   case'pourCue':this.tone(440,t,.12,.08,'sine',this.cues,660);break;
   case'releaseCue':this.chime(88,t,.075);break;
   case'echo':this.chime([76,79,83,86][c.pitch%4],t,.19);this.noiseHit(t,.025,.08,1800,'bandpass',this.cues);break;
   case'yourTurn':this.tone(740,t,.07,.06,'sine',this.cues,980);break;
  }
 }
 syllable(f,t,d,weights){for(let i=0;i<weights.length;i++)this.tone(f*(i+1),t,d,.13*weights[i],'sine',this.cues);}
 hit(id,kind='down',demo=false){if(!this.ctx)return;this.hitAt(id,kind,this.ctx.currentTime+.004,demo);}
 hitAt(id,kind,t,demo=false){const bus=demo?this.cues:this.fx;
  if(id==='mail'){this.noiseHit(t,.065,.19,1000,'lowpass',bus);this.tone(180,t,.08,.24,'sine',bus,75);this.tone(960,t+.014,.075,.075,'sine',bus);}
  if(id==='soda'){if(kind==='down'){this.noiseHit(t,.2,.14,2200,'bandpass',bus);this.tone(270,t,.13,.1,'sine',bus,580);}else{this.tone(900,t,.07,.17,'sine',bus,400);this.tone(1320,t+.03,.15,.085,'sine',bus);this.noiseHit(t,.055,.08,4300,'highpass',bus);}}
  if(id==='moon'){this.noiseHit(t,.07,.13,3000,'bandpass',bus);this.tone(1100,t,.12,.13,'sine',bus);this.tone(1650,t,.16,.045,'sine',bus);}
  if(id==='fireworks'){if(kind==='down')this.noiseHit(t,.28,.1,3000,'highpass',bus);else{this.tone(220,t,.2,.2,'sine',bus,45);this.noiseHit(t+.035,.5,.21,1600,'lowpass',bus);this.tone(1320,t+.12,.4,.065,'sine',bus);}}
  if(id==='ghost'){this.noiseHit(t,.028,.22,2200,'highpass',bus);this.noiseHit(t+.045,.03,.13,1400,'bandpass',bus);this.tone(1200,t+.075,.15,.06,'sine',bus);}
  if(id==='bakery'){if(kind==='down'){this.noiseHit(t,.075,.16,700,'lowpass',bus);this.tone(190,t,.12,.12,'sine',bus,100);}else{for(let i=0;i<3;i++)this.tone(midi(76+i*3),t+i*.05,.3,.09,'sine',bus);}}
 }
 miss(){if(this.ctx)this.tone(140,this.ctx.currentTime+.003,.16,.08,'triangle',this.fx,90);}
 finish(good){if(!this.ctx)return;const t=this.ctx.currentTime+.1;for(const [i,n]of(good?[72,76,79,84]:[72,71,67,72]).entries())this.tone(midi(n),t+i*.12,.5,.11,'sine',this.fx);}
 composition(step,t){
  const b=step/4,bar=Math.floor(b/4),pos=step%16,mix=this.chart.game.id==='remix';
  const id=mix?(this.chart.sections.find(s=>b>=s.beat&&b<s.end)||this.chart.sections.at(-1)).mode:this.chart.game.id;
  if(this.chart.quiet&&b>=this.chart.quiet.from&&b<this.chart.quiet.to)return;
  const count=this.chart.duration/4,ending=bar>=count-4,bridge=bar>=Math.floor(count*.65)&&bar<Math.floor(count*.65)+3;
  const section=Math.floor(bar/4),spb=60/this.bpm;
  const progressions={mail:[[48,52,55,59],[45,48,52,55],[50,53,57,60],[43,47,50,53]],soda:[[53,57,60,64],[55,59,62,65],[52,55,59,62],[45,48,52,55]],moon:[[50,53,57,60],[46,50,53,57],[48,52,55,59],[45,49,52,55]]};
  progressions.fireworks=[[48,55,60,64],[53,57,60,65],[45,52,57,60],[55,59,62,67]];progressions.ghost=[[45,48,52,59],[50,53,57,60],[47,50,53,56],[52,56,59,62]];progressions.bakery=[[53,57,60,62],[50,53,57,60],[55,59,62,65],[48,52,55,60]];
  const chord=(mix?[[48,52,55,59],[45,48,52,55],[53,57,60,64],[43,47,50,53]]:progressions[id])[(Math.floor(bar/2)+(this.chart.shift?1:0))%4].map(n=>n+(this.chart.shift?2:0));
  if((ending||this.chart.quiet&&b>=this.chart.quiet.to)&&pos===0){this.noiseHit(t,.35,.04,4500,'highpass');this.keys(chord[0]+24,t,.6,.055);}
  if(id==='fireworks'&&pos%4===0)this.tone(100,t,.17,.08,'sine',this.music,50);
  if(id==='ghost'&&pos===0){this.tone(midi(chord[0]+24),t,1.1,.024,'sine');this.tone(midi(chord[0]+24)+2,t,1.1,.018,'sine');}
  if(mix&&pos===14&&bar%4===3)this.pluck(chord[2]+24,t,.18,.05);
  // 合図の立ち上がりを空け、伴奏は少し控えめな帯域と音量にまとめる。
  if(pos===0||pos===(id==='soda'?10:8))this.kick(t,bridge);
  if(!bridge&&(pos===4||pos===12))this.snare(t,id==='mail');
  if(pos%2===0&&!bridge)this.hat(t+(pos%4===2&&id==='mail'?spb*.07:0),pos%4===0?.018:.027);
  if(pos===0||pos===6||pos===10||pos===14){const n=chord[pos===10?2:0]-12;this.bass(n,t,pos===0?spb*.7:spb*.35);}
  if(pos===(id==='mail'?2:0)||pos===10){for(let i=0;i<4;i++)this.keys(chord[i]+12,t+i*.008,bridge?1.2:.6,bridge?.023:.041);}
  const melodies={mail:[12,16,19,16,14,12,11,7,12,14,16,19,23,19,16,14],soda:[12,19,16,19,14,17,21,17,11,14,19,14,12,16,19,24],moon:[12,19,24,19,15,22,27,22,14,21,26,21,12,19,24,19]};
  melodies.fireworks=[12,12,19,24,19,16,12,7,12,19,24,26,24,19,16,12];melodies.ghost=[12,15,19,23,24,23,19,15,11,14,17,20,19,17,14,11];melodies.bakery=[12,16,19,24,21,19,16,14,12,14,16,19,17,16,14,12];
  if(!bridge&&(pos===2||pos===6||pos===14||(ending&&pos===10))){const m=melodies[id][(bar*3+Math.floor(pos/4)+section)%16]+chord[0];this.pluck(m,t,.25,id==='moon'?.025:.035);}
  if(pos===15&&bar%4===3&&!bridge){this.hat(t,.018);this.hat(t+spb*.13,.015);}
 }
 start(chart,startBeat=0){
  this.stop();this.chart=chart;this.bpm=chart.game.bpm;this.startBeat=startBeat;this.origin=this.ctx.currentTime+.15+(4-startBeat)*60/this.bpm;
  this.nextStep=Math.round((startBeat-4)*4);this.cueIndex=chart.cues.findIndex(c=>c.beat>=startBeat);if(this.cueIndex<0)this.cueIndex=chart.cues.length;
  this.lastDemo=-1;this.demoIndex=chart.demos.findIndex(d=>d.beat>=startBeat);if(this.demoIndex<0)this.demoIndex=chart.demos.length;
  this.active=true;this.runId++;this.pump();this.timer=setInterval(()=>this.pump(),25);
 }
 pump(){if(!this.active)return;const limit=this.ctx.currentTime+.16,spb=60/this.bpm;
  while(this.origin+this.nextStep/4*spb<limit){const b=this.nextStep/4,t=this.origin+b*spb;
   if(b>=this.startBeat&&b<this.chart.duration)this.composition(this.nextStep,t);
   else if(b<this.startBeat&&this.nextStep%4===0)this.chime(b===this.startBeat-1?84:76,t,.09);
   this.nextStep++;if(b>this.chart.duration+2)break;
  }
  while(this.cueIndex<this.chart.cues.length&&this.origin+this.chart.cues[this.cueIndex].beat*spb<limit){const c=this.chart.cues[this.cueIndex++];this.cue(c,this.origin+c.beat*spb);}
  while(this.demoIndex<this.chart.demos.length&&this.origin+this.chart.demos[this.demoIndex].beat*spb<limit){const d=this.chart.demos[this.demoIndex++];this.hitAt(d.mode||this.chart.game.id,d.kind,this.origin+d.beat*spb,true);}
 }
 outputTime(performanceMs){
  if(!this.ctx)return 0;
  if(this.ctx.getOutputTimestamp){const ts=this.ctx.getOutputTimestamp();if(ts.contextTime>0&&ts.performanceTime>0)return ts.contextTime+(performanceMs-ts.performanceTime)/1000;}
  return this.ctx.currentTime-(this.ctx.outputLatency||0)-(performance.now()-performanceMs)/1000;
 }
 beat(performanceMs=performance.now(),offset=0){return (this.outputTime(performanceMs)-this.origin-offset/1000)/(60/this.bpm);}
 stop(){this.active=false;clearInterval(this.timer);this.timer=null;this.runId++;for(const n of this.nodes){try{n.stop();}catch{}}this.nodes.clear();}
}
root.RhythmAudio=RhythmAudio;
})(typeof window!=='undefined'?window:globalThis);
