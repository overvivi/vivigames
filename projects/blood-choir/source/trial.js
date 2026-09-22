(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./engine.js'),require('./data.js'));else root.BCTrial=factory(root.BCCore,root.BCData);})(this,function(C,D){
  'use strict';
  class TrialRun extends C.Run{
    hurtPlayer(){} // 試射の標的と接触しても、装備を試す時間を奪わない。
    updateEnemies(dt){
      for(const e of this.enemies){if(e.dead)continue;e.age+=dt;e.hit=Math.max(0,e.hit-dt);e.arrival=Math.max(0,e.arrival-dt);e.x+=(e.homeX-e.x)*Math.min(1,dt*3);e.y+=(e.homeY+Math.sin(e.age*1.4+e.phase)*4-e.y)*Math.min(1,dt*3);e.dot-=dt;if(e.dot<=0){e.dot=.3;if(e.burn||e.poison)this.hurtEnemy(e,this.damageValue()*(e.burn*.2+e.poison*.16)*.3,'dot');}}
    }
  }
  class Trial{
    constructor(options={}){
      this.record=C.normalizeRecord(options.record);
      this.options={weapon:D.weapons.some(d=>d.id===options.weapon)?options.weapon:'lantern',mask:D.masks.some(d=>d.id===options.mask)?options.mask:'mourner',rite:[...D.evolutions,...D.resonances].some(d=>d.id===options.rite)?options.rite:'none'};
      this.options.targetHp=[600,6000,60000].includes(Number(options.targetHp))?Number(options.targetHp):this.record?60000:600;
      if(this.record){this.options.weapon=this.record.weapon;this.options.mask=this.record.mask;this.options.rite='record';}
      this.reset();
    }
    reset(){
      const r=this.run=new TrialRun({...this.options,...this.record,daily:false,seed:this.record?.seed||7302});r.practice=true;r.trial=true;r.trialRecord=!!this.record;r.intro=0;r.spawnLeft=1;r.spawnTimer=1e9;r.events=[];
      if(this.record){
        // 保存された能力だけを複製し、前の戦闘の被害・計測・消費済みの状態は持ち込まない。
        r.stacks={...this.record.stacks};r.evolved=[...this.record.evolved];r.covenants=[...this.record.covenants];r.growth=this.record.growth;
      }else{
        const resonance=D.resonances.find(d=>d.id===this.options.rite),ids=resonance?resonance.pair:this.options.rite==='none'?[]:[this.options.rite];
        for(const id of ids){const d=D.evolutions.find(d=>d.id===id);r.evolved.push(id);for(const [key,n]of Object.entries(d.needs))r.stacks[key]=Math.max(r.stacks[key]||0,n);}
      }
      r.stats=r.computeStats();r.p.hp=r.stats.hp;r.p.shield=r.stats.barrier*6;r.rebirths=r.count('rebirth')+(r.has('phoenix')?1:0);r.charge=r.stats.ultimate;this.samples=[];this.total=0;this.chargeWait=0;
      this.slots=[{x:230,y:165},{x:480,y:245},{x:730,y:165}].map(v=>({...v,timer:0,enemy:null}));for(const slot of this.slots)this.spawn(slot);
    }
    spawn(slot){
      const e=this.run.spawn(0,false,slot.x,slot.y);Object.assign(e,{kind:'effigy',name:'試射の聖遺物',behavior:'effigy',r:25,hp:this.options.targetHp,maxHp:this.options.targetHp,shoot:1e9,homeX:slot.x,homeY:slot.y});slot.enemy=e;slot.timer=0;
    }
    get dps(){return this.samples.reduce((n,v)=>n+v.damage,0)/10;}
    snapshot(){
      if(this.run.time<10)return null;
      const tally={};for(const sample of this.samples)for(const [id,n]of Object.entries(sample.tally))tally[id]=(tally[id]||0)+n;
      const r=this.run;return{dps:this.dps,tally,targetHp:this.options.targetHp,time:r.time,recordWave:this.record?.wave??null,options:{...this.options},build:{weapon:r.weapon.id,mask:r.mask.id,stacks:{...r.stacks},evolved:[...r.evolved],covenants:[...r.covenants],meta:{...r.meta},growth:r.growth}};
    }
    update(dt,input={}){
      const r=this.run;if(r.state!=='playing')return;
      dt=C.clamp(Number(dt)||0,0,.05);
      const oldTally={...r.damageTally},oldTotal=Object.values(oldTally).reduce((n,v)=>n+v,0),before=r.charge;r.update(dt,input);
      if(before>=r.stats.ultimate&&r.charge<r.stats.ultimate)this.chargeWait=5;
      if(this.chargeWait>0){this.chargeWait=Math.max(0,this.chargeWait-dt);r.charge=r.stats.ultimate*(1-this.chargeWait/5);}
      else r.charge=r.stats.ultimate;
      this.total=Object.values(r.damageTally).reduce((n,v)=>n+v,0);if(this.total>oldTotal){const tally={};for(const [id,n]of Object.entries(r.damageTally)){const added=n-(oldTally[id]||0);if(added>0)tally[id]=added;}this.samples.push({time:r.time,damage:this.total-oldTotal,tally});}this.samples=this.samples.filter(v=>v.time>r.time-10);
      // 通常のダメージ・死亡・継続効果を使い、倒れた標的だけを一秒後に補充する。
      for(const slot of this.slots)if(slot.enemy.dead){slot.timer+=dt;if(slot.timer>=1)this.spawn(slot);}
      r.souls=0;
    }
  }
  return{Trial};
});
