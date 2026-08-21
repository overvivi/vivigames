// 外部ファイルとして置いている大きな画像を WebP へ変換し、参照側も書き換える。
//
// HELL RUNNER の背景6枚は1枚2MB前後のPNGで、1と2の両方が同じものを読む。
// 進むほど落とす量が増えるため、ここが体感のカクつきに直結する。
// 写真的な絵なので非可逆WebPが非常によく効く（実測で約9割減）。
//
//   node tools/external-images.mjs --dry-run
//   node tools/external-images.mjs
//
// 対象は TARGETS に列挙したものだけ。地面やUIの小さなPNGは触らない。
// ドット絵を非可逆で潰すと輪郭が滲むうえ、元から小さく効果が薄い。

import sharp from 'sharp';
import { readFileSync, writeFileSync, statSync, existsSync, unlinkSync } from 'node:fs';

const dryRun = process.argv.includes('--dry-run');

// 参照を書き換える対象。ここに無いHTMLは触らない。
const USERS = ['games/temple-run-clone.html', 'games/hell-runner-2.html'];

const TARGETS = [
  'images/bg1-hell.png',
  'images/bg2-graveyard.png',
  'images/bg3-forest.png',
  'images/bg4-ruins.png',
  'images/bg5-cliff.png',
  'images/bg6-hope.png'
];

const QUALITY = 82;   // 82と90で見分けがつかず、82のほうが3割小さい

const mb = n => (n / 1024 / 1024).toFixed(2) + 'MB';

let inTotal = 0, outTotal = 0;
const renames = [];

for(const src of TARGETS){
  if(!existsSync(src)){ console.error(`  ${src} が無い`); continue; }
  const before = statSync(src).size;
  inTotal += before;
  const out = src.replace(/\.png$/, '.webp');

  if(dryRun){
    const m = await sharp(src).metadata();
    console.log(`  ${mb(before).padStart(8)}  ${m.width}x${m.height}  ${src}`);
    continue;
  }

  // 背景は不透明な絵。アルファは持たないので余計な指定はしない。
  const buf = await sharp(src).webp({ quality: QUALITY, effort: 6 }).toBuffer();
  writeFileSync(out, buf);
  outTotal += buf.length;
  renames.push([src.replace(/^images\//, ''), out.replace(/^images\//, '')]);
  console.log(`  ${mb(before).padStart(8)} → ${mb(buf.length).padStart(8)} ` +
              `(${(100 - buf.length / before * 100).toFixed(0)}%減)  ${out}`);
}

if(dryRun){
  console.log(`\n${TARGETS.length}枚 計 ${mb(inTotal)}`);
  process.exit(0);
}

// ---- 参照の書き換え ----
// ファイル名だけを見て置換する。パスの書き方（../images/ 等）が
// ゲームごとに違っても拾えるようにするため。
let touched = 0;
for(const file of USERS){
  if(!existsSync(file)) continue;
  let html = readFileSync(file, 'utf8');
  const orig = html;
  for(const [from, to] of renames) html = html.split(from).join(to);
  if(html !== orig){
    writeFileSync(file, html);
    touched++;
    console.log(`  参照を書き換え: ${file}`);
  }
}

// ---- 元のPNGを削除 ----
// 残すと git に両方が入り、軽くした意味が半分になる。
// 原本が要るなら images/source/ のような追跡外の場所へ置くこと。
for(const src of TARGETS){
  if(existsSync(src)) unlinkSync(src);
}

console.log(`\n背景 ${mb(inTotal)} → ${mb(outTotal)} ` +
            `(${(100 - outTotal / inTotal * 100).toFixed(0)}%減)`);
console.log(`参照を書き換えたHTML: ${touched}件 / 元のPNGは削除した`);
