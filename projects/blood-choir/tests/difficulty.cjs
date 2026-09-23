// 波ごとの手応えを測る。自動操作なので人間の攻略とは異なるが、
// 「敵が撃つ前に死ぬ」「弾が飛んでこない」「どこで倒れるか」を数字で見るには足りる。
//
//   node projects/blood-choir/tests/difficulty.cjs [深度] [最終波] [none|mid|full] [endless] [seed...]
//
// 出す数字:
//   出現   その波に出た敵の数
//   初弾   波の開始から最初の敵弾までの秒数（∞ は一発も飛ばなかった）
//   敵弾   その波に敵が撃った弾の総数
//   被弾   その波で失った生命
//   秒     波を片付けるまでの時間
// 最後に、何で生命を削られたかの内訳を出す。

const D = require('../source/data.js');
const { Run } = require('../source/engine.js');

const depth = Math.max(0, Math.min(4, Number(process.argv[2]) || 0));
const maxWave = Math.max(1, Number(process.argv[3]) || 12);
const metaMode = process.argv.includes('full') ? 'full' : process.argv.includes('mid') ? 'mid' : 'none';
const endless = process.argv.includes('endless');
const seeds = process.argv.slice(4).map(Number).filter(Number.isFinite);
const SEEDS = seeds.length ? seeds : [13, 82, 491];
// 反応の速さ。既定は人間並み（0.2秒ごとに判断し、近くの弾しか見ない）。
// sharp を付けると 0.05秒ごとに全弾を読む。上手い人の上限の目安。
const sharp = process.argv.includes('sharp');
const THINK = sharp ? 3 : 12, SIGHT = sharp ? 2000 : 240;

