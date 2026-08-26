// 背景ゾーンの繋がりを、絵を見ずに検証する。
//
// 背景の確認は tests/backgrounds.spec.js のスクリーンショット比較しかないが、
// 基準画像はOSごとに別ファイルで、実行環境を揃えないと結果が食い違う。
// そのため「どの距離でも背景が必ず1枚ぶん出ている」「重なり区間で合計が1になる」
// といった、環境に左右されない部分だけをここで押さえる。
//
// HELL RUNNER 2 側は背景比較テストが1件も無いので、この検証が唯一の自動確認になる。

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadFunctions } from './extract.mjs';

const GAMES = ['games/temple-run-clone.html', 'games/hell-runner-2.html'];
const CROSSFADE_M = 3000; // 前後の背景を重ねながら入れ替える距離

for (const file of GAMES) {
  const { BG_ZONES, rangeAlpha } = loadFunctions(file, ['BG_ZONES', 'rangeAlpha']);

  test(`${file}: ゾーンは距離順に並び、境界が噛み合っている`, () => {
    for (let i = 0; i < BG_ZONES.length; i++) {
      const z = BG_ZONES[i];
      assert.ok(z.start < z.peak1, `${z.key}: start(${z.start}) < peak1(${z.peak1}) でない`);
      assert.ok(z.peak1 <= z.peak2, `${z.key}: peak1(${z.peak1}) <= peak2(${z.peak2}) でない`);
      assert.ok(z.peak2 < z.end, `${z.key}: peak2(${z.peak2}) < end(${z.end}) でない`);

      const next = BG_ZONES[i + 1];
      if (!next) continue;
      // 前のゾーンが消え切る地点＝次のゾーンが出揃う地点。ここがズレると、
      // どちらも薄い（＝手描き背景が透ける）距離帯ができる。
      assert.equal(z.end, next.peak1, `${z.key}→${next.key}: 消え切る地点と出揃う地点が違う`);
      assert.equal(z.peak2, next.start, `${z.key}→${next.key}: 薄れ始めと現れ始めが違う`);
    }
  });

  test(`${file}: 入れ替えは前後3000mかけて行う`, () => {
    BG_ZONES.forEach((z, i) => {
      // 最初のゾーンは0mから出ている必要があるため、立ち上がりだけ例外
      if (i > 0) assert.equal(z.peak1 - z.start, CROSSFADE_M, `${z.key}: 現れるまでの距離が3000mでない`);
      // 最後のゾーンは終わりが無い
      if (i < BG_ZONES.length - 1) assert.equal(z.end - z.peak2, CROSSFADE_M, `${z.key}: 消えるまでの距離が3000mでない`);
    });
  });

  test(`${file}: どの距離でも背景の合計は1になる`, () => {
    const last = BG_ZONES[BG_ZONES.length - 1];
    for (let distM = 0; distM <= last.peak1 + 5000; distM += 250) {
      const total = BG_ZONES.reduce(
        (sum, z) => sum + rangeAlpha(distM, z.start, z.peak1, z.peak2, z.end), 0);
      assert.ok(Math.abs(total - 1) < 1e-9,
        `${distM}m で背景の合計が ${total.toFixed(4)}（1でない）`);
    }
  });

  test(`${file}: 重なるのは常に2枚まで`, () => {
    const last = BG_ZONES[BG_ZONES.length - 1];
    for (let distM = 0; distM <= last.peak1 + 5000; distM += 250) {
      const shown = BG_ZONES.filter(
        z => rangeAlpha(distM, z.start, z.peak1, z.peak2, z.end) > 0).length;
      assert.ok(shown >= 1 && shown <= 2, `${distM}m で ${shown} 枚が同時に出ている`);
    }
  });

  test(`${file}: ゾーンの画像が実在する`, () => {
    const dir = path.dirname(file);
    for (const z of BG_ZONES) {
      assert.ok(existsSync(path.resolve(dir, z.src)), `${z.key}: ${z.src} が無い`);
    }
  });
}

test('2本のランナーは同じ背景ゾーンを使う', () => {
  // 無印は凍結、HELL RUNNER 2 は制作中。背景の区間だけは同じ素材・同じ距離で
  // 揃えてある前提なので、片方だけ動いたらここで気づけるようにする。
  const [a, b] = GAMES.map(f => loadFunctions(f, ['BG_ZONES']).BG_ZONES);
  assert.equal(a.length, b.length, 'ゾーン数が違う');
  a.forEach((z, i) => {
    assert.deepEqual(
      { key: z.key, src: z.src, start: z.start, peak1: z.peak1, peak2: z.peak2, end: z.end },
      { key: b[i].key, src: b[i].src, start: b[i].start, peak1: b[i].peak1, peak2: b[i].peak2, end: b[i].end },
      `${z.key} の区間が2本で食い違っている`
    );
  });
});
