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
  await expect(page.locator('#retry')).toBeHidden();
  await expect(page.locator('#signal')).toHaveText('CHAMPION DETECTED');

  // 王者戦では通常NPCの乱数ではなく、登録された150msで反応する。
  await expect(page.locator('#signal')).toHaveText('NPC WINS',{timeout:8000});
  await expect(page.locator('#result')).toHaveText('150ms');
});

test('開発モードで音源ごとの音量を調整できる', async ({ page })=>{
  await page.goto('/games/todays-champion.html?debug=1');
  const tools=page.locator('.dev-tools');
  await expect(tools).toContainText('AUDIO MIX');
  await expect(tools).toContainText('SIGNAL 1/2');
  await expect(tools).toContainText('SIGNAL 3');
  await expect(tools).toContainText('IMPACT');
  await expect(tools).toContainText('CHAMPION');
  await expect(tools).toContainText('VOICE');
  await expect(tools).toContainText('VOICE BRICK');
  await expect(tools).toContainText('VOICE KIRI');
  await expect(tools.getByRole('button',{name:'PLAY / STOP SELECT BGM'})).toBeVisible();
  await expect(tools.getByRole('button',{name:'PLAY / STOP CAUTION BGM'})).toBeVisible();
  await expect(tools).toContainText('CHAMPION SCREEN');
  await expect(tools.getByRole('button',{name:'COPY CHAMPION SCREEN'})).toBeVisible();
  await expect(tools).toContainText('RESULT BUTTONS');
  await expect(tools.getByRole('button',{name:'COPY RESULT BUTTONS'})).toBeVisible();
  await expect(tools).toContainText('WIN');
  await expect(tools).toContainText('LOSE');
});

test('ブリック選択時は選択ボイスを読み込む', async ({ page })=>{
  await page.goto('/games/todays-champion.html?debug=1');
  let voiceRequests=0;
  page.on('request',request=>{if(request.url().endsWith('/audio/todays-champion/voices/brick-select-preview.mp3'))voiceRequests++;});
  const voiceRequest=page.waitForRequest(request=>request.url().endsWith('/audio/todays-champion/voices/brick-select-preview.mp3'));
  await page.getByRole('button',{name:/BRICK/}).click();
  await voiceRequest;
  await page.getByRole('button',{name:/BRICK/}).click();
  await page.waitForTimeout(150);
  expect(voiceRequests).toBe(1);
  await expect(page.getByRole('button',{name:'PLAY SELECT VOICE'})).toBeVisible();
});

test('キリ選択時は整音済みの選択ボイスを読み込む', async ({ page })=>{
  await page.goto('/games/todays-champion.html?debug=1');
  const voiceRequest=page.waitForRequest(request=>request.url().endsWith('/audio/todays-champion/voices/kiri-select-preview.wav'));
  await page.getByRole('button',{name:/KIRI/}).click();
  await voiceRequest;
});

test('開発モードでは信号3灯を同時点灯して配置を確認できる', async ({ page })=>{
  await page.goto('/games/todays-champion.html?debug=1');
  const button=page.locator('#allLamps');
  await button.click();
  await expect(button).toHaveText('ALL LAMPS: ON');
  await expect(page.locator('#stage')).toHaveClass(/dev-all-lamps/);
  await button.click();
  await expect(page.locator('#stage')).not.toHaveClass(/dev-all-lamps/);
});

test('開発モードでは調整値を項目ごとにコピーできる', async ({ page })=>{
  await page.goto('/games/todays-champion.html?debug=1');
  await page.getByRole('button',{name:'COPY SIGNAL'}).click();
  await expect(page.locator('#tuneOutput')).toContainText('signal');
  await page.getByRole('button',{name:'COPY AUDIO'}).click();
  await expect(page.locator('#tuneOutput')).toContainText('audio');
});

test('PCではSpaceで試合開始と合図への反応ができる', async ({ page })=>{
  await page.goto('/games/todays-champion.html');
  await expect(page.getByRole('link',{name:'GAME BASE'})).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('body')).toHaveClass(/in-duel/);
  await expect(page.getByRole('link',{name:'GAME BASE'})).toBeHidden();
  await page.keyboard.press('Space');
  await expect(page.locator('#signal')).toHaveText('NPC WINS');
  await expect(page.locator('#result')).toHaveText('FLYING');
});

test('名前はキャラの足元中央へ置き、開発モードで微調整できる', async ({ page })=>{
  await page.goto('/games/todays-champion.html?debug=1');
  await page.getByRole('button',{name:'PLAYER WIN'}).click();
  await expect(page.locator('.dev-tools')).toContainText('NAME LABELS');
  expect(await page.locator('#leftName').evaluate(el=>el.style.left)).toBe('50%');
  const before=await page.locator('#leftName').evaluate(el=>el.style.transform);
  await page.locator('#nameX').fill('12');
  await expect.poll(()=>page.locator('#leftName').evaluate(el=>el.style.transform)).not.toBe(before);
});

