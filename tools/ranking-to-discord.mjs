// Supabaseのランキングを見て、1位が更新されていたら Discord へ通知する。
//
// 「更新された時だけ」を判定するため、前回通知した1位を tools/ranking-state.json へ
// 残す。ワークフロー側でこのファイルをコミットして次回へ引き継ぐ。
//
// 使い方:
//   node tools/ranking-to-discord.mjs --dry-run    # 送らずに判定結果だけ表示
//   DISCORD_WEBHOOK_URL=... node tools/ranking-to-discord.mjs
//
// 環境変数:
//   DISCORD_WEBHOOK_URL  必須（送信時のみ）
//   NG_WORDS             任意。カンマ区切り。名前に含まれていたら伏せ字にする
//   SUPABASE_URL / SUPABASE_ANON_KEY  任意。未指定ならゲーム本体から読み取る

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const STATE_FILE = 'tools/ranking-state.json';
const SOURCE_HTML = 'games/temple-run-clone.html';

const GAMES = [
  { table: 'runner_scores',      label: 'HELL RUNNER' },
  { table: 'boss_battle_scores', label: '討伐2048' }
];

const dryRun = process.argv.includes('--dry-run');

// ---- Supabaseの接続先 ----
// anonキーはゲームのHTMLへ埋め込まれて公開されているものなので、秘密情報ではない。
// 二重管理を避けるため、既定ではゲーム本体から読み取る。
function resolveSupabase(){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if(url && key) return { url, key };

  const html = readFileSync(SOURCE_HTML, 'utf8');
  const m = html.match(/createClient\(\s*'([^']+)'\s*,\s*'([^']+)'/);
  if(!m) throw new Error(`${SOURCE_HTML} からSupabaseの接続先を読み取れなかった`);
  return { url: m[1], key: m[2] };
}

// ---- 名前の無害化 ----
// ランキングの名前はプレイヤーが自由に入力したもの。無審査でDiscordへ流すため、
// メンションや装飾記法として解釈されないよう必ず通す。
const NG_WORDS = (process.env.NG_WORDS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function sanitizeName(raw){
  // 制御文字（改行を含む）を落とす。改行が混ざると1行のはずの表示が崩れるため
  let name = String(raw ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if(!name) return '（名無し）';

  if(NG_WORDS.some(w => name.toLowerCase().includes(w))){
    return '＊＊＊'; // NGワードに触れた場合は名前ごと伏せる
  }
  // Discordのメンション記法と装飾記法を無効化する。
  // allowed_mentions でも通知は止めているが、表示崩れとなりすましを防ぐため文字自体も潰す。
  name = name
    .replace(/@/g, '＠')
    .replace(/[`*_~|\\<>]/g, '');
  if(name.length > 20) name = name.slice(0, 20) + '…';
  return name || '（名無し）';
}

const fmt = n => Number(n).toLocaleString('ja-JP');

// ---- 現在の1位を取得 ----
const { url, key } = resolveSupabase();
async function fetchTop(table){
  const endpoint = `${url}/rest/v1/${table}?select=name,score&order=score.desc&limit=1`;
  const res = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if(!res.ok) throw new Error(`${table} の取得に失敗: HTTP ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
}

// ---- 前回の状態 ----
const state = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  : {};

const messages = [];
let stateChanged = false;

for(const game of GAMES){
  let top;
  try {
    top = await fetchTop(game.table);
  } catch (e) {
    console.error(`${game.label}: ${e.message}`);
    continue;
  }
  if(!top){
    console.log(`${game.label}: まだ記録が無い`);
    continue;
  }

  const prev = state[game.table];
  const score = Math.floor(Number(top.score) || 0);

  // 初回はスコアを覚えるだけで通知しない。過去の記録を「新記録」として流さないため。
  if(!prev){
    console.log(`${game.label}: 初回のため記録だけ保存する（${fmt(score)}）`);
    state[game.table] = { name: top.name, score };
    stateChanged = true;
    continue;
  }

  // スコアが伸びた時だけ通知する。同点での名義違いや、記録削除による繰り上がりでは流さない。
  if(score <= prev.score){
    console.log(`${game.label}: 更新なし（現在 ${fmt(score)} / 前回 ${fmt(prev.score)}）`);
    continue;
  }

  const name = sanitizeName(top.name);
  const prevName = sanitizeName(prev.name);
  messages.push(
    `👑 **${game.label} 新記録！**\n` +
    `1位: ${name} — ${fmt(score)}\n` +
    `（前回: ${prevName} — ${fmt(prev.score)}）`
  );
  state[game.table] = { name: top.name, score };
  stateChanged = true;
}

if(stateChanged && !dryRun){
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

if(!messages.length){
  console.log('通知する更新は無し。');
  process.exit(0);
}

if(dryRun){
  console.log(`--- 送信内容のプレビュー（${messages.length}通） ---\n`);
  messages.forEach(m => console.log(m + '\n'));
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
    // プレイヤー名が @everyone などでも通知が飛ばないよう、メンションを全面的に無効化する
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } })
  });
  if(!res.ok){
    // WebhookのURLはログへ出さない
    console.error(`Discordへの送信に失敗 (${i+1}通目): HTTP ${res.status}`);
    process.exit(1);
  }
  if(i < messages.length - 1) await new Promise(r => setTimeout(r, 700));
}
console.log(`Discordへ ${messages.length} 通送信した。`);
