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

async function startBattle(page){
  await page.goto('/games/boss-battle-demo.html?debug=1');
  const closeRules = page.locator('#closeRulesBtn');
  if(await page.locator('#rulesOverlay').evaluate(el=>el.classList.contains('show'))) await closeRules.click();
  await page.locator('.heroCard').first().click();
  await page.locator('#startBattleBtn').click();
  await expect(page.locator('#pauseBtn')).toBeVisible();
}

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

test('スライドと合体の既存ルールを維持する', async ({ page })=>{
  await page.goto('/games/boss-battle-demo.html?debug=1');
  const cases = [
    {input:[0,0,0,0], arr:[0,0,0,0], mergedTiers:[], mergedAt:[]},
    {input:[1,0,0,0], arr:[1,0,0,0], mergedTiers:[], mergedAt:[]},
    {input:[0,0,0,1], arr:[1,0,0,0], mergedTiers:[], mergedAt:[]},
    {input:[1,1,0,0], arr:[2,0,0,0], mergedTiers:[2], mergedAt:[0]},
    {input:[1,1,1,1], arr:[2,2,0,0], mergedTiers:[2,2], mergedAt:[0,1]},
    {input:[1,1,2,0], arr:[2,2,0,0], mergedTiers:[2], mergedAt:[0]},
    {input:[2,1,1,0], arr:[2,2,0,0], mergedTiers:[2], mergedAt:[1]}
  ];
  const results = await page.evaluate(cases=>cases.map(({input})=>window.__bossBattleDebug.slideAndMergeGrid(input)),cases);
  results.forEach((result,i)=>{
    expect(result.arr).toEqual(cases[i].arr);
    expect(result.mergedTiers).toEqual(cases[i].mergedTiers);
    expect(result.mergedAt).toEqual(cases[i].mergedAt);
  });
});

test('移動元を追跡し、4方向を同じ座標変換で扱う', async ({ page })=>{
  await page.goto('/games/boss-battle-demo.html?debug=1');
  const result = await page.evaluate(()=>({
    fromCases:[
      [1,0,0,0], [0,0,0,1], [1,1,0,0], [1,1,1,1]
    ].map(line=>window.__bossBattleDebug.slideAndMergeGrid(line).from),
    cells:Object.fromEntries(['left','right','up','down'].map(dir=>[
      dir, Array.from({length:4},(_,i)=>Array.from({length:4},(_,k)=>window.__bossBattleDebug.cellForDir(dir,i,k)))
    ]))
  }));
  expect(result.fromCases).toEqual([
    [0,-1,-1,-1], [3,-1,-1,-1], [1,-1,-1,-1], [1,3,-1,-1]
  ]);
  expect(result.cells).toEqual({
    left:[[0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15]],
    right:[[3,2,1,0],[7,6,5,4],[11,10,9,8],[15,14,13,12]],
    up:[[0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15]],
    down:[[12,8,4,0],[13,9,5,1],[14,10,6,2],[15,11,7,3]]
  });
});

test('一時停止中は演出を止め、音量を保存して再開できる', async ({ page })=>{
  await startBattle(page);
  await page.keyboard.press('ArrowDown');
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  const paused = await page.evaluate(()=>window.__bossBattleDebug.getState());
  await page.waitForTimeout(180);
  const still = await page.evaluate(()=>window.__bossBattleDebug.getState());
  expect(paused.battlePaused).toBe(true);
  expect(still.animT).toBe(paused.animT);
  expect(still.gridMoveT).toBe(paused.gridMoveT);

  await page.locator('#pauseBgmVolume').fill('35');
  await page.locator('#pauseSfxVolume').fill('60');
  expect(await page.evaluate(()=>({
    bgm:localStorage.getItem('bossBattleBgmVolume'),
    sfx:localStorage.getItem('bossBattleSfxVolume')
  }))).toEqual({bgm:'0.35',sfx:'0.6'});

  await page.locator('#pauseResumeBtn').click();
  await expect(page.locator('#pauseOverlay')).not.toHaveClass(/show/);
  await expect.poll(()=>page.evaluate(()=>window.__bossBattleDebug.getState().animT)).toBeGreaterThan(paused.animT);
});

test('一時停止メニューからRETRYとHOMEを選べる', async ({ page })=>{
  await startBattle(page);
  await page.locator('#pauseBtn').click();
  await page.locator('#pauseRetryBtn').click();
  await expect(page.locator('#pauseOverlay')).not.toHaveClass(/show/);
  let state = await page.evaluate(()=>window.__bossBattleDebug.getState());
  expect(state.battlePaused).toBe(false);
  expect(state.grid.filter(v=>v>0)).toHaveLength(2);

  await page.locator('#pauseBtn').click();
  await page.locator('#pauseHomeBtn').click();
  await expect(page.locator('#selectScreen')).toBeVisible();
  state = await page.evaluate(()=>window.__bossBattleDebug.getState());
  expect(state.inBattle).toBe(false);
});

