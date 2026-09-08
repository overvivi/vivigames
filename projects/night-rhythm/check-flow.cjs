const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const core=require('./source/core.js');
let checks=0;
function ok(value,message){assert(value,message);checks++;}
// 実際のイベント入口から曲を最後まで進め、画面遷移と入力の接続を検証する。
// 時刻だけを制御し、採点処理は製品版をそのまま使う。
function fixture(stored='{}'){
 let now=0,serial=0;const frames=new Map(),elements=new Map(),events={},hits=[],storage=new Map([['nightRhythmBests_v1',stored]]);
 class Element{
  constructor(id){this.id=id;this.hidden=false;this.open=false;this.dataset={};this.style={};this.listeners={};this.textContent='';this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(k,f){(this.listeners[k]??=[]).push(f);}
  async fire(k,extra={}){for(const fn of this.listeners[k]||[])await fn({target:this,currentTarget:this,button:0,pointerId:1,timeStamp:now,preventDefault(){},...extra});}
  showModal(){this.open=true;}close(){this.open=false;this.fire('close');}
  getBoundingClientRect(){return {width:370,height:400};}setPointerCapture(){}
  getContext(){const gradient={addColorStop(){}};return new Proxy({},{get:(_,k)=>k==='createLinearGradient'?()=>gradient:(...args)=>{assert(args.every(x=>typeof x!=='number'||Number.isFinite(x)),'finite Canvas '+k);},set:()=>true});}
 }
 const el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 const cards=Object.keys(core.GAMES).map(id=>{const e=el('card-'+id);e.dataset.game=id;e.closest=()=>({querySelector:()=>({src:id+'.webp'})});return e;});
 const bestNodes=Object.keys(core.GAMES).map(id=>{const e=el('best-'+id);e.dataset.best=id;return e;});
 const document={getElementById:el,hidden:false,addEventListener:(k,f)=>events[k]=f,
  querySelector:s=>s==='dialog[open]'?[...elements.values()].find(e=>e.open):null,
  querySelectorAll:s=>s==='[data-game]'?cards:s==='[data-best]'?bestNodes:s==='dialog[open]'?[...elements.values()].filter(e=>e.open):s==='.beat-dots i'?[0,1,2,3].map(i=>el('dot'+i)):[]};
 class Audio{
  constructor(){this.ctx={state:'running',currentTime:0};this.active=false;}
  async unlock(){}setVolume(){}stop(){this.active=false;}hit(id,kind){hits.push({id,kind});}miss(){}finish(){}chime(){}keys(){}
  start(chart,start){this.chart=chart;this.origin=now+(4-start)*60000/chart.game.bpm;this.active=true;}
  beat(t=now,offset=0){return (t-this.origin-offset)/(60000/this.chart.game.bpm);}
  outputTime(t){return t/1000;}
 }
 const window={devicePixelRatio:1,scrollTo(){},addEventListener:(k,f)=>events[k]=f};
 const context={RhythmCore:core,RhythmAudio:Audio,window,document,location:{search:'?debug=1'},URLSearchParams,AbortController,performance:{now:()=>now},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout:()=>++serial,clearTimeout(){},requestAnimationFrame:f=>{frames.set(++serial,f);return serial;},cancelAnimationFrame:id=>frames.delete(id),console};
 vm.runInNewContext(fs.readFileSync(__dirname+'/source/app.js','utf8'),context);
 function tick(t){now=t;const work=[...frames.values()];frames.clear();for(const fn of work)fn(now);}
 return {el,events,document,storage,hits,debug:window.__nightRhythmDebug,
  tickBeat(b,bpm,start=0,origin=0){tick(origin+(b+4-start)*60000/bpm);},
  pointer:kind=>el('tapPad').fire(kind),clock:()=>now};
}
(async()=>{
 for(const id of Object.keys(core.GAMES)){
  const f=fixture('"old-format"'),g=core.GAMES[id];f.debug.select(id);await f.el('startButton').fire('click');
  ok(f.debug.getState().state==='running',id+' starts');const chart=core.makeChart(id);
  for(const n of chart.notes){f.tickBeat(n.beat,g.bpm);await f.pointer(n.kind==='down'?'pointerdown':'pointerup');if(n.holdId===null)await f.pointer('pointerup');f.tickBeat(n.beat+.02,g.bpm);}
  f.tickBeat(chart.duration+1,g.bpm);ok(f.debug.getState().state==='result',id+' completes');
  ok(f.el('resultScore').textContent===100,id+' pointer perfect');ok(JSON.parse(f.storage.get('nightRhythmBests_v1'))[id]===100,id+' best saved');
  ok(f.hits.length===chart.notes.length&&f.hits.every((h,i)=>h.id===(chart.sections[chart.notes[i].section].mode||id)),id+' correct instrument per input');
  ok(JSON.parse(f.storage.get('nightRhythmStamps_v1'))[id].every(Boolean),id+' earns all stamps');
  await f.el('nextButton').fire('click');ok(f.debug.getState().state==='brief',id+' next game');
  f.debug.select(id);await f.el('practiceButton').fire('click');const origin=f.clock();
  f.tickBeat(core.makeChart(id,true).duration+1,g.bpm,0,origin);ok(f.debug.getState().state==='brief',id+' practice completes');
  ok(f.el('briefType').textContent.includes('おつかれさま'),id+' practice feedback');
 }
 const f=fixture(),g=core.GAMES.soda;f.debug.select('soda');await f.el('startButton').fire('click');
 f.tickBeat(2,g.bpm);await f.pointer('pointerdown');ok(f.debug.getState().pressed,'hold begins');
 f.tickBeat(3,g.bpm);await f.pointer('pointerup');ok(f.debug.getState().stats.miss===1,'early release misses');
 f.tickBeat(10,g.bpm);await f.pointer('pointerdown');await f.pointer('pointercancel');
 ok(f.debug.getState().state==='paused'&&!f.debug.getState().pressed,'cancel pauses and clears hold');
 const at=f.clock();await f.el('resumeButton').fire('click');ok(f.debug.getState().rewindBeat===8,'phrase rewind');
 f.tickBeat(10,g.bpm,8,at);await f.pointer('pointerdown');f.tickBeat(12,g.bpm,8,at);await f.pointer('pointerup');
 ok(f.debug.getState().stats.perfect===3,'replayed hold scores once');
 f.document.hidden=true;f.events.visibilitychange();ok(f.debug.getState().state==='paused','background pauses');
 await f.el('pauseMenu').fire('click');ok(f.debug.getState().state==='menu','pause menu');
 const keys=fixture();keys.debug.select('mail');await keys.el('startButton').fire('click');keys.tickBeat(3,112);
 keys.events.keydown({code:'Space',repeat:false,preventDefault(){}});keys.events.keydown({code:'Space',repeat:true,preventDefault(){}});keys.events.keyup({code:'Space',preventDefault(){}});
 ok(keys.debug.getState().stats.perfect===1&&!keys.debug.getState().pressed,'keyboard and repeat guard');
 const race=fixture();race.debug.select('mail');const pending=race.el('startButton').fire('click');await race.el('homeButton').fire('click');await pending;
 ok(race.debug.getState().state==='menu','pending audio unlock cannot reopen a departed game');
 const offset=fixture();offset.debug.select('mail');offset.el('offset').value=100;await offset.el('offset').fire('input');await offset.el('startButton').fire('click');offset.tickBeat(3+.1/(60/112),112);await offset.pointer('pointerdown');
 ok(offset.debug.getState().stats.perfect===1,'positive offset compensates late input');
 const mix=fixture(),mc=core.makeChart('remix');mix.debug.select('remix');await mix.el('startButton').fire('click');
 const moon=mc.sections.find(s=>s.mode==='moon');mix.tickBeat(moon.beat+5,mc.game.bpm);await mix.el('pauseButton').fire('click');
 ok(mix.debug.getState().rewindBeat===moon.beat,'remix rewinds whole echo, including teacher');
 await mix.el('resumeButton').fire('click');
 ok(mix.debug.getState().state==='running','remix resumes');
 for(const id of Object.keys(core.SHIFTS)){
  const shift=fixture();shift.debug.select(id);await shift.el('shiftButton').fire('click');ok(shift.el('gameTitle').textContent===core.SHIFTS[id].name,'shift title');await shift.el('startButton').fire('click');const chart=core.makeChart(id,false,true);
  for(const n of chart.notes){shift.tickBeat(n.beat,chart.game.bpm);await shift.pointer(n.kind==='down'?'pointerdown':'pointerup');if(n.holdId===null)await shift.pointer('pointerup');}shift.tickBeat(chart.duration+1,chart.game.bpm);
  ok(shift.el('resultScore').textContent===100,'shift pointer performance');const bests=JSON.parse(shift.storage.get('nightRhythmBests_v1'));ok(bests[id+'-shift']===100&&bests[id]===undefined,'shift best separate');
  await shift.el('retryButton').fire('click');ok(!shift.el('resultStamps').textContent,'clear reward before replay');
  await shift.el('homeButton').fire('click');shift.debug.select(id);await shift.el('shiftButton').fire('click');await shift.el('practiceButton').fire('click');const origin=shift.clock();shift.tickBeat(core.makeChart(id,true,true).duration+1,chart.game.bpm,0,origin);ok(shift.el('briefType').textContent.includes('おつかれさま'),'shift practice completion');
 }
 const silent=fixture();silent.debug.select('ghost');await silent.el('startButton').fire('click');silent.tickBeat(core.makeChart('ghost').duration+1,110);ok(JSON.parse(silent.storage.get('nightRhythmStamps_v1')).ghost.every(v=>!v),'no awards for silent play');
 const migration=fixture('{"mail":87,"moon":100}');ok(migration.el('stampTotal').textContent==='4 / 30','old scores migrate without assuming no miss');
 console.log('PASS '+checks+' app flow checks: 10 courses / practice / save / stamps / hold / cancel / resume / keyboard / offset / shift selection');
})().catch(e=>{console.error(e);process.exitCode=1;});
