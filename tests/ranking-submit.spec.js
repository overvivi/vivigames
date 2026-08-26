const { test, expect } = require('@playwright/test');

// ランキング登録ボタンの状態遷移を検証する。
//
// 既存のテストはどれも Supabase を「必ず成功するスタブ」へ置き換えているため、
// 送信が失敗した時の道（`失敗…もう一度` へ戻して押し直せる）と、
// 成功後に二重送信させない仕組みが、一度も動かされていなかった。
// ランキングは全員で共有する記録なので、二重登録も送りっぱなしの取りこぼしも痛い。
//
// 対象は HELL RUNNER 2。βとして公開中で、専用テーブルへ書き込む唯一のゲームのため。

const GAME = '/games/hell-runner-2.html?debug=1';

// insert の結果をテストから切り替えられるスタブ。
// window.__insertOutcome を 'ok' / 'error' / 'throw' で差し替えて使う。
async function stubRanking(page){
  await page.addInitScript(()=>{
    window.__insertOutcome = 'ok';
    window.__insertCalls = [];
    window.supabase = { createClient:()=>({
      from:(table)=>({
        select(){ return this; },
        order(){ return this; },
        limit(){ return Promise.resolve({ data:[], error:null }); },
        insert(row){
          window.__insertCalls.push({ table, row });
          if(window.__insertOutcome === 'error') return Promise.resolve({ error:{ message:'テスト用の失敗' } });
          if(window.__insertOutcome === 'throw') return Promise.reject(new Error('テスト用の通信断'));
          return Promise.resolve({ error:null });
        }
      })
    }) };
  });
}

// ゲームオーバーまで進めて、名前入力欄が出た状態にする
async function reachNameInput(page){
  await page.goto(GAME);
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>window.__hellRunnerDebug);
  await page.evaluate(()=>window.__hellRunnerDebug.endGameNow());
  await expect(page.locator('#overScreen')).toBeVisible();
  await expect(page.locator('#nameInput')).toBeVisible();
}

test('名前が空のままでは送信しない', async ({ page })=>{
  await stubRanking(page);
  await reachNameInput(page);

  await page.locator('#submitScoreBtn').click();
  expect(await page.evaluate(()=>window.__insertCalls.length)).toBe(0);
  // 押しても無効化されない。名前を入れれば続けて送れる状態のまま
  await expect(page.locator('#submitScoreBtn')).toBeEnabled();

  // 空白だけも同じ扱い
  await page.locator('#nameInput').fill('   ');
  await page.locator('#submitScoreBtn').click();
  expect(await page.evaluate(()=>window.__insertCalls.length)).toBe(0);
});

test('送信に失敗したら押し直せる状態へ戻す', async ({ page })=>{
  await stubRanking(page);
  await reachNameInput(page);
  await page.evaluate(()=>{ window.__insertOutcome = 'error'; });

  await page.locator('#nameInput').fill('テスト');
  await page.locator('#submitScoreBtn').click();

  await expect(page.locator('#submitScoreBtn')).toHaveText('失敗…もう一度');
  await expect(page.locator('#submitScoreBtn')).toBeEnabled();

  // 通信が復活したら、同じ画面からそのまま登録できる
  await page.evaluate(()=>{ window.__insertOutcome = 'ok'; });
  await page.locator('#submitScoreBtn').click();
  await expect(page.locator('#submitScoreBtn')).toHaveText('登録しました！');
  expect(await page.evaluate(()=>window.__insertCalls.length)).toBe(2);
});

test('例外で落ちた時も失敗として扱う', async ({ page })=>{
  await stubRanking(page);
  await reachNameInput(page);
  await page.evaluate(()=>{ window.__insertOutcome = 'throw'; });

  await page.locator('#nameInput').fill('テスト');
  await page.locator('#submitScoreBtn').click();
  await expect(page.locator('#submitScoreBtn')).toHaveText('失敗…もう一度');
  await expect(page.locator('#submitScoreBtn')).toBeEnabled();
});

test('登録に成功したら、押し直しても二重に送らない', async ({ page })=>{
  await stubRanking(page);
  await reachNameInput(page);

  await page.locator('#nameInput').fill('テスト');
  await page.locator('#submitScoreBtn').click();
  await expect(page.locator('#submitScoreBtn')).toHaveText('登録しました！');

  // 守りは2つある。ボタンを押せなくすることと、送る点数を手放すこと。
  // 前者だけだと、何かの拍子にボタンが戻った時に同じ記録がもう1件入る。
  await expect(page.locator('#submitScoreBtn')).toBeDisabled();

  // ボタンだけ強制的に戻して、点数側の守りが効いているかを見る
  await page.locator('#submitScoreBtn').evaluate(el=>{ el.disabled = false; });
  await page.locator('#submitScoreBtn').click();
  await page.locator('#submitScoreBtn').click();
  expect(await page.evaluate(()=>window.__insertCalls.length)).toBe(1);
});

test('βの記録は専用テーブルへ入れる', async ({ page })=>{
  await stubRanking(page);
  await reachNameInput(page);

  await page.locator('#nameInput').fill('テスト');
  await page.locator('#submitScoreBtn').click();
  await expect(page.locator('#submitScoreBtn')).toHaveText('登録しました！');

  const calls = await page.evaluate(()=>window.__insertCalls);
  expect(calls).toHaveLength(1);
  // 無印(runner_scores)へ混ぜない。βは点数の意味が違う
  expect(calls[0].table).toBe('runner_scores_hell_runner_2_draft');
  expect(calls[0].row.name).toBe('テスト');
  expect(Number.isInteger(calls[0].row.score)).toBe(true);
});
