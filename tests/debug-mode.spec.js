const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page })=>{
  await page.route('**/supabase-js@2', route=>route.fulfill({
    contentType:'text/javascript',
    body:'window.supabase={createClient:()=>({from:()=>({select:async()=>({data:[],error:null})})})};'
  }));
});

test('通常URLではデバッグ機能を公開しない', async ({ page })=>{
  await page.setViewportSize({ width:1200, height:800 });
  await page.goto('/games/temple-run-clone.html');
  await expect(page.locator('#debugPanel')).toBeHidden();
  await expect(page.locator('.pcControlHint')).toContainText('SPACE');
  await expect(page.locator('.pcControlHint')).toContainText('P / ESC');
  await expect(page.locator('.pcControlHint')).toBeVisible();
  expect(await page.evaluate(()=>typeof window.__hellRunnerDebug)).toBe('undefined');
});

test('短押しは小ジャンプ、長押しは従来相当の大ジャンプになる', async ({ page })=>{
  const loopErrors=[];
  page.on('console',message=>{ if(message.type()==='error'&&message.text().includes('game loop error'))loopErrors.push(message.text()); });
  await page.goto('/games/temple-run-clone.html?debug=1');
  await page.evaluate(()=>window.__hellRunnerDebug.setPanelVisible(false));
  await page.locator('#startBtn').click();
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await expect.poll(()=>page.evaluate(()=>{
    const measure=window.__hellRunnerDebug.getState().jump.measure;
    return !!measure&&!measure.live;
  })).toBe(true);
  const small=await page.evaluate(()=>window.__hellRunnerDebug.getState().jump.measure);

  await page.reload();
  await page.evaluate(()=>window.__hellRunnerDebug.setPanelVisible(false));
  await page.locator('#startBtn').click();
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.keyboard.up('Space');
  await expect.poll(()=>page.evaluate(()=>{
    const measure=window.__hellRunnerDebug.getState().jump.measure;
    return !!measure&&!measure.live;
  })).toBe(true);
  const full=await page.evaluate(()=>window.__hellRunnerDebug.getState().jump.measure);

  expect(small.mode).toBe('SMALL');
  expect(full.mode).toBe('FULL');
  expect(small.airtime).toBeLessThan(full.airtime*0.85);
  expect(small.distance).toBeLessThan(full.distance*0.85);
  expect(small.height).toBeLessThan(full.height*0.85);
  expect(full.height).toBeGreaterThan(180);
  expect(loopErrors).toEqual([]);
});

test('携帯で2本目の指を離しても長押し状態を解除しない', async ({ page })=>{
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/games/temple-run-clone.html?debug=1');
  await page.evaluate(()=>window.__hellRunnerDebug.setPanelVisible(false));
  await page.locator('#startBtn').click();
  const states=await page.evaluate(()=>{
    const stage=document.getElementById('stage');
    const send=(type,id)=>stage.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch'}));
    send('pointerdown',11);
    send('pointerdown',22);
    send('pointerup',22);
    const afterSecond=window.__hellRunnerDebug.getState().jump.holding;
    send('pointerup',11);
    const afterPrimary=window.__hellRunnerDebug.getState().jump.holding;
    return {afterSecond,afterPrimary};
  });
  expect(states).toEqual({afterSecond:true,afterPrimary:false});
});

