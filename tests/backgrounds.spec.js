const { test, expect } = require('@playwright/test');

const zones = [
  ['01-hell', 0, 'hell'],
  ['02-graveyard', 18000, 'graveyard'],
  ['03-forest', 34500, 'forest'],
  ['04-ruins', 56500, 'ruins'],
  ['05-cliff', 79500, 'cliff'],
  ['06-hope', 101500, 'hope']
];

test.beforeEach(async ({ page })=>{
  // ランキング通信は背景テストと無関係なので、外部接続なしでも起動できる最小スタブに置き換える。
  await page.route('**/supabase-js@2', route=>route.fulfill({
    contentType:'text/javascript',
    body:'window.supabase={createClient:()=>({from:()=>({select:async()=>({data:[],error:null})})})};'
  }));
  await page.goto('/games/temple-run-clone.html?debug=1');
  await page.waitForFunction(()=>window.__hellRunnerDebug);
});

for(const [name,distanceM,key] of zones){
  test(`${name} background`, async ({ page })=>{
    await page.evaluate(m=>{
      window.__hellRunnerDebug.jumpTo(m);
      window.__hellRunnerDebug.setFrozen(true);
      window.__hellRunnerDebug.setPanelVisible(false);
    },distanceM);
    await page.waitForFunction(k=>window.__hellRunnerDebug.getState().backgroundsLoaded.includes(k),key);
    await page.waitForFunction(()=>window.__hellRunnerDebug.getState().groundLoaded);
    if(distanceM>=20000) await page.waitForFunction(()=>window.__hellRunnerDebug.getState().reaperLoaded);
    // 画像のload完了とCanvasの再描画は別フレームなので、読み込み直後に旧描画を撮らないよう待つ。
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    // Canvasは自動再試行の途中で別フレームを拾うことがあるため、確定した1枚を直接比較する。
    const screenshot = await page.locator('#stage').screenshot({animations:'disabled',caret:'hide'});
    expect(screenshot).toMatchSnapshot(`${name}.png`,{maxDiffPixelRatio:0.01});
  });
}
