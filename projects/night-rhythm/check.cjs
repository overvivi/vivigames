const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const {GAMES,SHIFTS,RECORD_KEYS,stampAwards,Session,makeChart,validateChart,WINDOW,PERFECT}=require('./source/core.js');
let checks=0;function ok(v,msg){assert(v,msg);checks++;}
for(const id of Object.keys(GAMES))for(const practice of [false,true]){
 const c=makeChart(id,practice);ok(validateChart(c),'valid chart');const spb=60/c.game.bpm;
 const s=new Session(c);for(const n of c.notes){const r=s.input(n.kind,n.beat);ok(r?.grade==='perfect',id+' full correct '+n.id);s.advance(n.beat);}
 s.advance(c.duration+1);ok(s.stats().score===100,'full score');ok(s.stats().miss===0,'no miss');
 const silent=new Session(c);silent.advance(c.duration+1);ok(silent.stats().miss===c.notes.length,'all missed');ok(silent.stats().score===0,'zero score');
 // 高速2連打では隣の音の判定域に入るため、単音の境界検査は対象音を分離する。
 const first=c.notes[0];for(const sign of [-1,1])for(const delta of [0,PERFECT-.0001,PERFECT+.0001,WINDOW-.0001,WINDOW+.0001]){const trial=new Session({...c,notes:[first]}),r=trial.input('down',first.beat+sign*delta/spb);ok(delta>WINDOW?r?.grade!=='perfect'&&r?.grade!=='good':r?.grade===(delta<=PERFECT?'perfect':'good'),'window boundary');}
 const spam=new Session(c);for(let b=0;b<c.duration;b+=.07){spam.input('down',b);spam.input('up',b+.01);spam.advance(b+.01);}spam.advance(c.duration+1);ok(spam.stats().score<65,'spam cannot win '+id);
 const replay=new Session(c);const boundary=c.game.phrase*(practice?1:4);for(const n of c.notes)replay.input(n.kind,n.beat);replay.rewind(boundary);ok([...replay.results.values()].every(r=>r.beat<boundary),'rewind results');for(const n of c.notes.filter(n=>n.beat>=boundary))replay.input(n.kind,n.beat);ok(replay.stats().score===100,'rewind perfect');
 ok(c.cues.every(e=>Number.isFinite(e.beat)&&e.beat<c.duration),'cue range');
 if(id==='soda'){
  const bad=new Session(c),down=c.notes[0],up=c.notes[1];ok(bad.input('up',up.beat)===null,'orphan release ignored');bad.input('down',down.beat);ok(bad.input('down',down.beat+.1)===null,'held down duplicate');ok(bad.input('up',down.beat+.3)?.grade==='miss','early release fails');ok(bad.input('up',up.beat)===null,'early release cannot score again');
 }
}
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
ok(html.trimEnd().endsWith('</html>'),'HTML end');ok(!/@@\w+@@/.test(html),'no placeholders');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];ok(scripts.length===3,'three scripts');for(const m of scripts){new vm.Script(m[1]);checks++;}
const images=[...html.matchAll(/src="data:image\/webp;base64,([^"]+)"/g)];ok(images.length===6,'six embedded stage images');for(const m of images){const b=Buffer.from(m[1],'base64');ok(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP','valid webp');}
ok(!/<(?:script|link)[^>]+(?:src|href)="https?:/.test(html),'no external scripts/styles');
// 音源を生成せず予約を記録し、曲ごとの伴奏と合図が全区間に存在することを検査する。
const sandbox={window:{},console};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'source/audio.js'),'utf8'),sandbox);
for(const key of RECORD_KEYS){
 const id=key.replace('-shift',''),a=new sandbox.window.RhythmAudio();a.chart=makeChart(id,false,key.endsWith('-shift'));a.bpm=a.chart.game.bpm;const events=[];
 for(const name of ['tone','noiseHit','keys','pluck','bass','kick','snare','hat','chime'])a[name]=(...args)=>events.push({name,args});
 for(let step=0;step<a.chart.duration*4;step++)a.composition(step,step/4*60/a.bpm);
 ok(events.length>400,'musical arrangement '+id);ok(events.every(e=>e.args.every(x=>typeof x!=='number'||Number.isFinite(x))),'finite audio '+id);
 const barCount=a.chart.duration/4;for(let bar=0;bar<barCount;bar++){const start=events.length;for(let k=0;k<16;k++)a.composition(bar*16+k,(bar*4+k/4)*60/a.bpm);const quiet=a.chart.quiet&&bar*4>=a.chart.quiet.from&&bar*4<a.chart.quiet.to;ok(quiet?events.length===start:events.length-start>8,quiet?'silent accompaniment':'nonempty bar '+id);}
 for(const c of a.chart.cues)a.cue(c,c.beat*60/a.bpm);ok(events.some(e=>e.name==='chime'||e.name==='tone'),'cue synth');
}
const remix=makeChart('remix');
ok(remix.game.bpm>Math.max(GAMES.mail.bpm,GAMES.soda.bpm,GAMES.moon.bpm),'remix faster');
ok(new Set(remix.sections.map(s=>s.mode)).size===3,'all mechanics mixed');
ok(remix.sections.some(s=>s.hold===1)&&remix.sections.some(s=>s.hold===3),'short and long holds');
ok(remix.sections.some(s=>s.pattern?.length>=5),'dense echo pattern');
for(const s of remix.sections){
 ok(remix.cues.some(c=>c.type==='switch'&&c.section===s.index&&c.beat===s.beat-1),'advance switch cue');
 ok(remix.notes.filter(n=>n.section===s.index).every(n=>n.beat>=s.beat&&n.beat<s.end),'notes stay within mode');
 const test=new Session(remix);for(const n of remix.notes)test.input(n.kind,n.beat);test.rewind(s.beat);for(const n of remix.notes.filter(n=>n.beat>=s.beat))test.input(n.kind,n.beat);ok(test.stats().score===100,'every remix resume boundary');
}
for(const id of Object.keys(SHIFTS))for(const practice of [false,true]){
 const c=makeChart(id,practice,true),s=new Session(c);ok(validateChart(c),'shift chart');ok(c.game.bpm!==GAMES[id].bpm,'shift tempo');
 ok(JSON.stringify(c.notes)!==JSON.stringify(makeChart(id,practice).notes),'shift changes pattern');for(const n of c.notes)s.input(n.kind,n.beat);s.advance(c.duration+1);ok(s.stats().score===100,'shift full correct');
 ok(c.demos.every((d,i)=>!i||d.beat>=c.demos[i-1].beat),'sorted shift demos');
}
for(const [score,expected] of [[0,[false,false,false]],[64,[false,false,false]],[65,[true,false,false]],[84,[true,false,false]],[85,[true,true,false]]])ok(JSON.stringify(stampAwards({score,total:10,perfect:5,good:4,miss:1,extras:0}))===JSON.stringify(expected),'stamp threshold');
ok(stampAwards({score:100,total:10,perfect:10,good:0,miss:0,extras:0}).every(Boolean),'all three stamps');
ok(!stampAwards({score:100,total:10,perfect:10,good:0,miss:0,extras:1})[2],'extra blocks no miss');
for(const id of Object.keys(GAMES)){ok(makeChart(id).sections.at(-1).grand,'every game has finale');ok(!makeChart(id,true).sections.some(s=>s.grand),'practice has no finale');}
console.log('PASS '+checks+' checks: 10 courses / timing / holds / stamps / 7 arrangements / quiet bridge / finales / embedded art');
