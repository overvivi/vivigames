// ポータルの素材を、表示サイズに合わせて縮小しつつ webp へ変換する。
//
// 生成AIが出す原本は解像度が過剰で、そのまま置くとポータルが数MB単位で重くなる。
// 原本は images/portal/source/ に残し（.gitignore 対象）、
// 公開に使う webp だけを images/portal/ へ書き出して追跡する。
//
//   node tools/portal-images.mjs            # 変換する
//   node tools/portal-images.mjs --dry-run  # 何をするかだけ表示する
//
// 素材が増えたら TARGETS へ1行足す。

import sharp from 'sharp';
import { readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = 'images/portal/source';
const OUT = 'images/portal';
const dryRun = process.argv.includes('--dry-run');

// width は「画面に出る最大の幅の約2倍」。高解像度の画面でも粗が出ない範囲で、
// これ以上大きくしても見た目が変わらない値にしてある。
const TARGETS = [
  { src:'arcade-bg-desktop.png',          out:'arcade-bg-desktop.webp',      width:2560, note:'秘密基地背景（PC）' },
  { src:'arcade-bg-mobile.png',           out:'arcade-bg-mobile.webp',       width:1080, note:'秘密基地背景（携帯）' },
  { src:'console-body-pattern-1.png',    out:'console-body.webp',           width:1520, note:'本体（表示は最大760px）' },
  { src:'cart-label-hell-runner-draft.png', out:'cart-label-hell-runner.webp', width:640,  note:'ラベル（画面に約260px）' },
  { src:'cart-label-hell-runner-2-beta.png', out:'cart-label-hell-runner-2-beta.webp', width:640, note:'HELL RUNNER 2 βラベル' },
  { src:'cart-label-boss-2048-draft.png',  out:'cart-label-boss-2048.webp',   width:640,  note:'ラベル' },
  { src:'cart-label-hexamine-draft.png',   out:'cart-label-hexamine.webp',    width:640,  note:'ラベル' },
  { src:'cart-label-todays-champion.png',  out:'cart-label-todays-champion.webp', width:640, note:'本日の最強決定戦ラベル' },
  { src:'cart-label-still.png',            out:'cart-label-still.webp',       width:640,  note:'STILLラベル' },
  { src:'cart-label-solitaire.png',        out:'cart-label-solitaire.webp',   width:640,  note:'SOLITAIREラベル' },
  { src:'cart-label-immune-defense.png',  out:'cart-label-immune-defense.webp', width:640, note:'IMMUNE DEFENSEラベル' }
];

const kb = n => (n / 1024).toFixed(0) + 'KB';

if(!existsSync(SRC)){
  console.error(`${SRC} が無い。原本は履歴に残さない方針なので、手元に用意すること。`);
  process.exit(1);
}

let totalIn = 0, totalOut = 0, failed = 0;

for(const t of TARGETS){
  const from = path.join(SRC, t.src);
  const to = path.join(OUT, t.out);
  if(!existsSync(from)){
    console.error(`  未検出: ${t.src}`);
    failed++;
    continue;
  }
  const inSize = statSync(from).size;
  totalIn += inSize;

  if(dryRun){
    console.log(`  ${t.src}\n    → ${t.out}  幅${t.width}  ${t.note}`);
    continue;
  }

  // 透過を保つ。本体は切り抜きとマスクの両方に使うので、アルファが崩れると成立しない。
  const buf = await sharp(from)
    .resize({ width: t.width, withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 100, effort: 6 })
    .toBuffer();

  await sharp(buf).toFile(to);
  const outSize = statSync(to).size;
  totalOut += outSize;
  const meta = await sharp(to).metadata();
  console.log(`  ${t.out.padEnd(30)} ${meta.width}x${meta.height} ` +
              `${kb(inSize).padStart(8)} → ${kb(outSize).padStart(7)} ` +
              `(${(100 - outSize / inSize * 100).toFixed(0)}%減)  α=${meta.hasAlpha}`);
}

if(!dryRun && totalOut){
  console.log(`\n合計 ${kb(totalIn)} → ${kb(totalOut)} (${(100 - totalOut / totalIn * 100).toFixed(0)}%減)`);
}
if(failed){
  console.error(`\n${failed} 件が見つからなかった。`);
  process.exit(1);
}
