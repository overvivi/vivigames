// HEXAMINEデイリーの曜日割りを検証する。
//
// 以前は毎日 91マス・穴3個・density 0.44・深さ2 の固定で、150日ぶんを生成して測っても
// 難易度は横ばいだった。「日に日に簡単になっている」という声の正体は、難易度低下ではなく
// 毎日ほぼ同じ形・同じ手筋だったことによる単調さで、曜日ごとに振る形へ変更した。
//
// ここで縛るのは、全員が同じ盤面になること（種だけで決まること）と、
// 携帯で解ける規模から外れないこと。数値の good/bad は実測で決めたので、
// 変えた時に気づけるよう主要な性質だけを固定する。

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions } from './extract.mjs';

const SOURCE = 'games/hexamine.html';
const api = loadFunctions(SOURCE, ['DAILY_PLAN', 'dailyJitter', 'dailyPlanFor'], { Math });
const { DAILY_PLAN, dailyPlanFor } = api;

// 2026-09-07 は月曜。そこから7日ぶんの (種, 曜日) を作る
const WEEK = [];
for (let i = 0; i < 7; i++) {
  const d = new Date(Date.UTC(2026, 8, 7 + i));
  WEEK.push({
    seed: d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(),
    dow: d.getUTCDay()
  });
}

test('7曜日ぶんの設定がそろっている', () => {
  assert.equal(DAILY_PLAN.length, 7);
  // 正本を別文脈で評価しているため、配列はそのまま比べるとプロトタイプ差で落ちる
  assert.deepEqual([...DAILY_PLAN.map(p => p.label)], ['日', '月', '火', '水', '木', '金', '土']);
  for (const p of DAILY_PLAN) {
    assert.ok(p.weight, `${p.label}: 重さの表示が無い`);
    assert.ok(p.maxDepth === 1 || p.maxDepth === 2,
      `${p.label}: maxDepth は1か2（ソルバーが深さ2までしか実装していない）`);
  }
});

test('同じ日なら誰が開いても同じ設定になる', () => {
  // デイリーの前提。種と曜日だけで決まり、実行のたびに変わってはいけない
  for (const { seed, dow } of WEEK) {
    const a = dailyPlanFor(seed, dow);
    const b = dailyPlanFor(seed, dow);
    assert.deepEqual({ ...a }, { ...b }, `${seed} で結果がぶれた`);
  }
});

test('同じ曜日でも週によって規模が変わる', () => {
  // 揺らぎが効いていないと、毎週まったく同じ盤面規模になって単調に戻る
  const mondays = [];
  for (let w = 0; w < 8; w++) {
    const d = new Date(Date.UTC(2026, 8, 7 + w * 7));
    mondays.push(dailyPlanFor(d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(), 1).cells);
  }
  assert.ok(new Set(mondays).size >= 3, `月曜のマス数が固定気味: ${mondays.join(',')}`);
});

test('マス数は携帯で解ける範囲に収まる', () => {
  // 95マス以上は1マスが約14.0pxで頭打ち。これ以上広げると指の当たる幅が削れる。
  // 揺らぎ(±6)を含めた実際の値で見る
  for (let i = 0; i < 90; i++) {
    const d = new Date(Date.UTC(2026, 8, 7 + i));
    const seed = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    const plan = dailyPlanFor(seed, d.getUTCDay());
    assert.ok(plan.cells >= 61 && plan.cells <= 121,
      `${seed}(${plan.label}) のマス数 ${plan.cells} が想定の 61〜121 から外れている`);
    assert.ok(plan.holes >= 1, `${seed}: 穴の数が1未満`);
  }
});

test('週の中に軽い日と重い日の両方がある', () => {
  const depths = DAILY_PLAN.map(p => p.maxDepth);
  assert.ok(depths.includes(1), '深さ1の日が無い（解き方が毎日同じに戻る）');
  assert.ok(depths.includes(2), '深さ2の日が無い');
  // 慣れてきた人向けに、軽い日は少なめに保つ
  const light = depths.filter(v => v === 1).length;
  assert.ok(light >= 1 && light <= 2, `軽い日が ${light} 日。1〜2日に保つ`);
});

test('重さの並びが週の流れになっている', () => {
  // density が低いほど重い。月が最も軽く、土が最も重い
  const byLabel = Object.fromEntries(DAILY_PLAN.map(p => [p.label, p]));
  assert.equal(byLabel['月'].maxDepth, 1, '月は軽い日にしてある');
  assert.ok(byLabel['月'].density > byLabel['土'].density, '月より土が重いこと');
  assert.ok(byLabel['土'].cells > byLabel['月'].cells, '土のほうが規模が大きいこと');
});
