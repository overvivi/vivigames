// HELL RUNNER 2 の地形生成が「跳べない奈落」を作らないことを検証する。
//
// 奈落の幅は generateTerrain の中で、速度・着地側の高低差から毎回計算して決まる。
// 幅の係数やジャンプ力を少し変えるだけで、ある速度帯だけ跳べない奈落が混ざる状態に
// なり得るが、それは実際に走ってその地点まで到達しないと分からない。
//
// このゲームは開発終了しており、今後の変更はプレイヤーからのバグ報告への対応だけになる。
// そういう「1箇所だけ直す」場面ほど、遠くの距離帯で地形が破綻しても気づけないため、
// ここで機械的に見張る。
//
// 判定は「ゲーム側が持っている見積り」ではなく、GRAVITY と JUMP_VELOCITY から
// 2段ジャンプの滞空時間を解いた物理的な上限で行う。定数は正本から読むので、
// ジャンプ力や重力を変えれば、この検証も自動で追随する。

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadInContext } from './extract.mjs';

const SOURCE = 'games/hell-runner-2.html';

const CONSTANTS = [
  'GRAVITY', 'JUMP_VELOCITY', 'JUMP_AIRTIME', 'DOUBLE_JUMP_RANGE_MULT', 'STEP_MAX_H',
  'BASE_SPEED', 'SPEED_RAMP_START_M', 'SPEED_RAMP_END_M', 'MAX_SPEED_BONUS'
];

// 同じ手順を何度も回すため、乱数だけ差し替えられる形にしておく。
function buildTerrain({ speed, random, lookaheadW = 430, steps = 400 }) {
  const rng = Object.create(Math);
  rng.random = random;

  const { api, context } = loadInContext(
    SOURCE,
    [...CONSTANTS, 'speedForDistanceM', 'generateTerrain'],
    {
      Math: rng,
      W: lookaheadW,
      speed,
      distance: 0,
      // 走り出しの足場。ここから先を generateTerrain が作る
      terrain: [{ start: 0, end: 600, type: 'ground', h: 0 }],
      frontier: 600,
      pendingLandH: 0,
      lastNarrow: false,
      // 収集物の配置は別の関心事なので、ここでは呼ばれたことだけ受け止める
      spawnGapRewards: () => {},
      spawnGroundCoins: () => {},
      spawnGroundXp: () => {}
    }
  );

  // 先読み範囲ぶんずつ距離を進めて、地形を伸ばしていく
  for (let i = 0; i < steps; i++) {
    context.distance = context.frontier - (lookaheadW * 3 + 800) + 1;
    api.generateTerrain();
  }
  return { terrain: context.terrain, constants: api };
}

// 2段ジャンプで水平に届く最大距離。
// 1段目を踏み切ってから t2 秒後に2段目を撃つとして、t2 を細かく振って一番遠くまで運べる値を返す。
// deltaH は着地側が踏切より何px高いか（下りなら負）。
function maxDoubleJumpRun(speed, deltaH, { GRAVITY, JUMP_VELOCITY }) {
  const g = GRAVITY;
  const v = JUMP_VELOCITY;
  let best = -1;
  for (let t2 = 0; t2 <= 2 * v / g + 1e-9; t2 += 0.001) {
    const heightAtSecondJump = v * t2 - g * t2 * t2 / 2;
    // 2段目を撃った位置から deltaH まで降りられるか
    const disc = v * v - 2 * g * (deltaH - heightAtSecondJump);
    if (disc < 0) continue;
    const fall = (v + Math.sqrt(disc)) / g;
    best = Math.max(best, speed * (t2 + fall));
  }
  return best;
}

// 生成された地形を、奈落とその前後の足場の組に並べ直す
function gapsOf(terrain) {
  const gaps = [];
  for (let i = 1; i < terrain.length - 1; i++) {
    if (terrain[i].type !== 'gap') continue;
    const before = terrain[i - 1];
    const after = terrain[i + 1];
    if (before.type !== 'ground' || after.type !== 'ground') continue;
    gaps.push({
      length: terrain[i].end - terrain[i].start,
      takeoffH: before.h || 0,
      landH: after.h || 0
    });
  }
  return gaps;
}

