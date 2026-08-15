const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page })=>{
  await page.route('**/supabase-js@2', route=>route.fulfill({
    contentType:'text/javascript',
    body:'window.supabase={createClient:()=>({from:()=>({select:async()=>({data:[],error:null})})})};'
  }));
});

test('通常URLではデバッグ機能を公開しない', async ({ page })=>{
  await page.goto('/games/temple-run-clone.html');
  await expect(page.locator('#debugPanel')).toBeHidden();
  expect(await page.evaluate(()=>typeof window.__hellRunnerDebug)).toBe('undefined');
});

test('debug=1では距離ジャンプが使える', async ({ page })=>{
  await page.goto('/games/temple-run-clone.html?debug=1');
  await expect(page.locator('#debugPanel')).toBeVisible();
  await expect(page.locator('#debugRecordStart')).toBeEnabled();
  await page.evaluate(()=>{
    window.__hellRunnerDebug.jumpTo(101500);
    window.__hellRunnerDebug.setFrozen(true);
  });
  await expect.poll(()=>page.evaluate(()=>window.__hellRunnerDebug.getState().distanceM)).toBe(101500);
  await expect.poll(()=>page.evaluate(()=>window.__hellRunnerDebug.getState().reaperLoaded)).toBe(true);
});

test('背景の切り替わりと同じ3000mでBGMがクロスフェードする', async ({ page })=>{
  await page.goto('/games/temple-run-clone.html?debug=1');
  await page.locator('#startBtn').click();
  const volumes = await page.evaluate(()=>{
    window.__hellRunnerDebug.previewBGM(16500);
    return window.__hellRunnerDebug.getState().bgm.map(track=>track.volume);
  });
  expect(volumes[0]).toBeCloseTo(0.07, 5);
  expect(volumes[1]).toBeCloseTo(0.07, 5);
  expect(volumes.slice(2)).toEqual([0,0,0,0]);
  const audioMix = await page.evaluate(()=>window.__hellRunnerDebug.getState().audioMix);
  expect(audioMix).toEqual({ bgm:0.14, jump:1.5, coin:1.5, rival:2 });
  await page.locator('#debugBgmVolume').fill('0.34');
  await page.locator('#debugJumpVolume').fill('1.8');
  await page.locator('#debugCoinVolume').fill('1.25');
  await page.locator('#debugRivalVolume').fill('2.4');
  const adjustedMix = await page.evaluate(()=>window.__hellRunnerDebug.getState().audioMix);
  expect(adjustedMix).toEqual({ bgm:0.34, jump:1.8, coin:1.25, rival:2.4 });
  await expect(page.locator('#debugBgmValue')).toHaveText('0.34');
  await page.locator('#debugCollapse').click();
  await expect(page.locator('#debugPanel')).toHaveClass(/collapsed/);
  await expect(page.locator('.debugPanelBody')).toBeHidden();
  await page.locator('#debugCollapse').click();
  await expect(page.locator('.debugPanelBody')).toBeVisible();
});

test('PCではデバッグパネルをゲーム画面外の余白に表示する', async ({ page })=>{
  await page.setViewportSize({ width:1200, height:800 });
  await page.goto('/games/temple-run-clone.html?debug=1');
  const boxes = await page.evaluate(()=>{
    const stage = document.getElementById('stage').getBoundingClientRect();
    const panel = document.getElementById('debugPanel').getBoundingClientRect();
    return { stageRight:stage.right, panelLeft:panel.left };
  });
  expect(boxes.panelLeft).toBeGreaterThan(boxes.stageRight);
});

