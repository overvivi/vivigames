// 正本のソースから関数だけを取り出して動かす。
//
// tools/ のスクリプトは import した時点で Supabase への接続や git diff を始めるため、
// そのまま読み込むとテストが本番へ触ってしまう。かといってテスト側へ写しを持つと
// 必ず食い違う（tools/hex/solver.test.mjs が正本から取り出しているのと同じ理由）。
// そこで宣言行から対応する閉じ括弧までを切り出し、素の文脈で評価する。
//
// 対象ファイルを整形し直して形が変わった場合は、黙って通さずここで落ちる。

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function cut(lines, name, file){
  const start = lines.findIndex(line => {
    const body = line.trimStart();
    return body.startsWith(`function ${name}(`) || body.startsWith(`const ${name} =`)
        || body.startsWith(`const ${name}=`);
  });
  if(start < 0) throw new Error(`${file}: ${name} の宣言を見つけられなかった`);

  // 括弧を開かない1行宣言（const x = ...;）はその行で完結している
  const opener = lines[start].replace(/\s*\/\/.*$/, '').trimEnd().slice(-1);
  if(!'{[('.includes(opener)) return lines[start].trim();

  const indent = lines[start].slice(0, lines[start].length - lines[start].trimStart().length);
  const closers = ['}', '};', ']', '];', ')', ');'].map(c => indent + c);
  for(let i = start + 1; i < lines.length; i++){
    if(closers.includes(lines[i])){
      return lines.slice(start, i + 1).map(l => l.slice(indent.length)).join('\n');
    }
  }
  throw new Error(`${file}: ${name} の終わりを見つけられなかった`);
}

// file から names を取り出し、extra を追加した文脈で評価する。
// 取り出したものと、評価に使った文脈の両方を返す。
// 外側の変数を書き換える関数（地形生成など）は、呼んだあとの文脈を見る必要があるため。
export function loadInContext(file, names, extra = {}){
  const lines = readFileSync(file, 'utf8').split('\n');
  const source = names.map(name => cut(lines, name, file)).join('\n');
  const context = vm.createContext({ console, ...extra });
  vm.runInContext(`${source}\n;globalThis.__api = { ${names.join(', ')} };`, context, { filename: file });
  return { api: context.__api, context };
}

// file から names を取り出し、extra を追加した文脈で評価して返す。
export function loadFunctions(file, names, extra = {}){
  return loadInContext(file, names, extra).api;
}

// Date.now() と new Date() を固定時刻へ差し替えたクラスを作る。
// 日付境界の検証で実時刻に依存させないため。
export function frozenDate(isoString){
  const fixed = Date.parse(isoString);
  return class extends Date {
    constructor(...args){ super(...(args.length ? args : [fixed])); }
    static now(){ return fixed; }
  };
}