// 素の弔具と仮面。祭壇は引数で変える。
const PRIORITY = ['damage', 'rate', 'vitality', 'multishot', 'critical', 'regen', 'armor', 'lifesteal'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 0.5秒先までの自分と弾の位置を読み、いちばん当たらない動きを選ぶ。
// 人間ほど上手くはないが、突っ立って撃ち合うよりはずっと近い。
function danger(r, move, jump) {
  const p = r.p, s = r.stats, dt = 1 / 30;
  let x = p.x, y = p.y, vx = p.vx, vy = jump ? -s.jump : p.vy, cost = 0;
  for (let i = 1; i <= 15; i++) {
    const t = i * dt, w = 1 / (1 + i * .12);
    vx += (move * s.speed - vx) * Math.min(1, dt * 18);
    if (y < D.FLOOR - 22 || vy < 0) vy += 1050 * dt;
    x = clamp(x + vx * dt, 38, 922); y += vy * dt;
    if (y >= D.FLOOR - 22) { y = D.FLOOR - 22; vy = 0; }
    for (const b of r.hostile) {
      if (b.life <= t || Math.abs(b.x - p.x) + Math.abs(b.y - p.y) > SIGHT) continue;
      const d = Math.hypot(b.x + b.vx * t - x, b.y + b.vy * t - y), R = b.r + p.r + 5;
      if (d < R) cost += 10 * w; else if (d < R + 30) cost += (R + 30 - d) / 30 * .4 * w;
    }
    for (const h of r.hazards) {
      const at = h.delay - t;
      if (h.kind === 'sweep') { if (at <= .05 && at > -h.duration && Math.abs(y - h.y) < h.r + p.r + 6) cost += 10 * w; }
      else if (at <= .15 && h.life > t && Math.abs(x - h.x) < h.r + p.r + 10) cost += 10 * w;
    }
    for (const e of r.enemies) if (!e.dead && e.arrival <= 0 && Math.hypot(e.x - x, e.y - y) < e.r + p.r + 10) cost += 6 * w;
  }
  return cost + Math.abs(x - 480) / 480 * .25;
}

function decide(r) {
  const p = r.p;
  let best = null;
  for (const move of [-1, 0, 1]) for (const jump of [false, true]) {
    if (jump && p.jumps >= r.stats.jumps) continue;
    const cost = danger(r, move, jump);
    if (!best || cost < best.cost) best = { move, jump, cost };
  }
  // どう動いても当たるなら、無敵の回避で抜ける。
  best.dash = best.cost >= 6 && p.dashCD <= 0;
  return best;
}

function playWave(r, hurtBy) {
  const startHp = r.p.hp;
  const startSouls = r.souls;
  const startTime = r.time;
  const startShots = r.shotsFired;
  let firstShot = Infinity, frames = 0, plan = null;
  while ((r.state === 'playing' || r.state === 'clearing') && frames < 60 * 150) {
    if (firstShot === Infinity && r.shotsFired > startShots) firstShot = r.time - startTime;
    if (frames % THINK === 0) plan = decide(r);
    r.update(1 / 60, {
      fire: true, autoAim: true, move: plan.move, jump: frames % THINK === 0 && plan.jump, dash: plan.dash,
      ultimate: r.charge >= r.stats.ultimate && (plan.cost > 3 || r.enemies.some(e => e.boss)),
    });
    r.events = [];
    frames++;
  }
  return { shots: r.shotsFired - startShots, firstShot, hurt: Math.max(0, startHp - r.p.hp), ash: r.souls - startSouls, seconds: r.time - startTime };
}

const rows = [];
const hurtBy = {};
for (const seed of SEEDS) {
  const meta = Object.fromEntries(D.meta.map(d => [d.id, metaMode === 'full' ? d.max : metaMode === 'mid' ? Math.ceil(d.max / 2) : 0]));
  const r = new Run({ seed, difficulty: depth, meta, endless });
  const hurt = r.hurtPlayer.bind(r);
  r.hurtPlayer = (amount, source = {}) => {
    const before = r.p.hp; hurt(amount, source);
    const k = source.kind || '?'; hurtBy[k] = (hurtBy[k] || 0) + Math.max(0, before - r.p.hp);
  };
  const shot = r.enemyShot.bind(r);
  r.shotsFired = 0;
  r.enemyShot = (...a) => { r.shotsFired++; return shot(...a); };
  for (let w = 1; w <= maxWave && r.state !== 'dead'; w++) {
    if (r.state === 'upgrade') {
      const rank = id => D.evolutions.some(e => e.id === id) ? 100
        : Math.max(0, 25 - PRIORITY.indexOf(id) * 2) * (PRIORITY.includes(id) ? 1 : 0);
      r.choose([...r.choices].sort((a, b) => rank(b) - rank(a))[0]);
    }
    if (r.state !== 'playing') break;
    const spawnPlanned = r.spawnLeft + r.enemies.length;
    const res = playWave(r, hurtBy);
    rows.push({ seed, wave: w, born: spawnPlanned, ...res, hp: Math.round(r.p.hp), state: r.state });
    if (r.state === 'dead' || r.state === 'victory') break;
  }
}

const fmt = n => n === Infinity ? '  ∞ ' : n.toFixed(1).padStart(4);
const by = new Map();
for (const row of rows) {
  if (!by.has(row.wave)) by.set(row.wave, []);
  by.get(row.wave).push(row);
}
console.log((endless ? '無限' : '葬送 深度 ' + (depth + 1)) + (sharp ? ' / 上手い操作' : ' / 人並みの操作') + ' / seed ' + SEEDS.join(',') + ' / 祭壇 ' + ({ none: 'なし', mid: '半分', full: '最大' })[metaMode]);
console.log('波   人数  出現   初弾   敵弾   被弾   遺灰    秒   残生命');
for (const [wave, list] of [...by.entries()].sort((a, b) => a[0] - b[0])) {
  const avg = f => list.reduce((s, x) => s + f(x), 0) / list.length;
  const first = list.map(x => x.firstShot).filter(Number.isFinite);
  console.log(
    String(wave).padStart(2) + '  ' +
    String(list.length).padStart(4) + '  ' +
    avg(x => x.born).toFixed(0).padStart(4) + '  ' +
    (first.length ? fmt(first.reduce((s, x) => s + x, 0) / first.length) : '  ∞ ') + '  ' +
    avg(x => x.shots).toFixed(0).padStart(5) + '  ' +
    avg(x => x.hurt).toFixed(0).padStart(5) + '  ' +
    avg(x => x.ash).toFixed(1).padStart(5) + '  ' +
    avg(x => x.seconds).toFixed(1).padStart(5) + '  ' +
    avg(x => x.hp).toFixed(0).padStart(5)
  );
}
const ends = rows.filter(r => r.state === 'dead').map(r => r.wave);
const ashTotal = rows.reduce((s, r) => s + r.ash, 0) / SEEDS.length;
console.log('\n倒れた波: ' + (ends.length ? ends.join(', ') : 'なし') + ' / 遺灰の平均 ' + ashTotal.toFixed(0));
console.log('被弾の内訳: ' + Object.entries(hurtBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + Math.round(v)).join(' / '));
