const { test, expect } = require('@playwright/test');

test('当日最速の記録を王者として敵に出す', async ({ page })=>{
  await page.route('**/supabase-js@2', route=>route.fulfill({
    contentType:'application/javascript',
    body:`window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({order:()=>({limit:async()=>({data:[{name:'TEST CHAMPION',character_id:'kiri',ms:150}],error:null})})})})})})};`
  }));
  await page.goto('/games/todays-champion.html');

  // 通常NPCの名前ではなく、当日最速の名前とキャラを敵へ反映する。
  await expect(page.locator('#rightName')).toHaveText('TEST CHAMPION');
  await expect(page.locator('#rightSprite')).toHaveAttribute('src',/kiri-guard\.webp$/);

  await page.getByRole('button',{name:'START DUEL'}).click();
  await expect(page.locator('#caution')).toBeVisible();
  await expect(page.locator('#caution')).toContainText('TEST CHAMPION');
  await expect(page.locator('#caution')).toContainText('BREAK THE RECORD. TAKE THE CROWN.');
  await expect(page.locator('#signal')).toHaveText('CHAMPION DETECTED');

  // 王者戦では通常NPCの乱数ではなく、登録された150msで反応する。
  await expect(page.locator('#signal')).toHaveText('NPC WINS',{timeout:8000});
  await expect(page.locator('#result')).toContainText('NPC 150ms');
});

test('開発モードで音源ごとの音量を調整できる', async ({ page })=>{
  await page.goto('/games/todays-champion.html?debug=1');
  const tools=page.locator('.dev-tools');
  await expect(tools).toContainText('AUDIO MIX');
  await expect(tools).toContainText('SIGNAL 1/2');
  await expect(tools).toContainText('SIGNAL 3');
  await expect(tools).toContainText('IMPACT');
  await expect(tools).toContainText('CHAMPION');
  await expect(tools).toContainText('WIN');
  await expect(tools).toContainText('LOSE');
});

test('携帯の調整パネルは見たいゲーム画面側を切り替えられる', async ({ page })=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/todays-champion.html?debug=1');
  const tools=page.locator('.dev-tools');
  const bottom=await tools.evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};});
  // 初期は上半分を見せるため、パネルを下側の半画面に留める。
  expect(bottom.top).toBeGreaterThan(350);
  expect(bottom.height).toBeLessThan(430);
  await page.getByRole('button',{name:/BOTTOM VIEW/}).click();
  const top=await tools.evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom};});
  expect(top.top).toBeLessThan(30);
  expect(top.bottom).toBeLessThan(430);
});
