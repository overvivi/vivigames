// 公開ファイルの健全性をまとめて検査する。
//
// 指示書のたびに tail / grep / git diff --check を手で叩いていたが、
// 手順が長いと省略されるうえ、素材の欠落だけは目視でしか気づけなかった。
// 1コマンドへまとめて、必ず同じ検査が走るようにする。
//
//   node tests/verify.cjs
//
// 検査するもの:
//   1. インラインスクリプトの構文
//   2. <script> の開閉数と </html> での終端（base64行を壊す編集の検出）
//   3. 参照している素材が実在するか

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = [
  'index.html',
  'games/temple-run-clone.html',
  'games/boss-battle-demo.html',
  'games/hexamine.html',
  'games/still.html',
  // 制作中で最も編集が多い。base64を1行へ詰めている以上、ここが一番壊れやすい
  'games/hell-runner-2.html',
  'games/todays-champion-motion-preview.html',
  'games/todays-champion.html'
];

// 相対パスの素材参照を拾う。HTMLの属性・CSSのurl()・JSの文字列リテラルをまとめて拾えるよう、
// 引用符か括弧に挟まれた「拡張子付きのパス」を対象にする。
// バッククォートも含めるのは、HELL RUNNER 2 が `.../icons/${def.icon}` のような
// テンプレートリテラルで素材を組み立てているため。
const ASSET_RE = /['"`(]([^'"`()\s]+\.(?:png|jpe?g|webp|gif|svg|ogg|mp3|wav|ico))['"`)]/gi;

// リポジトリ内の全ファイルを basename で引けるようにしておく。
// 素材名だけを配列に持ち、表示時にディレクトリと連結する書き方（HELL RUNNER 2 の能力アイコン）は
// 参照文字列だけでは場所が決まらないため、名前の実在で確認する。
function indexFiles(dir, index){
  for(const entry of fs.readdirSync(dir, { withFileTypes:true })){
    if(entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'test-results') continue;
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()) indexFiles(full, index);
    else index.add(entry.name);
  }
  return index;
}
const fileNames = indexFiles('.', new Set());

let scriptCount = 0;
const problems = [];

for(const file of FILES){
  if(!fs.existsSync(file)){ problems.push(`${file}: ファイルが存在しない`); continue; }
  const html = fs.readFileSync(file, 'utf8');

  // ---- 1. 構文 ----
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1]).filter(s => s.trim());
  for(let i=0;i<scripts.length;i++){
    try {
      new vm.Script(scripts[i], { filename:`${file}-inline-${i+1}.js` });
      scriptCount++;
    } catch (e) {
      problems.push(`${file}: インラインスクリプト${i+1} の構文エラー — ${e.message}`);
    }
  }

  // ---- 2. 構造 ----
  // フォーマッタや不用意な全体書き換えでbase64行が壊れると、まずここに出る。
  const open = (html.match(/<script(?:\s|>)/gi) || []).length;
  const close = (html.match(/<\/script>/gi) || []).length;
  if(open !== close) problems.push(`${file}: <script>の開閉が不一致 (開 ${open} / 閉 ${close})`);
  if(!html.trimEnd().endsWith('</html>')) problems.push(`${file}: </html> で終わっていない`);

  // ---- 3. 素材の実在 ----
  const dir = path.dirname(file);
  const refs = new Set();
  for(const m of html.matchAll(ASSET_RE)){
    const ref = m[1];
    if(/^(?:https?:)?\/\//.test(ref) || ref.startsWith('data:')) continue; // 外部とdata URIは対象外
    refs.add(ref);
  }
  for(const ref of refs){
    const target = ref.split('?')[0];

    // `${...}` を含む参照は、その場では1つに決まらない。差し込み部分を任意の1階層として扱い、
    // 候補が1つも無い時だけ落とす（フォルダごと消えた・綴りを間違えた場合はここで出る）。
    if(target.includes('${')){
      // フォルダを伴わない差し込みは `link.download` に渡す保存名で、読み込む素材ではない。
      const folder = path.posix.dirname(target);
      if(folder === '.') continue;
      // 先に差し込み部分を目印へ逃がしてからエスケープする。順序を逆にすると `$` のエスケープが
      // 目印にも掛かり、出来上がった正規表現が何にも一致しなくなる。
      const MARK = '\u0000';
      const pattern = new RegExp('^' + target
        .replace(/\$\{[^}]*\}/g, MARK)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .split(MARK).join('[^/]*') + '$');
      const base = path.resolve(dir, folder);
      const found = fs.existsSync(base) &&
        fs.readdirSync(base).some(name => pattern.test(folder + '/' + name));
      if(!found) problems.push(`${file}: 参照先の候補が1つも無い — ${ref}`);
      continue;
    }

    // ディレクトリを含まない素材名は、コード側で連結される前提の断片。名前の実在だけを見る。
    if(!target.includes('/')){
      if(!fileNames.has(target)) problems.push(`${file}: その名前の素材がリポジトリに無い — ${ref}`);
      continue;
    }

    const resolved = path.resolve(dir, target);
    if(!fs.existsSync(resolved)) problems.push(`${file}: 参照先が存在しない — ${ref}`);
  }
}

if(problems.length){
  console.error('検査に失敗:');
  for(const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`${FILES.length} ファイル / インラインスクリプト ${scriptCount} 件: 構文・構造・素材参照すべてOK`);