// 乱数の偏りで見落とさないよう、種を変えた再現可能な乱数を使う
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('生成された奈落は、その速度の2段ジャンプで必ず跳び越せる', () => {
  const speeds = [640, 700, 768, 896]; // 開始速度から最大速度(+40%)まで
  let checked = 0;

  for (const speed of speeds) {
    for (let seed = 1; seed <= 8; seed++) {
      const { terrain, constants } = buildTerrain({ speed, random: seededRandom(seed) });
      for (const gap of gapsOf(terrain)) {
        const deltaH = gap.landH - gap.takeoffH;
        const reach = maxDoubleJumpRun(speed, deltaH, constants);
        assert.ok(
          gap.length <= reach,
          `速度${speed}px/s・高低差${deltaH}pxで、幅${gap.length.toFixed(1)}pxの奈落が`
          + `2段ジャンプの限界${reach.toFixed(1)}pxを超えている（seed=${seed}）`
        );
        checked++;
      }
    }
  }
  assert.ok(checked > 500, `検査した奈落が少なすぎる（${checked}件）`);
});

test('極端な乱数でも跳べない奈落にならない', () => {
  // 幅が最大になる引き（gapLen の係数が上限、登り着地）を狙い撃ちする
  const always = (value) => () => value;
  for (const speed of [640, 896]) {
    for (const r of [0, 0.999999]) {
      const { terrain, constants } = buildTerrain({ speed, random: always(r), steps: 60 });
      for (const gap of gapsOf(terrain)) {
        const deltaH = gap.landH - gap.takeoffH;
        const reach = maxDoubleJumpRun(speed, deltaH, constants);
        assert.ok(gap.length <= reach,
          `Math.random()=${r}・速度${speed}で幅${gap.length.toFixed(1)}pxが限界${reach.toFixed(1)}pxを超えた`);
      }
    }
  }
});

test('奈落の直後は必ず、その奈落を測った時の着地高さの足場になる', () => {
  // 幅は「着地側の高さ」を前提に計算される。生成順が変わって別の高さの足場が
  // 入ると、跳べる前提のまま跳べない奈落になる。
  const { terrain } = buildTerrain({ speed: 768, random: seededRandom(42) });
  let pairs = 0;
  for (let i = 0; i < terrain.length - 1; i++) {
    if (terrain[i].type !== 'gap') continue;
    assert.equal(terrain[i + 1].type, 'ground', '奈落が連続している');
    pairs++;
  }
  assert.ok(pairs > 50, `検査した奈落が少なすぎる（${pairs}件）`);
});

test('足場の高さは STEP_MAX_H の範囲に収まる', () => {
  const { terrain, constants } = buildTerrain({ speed: 768, random: seededRandom(7) });
  for (const seg of terrain) {
    if (seg.type !== 'ground') continue;
    const h = seg.h || 0;
    assert.ok(Math.abs(h) <= constants.STEP_MAX_H,
      `足場の高さ${h}pxが上限${constants.STEP_MAX_H}pxを超えている`);
  }
});

test('速度カーブは30000mから100000mで最大+40%まで上がる', () => {
  const { api } = loadInContext(SOURCE, [...CONSTANTS, 'speedForDistanceM'], {});
  const { speedForDistanceM, BASE_SPEED, MAX_SPEED_BONUS } = api;
  assert.equal(speedForDistanceM(0), BASE_SPEED);
  assert.equal(speedForDistanceM(30000), BASE_SPEED);
  assert.equal(speedForDistanceM(65000), BASE_SPEED * (1 + MAX_SPEED_BONUS / 2));
  assert.equal(speedForDistanceM(100000), BASE_SPEED * (1 + MAX_SPEED_BONUS));
  // 頭打ちのあとは上がらない
  assert.equal(speedForDistanceM(999999), BASE_SPEED * (1 + MAX_SPEED_BONUS));
});
