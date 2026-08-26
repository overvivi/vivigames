// ランキング通知（tools/ranking-to-discord.mjs）の純粋関数を検証する。
//
// このスクリプトは5分ごとのGitHub Actionsで本番のDBを見てDiscordへ投稿する。
// 中でも sanitizeName は、プレイヤーが自由入力した名前をそのまま外部へ流す前の
// 唯一の関門なので、壊れても気づけないまま公開チャンネルへ出てしまう。

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions, frozenDate } from './extract.mjs';

const SOURCE = 'tools/ranking-to-discord.mjs';
const load = (extra) => loadFunctions(SOURCE, ['jstDay', 'fmtTime', 'sanitizeName'], extra);

test('sanitizeName: 名前が無い時は伏せ字ではなく既定名にする', () => {
  const { sanitizeName } = load({ NG_WORDS: [] });
  assert.equal(sanitizeName(''), '（名無し）');
  assert.equal(sanitizeName('   '), '（名無し）');
  assert.equal(sanitizeName(null), '（名無し）');
  assert.equal(sanitizeName(undefined), '（名無し）');
});

test('sanitizeName: 制御文字を落として1行に保つ', () => {
  const { sanitizeName } = load({ NG_WORDS: [] });
  // 改行が残ると、1行のはずのランキング表示が崩れる
  assert.equal(sanitizeName('あい\nうえ'), 'あいうえ');
  assert.equal(sanitizeName('あ\tい'), 'あい');
  assert.equal(sanitizeName(' 名前'), '名前');
});

test('sanitizeName: メンションと装飾記法を無効化する', () => {
  const { sanitizeName } = load({ NG_WORDS: [] });
  // @ は全角へ。allowed_mentions でも通知は止めているが、なりすまし表示も防ぐ
  assert.equal(sanitizeName('@everyone'), '＠everyone');
  assert.equal(sanitizeName('@here'), '＠here');
  assert.equal(sanitizeName('**強調**'), '強調');
  assert.equal(sanitizeName('`code`'), 'code');
  assert.equal(sanitizeName('~~打消~~'), '打消');
  assert.equal(sanitizeName('||伏字||'), '伏字');
  assert.equal(sanitizeName('<@123456>'), '＠123456');
  assert.equal(sanitizeName('a_b'), 'ab');
  assert.equal(sanitizeName('back\\slash'), 'backslash');
});

test('sanitizeName: 記法だけの名前は空のまま出さない', () => {
  const { sanitizeName } = load({ NG_WORDS: [] });
  assert.equal(sanitizeName('***'), '（名無し）');
  assert.equal(sanitizeName('|||'), '（名無し）');
});

test('sanitizeName: 20文字を超えたら切り詰める', () => {
  const { sanitizeName } = load({ NG_WORDS: [] });
  assert.equal(sanitizeName('あ'.repeat(20)), 'あ'.repeat(20));
  assert.equal(sanitizeName('あ'.repeat(21)), 'あ'.repeat(20) + '…');
  assert.equal(sanitizeName('x'.repeat(50)), 'x'.repeat(20) + '…');
});

test('sanitizeName: NGワードは大文字小文字を問わず名前ごと伏せる', () => {
  const { sanitizeName } = load({ NG_WORDS: ['ngword', '禁止'] });
  assert.equal(sanitizeName('ngword'), '＊＊＊');
  assert.equal(sanitizeName('NGWORD'), '＊＊＊');
  assert.equal(sanitizeName('前ngword後'), '＊＊＊');
  assert.equal(sanitizeName('これは禁止です'), '＊＊＊');
  // 無関係な名前は伏せない
  assert.equal(sanitizeName('ふつうの名前'), 'ふつうの名前');
});

test('fmtTime: 分秒表記で秒を0埋めする', () => {
  const { fmtTime } = load({ NG_WORDS: [] });
  assert.equal(fmtTime(0), '0:00');
  assert.equal(fmtTime(5000), '0:05');
  assert.equal(fmtTime(65000), '1:05');
  assert.equal(fmtTime(600000), '10:00');
  assert.equal(fmtTime(3599999), '59:59');
});

test('fmtTime: 負値でも0として扱う', () => {
  const { fmtTime } = load({ NG_WORDS: [] });
  assert.equal(fmtTime(-1), '0:00');
  assert.equal(fmtTime(null), '0:00');
});

test('jstDay: 日本時間で日付が変わる（UTC15時が境目）', () => {
  const at = (iso) => load({ NG_WORDS: [], Date: frozenDate(iso) }).jstDay();
  assert.equal(at('2026-08-25T14:59:59Z'), 20260825); // JST 23:59
  assert.equal(at('2026-08-25T15:00:00Z'), 20260826); // JST 翌0:00
  assert.equal(at('2026-08-25T00:00:00Z'), 20260825); // JST 9:00
});

test('jstDay: 月またぎ・年またぎでも桁が崩れない', () => {
  const at = (iso) => load({ NG_WORDS: [], Date: frozenDate(iso) }).jstDay();
  assert.equal(at('2026-08-31T15:00:00Z'), 20260901);
  assert.equal(at('2026-12-31T15:00:00Z'), 20270101);
  assert.equal(at('2026-01-01T00:00:00Z'), 20260101);
});

test('jstDay: HEXAMINE本体の dailySeed と同じ日付になる', () => {
  // 通知側とゲーム側で別実装のため、ズレると「前日の王者」を通知してしまう。
  // 実装を1つにまとめない代わりに、結果が一致することをここで縛る。
  for (const iso of ['2026-08-25T14:59:59Z', '2026-08-25T15:00:00Z', '2026-12-31T15:00:00Z']) {
    const FrozenDate = frozenDate(iso);
    const { jstDay } = load({ NG_WORDS: [], Date: FrozenDate });
    const { dailySeed } = loadFunctions('games/hexamine.html',
      ['JST_OFFSET', 'dailyDate', 'dailySeed'], { Date: FrozenDate });
    assert.equal(jstDay(), dailySeed(), `${iso} で通知側とゲーム側の日付が食い違う`);
  }
});
