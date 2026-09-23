(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./data.js'));else root.BCCore=factory(root.BCData);})(this,function(D){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const finite=(n,d=0)=>Number.isFinite(n)?n:d;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function segmentHit(x0,y0,x1,y1,cx,cy,radius){
    // 高速の弾が一コマで相手を跨いでも、移動線と判定円が最初に触れる位置を返す。
    const dx=x1-x0,dy=y1-y0,ox=x0-cx,oy=y0-cy,outside=ox*ox+oy*oy-radius*radius;
    if(outside<=0)return 0;const length=dx*dx+dy*dy,approach=ox*dx+oy*dy;if(!length||approach>=0)return null;
    const discriminant=approach*approach-length*outside;if(discriminant<0)return null;
    const t=(-approach-Math.sqrt(discriminant))/length;return t>=0&&t<=1?t:null;
  }
  function moveProjectile(b,dt){
    // 壁までの時間と反射後の残り時間を分け、低い更新頻度でも飛距離と折れた軌跡を保つ。
    if(dt<=0)return[{x0:b.x,y0:b.y,x1:b.x,y1:b.y,t0:0,t1:1}];
    const path=[];let elapsed=0;
    if(b.trailBends)b.trailBends=b.trailBends.map(v=>({...v,age:v.age+dt})).filter(v=>v.age<.035);
    if(b.bounce>0){b.x=clamp(b.x,6,954);b.y=clamp(b.y,12,D.FLOOR);}
    while(elapsed<dt){
      const remaining=dt-elapsed,tx=b.bounce>0&&b.vx?((b.vx>0?954:6)-b.x)/b.vx:Infinity,ty=b.bounce>0&&b.vy?((b.vy>0?D.FLOOR:12)-b.y)/b.vy:Infinity,wall=Math.max(0,Math.min(tx,ty)),step=Math.min(remaining,wall),x0=b.x,y0=b.y;
      b.x+=b.vx*step;b.y+=b.vy*step;path.push({x0,y0,x1:b.x,y1:b.y,t0:elapsed/dt,t1:(elapsed+step)/dt});elapsed+=step;
      if(wall>remaining||b.bounce<=0)break;
      if(dt-elapsed<.035)(b.trailBends||(b.trailBends=[])).push({x:b.x,y:b.y,age:dt-elapsed,vx:b.vx,vy:b.vy});
      // 角へ同時に触れたときは両軸を返し、一度の接触として反射回数を消費する。
      if(Math.abs(tx-wall)<1e-9)b.vx*=-1;if(Math.abs(ty-wall)<1e-9)b.vy*=-1;b.bounce--;
    }
    return path;
  }
  const lookup=Object.fromEntries([...D.items,...D.evolutions].map(i=>[i.id,i]));
  const damageIds=new Set(D.damageSources.map(d=>d.id)),enemyIds=new Set([...D.enemies,...D.bosses].map(d=>d.id));
  function normalizeEnemyKills(raw){const tally={};for(const id of enemyIds){const n=clamp(Math.floor(finite(raw?.[id])),0,1e9);if(n)tally[id]=n;}return tally;}
  const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  function normalizeDamage(raw){const tally={};for(const d of D.damageSources){const n=clamp(finite(raw?.[d.id]),0,1e15);if(n)tally[d.id]=n;}return tally;}
  function normalizeRecord(v){
    if(!v||!Number.isFinite(v.wave))return null;
    const ids=(list,defs)=>Array.isArray(list)?[...new Set(list.filter(id=>defs.some(d=>d.id===id)))]:[];
    const record={wave:clamp(v.wave,0,1e6),kills:clamp(finite(v.kills),0,1e8),time:clamp(finite(v.time),0,1e8),weapon:D.weapons.some(w=>w.id===v.weapon)?v.weapon:'lantern',mask:D.masks.some(m=>m.id===v.mask)?v.mask:'mourner',difficulty:clamp(Math.floor(finite(v.difficulty)),0,4),date:/^\d{4}-\d{2}-\d{2}/.test(v.date||'')?String(v.date).slice(0,10):'',won:!!v.won,outcome:['slain','retired','victory'].includes(v.outcome)?v.outcome:'retired',stacks:{},meta:{},evolved:ids(v.evolved,D.evolutions),covenants:ids(v.covenants,D.covenants)};
    for(const d of D.items){const n=clamp(Math.floor(finite(v.stacks?.[d.id])),0,d.max);if(n)record.stacks[d.id]=n;}
    for(const d of D.meta)record.meta[d.id]=clamp(Math.floor(finite(v.meta?.[d.id])),0,d.max);
    if(v.lastHit)record.lastHit={kind:['bullet','contact','pillar','beam'].includes(v.lastHit.kind)?v.lastHit.kind:'unknown',enemy:[...D.enemies,...D.bosses].some(d=>d.id===v.lastHit.enemy)?v.lastHit.enemy:'',amount:clamp(Math.round(finite(v.lastHit.amount)),0,1e6)};
    record.reliquaryKills=clamp(Math.floor(finite(v.reliquaryKills)),0,1e6);record.secretKills=clamp(Math.floor(finite(v.secretKills)),0,1e6);record.crownKills=clamp(Math.floor(finite(v.crownKills)),0,1e6);record.growth=clamp(finite(v.growth),0,1e12);record.damageTally=normalizeDamage(v.damageTally);record.enemyKills=normalizeEnemyKills(v.enemyKills);return record;
  }
  function hash(s){let v=2166136261;for(const c of String(s)){v^=c.charCodeAt(0);v=Math.imul(v,16777619);}return v>>>0;}
  function recordKey(record){const r=normalizeRecord(record);return r?JSON.stringify(r):null;}
  function freshProfile(){return{version:1,achievementGoal:null,enemyKills:{},weaponBest:Object.fromEntries(D.weapons.map(d=>[d.id,0])),ashes:0,best:0,reliquaryKills:0,crownKills:0,secretKills:0,kills:0,runs:0,clearedDifficulty:-1,weapons:['lantern'],masks:['mourner'],weapon:'lantern',mask:'mourner',meta:{},discovered:[],evolutions:[],resonances:[],achievements:[],records:[],settled:[],settings:{music:.3,sfx:.5,effectOpacity:1,backgroundDim:.2,damageNumbers:'all',hitRing:true,flashes:true,shake:true,gore:true,autoFire:true,autoAim:true}};}
  function normalizeProfile(raw){
    const p=freshProfile();if(!raw||typeof raw!=='object')return p;
    for(const key of ['ashes','best','kills','runs','secretKills','crownKills','reliquaryKills'])p[key]=clamp(Math.floor(finite(raw[key])),0,1e9);
    p.enemyKills=normalizeEnemyKills(raw.enemyKills);
    p.achievementGoal=D.achievements.some(a=>a.id===raw.achievementGoal)?raw.achievementGoal:null;
    p.clearedDifficulty=clamp(Math.floor(finite(raw.clearedDifficulty,-1)),-1,4);
    for(const [key,defs] of [['weapons',D.weapons],['masks',D.masks],['discovered',D.items],['evolutions',D.evolutions],['resonances',D.resonances],['achievements',D.achievements]])if(Array.isArray(raw[key]))p[key]=[...new Set([...p[key],...raw[key].filter(v=>defs.some(d=>d.id===v))])];
    if(p.weapons.includes(raw.weapon))p.weapon=raw.weapon;if(p.masks.includes(raw.mask))p.mask=raw.mask;
    for(const m of D.meta)p.meta[m.id]=clamp(Math.floor(finite(raw.meta?.[m.id])),0,m.max);
    if(Array.isArray(raw.records))p.records=raw.records.map(normalizeRecord).filter(Boolean).slice(0,30);
    // お気に入りの墓碑は上位30件の入替えから独立させ、能力や報酬を増やさず複製を保存する。
    
    
    for(const d of D.weapons)p.weaponBest[d.id]=clamp(Math.floor(finite(raw.weaponBest?.[d.id])),0,1e6);
    // 古い保存は残っている墓碑・日替わり記録だけから復元し、不明な弔具へ到達を推測しない。
    for(const r of (Array.isArray(raw.records)?raw.records.filter(r=>r&&Number.isFinite(r.wave)):[]))if(r&&D.weapons.some(d=>d.id===r.weapon)&&Number.isFinite(r.wave))p.weaponBest[r.weapon]=Math.max(p.weaponBest[r.weapon],clamp(Math.floor(r.wave),0,1e6));
    if(Array.isArray(raw.settled))p.settled=raw.settled.filter(x=>typeof x==='string').slice(-30);
    for(const k of ['music','sfx'])p.settings[k]=clamp(finite(raw.settings?.[k],p.settings[k]),0,1);
    p.settings.effectOpacity=clamp(finite(raw.settings?.effectOpacity,1),.35,1);
    p.settings.backgroundDim=clamp(finite(raw.settings?.backgroundDim,.2),0,.6);
    p.settings.damageNumbers=['all','critical','none'].includes(raw.settings?.damageNumbers)?raw.settings.damageNumbers:'all';
    for(const k of ['hitRing','flashes','shake','gore','autoFire','autoAim'])if(typeof raw.settings?.[k]==='boolean')p.settings[k]=raw.settings[k];
    return p;
  }
  function awardAchievements(p){const gained=[];for(const a of D.achievements)if(!p.achievements.includes(a.id)&&a.test(p)){p.achievements.push(a.id);p.ashes+=Math.ceil(a.reward*D.ASH.medal);gained.push(a);}return gained;}
  function settle(p,run,date=new Date().toLocaleDateString('sv-SE')){
    if(run.training)return[];
    if(p.settled.includes(run.id))return[];
    p.settled.push(run.id);p.settled=p.settled.slice(-30);p.ashes+=Math.floor(run.souls);p.best=Math.max(p.best,run.completed);p.kills+=run.kills;p.secretKills+=run.secretKills;p.reliquaryKills+=run.reliquaryKills;p.crownKills+=run.crownKills;p.runs++;
    run.medalsEarned=[];for(const [id,n]of Object.entries(normalizeEnemyKills(run.enemyKills))){const before=D.bestiaryProgress(id,p.enemyKills[id]);p.enemyKills[id]=Math.min(1e9,(p.enemyKills[id]||0)+n);const after=D.bestiaryProgress(id,p.enemyKills[id]);if(after.tier>before.tier)run.medalsEarned.push({id,tier:after.tier,label:after.label});}
    p.weaponBest[run.weapon.id]=Math.max(p.weaponBest[run.weapon.id]||0,run.completed);
    
    if(run.completed>=32)p.clearedDifficulty=Math.max(p.clearedDifficulty,run.difficulty);
    p.discovered=[...new Set([...p.discovered,...Object.keys(run.stacks)])];p.evolutions=[...new Set([...p.evolutions,...run.evolved])];p.resonances=[...new Set([...p.resonances,...run.stats.resonances])];
    run.finalRecord=normalizeRecord({wave:run.completed,kills:run.kills,time:run.time,weapon:run.weapon.id,mask:run.mask.id,difficulty:run.difficulty,date,won:run.completed>=32,meta:run.meta,stacks:run.stacks,evolved:run.evolved,covenants:run.covenants,lastHit:run.lastHit,enemyKills:run.enemyKills,outcome:run.outcome,growth:run.growth,damageTally:run.damageTally,secretKills:run.secretKills,crownKills:run.crownKills,reliquaryKills:run.reliquaryKills});p.records.push(run.finalRecord);
    p.records.sort((a,b)=>b.wave-a.wave||a.time-b.time);p.records=p.records.slice(0,30);
    return awardAchievements(p);
  }
  function purchase(p,type,id){
    const defs=type==='weapon'?D.weapons:type==='mask'?D.masks:type==='meta'?D.meta:null;
    const d=defs?.find(x=>x.id===id);if(!d)return false;
    let cost=d.cost;
    if(type==='meta'){const level=p.meta[id]||0;if(level>=d.max)return false;cost+=d.step*level;}else if(p[type+'s'].includes(id)){p[type]=id;return true;}
    if(p.ashes<cost)return false;p.ashes-=cost;
    if(type==='meta')p.meta[id]=(p.meta[id]||0)+1;else{p[type+'s'].push(id);p[type]=id;}
    awardAchievements(p);return true;
  }
  class Run{
    constructor(options={}){
      this.seed=(finite(options.seed,Date.now())>>>0)||1;this.rng=this.seed;this.offerRng=hash(this.seed+'-offer');this.endless=!!options.endless;
      this.id=options.id||String(Date.now())+'-'+this.seed;this.difficulty=clamp(Math.floor(finite(options.difficulty)),0,4);
      this.weapon=D.weapons.find(w=>w.id===options.weapon)||D.weapons[0];this.mask=D.masks.find(m=>m.id===options.mask)||D.masks[0];
            this.meta={...options.meta};this.stacks={};this.evolved=[];this.banned=[];this.covenants=[];this.covenantChoices=[];this.oathWave=0;this.rerolls=2+(this.meta.reroll||0)+(this.mask.rerolls||0);this.banishes=1+(this.meta.banish||0);
      // 外部の記録を読み込むときも、永久強化を正規の範囲へ揃える。
      for(const d of D.meta)this.meta[d.id]=clamp(Math.floor(finite(this.meta[d.id])),0,d.max);
      this.rerolls=2+(this.meta.reroll||0)+(this.mask.rerolls||0);this.banishes=1+(this.meta.banish||0);
      this.time=0;this.kills=0;this.secretKills=0;this.reliquaryKills=0;this.crownKills=0;this.souls=0;this.completed=0;this.growth=0;this.rebirths=0;this.revivesUsed=0;this.flawless=0;this.waveDamage=0;this.charge=0;this.damageTally={};this.enemyKills={};
      this.p={x:480,y:D.FLOOR-22,vx:0,vy:0,r:11,hp:100,shield:0,jumps:0,jumpBuffer:0,grounded:true,facing:1,invuln:0,dashTime:0,dashCD:0,shotCD:0};
      this.timers={lightning:2,void:3,cleave:2,familiar:.7,barrier:8,sanguine:0};this.events=[];this.uid=1;this.stats=this.computeStats();this.p.hp=this.stats.hp;this.state='playing';this.beginWave(1);
    }
    random(){let t=this.rng+=0x6D2B79F5;this.rng>>>=0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
    offerRandom(){let t=this.offerRng+=0x6D2B79F5;this.offerRng>>>=0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
    range(a,b){return a+(b-a)*this.random();}
    emit(type,data={}){if(this.events.length<160)this.events.push({type,...data});}
    count(id){return this.stacks[id]||0;}
        has(id){return this.evolved.includes(id);}
    hasResonance(id){return this.stats.resonances.includes(id);}
    computeStats(){
      const w=this.weapon,m=this.mask,n=id=>this.count(id),e=id=>this.has(id),o=id=>this.covenants.includes(id)?1:0;
      const stats={hp:Math.max(25,100+(m.hp||0)+(this.meta.heart||0)*5+n('vitality')*18-n('sacrifice')*12),
        damage:w.damage*(1+n('damage')*.18+n('sacrifice')*.3+(m.damage||0)+(this.meta.power||0)*.04+this.growth+(e('bloodrain')?.45:0)),
        rate:Math.min(25,w.rate*(1+n('rate')*.14+(this.meta.tempo||0)*.03)),speed:215*(1+n('speed')*.1+(m.speed||0)),jump:395*(1+n('jump')*.07),jumps:2+n('jump')+(m.jumps||0),
        armor:Math.min(.6,n('armor')*.08+(m.armor||0)),regen:n('regen')*.4+(m.regen||0),crit:Math.min(.85,.05+n('critical')*.07+(m.crit||0)),critPower:2+n('critDamage')*.4,
        bulletSpeed:w.speed*(1+n('bulletSpeed')*.15),size:1+n('bulletSpeed')*.08+(e('ossuary')?.9:0),shots:1+n('multishot')+(w.shots||0),pierce:n('pierce')+(w.pierce||0)+(e('ossuary')?6:0),bounce:n('bounce'),homing:n('homing')+(w.homing||0),
        leech:n('lifesteal')*.04,explosion:n('explosion'),burn:n('ember')*(e('phoenix')?3:1),poison:(n('plague')+(w.poison||0))*(e('pestilence')?3:1),slow:n('chill')*.12,
        lightning:n('lightning')+(w.lightning||0),chain:n('conduit')+(e('tempest')?4:0),familiar:n('familiar')+(w.familiar||0)+(m.familiar||0)+(e('choir')?4:0),echo:Math.min(.95,n('echo')*.2+(e('choir')?.3:0)),void:n('void'),gravity:n('gravity'),cleave:n('cleave')+(w.cleave||0),
        execution:e('butcher')?.35:n('execution')*.05,spore:n('spore'),barrier:n('barrier'),thorns:n('thorns'),dashCD:1.8*Math.pow(.85,n('dash')),dashInv:.24+n('dash')*.04,cooldown:Math.pow(.9,n('cooldown')),magnet:70+n('magnet')*65,
        choices:Math.min(6,3+n('fortune')+(m.choices||0)),rage:n('rage')*.25,split:n('split')+(e('ossuary')?2:0),harvest:1+n('harvest')*.25+(this.meta.ashes||0)*.05,ultimate:Math.max(12,32-(this.meta.vessel||0)*2)};
      stats.resonances=D.resonances.filter(d=>d.pair.every(id=>this.has(id))).map(d=>d.id);
      stats.hp=Math.max(25,stats.hp-o('glass')*25-o('chalice')*15);stats.damage*=1+o('glass')*.4-o('hunger')*.12;stats.cooldown*=1-o('vigil')*.28;stats.dashCD*=1+o('vigil')*.3;stats.armor=Math.min(.72,stats.armor+o('marrow')*.12);stats.speed*=1-o('marrow')*.1;stats.harvest+=o('pilgrim')*.4;stats.ultimate=Math.max(8,stats.ultimate-o('chalice')*8);return stats;
    }
    damageValue(){return this.stats.damage*(1+clamp(1-this.p.hp/this.stats.hp,0,1)*this.stats.rage);}
    
    beginWave(wave){
      this.wave=wave;this.state='playing';this.waveTime=0;this.clearElapsed=0;this.waveDamage=0;this.intro=1.4;this.spawnTimer=.2;this.bossSpawned=false;this.enemies=[];this.bullets=[];this.hostile=[];this.fields=[];this.hazards=[];this.rituals=[];this.choices=[];
      // 遺灰だけは波をまたいで床に残り、自前の寿命で朽ちる。回復片は結果画面で回収済み。
      this.pickups=(this.pickups||[]).filter(v=>v.life>0&&v.souls>0);
      this.spawnLeft=wave%8===0?Math.min(10,3+Math.floor(wave/8)):Math.min(56,7+Math.floor(wave*1.5));
      if(this.training)this.spawnLeft=0;this.spawnIndex=0;
      this.p.x=480;this.p.y=D.FLOOR-22;this.p.vx=this.p.vy=0;this.p.grounded=true;this.p.jumps=this.p.jumpBuffer=0;this.p.invuln=1;this.p.dashTime=this.p.dashCD=this.p.shotCD=0;this.timers={lightning:2,void:3,cleave:2,familiar:.7,barrier:8,sanguine:0};this.emit('wave',{wave});
    }
    spawn(kind,boss=false,x,y){
      if(this.enemies.filter(e=>!e.dead).length>=65)return;
      const def=boss?D.bosses[kind%D.bosses.length]:D.enemies[kind%D.enemies.length];
      const scaling=boss?(1+this.difficulty*.28)*Math.pow(1.55,Math.floor((this.wave-1)/32)):(1+(this.wave-1)*.075)*(1+this.difficulty*.2)*Math.pow(1.035,Math.max(0,this.wave-32))*(this.covenants.includes('pilgrim')?1.15:1);
      const e={...def,kind:def.id,id:this.uid++,boss,x:x??this.range(65,895),y:y??this.range(55,boss?125:210),vx:0,vy:0,hp:def.hp*scaling,maxHp:def.hp*scaling,phase:this.range(0,6.28),age:0,arrival:boss?.95:.5,arrivalDuration:boss?.95:.5,shoot:this.range(.3,.95),hit:0,dot:0,burn:0,poison:0,slow:0,dive:0,dead:false};
      if(boss){e.x=480;e.y=150;e.shoot=2.2;this.emit('boss',{name:e.name});}e.facing=e.x>this.p.x?-1:1;
      this.enemies.push(e);return e;
    }
    crownEnemy(e,id){
      const d=D.crowns.find(d=>d.id===id);if(!e||e.dead||e.boss||e.crown||this.training||!d)return false;
      e.crown=id;e.hp*=d.hp;e.maxHp*=d.hp;e.speed*=d.speed;e.shoot*=d.shot;e.curseCD=4.5;e.curseWarn=false;this.emit('crowned',{id,name:e.name});return true;
    }
    spawnWaveEnemy(){
      // 波と種子から決め、射撃回数や戦闘乱数で強敵の有無が変わらないようにする。
      const ordinal=this.spawnIndex++,unlocked=Math.min(8,2+Math.floor((this.wave-1)/2)),e=this.spawn(hash(this.seed+'-'+this.wave+'-'+ordinal)%unlocked);
      if(this.wave>=9&&this.wave%3===0&&this.wave%8!==0&&ordinal===2)this.crownEnemy(e,D.crowns[hash(this.seed+'-crown-'+this.wave)%D.crowns.length].id);return e;
    }
    eligibleEvolutions(){return D.evolutions.filter(e=>!this.has(e.id)&&Object.entries(e.needs).every(([id,n])=>this.count(id)>=n));}
    preview(id){
      const d=lookup[id];if(!d&&id!=='communion')return null;
      // 表示のために実際の所持効果や乱数を進めない。実戦と同じ計算式へ仮の一段階だけ通す。
      const next=Object.create(this);next.stacks={...this.stacks};next.evolved=[...this.evolved];next.p={...this.p};
      if(id==='communion'){next.growth=this.growth+.1;next.p.hp=this.stats.hp;}
      else if(d.needs){if(next.has(id))return null;next.evolved.push(id);}
      else{if(this.count(id)>=d.max)return null;next.stacks[id]=this.count(id)+1;}
      next.stats=next.computeStats();next.p.hp=clamp(next.p.hp+(id==='vitality'?18:Math.max(0,next.stats.hp-this.stats.hp)),1,next.stats.hp);
      return{stats:next.stats,shot:next.damageValue()*Math.pow(.92,next.count('multishot')),hp:next.p.hp,ready:next.eligibleEvolutions().map(e=>e.id)};
    }
    drawChoices(){
      const choices=[],pool=D.items.filter(i=>this.count(i.id)<i.max&&!this.banned.includes(i.id)&&!(i.id==='fortune'&&this.stats.choices>=6));
      // 条件の揃った禁忌進化は待たせず候補へ出す。普通の強化の枠は一つ残す。
      const ready=this.eligibleEvolutions();
      for(let i=ready.length-1;i>0;i--){const j=Math.floor(this.offerRandom()*(i+1));const t=ready[i];ready[i]=ready[j];ready[j]=t;}
      for(const e of ready.slice(0,Math.max(1,this.stats.choices-1)))choices.push(e.id);
      while(choices.length<this.stats.choices&&pool.length){
        const weights=pool.map(i=>1+Math.min(3,this.count(i.id))*.75);let r=this.offerRandom()*weights.reduce((a,b)=>a+b,0),at=0;
        while(at<pool.length-1&&r>weights[at])r-=weights[at++];choices.push(pool.splice(at,1)[0].id);
      }
      if(!choices.length)choices.push('communion');return choices;
    }
    choose(id){
      if(this.state!=='upgrade'||!this.choices.includes(id))return false;
      if(id==='communion'){this.p.hp=this.stats.hp;this.souls+=10;this.growth+=.1;}
      else if(D.evolutions.some(e=>e.id===id)){if(!this.eligibleEvolutions().some(e=>e.id===id))return false;this.evolved.push(id);this.emit('evolve',{id});}
      else{const def=lookup[id];if(!def||this.count(id)>=def.max)return false;this.stacks[id]=this.count(id)+1;if(id==='rebirth')this.rebirths++;}
      
      const old=this.stats.hp;this.stats=this.computeStats();this.p.hp=clamp(this.p.hp+(id==='vitality'?18:Math.max(0,this.stats.hp-old)),1,this.stats.hp);
      this.beginWave(this.wave+1);return true;
    }
    reroll(){if(this.state!=='upgrade'||this.rerolls<=0)return false;this.rerolls--;this.choices=this.drawChoices();return true;}
    banish(id){if(this.state!=='upgrade'||this.banishes<=0||!this.choices.includes(id)||!D.items.some(i=>i.id===id))return false;this.banned.push(id);this.banishes--;this.choices=this.drawChoices();return true;}
    previewCovenant(id){
      if(!D.covenants.some(d=>d.id===id)||this.covenants.includes(id))return null;
      // 誓う前の比較は実戦と同じ計算を使い、生命・充填・候補・乱数は動かさない。
      const next=Object.create(this);next.covenants=[...this.covenants,id];next.p={...this.p};next.stats=next.computeStats();next.p.hp=Math.min(next.p.hp,next.stats.hp);
      const snapshot=r=>({stats:r.stats,hp:r.p.hp,shot:r.damageValue()*Math.pow(.92,r.count('multishot')),charge:Math.min(r.charge,r.stats.ultimate),killHeal:r.covenants.includes('hunger')?1:0,enemyHp:r.covenants.includes('pilgrim')?1.15:1});
      return{before:snapshot(this),after:snapshot(next)};
    }
    swear(id){
      if(this.state!=='upgrade'||this.wave%8!==0||this.oathWave===this.wave||!this.covenantChoices.includes(id)||this.covenants.includes(id))return false;
      this.covenants.push(id);this.oathWave=this.wave;this.stats=this.computeStats();this.p.hp=Math.min(this.p.hp,this.stats.hp);this.charge=Math.min(this.charge,this.stats.ultimate);this.emit('evolve',{id});return true;
    }
    completeWave(){
      if(this.training){
        // 稽古は記録も報酬も持たない。波を終えたら強化の選択へ渡すだけ。
        if(this.state==='dead')return;
        this.completed=this.wave;this.hostile=[];this.bullets=[];this.hazards=[];this.fields=[];this.rituals=[];
        this.state='practiceDone';this.emit('clear',{wave:this.wave});return;
      }
      const beforeSouls=this.souls,beforeHp=this.p.hp,leftoverHeal=this.pickups.reduce((sum,p)=>sum+(p.life>0?p.heal:0),0);
      this.completed=this.wave;
      if(this.waveDamage===0){this.flawless++;this.souls+=2;}
      this.growth+=this.count('growth')*.02;this.stats=this.computeStats();this.p.hp=Math.min(this.stats.hp,this.p.hp+leftoverHeal+6+(this.meta.mercy||0)*2+(this.wave%8===0?this.stats.hp*.18:0));
      this.waveReport={souls:this.souls-beforeSouls,heal:Math.round(this.p.hp-beforeHp),flawless:this.waveDamage===0};
      if(this.wave%8===0&&this.has('phoenix'))this.rebirths++;
      this.hostile=[];this.bullets=[];this.hazards=[];this.fields=[];this.pickups=(this.pickups||[]).filter(v=>v.life>0&&v.souls>0);this.emit(this.wave===32?'victory':'clear',{wave:this.wave,flawless:this.waveDamage===0});
      this.covenantChoices=[];
      if(this.wave%8===0){const pool=D.covenants.filter(d=>!this.covenants.includes(d.id));while(pool.length&&this.covenantChoices.length<3)this.covenantChoices.push(pool.splice(Math.floor(this.offerRandom()*pool.length),1)[0].id);}
      if(this.wave===32&&!this.endless){this.state='victory';return;}this.state='upgrade';this.choices=this.drawChoices();
    }
    continueEndless(){if(this.state!=='victory')return false;this.state='upgrade';this.choices=this.drawChoices();return true;}
    // 自弾と敵弾は互いを削り合う。耐久が尽きた方が消える。
    // 総当たりだと最大39万組になるので、64pxの格子で近いものだけを見る。
    collideBullets(){
      if(!this.hostile.length||!this.bullets.length)return;
      const CELL=64,grid=new Map();
      for(const h of this.hostile){
        if(h.life<=0)continue;
        const k=((h.x/CELL)|0)*1024+((h.y/CELL)|0);
        const list=grid.get(k);if(list)list.push(h);else grid.set(k,[h]);
      }
      for(const b of this.bullets){
        if(b.life<=0||!(b.guard>0))continue;
        const cx=(b.x/CELL)|0,cy=(b.y/CELL)|0;
        for(let gx=cx-1;gx<=cx+1&&b.life>0;gx++)for(let gy=cy-1;gy<=cy+1&&b.life>0;gy++){
          const list=grid.get(gx*1024+gy);if(!list)continue;
          for(const h of list){
            if(h.life<=0)continue;
            const reach=b.r+h.r+2,dx=b.x-h.x,dy=b.y-h.y;
            if(dx*dx+dy*dy>reach*reach)continue;
            // 耐久の低い方が砕ける。勝った側も一つ削れる。
            this.emit('clash',{x:(b.x+h.x)/2,y:(b.y+h.y)/2});
            if(b.guard>=h.guard){h.life=0;if(--b.guard<0){b.life=0;break;}}
            else{b.life=0;h.guard--;break;}
          }
        }
      }
    }
    shoot(x,y,angle,damage,extra={}){
      if(this.bullets.length>=600)return;
      const speed=extra.speed||this.stats.bulletSpeed;
      this.bullets.push({id:this.uid++,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:4*this.stats.size,damage,life:2.8,guard:1+Math.min(4,this.stats.pierce),pierce:this.stats.pierce,bounce:this.stats.bounce,homing:this.stats.homing,hitIds:new Set(),color:this.weapon.color,main:true,...extra});
    }
    playerPose(){
      const p=this.p,angle=clamp(p.vx/2500,-.11,.11),x=p.x,y=p.y-22+Math.sin((this.time+this.clearElapsed)*3.2)*1.6;
      // 衣装の灯りの位置を身体と同じ回転へ通し、射出点と発光を一致させる。
      const lampX=27*p.facing,lampY=-15;
      return{x,y,angle,muzzle:{x:x+Math.cos(angle)*lampX-Math.sin(angle)*lampY,y:y+Math.sin(angle)*lampX+Math.cos(angle)*lampY}};
    }
    fire(input){
      const p=this.p,s=this.stats,near=this.nearest(p);
      if(input.autoAim&&!near)return false;
      const target=input.autoAim&&near?near:{x:finite(input.aimX,p.x),y:finite(input.aimY,0)};
      if(Math.abs(target.x-p.x)>16)p.facing=target.x>=p.x?1:-1;
      const {x,y}=this.playerPose().muzzle,angle=Math.atan2(target.y-y,target.x-x),base=this.damageValue()*Math.pow(.92,this.count('multishot'));
      for(let i=0;i<s.shots;i++)this.shoot(x,y,angle+(i-(s.shots-1)/2)*.12,base);
      if(s.echo&&this.random()<s.echo)this.shoot(x,y,angle+.045,base*.55,{color:'#e4cdff',sprite:4});
      if(this.has('bloodrain'))for(const a of [-2.2,-.94])this.shoot(x,y,a,base*.65,{color:'#ff456b',sprite:0,homing:s.homing+1});
      this.emit('shot',{x,y});return true;
    }
    nearest(point,exclude){let best=null,min=Infinity;for(const e of this.enemies)if(!e.dead&&(!exclude||!exclude.has(e.id))){const d=distance(point,e);if(d<min){best=e;min=d;}}return best;}
    enemyMuzzle(e){
      // 攻撃コマで光る口・掌・胸・刃を射出点として登録する。
      const points={heart:[0,.13],nun:[.26,-.06],eye:[.02,-.16],angel:[0,.02],leech:[.24,-.13],cantor:[0,-.24],watcher:[0,-.08],seraph:[0,-.13],bishop:[.09,-.34],butcher:[.28,.23],choir:[.04,-.16],god:[0,.035],oblivion:[0,.18],reliquary:[0,-.105]},point=points[e.kind]||[0,0],size=e.r*(e.boss?3.05:3.25);
      const dx=point[0]*size*(e.facing||1),dy=point[1]*size,angle=(e.facing<0?-1:1)*(e.hit||0)*.55;
      return{x:e.x+Math.cos(angle)*dx-Math.sin(angle)*dy,y:e.y+Math.sin(angle)*dx+Math.cos(angle)*dy};
    }
    enemyShot(e,angle,speed=110,extra={}){if(this.hostile.length>=650)return;const from=this.enemyMuzzle(e);this.hostile.push({x:from.x,y:from.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:5,life:8,guard:1+Math.floor(this.wave/12)+(e.boss?2:0),damage:10+this.wave*.45+this.difficulty*3,color:'#ffb26a',enemy:e.kind,sprite:['nun','seraph','bishop','butcher'].includes(e.kind)?7:['cantor','choir','oblivion'].includes(e.kind)?8:['eye','god'].includes(e.kind)?9:6,...extra});}
    ring(e,n,speed=90,offset=0){for(let i=0;i<n;i++)this.enemyShot(e,offset+i*Math.PI*2/n,speed);}
    fan(e,n=3,speed=115,spread=.25){const from=this.enemyMuzzle(e),a=Math.atan2(this.p.y-from.y,this.p.x-from.x);for(let i=0;i<n;i++)this.enemyShot(e,a+(i-(n-1)/2)*spread,speed);}
    hurtEnemy(e,amount,kind='main',source=kind){
      if(e.dead||amount<=0)return;const beforeHp=e.hp,burningBefore=e.burn>0;let crit=false;
      if(source==='familiar'&&this.hasResonance('requiem')&&e.requiem>0)amount*=1.35;
      if(kind==='main'&&this.random()<this.stats.crit){amount*=this.stats.critPower;crit=true;}
      e.hp-=amount;e.hit=.1;
      if(kind==='main'){
        e.burn=Math.max(e.burn,this.stats.burn);e.poison=Math.min(this.stats.poison*5,e.poison+this.stats.poison);e.slow=Math.max(e.slow,this.stats.slow);
        if(this.stats.leech&&this.random()<this.stats.leech&&this.p.hp>0)this.p.hp=Math.min(this.stats.hp,this.p.hp+2);
        if(this.hasResonance('sanguine')&&burningBefore&&this.p.hp>0&&this.timers.sanguine<=0){const heal=Math.max(0,Math.min(1,this.stats.hp-this.p.hp));this.p.hp+=heal;this.timers.sanguine=.5;if(heal>0){this.emit('heal',{x:this.p.x,y:this.p.y,n:Math.ceil(heal)});this.emit('resonance',{id:'sanguine',x:this.p.x,y:this.p.y-20});}}
        if(!e.boss&&e.hp/e.maxHp<=this.stats.execution)e.hp=0;
      }
      // 倒した後の余剰ダメージを含めず、処刑で削った残り生命は直撃へ数える。
      const key=damageIds.has(source)?source:'main';this.damageTally[key]=(this.damageTally[key]||0)+Math.max(0,beforeHp-Math.max(0,e.hp));
      if(kind!=='dot')this.emit('hit',{id:e.id,x:e.x,y:e.y,n:Math.round(amount),crit,kind});
      if(e.hp<=0)this.kill(e);
    }
    kill(e){
      if(e.dead)return;e.dead=true;this.kills++;if(enemyIds.has(e.kind))this.enemyKills[e.kind]=(this.enemyKills[e.kind]||0)+1;if(e.crown){const d=D.crowns.find(d=>d.id===e.crown);this.crownKills++;this.souls+=d.reward;this.emit('crownDeath',{x:e.x,y:e.y,reward:d.reward});}if(e.kind==='oblivion')this.secretKills++;if(e.kind==='reliquary')this.reliquaryKills++;this.charge=Math.min(this.stats.ultimate,this.charge+(e.boss?10:1));
      if(e.boss)this.souls+=Math.ceil(D.ASH.boss*this.stats.harvest);
      else if(this.random()<D.ASH.chance)this.pickups.push({x:e.x,y:e.y,vy:-60,life:D.ASH.life,heal:0,souls:Math.ceil(D.ASH.drop*this.stats.harvest)});
      
      if(this.covenants.includes('hunger')&&this.p.hp>0)this.p.hp=Math.min(this.stats.hp,this.p.hp+1);
      this.emit('death',{x:e.x,y:e.y,boss:e.boss,sprite:e.sprite,enemyKind:e.kind,size:e.r*(e.boss?3.05:3.25),flip:e.facing<0,pose:{boss:e.boss,sprite:e.sprite,kind:e.kind,age:e.age,arrival:e.arrival,arrivalDuration:e.arrivalDuration,cast:e.cast,shoot:e.shoot,gap:e.gap?{...e.gap}:null}});
      if(this.random()<.14||e.boss)this.pickups.push({x:e.x,y:e.y,vy:20,life:15,heal:e.boss?18:4});
      if(this.stats.explosion){const r=54+this.stats.explosion*5;this.emit('burst',{x:e.x,y:e.y,r,row:0});for(const target of this.enemies)if(!target.dead&&distance(e,target)<r)this.hurtEnemy(target,this.damageValue()*this.stats.explosion*.5,'blast');}
      if(this.stats.spore||this.has('pestilence'))this.addField({x:e.x,y:e.y,r:this.has('pestilence')?95:55,life:3,tick:0,kind:'poison',damage:this.damageValue()*(this.stats.spore*.35+(this.has('pestilence')?1:0))});
      if(this.has('pestilence')&&e.poison>0){for(const target of this.enemies)if(!target.dead&&distance(e,target)<150)target.poison=Math.max(target.poison,e.poison*.6);this.emit('plagueBurst',{x:e.x,y:e.y});}
    }
    addField(f){if(this.fields.length<40)this.fields.push({...f,maxLife:f.life});}
    hurtPlayer(amount,source={}){
      const p=this.p;if(p.invuln>0||this.training||this.state!=='playing'||!Number.isFinite(amount)||amount<=0)return;
      const beforeHp=p.hp,beforeRevives=this.revivesUsed;
      amount*=1-this.stats.armor;const absorbed=Math.min(p.shield,amount);p.shield-=absorbed;amount-=absorbed;
      p.hp-=amount;p.invuln=.8;this.waveDamage+=amount;if(amount>0){this.lastHit={kind:source.kind||'unknown',enemy:source.enemy||'',amount:Math.ceil(amount)};}this.emit(amount>0?'hurt':'shield',{x:p.x,y:p.y,n:Math.ceil(amount)});
      if(this.stats.thorns){this.emit('burst',{x:p.x,y:p.y,r:130,row:0});for(const e of this.enemies)if(distance(p,e)<130)this.hurtEnemy(e,this.damageValue()*this.stats.thorns*3,'blast','thorns');}
      if(p.hp<=0){if(this.rebirths>0){this.rebirths--;this.revivesUsed++;p.hp=this.stats.hp*.5;p.invuln=3;this.hostile=[];if(this.hasResonance('sanguine'))this.charge=this.stats.ultimate;this.emit('revive');}else{p.hp=0;this.state='dead';this.outcome='slain';this.emit('dead');}}
    }
    ultimate(){
      if(this.charge<this.stats.ultimate||this.state!=='playing'||this.intro>0)return false;
      if(!this.enemies.some(e=>!e.dead)&&!this.hostile.length&&!this.hazards.length)return false;
      const weapon=this.weapon.id,damage=this.damageValue(),p=this.p,targets=this.enemies.filter(e=>!e.dead);
      this.charge=0;p.invuln=1.2;this.hostile=[];this.hazards=[];this.emit('ultimate',{x:p.x,y:p.y,weapon});
      // 弔具ごとの後続攻撃も、発動時の威力を保存する。再照準や瀕死補正で後から倍率を変えない。
      if(weapon==='needle')for(let i=0;i<8;i++){
        const target=targets[i%Math.max(1,targets.length)],x=target?clamp(target.x+(i%3-1)*42,35,925):100+i*105,y=30;
        this.shoot(x,y,target?Math.atan2(target.y-y,target.x-x):Math.PI/2,damage*1.2,{main:false,damageSource:'ultimate',sprite:1,pierce:1,bounce:0,homing:5,r:4,life:3,speed:740,color:'#f3deae',targetId:target?.id});
      }
      if(weapon==='book')for(let i=0;i<8;i++){
        const a=-Math.PI+i*Math.PI/7,x=p.x+Math.cos(a)*50,y=p.y-28+Math.sin(a)*28,target=targets[i%Math.max(1,targets.length)];
        this.shoot(x,y,target?Math.atan2(target.y-y,target.x-x):a,damage*1.25,{main:false,damageSource:'ultimate',sprite:4,pierce:0,bounce:0,homing:7,r:5,life:4,speed:450,color:'#e0c1f4',targetId:target?.id});
      }
      if(weapon==='censer'){
        const target=this.nearest(p),x=target?.x??p.x,y=target?.y??p.y-110;
        this.addField({x,y,r:235,life:4,tick:0,kind:'ritual',ritual:'censer',source:'ultimate',damage:damage*2});
      }
      if(weapon==='bell')this.rituals.push({kind:'bell',tick:.3,left:3,damage:damage*3});
      const base=weapon==='lantern'?16:['censer','scythe'].includes(weapon)?10:8;
      for(const e of targets){const near=weapon==='scythe'&&distance(p,e)<260+e.r;this.hurtEnemy(e,damage*(base+(near?8:0)),'blast','ultimate');}
      return true;
    }
    updateRituals(dt){
      for(const ritual of this.rituals){ritual.tick-=dt;if(ritual.tick>0)continue;ritual.tick=.5;ritual.left--;
        const targets=this.enemies.filter(e=>!e.dead).sort((a,b)=>distance(this.p,a)-distance(this.p,b)).slice(0,6);
        for(const e of targets){this.emit('ritualStrike',{x:e.x,y:e.y});this.emit('lightning',{x:e.x,y:18,tx:e.x,ty:e.y});this.hurtEnemy(e,ritual.damage,'blast','ultimate');}
      }
      this.rituals=this.rituals.filter(r=>r.left>0);
    }
    updateEnemies(dt){
      const p=this.p;
      for(const e of this.enemies){
        if(e.dead)continue;e.arrival=Math.max(0,(e.arrival||0)-dt);const speed=Math.max(.2,1-e.slow);e.age+=dt*speed;e.hit=Math.max(0,e.hit-dt);e.cast=Math.max(0,(e.cast||0)-dt);e.shoot-=dt*speed;e.requiem=Math.max(0,(e.requiem||0)-dt);
        const facingX=e.windup>0?e.targetX:e.dive>0?e.x+e.vx:p.x;
        if(Math.abs(facingX-e.x)>16)e.facing=facingX>e.x?1:-1;
        e.dot-=dt;if(e.dot<=0){e.dot=.3;if(e.burn||e.poison)this.hurtEnemy(e,this.damageValue()*(e.burn*.2+e.poison*.16)*.3,'dot');}if(e.dead)continue;
        if(e.boss){this.updateBoss(e,dt*speed);}
        else{
          const t=e.age+e.phase,drift=e.crown==='blood'?1.15:e.crown==='bone'?.75:1;
          if(e.behavior==='chase'){const a=Math.atan2(p.y-e.y,p.x-e.x);e.x+=Math.cos(a)*e.speed*speed*dt;e.y+=Math.sin(a)*e.speed*speed*dt;}
          else if(e.windup>0){e.windup-=dt*speed;if(e.windup<=0){e.dive=.85;const a=Math.atan2(e.targetY-e.y,e.targetX-e.x);e.vx=Math.cos(a)*220*drift;e.vy=Math.sin(a)*220*drift;}}
          else if(e.dive>0){e.dive-=dt*speed;e.x+=e.vx*dt*speed;e.y+=e.vy*dt*speed;e.x=clamp(e.x,25,935);if(e.y>D.FLOOR-30){e.y=D.FLOOR-30;e.dive=0;}}
          else{e.x+=Math.cos(t*.8)*e.speed*speed*dt;e.y+=Math.sin(t*1.5)*13*dt*speed*drift;if(e.y>250)e.y-=45*dt*speed*drift;e.x=clamp(e.x,25,935);e.y=clamp(e.y,35,D.FLOOR-28);}
          if(e.shoot<=0){
            e.shoot=this.range(1.4,2.4)/Math.min(2.2,1+this.wave*.03)*(e.crown==='blood'?.82:1);e.cast=.28;
            if(e.behavior==='float')this.enemyShot(e,Math.PI/2,95);
            if(e.behavior==='aim'||e.behavior==='chase')this.fan(e,1,125);
            if(e.behavior==='fan')this.fan(e,3,110);
            if(e.behavior==='burst')this.fan(e,5,145,.18);
            if(e.behavior==='ring')this.ring(e,9,92,t);
            if(e.behavior==='summon'){this.spawn(4,false,e.x-25,e.y+20);this.spawn(0,false,e.x+25,e.y);this.emit('summon',{x:e.x,y:e.y});}
            if(e.behavior==='dive'){e.windup=.55;e.targetX=p.x;e.targetY=p.y;this.emit('danger',{x:e.x,y:e.y});}
            if(!['dive','summon'].includes(e.behavior))this.emit('enemyShot',{x:e.x,y:e.y});
          }
        }
        if(e.crown==='curse'){
          e.curseCD-=dt*speed;if(e.curseCD<=.8&&!e.curseWarn){e.curseWarn=true;this.emit('danger',{x:e.x,y:e.y});}
          if(e.curseCD<=0){this.ring(e,8,92,e.age*.13);e.curseCD=5.5;e.curseWarn=false;e.cast=Math.max(e.cast,.25);this.emit('crownPulse',this.enemyMuzzle(e));this.emit('enemyShot',{x:e.x,y:e.y});}
        }
        if(e.arrival<=0&&distance(e,p)<e.r+p.r)this.hurtPlayer(16+this.wave*.5,{kind:'contact',enemy:e.kind});
      }
      // 同じ座標へ群れが重なり続けないよう、ごく弱く間隔を空ける。突進予告は動かさない。
      for(let i=0;i<this.enemies.length;i++)for(let j=i+1;j<this.enemies.length;j++){
        const a=this.enemies[i],b=this.enemies[j];if(a.dead||b.dead||a.boss||b.boss||a.windup>0||b.windup>0||a.dive>0||b.dive>0)continue;
        const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),gap=(a.r+b.r)*.65;if(d>=gap)continue;
        const push=Math.min(3,(gap-d)*.2)*dt*30,nx=d>.001?dx/d:1,ny=d>.001?dy/d:0;
        a.x=clamp(a.x-nx*push,25,935);a.y=clamp(a.y-ny*push,35,D.FLOOR-28);b.x=clamp(b.x+nx*push,25,935);b.y=clamp(b.y+ny*push,35,D.FLOOR-28);
      }
    }
    addHazard(h){if(this.hazards.length>=24)return;this.hazards.push(h);this.emit(h.kind==='sweep'?'sweepWarning':'pillarWarning',{x:h.x,y:h.kind==='sweep'?h.y:D.FLOOR});}
    updateBoss(e,dt){
      const phase=e.hp/e.maxHp<.45?2:1,t=e.age;
      if(phase===2&&!e.enraged){e.enraged=true;e.phaseTimer=1.2;e.shoot=['oblivion','reliquary'].includes(e.behavior)?2.2:Math.max(e.shoot,1.55);this.hostile=[];this.hazards=[];e.echoTimer=0;e.gap=null;e.route=null;e.gapRelease=0;this.emit('bossPhase',{x:e.x,y:e.y,name:e.name});}
      e.x+=((480+Math.sin(t*.58)*(e.behavior==='oblivion'?160:240))-e.x)*dt*1.2;e.y+=((155+Math.sin(t*.86)*22)-e.y)*dt*1.5;
      if(e.phaseTimer>0){e.phaseTimer=Math.max(0,e.phaseTimer-dt);e.cast=.3;return;}
      if(e.behavior==='oblivion'){this.updateOblivion(e,dt,phase);return;}
      if(e.behavior==='reliquary'){this.updateReliquary(e,phase);return;}
      if(e.shoot>0)return;e.cast=.3;e.shoot=(phase===2?1.1:1.8)/Math.min(2,1+Math.max(0,this.wave-32)*.015);e.attack=(e.attack||0)+1;
      if(e.behavior==='bishop'){this.fan(e,5+phase*2,120,.19);if(e.attack%3===0)this.ring(e,12,82,t*.3);}
      if(e.behavior==='butcher'){
        const blade=this.enemyMuzzle(e);this.emit('cleave',{x:blade.x,y:blade.y,r:64,hostile:true});
        this.fan(e,3,145,.3);const x=clamp(this.p.x,80,880);this.addHazard({kind:'pillar',enemy:e.kind,x,y:300,r:32,delay:1,life:1.6,active:false});
        if(phase===2)this.addHazard({kind:'pillar',enemy:e.kind,x:960-x,y:300,r:30,delay:1.2,life:1.8,active:false});
      }
      if(e.behavior==='choir'){this.ring(e,14+phase*4,105,t*.3);if(e.attack%3===0)this.spawn(1,false,e.x,e.y+40);}
      if(e.behavior==='god'){
        this.ring(e,12+phase*4,95,t*.22);this.fan(e,5,150,.15);
        if(e.attack%2===0){const x=this.range(70,890);this.addHazard({kind:'pillar',enemy:e.kind,x,y:300,r:45,delay:1.1,life:1.9,active:false});}
        if(e.attack%5===0)this.spawn(3,false,e.x,e.y+50);
      }
      this.emit('enemyShot',{x:e.x,y:e.y});
    }
    bellRoute(e){
      const from=this.enemyMuzzle(e),target=e.gap;
      if(!target)return null;
      return{...from,angle:Math.atan2(D.FLOOR-22-from.y,target.x-from.x),width:target.width,targetX:target.x};
    }
    bellPulse(e,phase){
      const route=this.bellRoute(e);if(!route)return;
      // 予告と発射を同じ射出点・角度から計算し、鐘の移動や被弾中にも抜け道を一致させる。
      const count=phase===2?26:22;
      for(let i=0;i<count;i++){const delta=i*Math.PI*2/count,wrapped=Math.min(delta,Math.PI*2-delta);if(wrapped<=route.width/2)continue;this.enemyShot(e,route.angle+delta,phase===2?145:130,{life:6});}
      e.route={...route,life:2.15};e.cast=.3;this.emit('bellPulse',{x:route.x,y:route.y});
    }
    updateReliquary(e,phase){
      if(e.shoot>0)return;e.cast=.3;e.attack=(e.attack||0)+1;e.shoot=phase===2?3.7:4.3;
      if(e.attack%2){this.fan(e,phase===2?7:5,128,.23);this.emit('enemyShot',this.enemyMuzzle(e));return;}
      // 予告した高さを追尾させず、跳躍・落下で離れられる帯へ固定する。
      const y=clamp(this.p.y,110,D.FLOOR-22),ys=phase===2?[y,y>260?y-110:y+110]:[y];
      ys.forEach((at,i)=>{const delay=1.15+i*.4;this.addHazard({kind:'sweep',enemy:e.kind,x:480,y:at,r:12,delay,startDelay:delay,duration:.34,life:delay+.34+.28,active:false});});
    }
    updateOblivion(e,dt,phase){
      if(e.route)e.route.life-=dt;
      if(e.gapRelease>0){e.gapRelease-=dt;if(e.gapRelease<=0)e.gap=null;}
      if(e.echoTimer>0){e.echoTimer-=dt;if(e.echoTimer<=0)this.bellPulse(e,phase);}
      if(e.shoot<=.95&&!e.gap){e.gap={x:clamp(this.p.x+((e.attack||0)%2?-110:110),230,730),width:phase===2?.64:.78};this.emit('bellWarning',{x:e.x,y:e.y});}
      if(e.shoot>0)return;
      e.attack=(e.attack||0)+1;this.bellPulse(e,phase);
      if(e.attack%3===0)e.echoTimer=.42;
      // 音紋が床を通過してから次の予告へ移る。二重音紋でも移動時間を残す。
      e.shoot=phase===2?3.2:3.65;e.gapRelease=e.echoTimer>0?.5:.05;
      if(phase===2&&e.attack%4===0)for(const x of [120,840])this.addHazard({kind:'pillar',enemy:e.kind,x,y:300,r:30,delay:1.15,life:1.9,active:false});
    }
    updateSkills(dt){
      this.updateRituals(dt);
      const s=this.stats,p=this.p;for(const k of Object.keys(this.timers))this.timers[k]-=dt;
      if(s.lightning&&this.timers.lightning<=0){
        this.timers.lightning=3*s.cooldown*(this.has('tempest')?.5:1);const hit=new Set();let from={x:p.x,y:p.y};
        for(let i=0;i<1+s.chain;i++){const e=this.nearest(from,hit);if(!e)break;hit.add(e.id);if(this.hasResonance('requiem')){e.requiem=2;this.emit('resonance',{id:'requiem',x:e.x,y:e.y});}this.emit('lightning',{x:from.x,y:from.y,tx:e.x,ty:e.y});this.hurtEnemy(e,this.damageValue()*s.lightning*1.6*Math.pow(.86,i),'lightning');from=e;}
        if(this.has('tempest'))this.hostile=this.hostile.filter(b=>!this.enemies.some(e=>hit.has(e.id)&&distance(e,b)<85));
      }
      if(s.familiar&&this.timers.familiar<=0){
        this.timers.familiar=1.15;const targets=this.enemies.filter(e=>!e.dead).sort((a,b)=>(this.hasResonance('requiem')?Number(b.requiem>0)-Number(a.requiem>0):0)||distance(p,a)-distance(p,b));
        // 複数の亡霊が一体へ過剰射撃しないよう、近い敵から分担する。
        for(let i=0;i<s.familiar&&targets.length;i++){const a=this.time*1.4+i*6.28/s.familiar,from={x:p.x+Math.cos(a)*52,y:p.y-24+Math.sin(a)*28},target=targets[i%targets.length];this.shoot(from.x,from.y,Math.atan2(target.y-from.y,target.x-from.x),this.damageValue()*.65*(this.has('choir')?1.5:1),{main:false,damageSource:'familiar',sprite:4,pierce:this.has('choir')?3:0,color:'#cab1f4',homing:3,r:3,life:3,targetId:target.id});}
      }
      if(s.void&&this.timers.void<=0){this.timers.void=4*s.cooldown;const e=this.nearest(p);if(e){const r=(55+s.gravity*30)*(this.has('eclipse')?2:1);this.addField({x:e.x,y:e.y,r,life:1.8,tick:0,kind:'void',damage:this.damageValue()*s.void*(this.has('eclipse')?3:1),pull:s.gravity});this.emit('burst',{x:e.x,y:e.y,r,row:3});}}
      if(s.cleave&&this.timers.cleave<=0){this.timers.cleave=2.5*s.cooldown;const r=this.has('butcher')?250:125;let struck=false;this.emit('cleave',{x:p.x,y:p.y,r});for(const e of this.enemies)if(!e.dead&&distance(p,e)<r+e.r){struck=true;this.hurtEnemy(e,this.damageValue()*s.cleave*2*(this.has('butcher')?3:1),'cleave');}
        if(struck&&this.hasResonance('boneMass')){this.emit('resonance',{id:'boneMass',x:p.x,y:p.y-60});for(let i=0;i<6;i++)this.shoot(p.x,p.y-16,-Math.PI*.9+i*Math.PI*.8/5,this.damageValue()*.5,{main:false,damageSource:'shard',sprite:1,pierce:2,bounce:0,homing:0,life:1.8,r:3,speed:650,color:'#eee0cc'});}
      }
      if(s.barrier&&this.timers.barrier<=0){this.timers.barrier=8;p.shield=Math.min(s.barrier*12,p.shield+s.barrier*6);this.emit('shield',{x:p.x,y:p.y});}
    }
    movePlayer(dt,input={},combat=false){
      const p=this.p,s=this.stats;
      let move=clamp(finite(input.move),-1,1);
      // 着地直前の押下を短く保持し、空中回数を使い切った境目でも操作を取りこぼさない。
      p.jumpBuffer=input.jump?.12:Math.max(0,(p.jumpBuffer||0)-dt);
      if(p.jumpBuffer>0&&p.jumps<s.jumps){p.jumpBuffer=0;p.vy=-s.jump;p.jumps++;p.grounded=false;this.emit('jump',{x:p.x,y:p.y});}
      if(input.dash&&p.dashCD<=0){p.dashCD=s.dashCD;p.dashTime=.18;p.invuln=Math.max(p.invuln,s.dashInv);p.dashDir=move?Math.sign(move):p.facing;this.emit('dash',{x:p.x,y:p.y});}
      if(combat&&input.ultimate)this.ultimate();
      if(p.dashTime>0){p.dashTime-=dt;p.vx=p.dashDir*700;p.vy*=.6;}else{p.vx+=(move*s.speed-p.vx)*Math.min(1,dt*18);p.vy+=1050*dt;}
      // 長衣と杖の絵が壁や天井で切れないだけの余白を確保する。
      p.x=clamp(p.x+p.vx*dt,38,922);p.y+=p.vy*dt;
      if(p.y>=D.FLOOR-22){p.y=D.FLOOR-22;p.vy=0;p.jumps=0;p.grounded=true;}else p.grounded=false;
      if(p.y<65){p.y=65;p.vy=Math.max(0,p.vy);}
      return move;
    }
    updateClearing(dt,input){
      // 撃破の余韻中も身体と弾は動かす。戦闘時計・回復・抽選・攻撃判定は進めない。
      this.clearElapsed+=dt;this.clearTimer-=dt;this.p.invuln=Math.max(0,this.p.invuln-dt);this.p.dashCD=Math.max(0,this.p.dashCD-dt);
      const move=this.movePlayer(dt,input);if(move)this.p.facing=move>0?1:-1;
      for(const b of this.bullets){b.life-=dt;if(b.life>0)moveProjectile(b,dt);}
      this.bullets=this.bullets.filter(b=>b.life>0&&b.x>-40&&b.x<1000&&b.y>-40&&b.y<560);
      for(const f of this.fields)f.life-=dt;this.fields=this.fields.filter(f=>f.life>0);
      // 回復片は報酬画面で回収するため、落下だけ続けて有効期限を減らさない。
      for(const v of this.pickups){v.vy+=200*dt;v.y=Math.min(D.FLOOR-8,v.y+v.vy*dt);}
      if(this.clearTimer<=0)this.completeWave();
    }
    update(dt,input={}){
      if(this.state==='clearing'){this.updateClearing(clamp(finite(dt),0,.05),input);return;}
      if(this.state!=='playing')return;dt=clamp(finite(dt),0,.05);this.time+=dt;this.waveTime+=dt;const p=this.p,s=this.stats;
      
      this.intro=Math.max(0,this.intro-dt);p.invuln=Math.max(0,p.invuln-dt);p.dashCD=Math.max(0,p.dashCD-dt);p.shotCD-=dt;p.hp=Math.min(s.hp,p.hp+s.regen*dt);
      const playerX=p.x,playerY=p.y,move=this.movePlayer(dt,input,true);
      // 射撃の瞬間だけ向きを変えると左右へ点滅する。照準方向を毎フレーム同じ規則で決める。
      const aim=input.fire?(input.autoAim?this.nearest(p):{x:finite(input.aimX,p.x)}):null;
      if(aim&&Math.abs(aim.x-p.x)>16)p.facing=aim.x>p.x?1:-1;else if(!aim&&move)p.facing=move>0?1:-1;
      if(this.intro>0)return;
      this.spawnTimer-=dt;
      if(this.spawnLeft>0&&this.spawnTimer<=0){this.spawnWaveEnemy();this.spawnLeft--;this.spawnTimer=Math.max(.22,.62-this.wave*.012);}
      if(this.wave%8===0&&!this.bossSpawned){this.bossSpawned=true;this.spawn(D.bosses.indexOf(D.bossForWave(this.wave)),true);}
      if(input.fire&&p.shotCD<=0&&this.fire(input))p.shotCD=1/s.rate;
      this.updateSkills(dt);for(const e of this.enemies){e.collisionX=e.x;e.collisionY=e.y;}this.updateEnemies(dt);if(this.state==='dead')return;
      for(const b of this.bullets){
        b.life-=dt;if(b.life<=0)continue;if(b.homing){const e=this.enemies.find(e=>e.id===b.targetId&&!e.dead&&!b.hitIds.has(e.id))||this.nearest(b,b.hitIds);if(e){const speed=Math.hypot(b.vx,b.vy),a=Math.atan2(e.y-b.y,e.x-b.x),k=Math.min(1,dt*b.homing*2.5);b.vx+=(Math.cos(a)*speed-b.vx)*k;b.vy+=(Math.sin(a)*speed-b.vy)*k;}}
        const path=moveProjectile(b,dt),impacts=[];
        for(const e of this.enemies){
          if(e.dead||b.hitIds.has(e.id))continue;const ex=e.collisionX??e.x,ey=e.collisionY??e.y,dx=e.x-ex,dy=e.y-ey;
          for(const part of path){const hit=segmentHit(part.x0-ex-dx*part.t0,part.y0-ey-dy*part.t0,part.x1-ex-dx*part.t1,part.y1-ey-dy*part.t1,0,0,b.r+e.r);if(hit!==null){impacts.push({e,t:part.t0+(part.t1-part.t0)*hit});break;}}
        }
        impacts.sort((a,b)=>a.t-b.t||a.e.id-b.e.id);
        for(const {e}of impacts){if(e.dead)continue;b.hitIds.add(e.id);this.hurtEnemy(e,b.damage,b.main?'main':'shard',b.damageSource||(b.main?'main':'shard'));
          if(b.main&&s.split){for(let i=0;i<2+(this.has('ossuary')?2:0);i++)this.shoot(e.x,e.y,this.range(-Math.PI,Math.PI),this.damageValue()*s.split*.18,{main:false,sprite:1,pierce:0,bounce:0,homing:1,life:.65,r:2,color:'#f6dfb5'});}
          if(b.pierce--<=0){b.life=0;break;}
        }
      }
      for(const b of this.hostile){b.life-=dt;if(b.life<=0)continue;const fromX=b.x-playerX,fromY=b.y-playerY;b.x+=b.vx*dt;b.y+=b.vy*dt;if(segmentHit(fromX,fromY,b.x-p.x,b.y-p.y,0,0,b.r+p.r)!==null){this.hurtPlayer(b.damage,{kind:'bullet',enemy:b.enemy});b.life=0;if(this.state==='dead')return;}}
      for(const f of this.fields){
        f.life-=dt;if(f.life<=0)continue;f.tick-=dt;
        if(f.kind==='void'){
          for(const e of this.enemies)if(!e.dead&&distance(f,e)<f.r&&!e.boss){e.x+=(f.x-e.x)*dt*(.6+f.pull*.3);e.y+=(f.y-e.y)*dt*(.6+f.pull*.3);}
          if(this.has('eclipse'))this.hostile=this.hostile.filter(b=>distance(b,f)>f.r*.7);
        }
        if(f.tick<=0){f.tick=.35;for(const e of this.enemies)if(!e.dead&&distance(f,e)<f.r+e.r){if(f.kind==='void'&&this.hasResonance('rotMoon'))e.poison=Math.min(s.poison*5,e.poison+s.poison);this.hurtEnemy(e,f.damage*.35,'dot',f.source||(f.kind==='void'?'void':'dot'));}}
      }
      for(const h of this.hazards){h.delay-=dt;h.life-=dt;if(h.life<=0)continue;const sweep=h.kind==='sweep',wasActive=h.active;h.active=h.delay<=0&&(!sweep||h.delay>-h.duration);if(h.active&&!wasActive)this.emit(sweep?'sweepErupt':'pillarErupt',{x:h.x,y:sweep?h.y:D.FLOOR});if(h.active&&(sweep?Math.abs(p.y-h.y):Math.abs(p.x-h.x))<h.r+p.r){this.hurtPlayer(sweep?24+this.wave*.3:22+this.wave*.6,{kind:sweep?'beam':'pillar',enemy:h.enemy});if(this.state==='dead')return;}}
      for(const v of this.pickups){v.life-=dt;if(v.life<=0)continue;v.vy+=200*dt;v.y=Math.min(D.FLOOR-8,v.y+v.vy*dt);const d=distance(v,p),wanted=v.souls>0||p.hp<s.hp;if(d<s.magnet&&wanted){v.x+=(p.x-v.x)*dt*8;v.y+=(p.y-v.y)*dt*8;}if(d<22&&wanted){v.life=0;if(v.souls>0){this.souls+=v.souls;this.emit('ash',{x:p.x,y:p.y,n:v.souls});}else{const healed=Math.min(s.hp-p.hp,v.heal);p.hp+=healed;this.emit('heal',{x:p.x,y:p.y,n:Math.round(healed)});}}}
      this.collideBullets();
      this.bullets=this.bullets.filter(b=>b.life>0&&b.x>-40&&b.x<1000&&b.y>-40&&b.y<560);this.hostile=this.hostile.filter(b=>b.life>0&&b.x>-60&&b.x<1020&&b.y>-60&&b.y<570);this.enemies=this.enemies.filter(e=>!e.dead);this.fields=this.fields.filter(f=>f.life>0);this.hazards=this.hazards.filter(h=>h.life>0);this.pickups=this.pickups.filter(p=>p.life>0);
      if(this.state==='playing'&&this.spawnLeft===0&&this.enemies.length===0&&(this.wave%8!==0||this.bossSpawned)){this.state='clearing';this.clearElapsed=0;this.clearTimer=this.wave%8===0?1.6:.75;this.hostile=[];this.hazards=[];}
    }
    checkpoint(){
      if(this.training)return null;
      // 波の冒頭と選択画面だけを保存する。飛翔中の弾を復元して不意打ちを作らない。
      return{enemyKills:{...this.enemyKills},lastHit:this.lastHit?{...this.lastHit}:null,reliquaryKills:this.reliquaryKills,secretKills:this.secretKills,crownKills:this.crownKills,damageTally:{...this.damageTally},waveReport:this.waveReport?{...this.waveReport}:null,covenants:[...this.covenants],covenantChoices:[...this.covenantChoices],oathWave:this.oathWave,version:1,id:this.id,endless:this.endless,seed:this.seed,rng:this.rng,offerRng:this.offerRng,difficulty:this.difficulty,weapon:this.weapon.id,mask:this.mask.id,meta:{...this.meta},stacks:{...this.stacks},evolved:[...this.evolved],banned:[...this.banned],rerolls:this.rerolls,banishes:this.banishes,time:this.time,kills:this.kills,souls:this.souls,completed:this.completed,growth:this.growth,rebirths:this.rebirths,revivesUsed:this.revivesUsed,flawless:this.flawless,charge:this.charge,wave:this.wave,state:this.state,choices:[...this.choices],hp:this.p.hp,shield:this.p.shield};
    }
    static restore(c){
      if(c?.training)return null;
      if(!c||c.version!==1||!['playing','upgrade','victory'].includes(c.state)||!Number.isInteger(c.wave)||c.wave<1||c.wave>100000||typeof c.id!=='string')return null;
      if(!D.weapons.some(w=>w.id===c.weapon)||!D.masks.some(m=>m.id===c.mask))return null;
      const r=new Run(c);r.enemyKills=normalizeEnemyKills(c.enemyKills);r.lastHit=normalizeRecord({wave:c.wave,lastHit:c.lastHit}).lastHit;r.damageTally=normalizeDamage(c.damageTally);r.stacks={};for(const i of D.items){const n=clamp(Math.floor(finite(c.stacks?.[i.id])),0,i.max);if(n)r.stacks[i.id]=n;}
      r.covenants=Array.isArray(c.covenants)?[...new Set(c.covenants.filter(id=>D.covenants.some(d=>d.id===id)))]:[];r.covenantChoices=Array.isArray(c.covenantChoices)?[...new Set(c.covenantChoices.filter(id=>D.covenants.some(d=>d.id===id)))]:[];r.oathWave=clamp(finite(c.oathWave),0,c.wave);
      r.evolved=Array.isArray(c.evolved)?[...new Set(c.evolved.filter(id=>D.evolutions.some(e=>e.id===id)))]:[];r.banned=Array.isArray(c.banned)?[...new Set(c.banned.filter(id=>D.items.some(i=>i.id===id)))]:[];
      for(const k of ['rerolls','banishes','time','kills','souls','completed','growth','rebirths','revivesUsed','flawless','charge','secretKills','crownKills','reliquaryKills'])r[k]=clamp(finite(c[k]),0,1e12);
      r.stats=r.computeStats();r.beginWave(c.wave);r.p.hp=clamp(finite(c.hp,r.stats.hp),1,r.stats.hp);r.p.shield=clamp(finite(c.shield),0,48);r.rng=c.rng>>>0;r.offerRng=finite(c.offerRng,r.offerRng)>>>0;r.state=c.state;if(c.waveReport)r.waveReport={souls:Math.max(0,finite(c.waveReport.souls)),heal:Math.max(0,finite(c.waveReport.heal)),flawless:!!c.waveReport.flawless};
      if(c.state==='upgrade'){r.choices=Array.isArray(c.choices)?c.choices.filter(id=>id==='communion'||(lookup[id]&&!r.banned.includes(id))):[];if(!r.choices.length)r.choices=r.drawChoices();}
      return r;
    }
  }
  return{Run,freshProfile,normalizeProfile,normalizeRecord,settle,purchase,awardAchievements,hash,clamp,lookup};
});
