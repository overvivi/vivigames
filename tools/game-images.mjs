// ゲームHTMLへ埋め込まれたPNGを、WebPへ入れ直して軽くする。
//
// ドット絵スプライトは非可逆で圧縮すると輪郭が滲むので、既定は可逆(lossless)。
// それでもPNGより小さくなる。UIのように写実寄りの絵だけ個別に落としたい場合は
// --lossy を使う。
//
//   node tools/game-images.mjs games/temple-run-clone.html --dry-run
//   node tools/game-images.mjs games/temple-run-clone.html
//
// 対象は2つの持ち方の両方:
//   1. data:image/png;base64,xxxx        … HTMLのimg等に直接書かれたもの
//   2. 'iVBORw0...'                       … JSの文字列。読み込み側が接頭辞を足す
// 2 の場合は、接頭辞を作っている箇所(image/png)も webp へ書き換える。

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import sharp from 'sharp';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
// 大きい絵(UI・ロゴ)は非可逆でも見分けがつかず、効果が大きい。
// 小さいドット絵スプライトは常時動くので可逆のままにする。
const tIdx = args.indexOf('--lossy-over');
const lossyOver = tIdx >= 0 ? Number(args[tIdx + 1]) * 1024 : 100 * 1024;
const quality = args.includes('--q90') ? 90 : 95;

if(!file){
  console.error('使い方: node tools/game-images.mjs <ゲームのHTML> [--lossy-over 100] [--q90] [--dry-run]');
  process.exit(1);
}

const mb = n => (n / 1024 / 1024).toFixed(2) + 'MB';
const kb = n => (n / 1024).toFixed(0) + 'KB';

let html = readFileSync(file, 'utf8');
const before = statSync(file).size;

// PNGのbase64は必ず iVBORw0KGgo で始まる。これを手掛かりに拾う。
const PNG_B64 = /iVBORw0KGgo[A-Za-z0-9+/=]{200,}/g;
const found = [...new Set(html.match(PNG_B64) || [])];

if(!found.length){
  console.error(`${file}: 埋め込みPNGが見つからない`);
  process.exit(1);
}

let inTotal = 0, outTotal = 0;
const swaps = new Map();

for(const b64 of found){
  const src = Buffer.from(b64, 'base64');
  inTotal += src.length;
  if(dryRun) continue;

  // 透過は必ず保つ。UIもスプライトも背景が抜けている前提の絵なので、
  // ここが崩れると黒い四角が出る。
  const big = src.length >= lossyOver;
  const out = await sharp(src)
    .webp(big ? { quality, alphaQuality:100, effort:6 }
              : { lossless:true, effort:6 })
    .toBuffer();

  // 稀にWebPのほうが大きくなる小さな画像がある。その場合は元を残す。
  if(out.length >= src.length){
    outTotal += src.length;
    continue;
  }
  outTotal += out.length;
  swaps.set(b64, out.toString('base64'));
}

if(dryRun){
  console.log(`PNG ${found.length}件 計 ${mb(inTotal)}`);
  found.map(b => Buffer.from(b, 'base64').length)
       .sort((a, b) => b - a).slice(0, 5)
       .forEach(n => console.log('  ' + kb(n)));
  process.exit(0);
}

let replaced = 0;
for(const [from, to] of swaps){
  const at = html.indexOf(from);
  if(at < 0) continue;
  html = html.split(from).join(to);
  replaced++;
}

// 接頭辞を png のまま残すと、中身がWebPなのに宣言だけPNGになる。
// 実害が出ない環境もあるが、正しく直しておく。
const mimeBefore = (html.match(/image\/png;base64/g) || []).length;
html = html.split('image/png;base64').join('image/webp;base64');

writeFileSync(file, html);
const after = statSync(file).size;

console.log(`PNG ${found.length}件中 ${replaced}件を差し替え (残りは元のほうが小さかったもの)`);
console.log(`宣言 image/png → image/webp: ${mimeBefore}箇所`);
console.log(`画像 ${mb(inTotal)} → ${mb(outTotal)}`);
console.log(`${file}  ${mb(before)} → ${mb(after)} (${(100 - after / before * 100).toFixed(0)}%減)`);
