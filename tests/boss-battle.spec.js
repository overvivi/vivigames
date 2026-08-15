const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page })=>{
  // 外部CDNの成否でゲーム本体の検証が止まらないよう、ランキング通信だけテスト用に置き換える。
  await page.addInitScript(()=>{
    window.supabase = { createClient:()=>({
      from:()=>({
        select(){ return this; },
        order(){ return Promise.resolve({data:[],error:null}); },
        insert(){ return Promise.resolve({error:null}); }
      })
    }) };
  });
});

test('チャレンジ得点は盤面に残った全タイルの合計になる', async ({ page })=>{
  await page.goto('/games/boss-battle-demo.html?debug=1');
  const score = await page.evaluate(()=>window.__bossBattleDebug.scoreForGrid([
    11,10,9,8,
    7,6,5,4,
    3,2,1,0,
    1,2,3,4
  ]));
  expect(score).toBe(4124);
});

test('通常URLでは討伐2048のデバッグ機能を公開しない', async ({ page })=>{
  await page.goto('/games/boss-battle-demo.html');
  expect(await page.evaluate(()=>window.__bossBattleDebug)).toBeUndefined();
});
