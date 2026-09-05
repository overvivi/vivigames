// React製のミニゲームを、置き場へ載せられる「単一HTML」へ書き出す。
//
// `immune-defense/` と `elegant-solitaire/` は Vite + React + TS のプロジェクトで、
// そのままでは games/ に置けない。vite-plugin-singlefile でJSとCSSを1枚のHTMLへ
// 畳み、その1枚だけを games/ へコピーする。
// 元のプロジェクトは編集用にそのまま残す（ここから作り直せる）。
//
//   node tools/build-embedded-games.mjs
//
// 背景画像だけは外部ファイルのままにしてある。base64で埋めるとHTMLが1MB以上
// 太るため、AGENTS.md の「背景画像だけが例外」に従って images/ へ置く。

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// 書き出したHTMLを file:// でそのまま開けるようにする。
//
// Viteは <head> に `<script type="module">` として畳み込む。モジュールは
// ローカルファイルだと読み込みを弾かれることがあるうえ、ふつうのスクリプトへ
// 落とすと今度は #root が出来る前に走ってしまう。
// 中身は全部畳んであって import も残っていないので、
// ただのスクリプトにして </body> の直前へ移す。
function toClassicScript(html) {
  const m = html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return html;
  const code = m[1];
  return html
    .replace(m[0], '')
    .replace('</body>', () => '  <script>' + code + '</script>\n  </body>');
}

const GAMES = [
  {
    dir: 'elegant-solitaire',
    out: 'games/elegant-solitaire.html',
    // 外部素材なし
    images: []
  },
  {
    dir: 'immune-defense',
    out: 'games/immune-defense.html',
    images: [{
      src: 'immune-defense/src/assets/images/immune_defense_bg_1788533030347.jpg',
      out: 'images/immune-defense/bg.webp',
      // 開発サーバー側でも同じ絵を見せる
      copyTo: 'immune-defense/public/bg.webp',
      width: 1376,
      quality: 72
    }]
  }
];

const kb = f => (statSync(f).size / 1024).toFixed(0) + 'KB';

let failed = 0;

for (const game of GAMES) {
  if (!existsSync(game.dir)) {
    console.error(`${game.dir} が無い。プロジェクトごと持ってくること。`);
    failed++;
    continue;
  }
  if (!existsSync(path.join(game.dir, 'node_modules'))) {
    console.error(`${game.dir}: npm install がまだ。先に依存を入れること。`);
    failed++;
    continue;
  }

  for (const img of game.images) {
    mkdirSync(path.dirname(img.out), { recursive: true });
    await sharp(img.src).resize({ width: img.width }).webp({ quality: img.quality }).toFile(img.out);
    if (img.copyTo) copyFileSync(img.out, img.copyTo);
    console.log(`  ${img.out}  ${kb(img.src)} → ${kb(img.out)}`);
  }

  const res = spawnSync('npm', ['run', 'build'], { cwd: game.dir, shell: true, encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(`${game.dir}: ビルドに失敗した`);
    console.error((res.stderr || res.stdout || '').split('\n').slice(-12).join('\n'));
    failed++;
    continue;
  }

  const built = path.join(game.dir, 'dist', 'index.html');
  if (!existsSync(built)) {
    console.error(`${game.dir}: dist/index.html が出ていない。singlefile の設定を確認すること。`);
    failed++;
    continue;
  }

  writeFileSync(game.out, toClassicScript(readFileSync(built, 'utf8')));
  console.log(`  ${game.out}  ${kb(game.out)}`);
}

if (failed) {
  console.error(`\n${failed} 件失敗`);
  process.exit(1);
}
console.log('\n書き出し完了。npm run verify で参照切れを確認すること。');
