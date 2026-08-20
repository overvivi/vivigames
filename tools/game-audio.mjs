// ゲームHTMLへ埋め込まれたBGMを、ビットレートを下げて入れ直す。
//
// 討伐2048 は 7.2MB のうち約5.2MB がBGMだった。Vorbis 160kbps ステレオで、
// ループするゲームBGM、しかも大半がスマホ再生という用途には過剰だった。
// ポータルの初回読み込みが重くなる一番の原因なので、ここを削る。
//
//   node tools/game-audio.mjs games/boss-battle-demo.html --dry-run
//   node tools/game-audio.mjs games/boss-battle-demo.html --bitrate 80
//
// フォーマットは Ogg Vorbis のまま変えない。いま動いている再生環境を
// いじる理由が無く、ビットレートを下げるだけで目的を達せられるため。

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const bIdx = args.indexOf('--bitrate');
const bitrate = bIdx >= 0 ? Number(args[bIdx + 1]) : 80;

if(!file){
  console.error('使い方: node tools/game-audio.mjs <ゲームのHTML> [--bitrate 80] [--dry-run]');
  process.exit(1);
}

// 埋め込みの形: key: { b64:'T2dnUw...'
// 長さで絞ることで、アイコン等の小さな base64 を巻き込まない。
const EMBED = /(\w+)\s*:\s*\{\s*b64\s*:\s*'([A-Za-z0-9+/=]{5000,})'/g;

const kb = n => (n / 1024).toFixed(0) + 'KB';
const mb = n => (n / 1024 / 1024).toFixed(2) + 'MB';

let html = readFileSync(file, 'utf8');
const before = statSync(file).size;

const hits = [...html.matchAll(EMBED)];
if(!hits.length){
  console.error(`${file}: 埋め込みBGMが見つからない`);
  process.exit(1);
}

const work = mkdtempSync(path.join(tmpdir(), 'gameaudio-'));
let inTotal = 0, outTotal = 0;
const swaps = new Map();

try {
  for(const m of hits){
    const [ , name, b64 ] = m;
    const src = Buffer.from(b64, 'base64');
    inTotal += src.length;

    if(dryRun){
      console.log(`  ${name.padEnd(10)} ${kb(src.length).padStart(8)}`);
      continue;
    }

    const inFile = path.join(work, name + '.ogg');
    const outFile = path.join(work, name + `-${bitrate}k.ogg`);
    writeFileSync(inFile, src);

    execFileSync(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', inFile, '-c:a', 'libvorbis', '-b:a', `${bitrate}k`, outFile
    ]);

    const out = readFileSync(outFile);
    outTotal += out.length;
    swaps.set(b64, out.toString('base64'));

    console.log(`  ${name.padEnd(10)} ${kb(src.length).padStart(8)} → ${kb(out.length).padStart(7)} ` +
                `(${(100 - out.length / src.length * 100).toFixed(0)}%減)`);
  }

  if(dryRun){
    console.log(`\n${hits.length}曲 計 ${mb(inTotal)} / ${bitrate}kbps へ変換する予定`);
    process.exit(0);
  }

  // 置換は関数で行う。base64 に $ は現れないが、置換文字列の特殊記法を
  // 踏まないようにしておく。
  let replaced = 0;
  html = html.replace(EMBED, (whole, name, b64) => {
    const next = swaps.get(b64);
    if(!next) return whole;
    replaced++;
    return whole.replace(b64, () => next);
  });

  if(replaced !== hits.length){
    console.error(`置換数が合わない (${replaced} / ${hits.length})。中止する。`);
    process.exit(1);
  }

  writeFileSync(file, html);
  const after = statSync(file).size;
  console.log(`\n音声 ${mb(inTotal)} → ${mb(outTotal)}`);
  console.log(`${file}  ${mb(before)} → ${mb(after)} (${(100 - after / before * 100).toFixed(0)}%減)`);
} finally {
  rmSync(work, { recursive:true, force:true });
}