test('デスイーター通知は1行で表示され、ゲームオーバー時に消える', async ({ page })=>{
  await page.goto('/games/temple-run-clone.html?debug=1');
  await page.evaluate(()=>window.__hellRunnerDebug.showDeathEaterBanner());
  const banner = page.locator('#unlockBanner');
  await expect(banner).toBeVisible();
  await expect(page.locator('#unlockTitle')).toBeHidden();
  await expect(page.locator('#unlockName')).toHaveText('【デスイーター降臨！】');
  expect(await banner.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.evaluate(()=>window.__hellRunnerDebug.endGameNow());
  await expect(page.locator('#overScreen')).toBeVisible();
  await expect(banner).toBeHidden();
  await expect(page.locator('#gameHud')).toBeHidden();
});

test('NO FALLを有効にすると落下判定でもゲームを継続する', async ({ page })=>{
  await page.goto('/games/temple-run-clone.html?debug=1');
  await page.locator('#startBtn').click();
  await page.locator('#debugNoFall').click();
  await expect(page.locator('#debugNoFall')).toHaveText('NO FALL: ON');
  await page.evaluate(()=>window.__hellRunnerDebug.endGameNow());
  const state = await page.evaluate(()=>window.__hellRunnerDebug.getState());
  expect(state.state).toBe('playing');
  expect(state.noFall).toBe(true);
  await expect(page.locator('#overScreen')).toBeHidden();
});

test('デバッグ録画を停止するとWebMを保存する', async ({ page })=>{
  await page.goto('/games/temple-run-clone.html?debug=1');
  await page.locator('#debugRecordStart').click();
  await expect.poll(()=>page.evaluate(()=>window.__hellRunnerDebug.getState().recording)).toBe(true);
  const downloadPromise = page.waitForEvent('download');
  await page.waitForTimeout(250);
  await page.locator('#debugRecordStop').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^hell-runner-.*\.webm$/);
  await expect.poll(()=>page.evaluate(()=>window.__hellRunnerDebug.getState().recording)).toBe(false);
});

test('速度は30000mから100000mまで緩やかに上がる', async ({ page })=>{
  await page.goto('/games/temple-run-clone.html?debug=1');
  const speeds = await page.evaluate(()=>[30000,65000,100000,120000].map(window.__hellRunnerDebug.speedAt));
  expect(speeds).toEqual([640,768,896,896]);
});

test('スマホは横幅いっぱい、PCは縦長比率で3倍の画面密度を使う', async ({ page })=>{
  await page.setViewportSize({ width:390, height:700 });
  await page.goto('/games/temple-run-clone.html');
  const mobile = await page.evaluate(()=>{
    const stage = document.getElementById('stage');
    const canvas = document.getElementById('game');
    return { width:stage.clientWidth, density:canvas.width/stage.clientWidth };
  });
  expect(mobile.width).toBe(390);
  expect(mobile.density).toBe(3);

  await page.setViewportSize({ width:1200, height:800 });
  const desktopRatio = await page.evaluate(()=>{
    window.dispatchEvent(new Event('resize'));
    const stage = document.getElementById('stage');
    return stage.clientWidth/stage.clientHeight;
  });
  expect(desktopRatio).toBeCloseTo(390/844,2);
});

test('長いHUD数値をK表記にしてスクリーンショット操作を表示する', async ({ page })=>{
  await page.goto('/games/temple-run-clone.html?debug=1');
  const labels = await page.evaluate(()=>[9999,10000,10500,100000].map(window.__hellRunnerDebug.formatNumber));
  expect(labels).toEqual(['9999','10K','10.5K','100K']);
  await page.evaluate(()=>{
    window.__hellRunnerDebug.jumpTo(110000);
    window.__hellRunnerDebug.setPanelVisible(false);
  });
  const hudFits = await page.locator('#gameHud .badge').evaluateAll(badges=>badges.every(el=>
    el.scrollWidth<=el.clientWidth && el.scrollHeight<=el.clientHeight
  ));
  expect(hudFits).toBe(true);
  await page.evaluate(()=>window.__hellRunnerDebug.setPanelVisible(true));
  await expect(page.locator('#debugScreenshot')).toBeVisible();
});

test('モバイルのタイトル画面が記録リセット欄まで収まり、遊び方を開ける', async ({ page })=>{
  await page.setViewportSize({ width:390, height:700 });
  await page.goto('/games/temple-run-clone.html');
  const layout = await page.evaluate(()=>{
    const stage = document.getElementById('stage').getBoundingClientRect();
    const logo = document.querySelector('#startScreen .logoImg').getBoundingClientRect();
    const danger = document.querySelector('#startScreen .dangerZone').getBoundingClientRect();
    const widths = [...document.querySelectorAll('.imgBtn img')].map(el=>getComputedStyle(el).width);
    return {
      visible:logo.top>=stage.top && logo.bottom<=stage.bottom && danger.bottom<=stage.bottom,
      sameWidth:new Set(widths).size===1
    };
  });
  expect(layout.visible).toBe(true);
  expect(layout.sameWidth).toBe(true);
  await page.locator('#rulesBtn').click();
  await expect(page.locator('#rulesOverlay')).toBeVisible();
  await page.locator('#closeRulesBtn').click();
  await expect(page.locator('#rulesOverlay')).toBeHidden();
  await page.locator('a[href="../index.html#credits"]').click();
  await expect(page).toHaveURL(/index\.html#credits$/);
});
