// 波ごとの手応えを測る。自動操作なので人間の攻略とは異なるが、
// 「敵が撃つ前に死ぬ」「弾が飛んでこない」を数字で見るには足りる。
//
//   node projects/blood-choir/tests/difficulty.cjs [深度] [最終波] [seed...]
//
// 出す数字:
//   出現   その波に出た敵の数
//   初弾   波の開始から最初の敵弾までの秒数（∞ は一発も飛ばなかった）
//   敵弾   その波に敵が撃った弾の総数
//   被弾   その波で失った生命
//   秒     波を片付けるまでの時間

const D = require('../source/data.js');
const { Run } = require('../source/engine.js');

const depth = Math.max(0, Math.min(4, Number(process.argv[2]) || 0));
const maxWave = Math.max(1, Number(process.argv[3]) || 12);
const metaMode = process.argv.includes('full') ? 'full' : process.argv.includes('mid') ? 'mid' : 'none';
const seeds = process.argv.slice(4).map(Number).filter(Number.isFinite);
const SEEDS = seeds.length ? seeds : [13, 82, 491];

// 素の弔具と仮面で、祭壇も無い状態。いちばん手応えが薄いはずの条件。
const PRIORITY = ['damage', 'rate', 'vitality', 'multishot', 'critical', 'regen', 'armor', 'lifesteal'];

function playWave(r) {
  const startHp = r.p.hp;
  const startTime = r.time;
  let shots = 0;
  let firstShot = Infinity;
  let lastJump = -10;
  let frames = 0;
  let prevHostile = r.hostile.length;

  while (r.state === 'playing' && frames < 60 * 120) {
    const p = r.p;
    let danger = 0, avoid = 0;
    for (const b of r.hostile) {
      const dx = b.x + b.vx * .22 - p.x, dy = b.y + b.vy * .22 - p.y;
      if (Math.abs(dy) < 50 && Math.abs(dx) < 110) { danger++; avoid -= Math.sign(dx) * (110 - Math.abs(dx)); }
    }
    // 敵弾は id を持たないので、本数が増えた分を発射とみなす。
    const grew = r.hostile.length - prevHostile;
    if (grew > 0) { shots += grew; if (firstShot === Infinity) firstShot = r.time - startTime; }
    prevHostile = r.hostile.length;
    let move = avoid ? Math.sign(avoid) : Math.sin(r.time * .65) > 0 ? 1 : -1;
    if (p.x < 75) move = 1;
    if (p.x > 885) move = -1;
    for (const h of r.hazards) if (h.kind !== 'sweep' && Math.abs(p.x - h.x) < h.r + 80) move = h.x < 150 ? 1 : h.x > 810 ? -1 : p.x < h.x ? -1 : 1;
    const jump = (p.grounded && r.time - lastJump > 1.5) || (p.jumps === 1 && p.vy > -60);
    if (jump) lastJump = r.time;
    r.update(1 / 60, {
      fire: true, autoAim: true, move, jump,
      dash: danger >= 2,
      ultimate: r.charge >= r.stats.ultimate && (danger > 2 || r.enemies.some(e => e.boss)),
    });
    r.events = [];
    frames++;
  }
  return { shots, firstShot, hurt: Math.max(0, startHp - r.p.hp), seconds: r.time - startTime };
}

const rows = [];
for (const seed of SEEDS) {
  const meta = Object.fromEntries(D.meta.map(d => [d.id, metaMode === 'full' ? d.max : metaMode === 'mid' ? Math.ceil(d.max / 2) : 0]));
  const r = new Run({ seed, difficulty: depth, meta });
  let born = 0;
  const seenEnemy = new Set();
  for (let w = 1; w <= maxWave && r.state !== 'dead'; w++) {
    if (r.state === 'upgrade') {
      const rank = id => D.evolutions.some(e => e.id === id) ? 100
        : Math.max(0, 25 - PRIORITY.indexOf(id) * 2) * (PRIORITY.includes(id) ? 1 : 0);
      r.choose([...r.choices].sort((a, b) => rank(b) - rank(a))[0]);
    }
    if (r.wave !== w) r.beginWave(w);
    const spawnPlanned = r.spawnLeft + r.enemies.length;
    const res = playWave(r);
    rows.push({ seed, wave: w, born: spawnPlanned, ...res, hp: Math.round(r.p.hp), state: r.state });
    if (r.state === 'dead') break;
  }
}

const fmt = n => n === Infinity ? '  ∞ ' : n.toFixed(1).padStart(4);
const by = new Map();
for (const row of rows) {
  const k = row.wave;
  if (!by.has(k)) by.set(k, []);
  by.get(k).push(row);
}
console.log('深度 ' + (depth + 1) + ' / seed ' + SEEDS.join(',') + ' / 祭壇 ' + ({none:'なし',mid:'半分',full:'最大'})[metaMode]);
console.log('波   出現   初弾   敵弾   被弾    秒   残生命');
for (const [wave, list] of [...by.entries()].sort((a, b) => a[0] - b[0])) {
  const avg = f => list.reduce((s, x) => s + f(x), 0) / list.length;
  const first = list.map(x => x.firstShot).filter(Number.isFinite);
  console.log(
    String(wave).padStart(2) + '  ' +
    avg(x => x.born).toFixed(0).padStart(4) + '  ' +
    (first.length ? fmt(first.reduce((s, x) => s + x, 0) / first.length) : '  ∞ ') + '  ' +
    avg(x => x.shots).toFixed(0).padStart(5) + '  ' +
    avg(x => x.hurt).toFixed(0).padStart(5) + '  ' +
    avg(x => x.seconds).toFixed(1).padStart(5) + '  ' +
    avg(x => x.hp).toFixed(0).padStart(5)
  );
}
const dead = rows.filter(r => r.state === 'dead').length;
console.log('\n倒れた回数: ' + dead + ' / ' + SEEDS.length);
