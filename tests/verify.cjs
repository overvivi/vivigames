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
  'games/rhythm-game-test.html',
  'games/todays-champion-motion-preview.html',
  'games/todays-champion.html'
];

// 相対パスの素材参照を拾う。HTMLの属性・CSSのurl()・JSの文字列リテラルをまとめて拾えるよう、
// 引用符か括弧に挟まれた「拡張子付きのパス」を対象にする。
const ASSET_RE = /['"(]([^'"()\s]+\.(?:png|jpe?g|webp|gif|svg|ogg|mp3|wav|ico))['")]/gi;

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
    const resolved = path.resolve(dir, ref.split('?')[0]);
    if(!fs.existsSync(resolved)) problems.push(`${file}: 参照先が存在しない — ${ref}`);
  }
}

if(problems.length){
  console.error('検査に失敗:');
  for(const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`${FILES.length} ファイル / インラインスクリプト ${scriptCount} 件: 構文・構造・素材参照すべてOK`);
