// HELL RUNNER 2 の外部画像を、表示サイズに見合った解像度へ縮小する。
//
// 生成時の原本は 1254×1254 前後だが、画面に出るのは能力アイコンで最大150px、
// カード枠でも400px程度。28MBのうち26MBがこの差分で、β配布のたびに
// 全員がこれを読み込むことになる。git履歴にも永久に残る。
//
//   node tools/hr2-images.mjs --dry-run
//   node tools/hr2-images.mjs
//
// 拡張子とファイル名は変えない。ゲームがパス直書きで参照しているため。
// PNGのまま再エンコードする（webpにすると参照側の書き換えが要る）。
//
// スプライトシートは触らない。フレーム位置をピクセルで計算している場合に
// 縮小すると絵がずれるため、確認せずに手を出さない。

import sharp from 'sharp';
import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'images/hell-runner-2';
const dryRun = process.argv.includes('--dry-run');

// width は「画面に出る最大幅の約2倍」。高解像度の画面でも粗が出ない範囲。
const RULES = [
  { dir:'icons',  width:320,  note:'能力アイコン（表示は最大150px前後）' },
  { dir:'frames', width:840,  note:'カード枠・スロット枠' },
  { dir:'ui',     width:512,  note:'ソウルバンク' }
  // collectibles は spritesheet なので対象外
];

const kb = n => (n / 1024).toFixed(0) + 'KB';
const mb = n => (n / 1024 / 1024).toFixed(2) + 'MB';

let inTotal = 0, outTotal = 0, count = 0;

for(const rule of RULES){
  const dir = path.join(ROOT, rule.dir);
  if(!existsSync(dir)){ console.error(`  ${dir} が無い`); continue; }

  console.log(`--- ${rule.dir} : 幅${rule.width}px へ（${rule.note}）---`);
  for(const name of readdirSync(dir)){
    if(!name.endsWith('.png')) continue;
    const file = path.join(dir, name);
    const before = statSync(file).size;
    inTotal += before;

    if(dryRun){
      const meta = await sharp(file).metadata();
      console.log(`  ${kb(before).padStart(7)} ${meta.width}x${meta.height}  ${name}`);
      continue;
    }

    // 透過は必ず保つ。枠もアイコンも背景が抜けている前提の絵。
    const buf = await sharp(file)
      .resize({ width: rule.width, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
      .toBuffer();

    // 稀に元のほうが小さいことがある。その場合は触らない。
    if(buf.length >= before){
      outTotal += before;
      console.log(`  ${name} は元のままにした`);
      continue;
    }

    await sharp(buf).toFile(file);
    const after = statSync(file).size;
    outTotal += after;
    count++;
    console.log(`  ${kb(before).padStart(7)} → ${kb(after).padStart(6)} ` +
                `(${(100 - after / before * 100).toFixed(0)}%減)  ${name}`);
  }
}

if(!dryRun){
  console.log(`\n${count}件を縮小  ${mb(inTotal)} → ${mb(outTotal)} ` +
              `(${(100 - outTotal / inTotal * 100).toFixed(0)}%減)`);
  console.log('spritesheet は対象外のまま（フレーム計算に影響しうるため）');
}
