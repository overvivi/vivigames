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

// 対戦素材は全ポーズを同じ640pxキャンバスで切り出してある。公開版では個別WebPのまま読み、
// 実行時のCanvas切り出しをなくすことで、足元や別ポーズが混ざる事故を防ぐ。
const states = ['guard','dash','attack','win','lose'];
mkdirSync(path.join(OUTPUT, 'sprites'), { recursive:true });
for(const id of portraits){
  for(const [index,state] of states.entries()){
    const from = path.join(SOURCE, 'sheets', `${id}${index + 1}.png`);
    const to = path.join(OUTPUT, 'sprites', `${id}-${state}.webp`);
    if(!existsSync(from)){
      console.error(`対戦原画が見つかりません: ${from}`);
      process.exit(1);
    }
    const before = statSync(from).size;
    await sharp(from).webp({ lossless:true, effort:6 }).toFile(to);
    const after = statSync(to).size;
    inputSize += before;
    outputSize += after;
    console.log(`${id}-${state} ${kb(before).padStart(7)} → ${kb(after).padStart(6)}（可逆・透過）`);
  }
}

mkdirSync(path.join(OUTPUT, 'effects'), { recursive:true });
for(const id of portraits){
  const from = path.join(SOURCE, 'effects', `${id}-attack.png`);
  const to = path.join(OUTPUT, 'effects', `${id}-attack.webp`);
  if(!existsSync(from)){
    console.error(`攻撃エフェクト原画が見つかりません: ${from}`);
    process.exit(1);
  }
  const before = statSync(from).size;
  await sharp(from).webp({ lossless:true, effort:6 }).toFile(to);
  const after = statSync(to).size;
  inputSize += before;
  outputSize += after;
  console.log(`${id}-effect ${kb(before).padStart(7)} → ${kb(after).padStart(6)}（可逆・透過）`);
}

const pixelFrom = path.join(SOURCE, 'pixel-character-poses-original.png');
const pixelTo = path.join(OUTPUT, 'pixel-character-poses.webp');
const pixelBefore = statSync(pixelFrom).size;
// 原画の濃紺はキャラの一部ではなく全枠に敷かれた撮影背景。残すと決闘背景の上で四角になるため、
// 輪郭の青紫・黒は残しつつ、この背景域だけを公開用に透明化する。
const pixelRaw = await sharp(pixelFrom).removeAlpha().raw().toBuffer({ resolveWithObject:true });
const pixelRgba = Buffer.alloc(pixelRaw.info.width * pixelRaw.info.height * 4);
for(let src=0,dst=0;src<pixelRaw.data.length;src+=3,dst+=4){
  const r=pixelRaw.data[src],g=pixelRaw.data[src+1],b=pixelRaw.data[src+2];
  const backdrop=r<=12&&g<=18&&b>=20&&b<=48;
  pixelRgba[dst]=r;pixelRgba[dst+1]=g;pixelRgba[dst+2]=b;pixelRgba[dst+3]=backdrop?0:255;
}
await sharp(pixelRgba,{raw:{width:pixelRaw.info.width,height:pixelRaw.info.height,channels:4}}).webp({ lossless:true, effort:6 }).toFile(pixelTo);
const pixelAfter = statSync(pixelTo).size;
inputSize += pixelBefore;
outputSize += pixelAfter;
console.log(`pixel   ${kb(pixelBefore).padStart(7)} → ${kb(pixelAfter).padStart(6)}（可逆）`);

// 初期実装の背景フォールバックを壊さないよう、旧ステージ背景も軽い公開WebPだけを残す。
const stageFrom = path.join(SOURCE, 'stage-bg.png');
const stageTo = path.join(OUTPUT, 'stage-bg.webp');
const stageBefore = statSync(stageFrom).size;
await sharp(stageFrom).resize({ width:1280, withoutEnlargement:true }).webp({ quality:82, effort:6 }).toFile(stageTo);
const stageAfter = statSync(stageTo).size;
inputSize += stageBefore;
outputSize += stageAfter;
console.log(`stage   ${kb(stageBefore).padStart(7)} → ${kb(stageAfter).padStart(6)}`);

// 交差点背景は合図用の信号機も絵へ収め、HTML側では点灯だけを重ねる。
const intersectionFrom = path.join(SOURCE, 'intersection-bg.png');
const intersectionTo = path.join(OUTPUT, 'intersection-bg.webp');
if(!existsSync(intersectionFrom)){
  console.error(`原画が見つかりません: ${intersectionFrom}`);
  process.exit(1);
}
const intersectionBefore = statSync(intersectionFrom).size;
await sharp(intersectionFrom).resize({ width:1280, withoutEnlargement:true }).webp({ quality:82, effort:6 }).toFile(intersectionTo);
const intersectionAfter = statSync(intersectionTo).size;
inputSize += intersectionBefore;
outputSize += intersectionAfter;
console.log(`crossing ${kb(intersectionBefore).padStart(7)} → ${kb(intersectionAfter).padStart(6)}`);
console.log(`合計    ${kb(inputSize).padStart(7)} → ${kb(outputSize).padStart(6)}（${(100 - outputSize / inputSize * 100).toFixed(0)}%減）`);