test('携帯でも停止ボタンがHPバーと重ならない', async ({ page })=>{
  await page.setViewportSize({width:390,height:844});
  await startBattle(page);
  const pauseBox = await page.locator('#pauseBtn').boundingBox();
  const hpBox = await page.locator('#hpOuter').boundingBox();
  expect(await page.locator('#pauseBtn img').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}))).toEqual({width:128,height:128});
  expect(pauseBox.width).toBeGreaterThanOrEqual(48);
  expect(pauseBox.height).toBeGreaterThanOrEqual(48);
  expect(pauseBox.y).toBeGreaterThanOrEqual(hpBox.y+hpBox.height);
  expect(pauseBox.x).toBeGreaterThanOrEqual(0);
  expect(pauseBox.x+pauseBox.width).toBeLessThanOrEqual(390);
});

test('デバッグモードで全ボスを一時解放し、ボタン・勇者・各ボスのサイズと位置を調整できる', async ({ page })=>{
  await page.setViewportSize({width:1200,height:800});
  await page.goto('/games/boss-battle-demo.html?debug=1');
  await expect(page.locator('#debugPanel')).toBeVisible();
  expect(await page.locator('.stageCard2:not(.challengeCard)').count()).toBe(3);
  expect(await page.locator('.stageCard2.locked').count()).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('bossDemoUnlockedStages'))).toBeNull();

  await page.locator('#debug-pauseSize-range').fill('88');
  await page.locator('#debug-pauseX-number').fill('24');
  await page.locator('#debug-pauseY-number').fill('92');
  await page.locator('#debug-heroSize-number').fill('96');
  await page.locator('#debug-heroX-number').fill('21.5');
  await page.locator('#debug-heroY-number').fill('87.5');
  await page.locator('#debug-mimicSize-number').fill('101');
  await page.locator('#debug-dragonSize-number').fill('122');
  await page.locator('#debug-dragonX-number').fill('72.5');
  await page.locator('#debug-demonSize-number').fill('143');
  await page.locator('#debug-demonY-number').fill('34.5');
  const values = await page.evaluate(()=>window.__bossBattleDebug.getState().debugValues);
  expect(values).toMatchObject({pauseSize:88,pauseX:24,pauseY:92,heroSize:96,heroX:21.5,heroY:87.5,mimicSize:101,dragonSize:122,dragonX:72.5,demonSize:143,demonY:34.5});
  expect(await page.locator('#pauseBtn').evaluate(el=>getComputedStyle(el).getPropertyValue('--pause-size').trim())).toBe('88px');
  expect(await page.locator('#pauseBtn').evaluate(el=>({left:el.style.left,top:el.style.top}))).toEqual({left:'24px',top:'92px'});

  await page.locator('#debugCopyBtn').click();
  await expect(page.locator('#debugOutput')).toBeVisible();
  expect(JSON.parse(await page.locator('#debugOutput').inputValue())).toEqual({
    pause:{size:88,x:24,y:92},
    hero:{size:96,x:21.5,y:87.5},
    bosses:{mimic:{size:101,x:73.4,y:33.4},dragon:{size:122,x:72.5,y:34},demon:{size:143,x:77.9,y:34.5}}
  });
});

test('確定した3ボス座標へダメージエフェクト基準点が追従し、スコアをK・M表記にする', async ({ page })=>{
  await page.goto('/games/boss-battle-demo.html?debug=1');
  const result = await page.evaluate(()=>({
    metrics:Object.fromEntries(['mimic','dragon','demon'].map(key=>[key,window.__bossBattleDebug.metricsForBoss(key,500,800)])),
    labels:[9999,10000,10500,100000,999999,1000000,1250000].map(window.__bossBattleDebug.formatHudNumber)
  }));
  expect(result.metrics.mimic).toMatchObject({size:155,x:367,groundY:267.2,centerY:197.7});
  expect(result.metrics.dragon).toMatchObject({size:155,x:341,groundY:272,centerY:202.5});
  expect(result.metrics.demon).toMatchObject({size:180,x:389.5,groundY:272,centerY:190});
  expect(result.labels).toEqual(['9999','10K','10.5K','100K','999K','1M','1.3M']);
});

test('携帯のサイズ調整パネルは初期縮小し、展開できる', async ({ page })=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/boss-battle-demo.html?debug=1');
  await expect(page.locator('#debugPanel')).toHaveClass(/mobileInitial/);
  await expect(page.locator('.debugPanelBody')).toBeHidden();
  await page.locator('#debugCollapseBtn').click();
  await expect(page.locator('.debugPanelBody')).toBeVisible();
});

test('通常URLでは討伐2048のデバッグ機能を公開しない', async ({ page })=>{
  await page.goto('/games/boss-battle-demo.html');
  expect(await page.evaluate(()=>window.__bossBattleDebug)).toBeUndefined();
  await expect(page.locator('#debugPanel')).toBeHidden();
});
