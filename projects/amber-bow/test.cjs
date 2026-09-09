const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const E=require('./source/engine.js');
test('引っぱりは逆向きの射角になり、携帯とPCで同じ割合なら同じ威力',()=>{
  for(const width of [320,390,1280]){
    const max=E.pullAim(-30,30,width).limit;
    const shot=E.pullAim(-max/Math.sqrt(2),max/Math.sqrt(2),width);
    assert.equal(shot.angle,45);assert.equal(shot.power,100);assert.equal(shot.valid,true);
  }
});
test('引く長さに応じて威力が増え、範囲外でも角度・威力の上限を守る',()=>{
  let prev=0;for(let d=15;d<250;d+=5){const a=E.pullAim(-d,d,390);assert.ok(a.power>=prev&&a.power<=100);assert.equal(a.angle,45);prev=a.power;}
  assert.equal(E.pullAim(-100,0,390).angle,5);assert.equal(E.pullAim(-3,500,390).angle,80);
});
test('タップ・元位置への戻し・前方向・下向き射撃は誤発射しない',()=>{
  for(const [x,y] of [[0,0],[-4,3],[60,60],[-30,-30],[0,100]])assert.equal(E.pullAim(x,y,390).valid,false);
  assert.equal(E.pullAim(-20,20,390).valid,true);
});
test('無風でも草は揺れ、矢への風加速はゼロのまま',()=>{
  assert.notEqual(Math.round(E.grassSway(0,0,0)),Math.round(E.grassSway(1.8,0,0)));
  const arrow=E.launch(115,1,45,70);assert.equal(E.advance(arrow,0).vx,arrow.vx);
  const d=new E.Duel(10);d.newRound();d.wind=0;assert.equal(d.round,2);assert.notEqual(E.grassSway(2,d.wind,1),E.grassSway(3,d.wind,1));
});
test('弾道は解析式と一致し、横風の向きが反映される',()=>{
  const initial=E.launch(115,1,60,90);let a=initial;
  for(let i=0;i<360;i++)a=E.advance(a,-10);
  assert.ok(Math.abs(a.x-(initial.x+initial.vx*3-45))<1e-7);
  assert.ok(Math.abs(a.y-(initial.y+initial.vy*3+E.GRAVITY*9/2))<1e-7);
  assert.ok(a.y<0,'初期画面より上に飛ぶ矢も生存');
});
test('高速の矢が頭・胴体をすり抜けず、弓と頭飾りは判定外',()=>{
  assert.equal(E.contact({x:0,y:180},{x:200,y:180},100).damage,45);
  assert.equal(E.contact({x:0,y:210},{x:200,y:210},100).damage,30);
  assert.equal(E.contact({x:0,y:162},{x:200,y:162},100),null);
  assert.equal(E.contact({x:80,y:190},{x:85,y:190},100),null);
});
test('CPUとプレイヤーの両方向で全風域・距離端点に有効な射撃がある',()=>{
  for(const wind of [-17,0,17])for(const dist of [400,560])for(const side of [-1,1]){
    const x=side===1?115:115+dist,target=side===1?115+dist:115;
    const aim=E.solve(x,side,wind,target);
    assert.ok(E.trace(x,side,aim.angle,aim.power,wind,target).damage>0,JSON.stringify({wind,dist,side}));
  }
});
test('全入力端点の矢が有限時間で終了する',()=>{
  for(const wind of [-17,17])for(const angle of [5,80])for(const power of [20,100]){
    const hit=E.trace(115,1,angle,power,wind,650);assert.ok(['head','body','ground','out'].includes(hit.kind));assert.ok(Number.isFinite(hit.x));
  }
});
test('発射中は二重発射を拒否し、結果処理を繰り返しても得点は一度だけ',()=>{
  const d=new E.Duel(42);d.hp[1]=30;const aim=E.solve(d.x[0],1,d.wind,d.x[1]);assert.equal(d.fire(aim.angle,aim.power),true);assert.equal(d.fire(45,90),false);
  while(d.phase==='flight')d.tick();assert.equal(d.hp[1],0);d.finishShot();d.finishShot();assert.equal(d.score[0],1);assert.equal(d.phase,'round');assert.ok(d.previous[0].length>0);
});
test('2ラウンド先取で試合終了、次ラウンドはHP・軌跡・CPU誤差を初期化',()=>{
  const d=new E.Duel(912);let safety=0;
  while(d.phase!=='match'&&safety++<40){
    const side=d.turn===0?1:-1;const aim=E.solve(d.x[d.turn],side,d.wind,d.x[1-d.turn]);d.fire(aim.angle,aim.power);
    while(d.phase==='flight')d.tick();d.finishShot();
    if(d.phase==='round'){const score=[...d.score];d.newRound();assert.deepEqual(d.hp,[100,100]);assert.deepEqual(d.score,score);assert.deepEqual(d.previous,[[],[]]);assert.equal(d.aiError,null);}
  }
  assert.equal(d.phase,'match');assert.equal(Math.max(...d.score),2);
});
test('同じシードで風・距離・CPU照準が再現できる',()=>{
  const a=new E.Duel(5),b=new E.Duel(5);assert.equal(a.wind,b.wind);assert.equal(a.distance,b.distance);assert.deepEqual(a.enemyAim(),b.enemyAim());a.newRound();b.newRound();assert.equal(a.wind,b.wind);assert.equal(a.distance,b.distance);
});
test('ふつうのCPUは前回の狙いから誤差を縮める',()=>{
  const d=new E.Duel(123,'normal');d.enemyAim();const first=Math.abs(d.aiError);d.enemyAim();assert.ok(Math.abs(d.aiError)<first);
});
test('単一HTMLは構文が通り、原画と同じPNGを埋め込み、外部実行依存がない',()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,3);scripts.forEach(m=>new vm.Script(m[1]));assert.ok(html.trim().endsWith('</html>'));assert.ok(!/<script[^>]+src=/.test(html));assert.ok(!/<link[^>]+stylesheet/.test(html));
  const image=html.match(/const SPRITE_DATA="data:image\/png;base64,([^"]+)"/)[1];assert.deepEqual(Buffer.from(image,'base64'),fs.readFileSync(path.join(__dirname,'art/archers-v1.png')));
});
