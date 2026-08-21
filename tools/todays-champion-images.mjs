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

const chibiFrom = path.join(SOURCE, 'chibi-duel-poses.png');
const chibiTo = path.join(OUTPUT, 'chibi-duel-poses.webp');
const chibiBefore = statSync(chibiFrom).size;
await sharp(chibiFrom).webp({ lossless:true, effort:6 }).toFile(chibiTo);
const chibiAfter = statSync(chibiTo).size;
inputSize += chibiBefore;
outputSize += chibiAfter;
console.log(`chibi   ${kb(chibiBefore).padStart(7)} → ${kb(chibiAfter).padStart(6)}（可逆・透過）`);

const resultFrom = path.join(SOURCE, 'chibi-result-poses-v2.png');
const resultTo = path.join(OUTPUT, 'chibi-result-poses-v2.webp');
const resultBefore = statSync(resultFrom).size;
await sharp(resultFrom).webp({ lossless:true, effort:6 }).toFile(resultTo);
const resultAfter = statSync(resultTo).size;
inputSize += resultBefore;
outputSize += resultAfter;
console.log(`result  ${kb(resultBefore).padStart(7)} → ${kb(resultAfter).padStart(6)}（可逆・透過）`);

// 対戦背景はスマホでも一瞬で試合画面へ入れるよう横幅を抑えた公開用WebPにする。
const stageFrom = path.join(SOURCE, 'stage-bg.png');
const stageTo = path.join(OUTPUT, 'stage-bg.webp');
if(!existsSync(stageFrom)){
  console.error(`原画が見つかりません: ${stageFrom}`);
  process.exit(1);
}
const stageBefore = statSync(stageFrom).size;
await sharp(stageFrom).resize({ width:1280, withoutEnlargement:true }).webp({ quality:82, effort:6 }).toFile(stageTo);
const stageAfter = statSync(stageTo).size;
inputSize += stageBefore;
outputSize += stageAfter;
console.log(`stage   ${kb(stageBefore).padStart(7)} → ${kb(stageAfter).padStart(6)}`);
console.log(`合計    ${kb(inputSize).padStart(7)} → ${kb(outputSize).padStart(6)}（${(100 - outputSize / inputSize * 100).toFixed(0)}%減）`);
