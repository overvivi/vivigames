(function(){
  'use strict';
  // 後日Sound Workshopの書出し音源をmanifestへ指定すれば、呼び出し側を変えず差し替えられる。
  const manifest={shot:null,hit:null,death:null,hurt:null,jump:null,dash:null,lightning:null,clear:null,boss:null,bossPhase:null,bellWarning:null,bellPulse:null,sweepWarning:null,sweepErupt:null,pillarWarning:null,pillarErupt:null,victory:null,combo:null,evolve:null,ultimate:null,ultimate_lantern:null,ultimate_needle:null,ultimate_censer:null,ultimate_bell:null,ultimate_book:null,ultimate_scythe:null,revive:null,dead:null,select:null,enemyShot:null,cleave:null,burst:null,plagueBurst:null,heal:null,shield:null,summon:null,danger:null,wave:null,ambience:null,...window.BCSoundManifest};
  class Audio{
    constructor(){this.ctx=null;this.music=.3;this.sfx=.5;this.last={};this.active=true;this.loaded=new Map();}
    unlock(){
      if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=.55;this.master.connect(this.ctx.destination);this.musicGain=this.ctx.createGain();this.musicGain.gain.value=0;this.musicGain.connect(this.master);this.makeDrone();}
      this.ctx.resume().catch(()=>{});
    }
    makeDrone(){
      if(manifest.ambience){this.ambience=new window.Audio(manifest.ambience);this.ambience.loop=true;return;}
      const c=this.ctx,breath=c.createGain();breath.gain.value=.7;breath.connect(this.musicGain);
      // 揺らぎは内部の音量へ掛け、最終音量ゼロと一時停止の無音を保証する。
      for(const [freq,vol]of [[55,.13],[82.4,.035],[110.3,.02],[164.7,.008]]){const o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.value=freq;g.gain.value=vol;o.connect(g);g.connect(breath);o.start();}
      const l=c.createOscillator(),g=c.createGain();l.frequency.value=.11;g.gain.value=.12;l.connect(g);g.connect(breath.gain);l.start();
    }
    set(settings,inGame){this.music=settings.music;this.sfx=settings.sfx;if(this.ctx)this.musicGain.gain.setTargetAtTime(this.active&&inGame?this.music*.45:0,this.ctx.currentTime,.08);if(this.ambience){this.ambience.volume=this.music*.5;if(this.active&&inGame&&this.music>0)this.ambience.play().catch(()=>{});else this.ambience.pause();}for(const pool of this.loaded.values())for(const a of pool)a.volume=this.sfx;}
    suspend(){this.active=false;if(this.ctx)this.ctx.suspend().catch(()=>{});this.ambience?.pause();for(const pool of this.loaded.values())for(const a of pool)a.pause();}
    resume(){this.active=true;if(this.ctx)this.ctx.resume().catch(()=>{});}
    play(name,variant){
      if(!this.ctx||!this.active||this.sfx<=0)return;
      const now=this.ctx.currentTime,limit={lightning:.06,shot:.07,hit:.06,death:.09,enemyShot:.12,burst:.12,plagueBurst:.15,summon:.18,heal:.1,sweepWarning:.15,sweepErupt:.15,pillarWarning:.15,pillarErupt:.15}[name]||0;if(now-(this.last[name]??-10)<limit)return;this.last[name]=now;
      const key=name==='ultimate'&&manifest['ultimate_'+variant]?'ultimate_'+variant:name;
      if(manifest[key]){let pool=this.loaded.get(key);if(!pool){pool=[];this.loaded.set(key,pool);}let a=pool.find(a=>a.paused||a.ended);if(!a&&pool.length<4){a=new window.Audio(manifest[key]);pool.push(a);}if(!a){a=pool.shift();pool.push(a);}a.currentTime=0;a.volume=this.sfx;a.play().catch(()=>{});return;}
      const presets={shot:[190,75,.075,.1,'triangle'],hit:[90,45,.09,.12,'sawtooth'],death:[110,28,.2,.15,'sawtooth'],hurt:[150,35,.22,.2,'sawtooth'],jump:[95,240,.12,.09,'sine'],dash:[240,50,.15,.1,'triangle'],lightning:[380,45,.18,.12,'sawtooth'],clear:[220,440,.5,.14,'triangle'],boss:[60,32,.9,.18,'sawtooth'],bossPhase:[45,90,1,.16,'sawtooth'],evolve:[165,660,.9,.16,'triangle'],ultimate:[80,24,.8,.22,'sawtooth'],revive:[130,520,.6,.14,'triangle'],dead:[90,28,1,.16,'triangle'],select:[180,260,.12,.1,'triangle']};
      Object.assign(presets,{enemyShot:[135,65,.09,.05,'triangle'],cleave:[180,35,.2,.12,'triangle'],burst:[65,28,.23,.1,'sawtooth'],plagueBurst:[55,25,.3,.07,'triangle'],heal:[260,440,.18,.07,'sine'],shield:[420,180,.15,.07,'triangle'],summon:[70,140,.35,.07,'triangle'],danger:[180,360,.2,.07,'sine'],bellWarning:[330,440,.6,.08,'sine'],bellPulse:[90,33,.85,.12,'triangle'],sweepWarning:[220,550,.8,.07,'sine'],sweepErupt:[80,28,.34,.12,'sawtooth'],pillarWarning:[160,330,.35,.065,'sine'],pillarErupt:[65,24,.4,.12,'sawtooth'],victory:[110,440,1.4,.14,'triangle']});
      const a=presets[name==='combo'?'select':name];if(!a)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1100;o.type=a[4];o.frequency.setValueAtTime(a[0],now);o.frequency.exponentialRampToValueAtTime(a[1],now+a[2]);g.gain.setValueAtTime(.001,now);g.gain.linearRampToValueAtTime(a[3]*this.sfx,now+.01);g.gain.exponentialRampToValueAtTime(.001,now+a[2]);o.connect(filter);filter.connect(g);g.connect(this.master);o.onended=()=>{o.disconnect();filter.disconnect();g.disconnect();};o.start(now);o.stop(now+a[2]+.02);
    }
  }
  window.BCAudio={Audio,manifest};
})();
