// 本日の最強決定戦の原画は大きいため、公開時は表示密度に合わせたWebPだけを置く。
// 立ち絵はカードの最大表示幅より十分大きい480pxへ、ドット絵は輪郭を崩さない可逆WebPへ変換する。
import sharp from 'sharp';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SOURCE = 'images/todays-champion/source';
const OUTPUT = 'images/todays-champion';
const portraits = ['raven','mika','brick','noise','kiri'];
const kb = n => (n / 1024).toFixed(0) + 'KB';

if(!existsSync(SOURCE)){
  console.error(`${SOURCE} が見つかりません。原画を残したまま公開用素材だけを作る必要があります。`);
  process.exit(1);
}
mkdirSync(path.join(OUTPUT, 'portraits'), { recursive:true });

let inputSize = 0;
let outputSize = 0;
for(const id of portraits){
  const from = path.join(SOURCE, 'portraits', `${id}.png`);
  const to = path.join(OUTPUT, 'portraits', `${id}.webp`);
  if(!existsSync(from)){
    console.error(`原画が見つかりません: ${from}`);
    process.exit(1);
  }
  const before = statSync(from).size;
  await sharp(from).resize({ width:480, withoutEnlargement:true }).webp({ quality:84, effort:6 }).toFile(to);
  const after = statSync(to).size;
  inputSize += before;
  outputSize += after;
  console.log(`${id.padEnd(7)} ${kb(before).padStart(7)} → ${kb(after).padStart(6)}`);
}

const pixelFrom = path.join(SOURCE, 'pixel-character-poses-original.png');
const pixelTo = path.join(OUTPUT, 'pixel-character-poses.webp');
const pixelBefore = statSync(pixelFrom).size;
await sharp(pixelFrom).webp({ lossless:true, effort:6 }).toFile(pixelTo);
const pixelAfter = statSync(pixelTo).size;
inputSize += pixelBefore;
outputSize += pixelAfter;
console.log(`pixel   ${kb(pixelBefore).padStart(7)} → ${kb(pixelAfter).padStart(6)}（可逆）`);
console.log(`合計    ${kb(inputSize).padStart(7)} → ${kb(outputSize).padStart(6)}（${(100 - outputSize / inputSize * 100).toFixed(0)}%減）`);
