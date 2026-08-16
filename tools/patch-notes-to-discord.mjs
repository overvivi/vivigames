// index.html のパッチノートのうち「今回のコミットで追加された分だけ」を Discord へ送る。
//
// 「どこまで送ったか」を別途記録せずに済むよう、ファイル全体ではなく git の差分を見る。
// 追加された <div class="patch-entry"> の行だけが対象になるため、送信済みのものが
// 再送されることがない。
//
// 使い方:
//   node tools/patch-notes-to-discord.mjs --base HEAD~1 --dry-run   # 送らずに内容だけ表示
//   DISCORD_WEBHOOK_URL=... node tools/patch-notes-to-discord.mjs --base HEAD~1
//
// Webhook URL は引数で渡さない。環境変数だけで受け取る。
// コマンド履歴やCIのログに残ると、誰でもそのチャンネルへ投稿できてしまうため。

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TARGET_FILE = 'index.html';
const DISCORD_LIMIT = 2000; // Discordの1メッセージあたりの文字数上限

function arg(name, fallback){
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i+1] ? process.argv[i+1] : fallback;
}
const base = arg('--base', 'HEAD~1');
const dryRun = process.argv.includes('--dry-run');
// --all: 差分を見ず、現在のパッチノートを全部送る。Discordチャンネルを作った直後に
// 過去分をまとめて流すためのモード。通常運用では使わない（毎回全件が再送されるため）。
const sendAll = process.argv.includes('--all');

// ---- HTML を Discord 向けの素のテキストへ ----
function decodeEntities(s){
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // &amp; は最後。先に戻すと他の実体参照を二重復元してしまう
}
function stripTags(s){
  return decodeEntities(s.replace(/<[^>]*>/g, '')).trim();
}

// 1行の <div class="patch-entry"> から、バージョンと項目を取り出す
function parseEntry(line){
  const version = stripTags((line.match(/<strong>([\s\S]*?)<\/strong>/) || [])[1] || '');
  const items = [...line.matchAll(/<li>([\s\S]*?)<\/li>/g)]
    .map(m => stripTags(m[1]))
    .filter(Boolean);
  if(!version && !items.length) return null;
  return { version, items };
}

// ---- 対象となる patch-entry の行を決める ----
let addedSet = null; // null は「全件対象」を意味する
if(!sendAll){
  let diff = '';
  try {
    diff = execFileSync('git', ['diff', '--unified=0', `${base}`, 'HEAD', '--', TARGET_FILE], { encoding: 'utf8' });
  } catch {
    console.error(`git diff に失敗した（base=${base}）。履歴の深さが足りない可能性がある。`);
    process.exit(1);
  }
  const addedLines = diff
    .split('\n')
    .filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .map(l => l.slice(1))
    .filter(l => l.includes('class="patch-entry"'));

  if(!addedLines.length){
    console.log('追加されたパッチノートは無し。何も送らずに終了する。');
    process.exit(0);
  }
  addedSet = new Set(addedLines.map(l => l.trim()));
}

// ---- どのゲームの項目かを、直前の <h3> から判定する ----
// 差分だけではゲーム名が分からないため、現在の index.html を上から辿って対応付ける。
//
// あわせて PATCH NOTES ダイアログの中だけに限定する。patch-entry クラスは
// NEWS ダイアログでも使われており、限定しないとお知らせまでパッチノートとして流れてしまう。
const fileLines = readFileSync(TARGET_FILE, 'utf8').split('\n');
const found = [];
let currentGame = '';
let inPatchDialog = false;
for(const line of fileLines){
  if(line.includes('id="patch-dialog"')) inPatchDialog = true;
  if(!inPatchDialog) continue;

  const h3 = line.match(/<h3>([\s\S]*?)<\/h3>/);
  if(h3) currentGame = stripTags(h3[1]);
  if(line.includes('class="patch-entry"') && (addedSet === null || addedSet.has(line.trim()))){
    const entry = parseEntry(line);
    if(entry) found.push({ game: currentGame, ...entry });
  }

  // 開始と終了が同じ行にある場合もあるため、判定は必ず開始チェックの後に置く
  if(line.includes('</dialog>')) inPatchDialog = false;
}

// 全件モードでは古い順に並べ替える。HTMLは新しい版が上だが、Discordは下へ流れるため、
// そのまま送ると新→古の逆順に見えてしまう。ゲームの並びは元のまま保つ。
if(sendAll){
  const byGame = new Map();
  for(const e of found){
    if(!byGame.has(e.game)) byGame.set(e.game, []);
    byGame.get(e.game).push(e);
  }
  found.length = 0;
  for(const [, entries] of byGame) found.push(...entries.reverse());
}

if(!found.length){
  console.log('追加行は見つかったが、解析できる項目が無かった。何も送らない。');
  process.exit(0);
}

// ---- メッセージを組み立てる ----
const blocks = found.map(e => {
  const head = `**${[e.game, e.version].filter(Boolean).join(' ')}**`;
  const body = e.items.map(i => `・${i}`).join('\n');
  return body ? `${head}\n${body}` : head;
});

// Discordの2000文字制限に収まるよう、ブロック単位で詰めて分割する。
// 1ブロック単体で超える場合だけ、やむを得ず行単位で切る。
const messages = [];
let buf = '';
for(const block of blocks){
  if(block.length > DISCORD_LIMIT){
    if(buf){ messages.push(buf); buf = ''; }
    let rest = block;
    while(rest.length > DISCORD_LIMIT){
      let cut = rest.lastIndexOf('\n', DISCORD_LIMIT);
      if(cut <= 0) cut = DISCORD_LIMIT;
      messages.push(rest.slice(0, cut));
      rest = rest.slice(cut).replace(/^\n/, '');
    }
    if(rest) buf = rest;
    continue;
  }
  const candidate = buf ? `${buf}\n\n${block}` : block;
  if(candidate.length > DISCORD_LIMIT){
    messages.push(buf);
    buf = block;
  } else {
    buf = candidate;
  }
}
if(buf) messages.push(buf);

if(dryRun){
  console.log(`--- 送信内容のプレビュー（${messages.length}通） ---\n`);
  messages.forEach((m, i) => console.log(`[${i+1}/${messages.length}]\n${m}\n`));
  process.exit(0);
}

const webhook = process.env.DISCORD_WEBHOOK_URL;
if(!webhook){
  console.error('DISCORD_WEBHOOK_URL が未設定。送信を中止する。');
  process.exit(1);
}

for(const [i, content] of messages.entries()){
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // パッチノートに @everyone 等が紛れても通知が飛ばないようにする
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } })
  });
  if(!res.ok){
    // 本文にWebhook URLを含めない。ログへ残すと誰でも投稿できてしまうため
    console.error(`Discordへの送信に失敗 (${i+1}通目): HTTP ${res.status}`);
    process.exit(1);
  }
  // 連続投稿でのレート制限を避けるため少し待つ
  if(i < messages.length - 1) await new Promise(r => setTimeout(r, 700));
}
console.log(`Discordへ ${messages.length} 通送信した。`);