test('攻撃ポーズを動かすとエフェクトも同じX/Y量だけ追従する', async ({ page })=>{
  await page.goto('/games/todays-champion.html?debug=1');
  await expect(page.locator('#attackEffectLink')).toHaveText('ATTACK + EFFECT: LINK ON');
  const fighter=page.locator('#tuneFighter'),asset=page.locator('#tuneAsset');
  await fighter.selectOption('raven');
  await asset.selectOption('effect');
  const beforeEffectX=Number(await page.locator('#assetFields input[type=number]').first().inputValue());
  await asset.selectOption('attack');
  const attackX=page.locator('#assetFields input[type=number]').first();
  const beforeAttackX=Number(await attackX.inputValue());
  await attackX.fill(String(beforeAttackX+12));
  await asset.selectOption('effect');
  await expect(page.locator('#assetFields input[type=number]').first()).toHaveValue(String(beforeEffectX+12));
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

test('信号は背景のcover拡大率へ追従する', async ({ page })=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/todays-champion.html?debug=1');
  await page.getByRole('button',{name:'PLAYER WIN'}).click();
  const portrait=await page.locator('#trafficLamps').evaluate(el=>({left:el.style.left,top:el.style.top,transform:el.style.transform}));
  await page.setViewportSize({width:844,height:390});
  await expect.poll(()=>page.locator('#trafficLamps').evaluate(el=>el.style.transform)).not.toBe(portrait.transform);
  const landscape=await page.locator('#trafficLamps').evaluate(el=>({left:el.style.left,top:el.style.top}));
  expect(landscape.top).not.toBe(portrait.top);
});

test('キャラ調整値は基準画面の比率でPCと携帯へ共通適用される', async ({ page })=>{
  const measure=()=>page.locator('#leftSprite').evaluate(el=>{
    const stage=document.querySelector('#stage').getBoundingClientRect();
    const unit=Math.min(stage.width/390,stage.height/844);
    return {width:parseFloat(el.style.width),bottom:parseFloat(el.style.bottom),unit};
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/todays-champion.html?debug=1');
  await page.getByRole('button',{name:'PLAYER WIN'}).click();
  const mobile=await measure();
  await page.setViewportSize({width:1440,height:900});
  await expect.poll(async()=>Math.round((await measure()).width)).not.toBe(Math.round(mobile.width));
  const desktop=await measure();

  // 保存する座標は390×844の基準値。実画面のpxが変わっても、基準換算値は不変。
  expect(mobile.width/mobile.unit).toBeCloseTo(226.2,3);
  expect(desktop.width/desktop.unit).toBeCloseTo(226.2,3);
  expect(mobile.bottom/mobile.unit).toBeCloseTo(42.2,3);
  expect(desktop.bottom/desktop.unit).toBeCloseTo(42.2,3);
});

test('キャラの立ち位置はPCと携帯で背景画像の同じ座標を指す', async ({ page })=>{
  const sourceX=()=>page.locator('.left-fighter').evaluate(el=>{
    const stage=document.querySelector('#stage').getBoundingClientRect(),fighter=el.getBoundingClientRect();
    const scale=Math.max(stage.width/1280,stage.height/720),offsetX=(stage.width-1280*scale)/2;
    return ((fighter.left-stage.left)+fighter.width/2-offsetX)/scale;
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/todays-champion.html?debug=1');
  await page.getByRole('button',{name:'PLAYER WIN'}).click();
  const mobile=await sourceX();
  await page.setViewportSize({width:1440,height:900});
  await expect.poll(sourceX).toBeCloseTo(mobile,1);
});

test('開発モードではランキング王者と戦わずに勝敗ポーズを確認できる', async ({ page })=>{
  await page.goto('/games/todays-champion.html?debug=1');
  await page.getByRole('button',{name:'PLAYER WIN'}).click();
  await expect(page.locator('#signal')).toHaveText('PREVIEW — PLAYER WIN');
  await page.getByRole('button',{name:'NPC WIN'}).click();
  await expect(page.locator('#signal')).toHaveText('PREVIEW — NPC WIN');
  await page.getByRole('button',{name:'MIRROR CHECK'}).click();
  await expect(page.locator('#signal')).toHaveText('PREVIEW — MIRROR CHECK');
  await page.getByRole('button',{name:'POSE LOOP'}).click();
  await expect(page.locator('#signal')).toHaveText('PREVIEW — POSE LOOP');
});

test('選択画面は選んだキャラだけを明るくし、ランキング入力画面も確認できる', async ({ page })=>{
  await page.goto('/games/todays-champion.html?debug=1');
  const cards=page.locator('.card');
  await cards.nth(3).click();
  await expect(cards.nth(3)).toHaveAttribute('aria-pressed','true');
  await expect(cards.nth(0)).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'RANKING ENTRY'}).click();
  await expect(page.locator('#scoreForm')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/is-registering/);
  await expect(page.locator('#championCrown')).toBeVisible();
  await expect(page.locator('#stage')).toHaveClass(/is-champion/);
  await expect(page.locator('#championExit')).toBeHidden();
  await expect(page.locator('#signal')).toBeHidden();
  await expect(page.locator('.vs')).toBeHidden();
  await expect(page.locator('#trafficLamps')).toBeHidden();
});

test('結果画面では決着後だけ選択・リトライのボタンを表示する', async ({ page })=>{
  await page.goto('/games/todays-champion.html?debug=1');
  await page.getByRole('button',{name:'RESULT BUTTONS',exact:true}).click();
  await expect(page.locator('#selectReturn')).toBeVisible();
  await expect(page.locator('#retry')).toBeVisible();
  const height=await page.locator('#selectReturn').evaluate(el=>el.getBoundingClientRect().height);
  expect(height).toBeLessThan(100);
});
