// パッチノート通知（tools/patch-notes-to-discord.mjs）のHTML解釈を検証する。
//
// index.html へパッチノートを1行足すたび、push契機のGitHub Actionsがこの解釈を通して
// Discordへ投稿する。壊れても投稿が空になるか文字化けするだけで、CIは成功したままになる。

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions } from './extract.mjs';

const SOURCE = 'tools/patch-notes-to-discord.mjs';
const api = loadFunctions(SOURCE, ['decodeEntities', 'stripTags', 'parseEntry']);

test('decodeEntities: 主要な実体参照を戻す', () => {
  const { decodeEntities } = api;
  assert.equal(decodeEntities('&lt;b&gt;'), '<b>');
  assert.equal(decodeEntities('&quot;引用&quot;'), '"引用"');
  assert.equal(decodeEntities('&#39;'), "'");
  assert.equal(decodeEntities('a&nbsp;b'), 'a b');
  assert.equal(decodeEntities('A&amp;B'), 'A&B');
});

test('decodeEntities: &amp; を最後に戻して二重復元しない', () => {
  // ここは意図的に順序を決めてある箇所。&amp; を先に戻すと `&amp;lt;` が `<` まで
  // 復元されてしまい、書いたとおりの文字が表示されなくなる。
  const { decodeEntities } = api;
  assert.equal(decodeEntities('&amp;lt;'), '&lt;');
  assert.equal(decodeEntities('&amp;amp;'), '&amp;');
});

test('stripTags: タグを外して前後の空白を落とす', () => {
  const { stripTags } = api;
  assert.equal(stripTags('<strong>v0.3</strong>'), 'v0.3');
  assert.equal(stripTags('  <em>近日</em>公開  '), '近日公開');
  assert.equal(stripTags('<a href="https://example.com">リンク</a>'), 'リンク');
  assert.equal(stripTags('<br>'), '');
});

test('stripTags: タグを外したあとに実体参照を戻す', () => {
  const { stripTags } = api;
  assert.equal(stripTags('<li>A&amp;B</li>'), 'A&B');
});

// parseEntry の戻り値は正本を評価した別文脈で作られるため、プロトタイプが手元のものと違う。
// deepStrictEqual はそこまで見て落ちるので、中身だけを取り出して比べる。
const entryOf = (line) => {
  const entry = api.parseEntry(line);
  return entry === null ? null : { version: entry.version, items: [...entry.items] };
};

test('parseEntry: 実際のパッチノート1行からバージョンと項目を取り出す', () => {
  const line = '<div class="patch-entry"><strong>v0.3</strong><ul>'
    + '<li>PCの盤面操作を左クリックだけに限定</li>'
    + '<li>右クリックによる誤答を防止</li></ul></div>';
  assert.deepEqual(entryOf(line), {
    version: 'v0.3',
    items: ['PCの盤面操作を左クリックだけに限定', '右クリックによる誤答を防止']
  });
});

test('parseEntry: 空の項目は落とす', () => {
  const line = '<div class="patch-entry"><strong>v1.0</strong><ul>'
    + '<li>本文</li><li></li><li>   </li></ul></div>';
  assert.deepEqual(entryOf(line), { version: 'v1.0', items: ['本文'] });
});

test('parseEntry: 項目だけ・バージョンだけでも取り出せる', () => {
  assert.deepEqual(entryOf('<div class="patch-entry"><strong>2026.08.20</strong></div>'),
    { version: '2026.08.20', items: [] });
  assert.deepEqual(entryOf('<div class="patch-entry"><ul><li>だけ</li></ul></div>'),
    { version: '', items: ['だけ'] });
});

test('parseEntry: 中身が無い行は送信対象にしない', () => {
  const { parseEntry } = api;
  assert.equal(parseEntry('<div class="patch-entry"></div>'), null);
  assert.equal(parseEntry('<div class="patch-entry"><ul></ul></div>'), null);
});

test('parseEntry: 実際の index.html のパッチノートを全件解釈できる', async () => {
  // 正本そのものを通す。書式を変えた時に、解釈できなくなったことへ気づけるようにする。
  const { readFileSync } = await import('node:fs');
  const html = readFileSync('index.html', 'utf8');
  const lines = html.split('\n').filter(l => l.includes('class="patch-entry"'));
  assert.ok(lines.length > 0, 'index.html にパッチノートが見つからない');
  for (const line of lines) {
    const entry = api.parseEntry(line);
    assert.notEqual(entry, null, `解釈できないパッチノート行がある: ${line.slice(0, 80)}`);
    assert.ok(entry.version || entry.items.length,
      `バージョンも項目も取れない行がある: ${line.slice(0, 80)}`);
  }
});