test('一時停止中は完全静止し、PLAY後も3秒カウントが終わるまで進まない', async ({ page })=>{
  const loopErrors=[];
  page.on('console',message=>{ if(message.type()==='error'&&message.text().includes('game loop error'))loopErrors.push(message.text()); });
  await page.goto('/games/temple-run-clone.html?debug=1');
  await page.evaluate(()=>window.__hellRunnerDebug.setPanelVisible(false));
  await expect(page.locator('#pauseBtn')).toBeHidden();
  await page.locator('#startBtn').click();
  await expect(page.locator('#pauseBtn')).toBeVisible();
  await page.waitForTimeout(180);
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  const stopped=await page.evaluate(()=>window.__hellRunnerDebug.getState());
  await page.waitForTimeout(350);
  const still=await page.evaluate(()=>window.__hellRunnerDebug.getState());
  expect(still.state).toBe('paused');
  expect(still.distanceM).toBe(stopped.distanceM);
  expect(still.jump.y).toBe(stopped.jump.y);
  expect(still.bgm.every(track=>track.paused)).toBe(true);

  await page.locator('#pausePlayBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__hellRunnerDebug.getState().state)).toBe('pauseCountdown');
  const countdownDistance=await page.evaluate(()=>window.__hellRunnerDebug.getState().distanceM);
  await page.waitForTimeout(900);
  expect(await page.evaluate(()=>window.__hellRunnerDebug.getState().distanceM)).toBe(countdownDistance);
  await expect.poll(()=>page.evaluate(()=>window.__hellRunnerDebug.getState().state),{timeout:4500}).toBe('playing');
  await expect.poll(()=>page.evaluate(()=>window.__hellRunnerDebug.getState().distanceM)).toBeGreaterThan(countdownDistance);
  expect(loopErrors).toEqual([]);
});

test('空中停止から再開してもジャンプカットを持ち越さない', async ({ page })=>{
  await page.goto('/games/temple-run-clone.html?debug=1');
  await page.evaluate(()=>window.__hellRunnerDebug.setPanelVisible(false));
  await page.locator('#startBtn').click();
  await page.keyboard.down('Space');
  await expect.poll(()=>page.evaluate(()=>window.__hellRunnerDebug.getState().jump.canCut)).toBe(true);
  await page.locator('#pauseBtn').click();
  await page.keyboard.up('Space');
  const stopped=await page.evaluate(()=>window.__hellRunnerDebug.getState().jump);
  expect(stopped.y).toBeLessThan(0);
  expect(stopped.canCut).toBe(false);
  expect(stopped.holding).toBe(false);
  await page.locator('#pausePlayBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__hellRunnerDebug.getState().state),{timeout:4500}).toBe('playing');
  expect(await page.evaluate(()=>window.__hellRunnerDebug.getState().jump.canCut)).toBe(false);
});

test('携帯の停止ボタン、サウンド保存、TOP、自動停止が安全に動く', async ({ page })=>{
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/games/temple-run-clone.html?debug=1');
  await page.evaluate(()=>window.__hellRunnerDebug.setPanelVisible(false));
  await page.locator('#startBtn').click();
  expect(await page.evaluate(()=>window.__hellRunnerDebug.getState().pauseButtonSize)).toBe(96);
  const pauseBox=await page.locator('#pauseBtn').boundingBox();
  expect(pauseBox.width).toBeGreaterThanOrEqual(48);
  expect(pauseBox.height).toBeGreaterThanOrEqual(48);
  expect(pauseBox.x+pauseBox.width).toBeLessThanOrEqual(390);
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#playerBgmVolume')).toHaveValue('100');
  await expect(page.locator('#playerSfxVolume')).toHaveValue('100');
  expect(await page.evaluate(()=>window.__hellRunnerDebug.getState().playerAudio)).toEqual({enabled:true,bgm:1,sfx:1});
  await page.locator('#playerBgmVolume').fill('35');
  await page.locator('#playerSfxVolume').fill('65');
  await expect(page.locator('#playerBgmVolumeValue')).toHaveText('35%');
  await expect(page.locator('#playerSfxVolumeValue')).toHaveText('65%');
  expect(await page.evaluate(()=>window.__hellRunnerDebug.getState().playerAudio)).toEqual({enabled:true,bgm:0.35,sfx:0.65});
  expect(await page.evaluate(()=>localStorage.getItem('ruinDashBgmVolume_v1'))).toBe('0.35');
  expect(await page.evaluate(()=>localStorage.getItem('ruinDashSfxVolume_v1'))).toBe('0.65');
  await page.locator('#pauseSoundBtn').click();
  await expect(page.locator('#pauseSoundBtn')).toHaveText('サウンド OFF');
  expect(await page.evaluate(()=>localStorage.getItem('ruinDashSoundOff_v1'))).toBe('1');
  await page.reload();
  await page.evaluate(()=>window.__hellRunnerDebug.setPanelVisible(false));
  await page.locator('#startBtn').click();
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#pauseSoundBtn')).toHaveText('サウンド OFF');
  await expect(page.locator('#playerBgmVolume')).toHaveValue('35');
  await expect(page.locator('#playerSfxVolume')).toHaveValue('65');
  await page.locator('#pauseHomeBtn').click();
  await expect(page.locator('#startScreen')).toBeVisible();
  await expect(page).toHaveURL(/temple-run-clone\.html\?debug=1$/);

  await page.locator('#startBtn').click();
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{value:true,configurable:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  expect(await page.evaluate(()=>window.__hellRunnerDebug.getState().state)).toBe('paused');
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
  await page.locator('#debugCollapse').click();
  const volumes = await page.evaluate(()=>{
    window.__hellRunnerDebug.previewBGM(16500);
    return window.__hellRunnerDebug.getState().bgm.map(track=>track.volume);
  });
  expect(volumes[0]).toBeCloseTo(0.15, 5);
  expect(volumes[1]).toBeCloseTo(0.15, 5);
  expect(volumes.slice(2)).toEqual([0,0,0,0]);
  const audioMix = await page.evaluate(()=>window.__hellRunnerDebug.getState().audioMix);
  expect(audioMix).toEqual({ bgm:0.3, jump:2.8, coin:1.5, rival:2 });
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

test('携帯でも音量ミキサーまで表示できる', async ({ page })=>{
  await page.setViewportSize({ width:390, height:700 });
  await page.goto('/games/temple-run-clone.html?debug=1');
  await page.locator('#debugCollapse').click();
  await page.locator('#debugCoinVolume').scrollIntoViewIfNeeded();
  await expect(page.locator('#debugCoinVolume')).toBeVisible();
  await page.locator('#debugJumpCut').scrollIntoViewIfNeeded();
  await expect(page.locator('#debugJumpCut')).toBeVisible();
  await page.locator('#debugJumpCut').fill('0.66');
  await expect(page.locator('#debugJumpCutValue')).toHaveText('0.66');
  expect((await page.evaluate(()=>window.__hellRunnerDebug.getState().jump.releaseCut))).toBe(0.66);
  const panel = page.locator('#debugPanel');
  expect(await panel.evaluate(el=>getComputedStyle(el).touchAction)).toBe('pan-y');
  await page.evaluate(()=>document.getElementById('startBtn').click());
  await page.locator('#debugPauseSize').scrollIntoViewIfNeeded();
  await page.locator('#debugPauseSize').fill('72');
  await expect(page.locator('#debugPauseSizeValue')).toHaveValue('72');
  expect(await page.evaluate(()=>window.__hellRunnerDebug.getState().pauseButtonSize)).toBe(72);
  expect(await page.locator('#pauseBtn img').evaluate(el=>({naturalWidth:el.naturalWidth,width:el.getBoundingClientRect().width}))).toEqual({naturalWidth:128,width:72});
  await page.locator('#debugPauseSizeValue').fill('40');
  await expect(page.locator('#debugPauseSize')).toHaveValue('40');
  expect((await page.locator('#pauseBtn').boundingBox()).width).toBeGreaterThanOrEqual(48);
  expect((await page.locator('#pauseBtn img').boundingBox()).width).toBe(40);
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
  await page.locator('#debugCollapse').click();
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
  await page.locator('#debugCollapse').click();
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
  await expect(page.locator('.pcControlHint')).toBeHidden();
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
