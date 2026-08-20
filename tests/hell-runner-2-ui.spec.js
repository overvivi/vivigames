const { test, expect } = require('@playwright/test');

test('HELL RUNNER 2の育成HUDと縦3択を390x844内へ表示できる', async ({ page })=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  expect(pageErrors).toEqual([]);
  await expect(page.locator('#rogueHud')).toBeVisible();
  await expect(page.locator('#gameHud #pauseBtn')).toBeVisible();
  await expect(page.locator('#comboHud')).toBeVisible();
  await expect(page.locator('#comboLabel')).toHaveText('00');
  await page.evaluate(()=>window.__hellRunnerDebug.giveXp(10));
  await expect(page.locator('#xpValue')).toHaveText('XP 10 / 24');
  await expect(page.locator('#xpFill')).toHaveCSS('width', /px/);
  await page.screenshot({path:'docs/mockups/hell-runner-2-ui-hud-mobile.png'});
  await expect(page.locator('#levelUpOverlay')).toBeHidden();
  await page.evaluate(()=>window.__hellRunnerDebug.giveXp(14));
  await expect(page.locator('#levelUpOverlay')).toBeVisible();
  await expect(page.locator('#xpLevel')).toHaveText('LV.1');
  await page.locator('.abilityChoice').first().click();
  await expect(page.locator('#levelUpOverlay')).toBeHidden();
  await page.waitForTimeout(700);
  // 携帯ではデバッグパネルが初期縮小なので、内部の試作ボタンを直接発火する。
  await page.locator('#debugAbilityPreview').dispatchEvent('click');
  await expect(page.locator('.abilityChoice')).toHaveCount(3);

  const boxes=await page.locator('.abilityChoice').evaluateAll(cards=>cards.map(card=>{
    const r=card.getBoundingClientRect();
    return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
  }));
  for(const box of boxes){
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(390);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(844);
    expect(box.height).toBeGreaterThanOrEqual(108);
  }
  await page.screenshot({path:'docs/mockups/hell-runner-2-ui-prototype.png'});

  await page.locator('.abilityChoice').first().click();
  await expect(page.locator('#levelUpOverlay')).toBeHidden();
  await expect(page.locator('#rogueHud')).toBeVisible();
});

test('HELL RUNNER 2のPC用LEVEL UP表示は拡大しても視界を塞がない', async ({ page })=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  await expect(page.locator('#gameHud #pauseBtn')).toBeVisible();
  const stageBox=await page.locator('#stage').boundingBox();
  const debugBox=await page.locator('#debugPanel').boundingBox();
  const balanceBox=await page.locator('#debugBalancePanel').boundingBox();
  expect(debugBox.x).toBeGreaterThanOrEqual(stageBox.x+stageBox.width);
  expect(debugBox.width).toBeGreaterThanOrEqual(390);
  expect(balanceBox.x+balanceBox.width).toBeLessThanOrEqual(stageBox.x);
  expect(balanceBox.width).toBeGreaterThanOrEqual(390);
  await expect(page.locator('label[for="debugItemScale"]')).toHaveText('コイン・オーブサイズ');
  const debugColumns=await page.locator('#debugPanel .debugPanelBody').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(debugColumns).toBe(2);
  const pauseBox=await page.locator('#gameHud #pauseBtn').boundingBox();
  expect(pauseBox.width).toBeGreaterThanOrEqual(44);
  expect(pauseBox.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:'docs/mockups/hell-runner-2-ui-hud-pc.png'});
  await page.locator('#debugAbilityPreview').dispatchEvent('click');
  await expect(page.locator('#levelUpOverlay')).toBeVisible();

  const boxes=await page.locator('.abilityChoice').evaluateAll(cards=>cards.map(card=>{
    const r=card.getBoundingClientRect();
    return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
  }));
  for(const box of boxes){
    expect(box.width).toBeGreaterThanOrEqual(400);
    expect(box.height).toBeGreaterThanOrEqual(140);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(1000);
  }
  await page.screenshot({path:'docs/mockups/hell-runner-2-ui-prototype-pc.png'});
});

test('HELL RUNNER 2のギャンブラーと育成完了後報酬は走行を止めない', async ({ page })=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  await page.evaluate(()=>window.__hellRunnerDebug.setNoFall(true));
  await page.locator('#debugCollapse').click();
  await page.locator('#debugItemScale').evaluate(input=>{ input.value='1.20'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#debugItemScaleValue')).toHaveText('1.20x');
  await page.locator('#debugHighOrb').evaluate(input=>{ input.value='45'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#debugHighOrbValue')).toHaveText('45%');
  await page.locator('#debugItemHeight').evaluate(input=>{ input.value='2.50'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#debugItemHeightValue')).toHaveText('2.50x');
  await page.locator('#debugCoinFrequency').evaluate(input=>{ input.value='10'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#debugCoinFrequencyValue')).toHaveText('10%');
  await page.locator('#debugHighItem').evaluate(input=>{ input.value='100'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#debugHighItemValue')).toHaveText('100%');
  await page.locator('#debugOrbFrequency').evaluate(input=>{ input.value='80'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#debugOrbFrequencyValue')).toHaveText('80%');
  await page.locator('#debugOrbMultiple').evaluate(input=>{ input.value='70'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#debugOrbMultipleValue')).toHaveText('70%');
  await page.locator('#debugItemGrid').evaluate(input=>{ input.value='100'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#debugItemGridValue')).toHaveText('100px');
  await page.locator('#debugCoinScoreScale').evaluate(input=>{ input.value='2.50'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#debugCoinScoreScaleValue')).toHaveText('2.50x');

  await page.evaluate(()=>window.__hellRunnerDebug.wallTest());
  await page.waitForTimeout(100);
  const wallState=await page.evaluate(()=>window.__hellRunnerDebug.getState());
  expect(wallState.state).toBe('playing');
  expect(wallState.jump.pushback).toBeGreaterThan(0);

  await page.evaluate(()=>window.__hellRunnerDebug.setRogueBuild({gambler:1}));
  await page.evaluate(()=>window.__hellRunnerDebug.giveXp(200));
  await expect(page.locator('#levelUpOverlay')).toBeHidden();
  const gamblerState=await page.evaluate(()=>window.__hellRunnerDebug.getRogueState());
  expect(gamblerState.state).toBe('playing');
  expect(gamblerState.level).toBeGreaterThan(1);
  expect(Object.keys(gamblerState.owned).length).toBeGreaterThan(1);

  await page.evaluate(()=>window.__hellRunnerDebug.completeBuild());
  const completeBuild=await page.evaluate(()=>window.__hellRunnerDebug.getRogueState());
  expect(completeBuild.owned.slotUnlock).toBe(1);
  expect(completeBuild.owned.coinScore).toBe(5);
  await page.evaluate(()=>window.__hellRunnerDebug.converterBuild());
  const converterBuild=await page.evaluate(()=>window.__hellRunnerDebug.getRogueState());
  expect(converterBuild.owned.converter).toBe(1);
  expect(converterBuild.owned.xpMultiplier).toBe(5);
  await page.evaluate(()=>window.__hellRunnerDebug.beginScoreBenchmark());
  expect(await page.evaluate(()=>window.__hellRunnerDebug.scoreBenchmarkReport())).toContain('10K比較中');
  await page.evaluate(()=>window.__hellRunnerDebug.giveXp(1));
  await expect(page.locator('#unlockBanner')).toHaveClass(/show/);

  await page.evaluate(()=>window.__hellRunnerDebug.setRogueBuild({
    slotUnlock:1, tripleJump:1, glide:1, reincarnate:1,
    coinScore:5, coinCombo:5, comboDuration:5
  }));
  const slotBoxes=await page.locator('#rogueHud .miniSlot').evaluateAll(slots=>slots.map(slot=>{
    const r=slot.getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
  }));
  for(let i=0;i<slotBoxes.length;i++) for(let j=i+1;j<slotBoxes.length;j++){
    const a=slotBoxes[i], b=slotBoxes[j];
    expect(a.right<=b.left || b.right<=a.left || a.bottom<=b.top || b.bottom<=a.top).toBeTruthy();
  }
  await page.evaluate(()=>window.__hellRunnerDebug.giveXp(100));
  await expect(page.locator('#levelUpOverlay')).toBeHidden();
  await expect(page.locator('#unlockBanner')).toHaveClass(/show/);
  const bannerBox=await page.locator('#unlockBanner').boundingBox();
  const xpBox=await page.locator('.xpBar').boundingBox();
  expect(bannerBox.y).toBeGreaterThanOrEqual(xpBox.y+xpBox.height);
  const completeState=await page.evaluate(()=>window.__hellRunnerDebug.getRogueState());
  expect(completeState.state).toBe('playing');

  await page.evaluate(()=>window.__hellRunnerDebug.setNoFall(false));
  await page.evaluate(()=>window.__hellRunnerDebug.endGameNow());
  await expect(page.locator('#overScreen')).toBeVisible();
  await expect(page.locator('#rogueHud')).toBeHidden();
});

test('HELL RUNNER 2はデバッグ地点移動後もレベルアップを選択できる', async ({ page })=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  await page.evaluate(()=>window.__hellRunnerDebug.giveXp(24));
  await expect(page.locator('#levelUpOverlay')).toBeVisible();
  await page.evaluate(()=>window.__hellRunnerDebug.jumpTo(60000));
  expect(await page.evaluate(()=>window.__hellRunnerDebug.getState().kaiokenActive)).toBeFalsy();
  await page.evaluate(()=>window.__hellRunnerDebug.setRogueBuild({deathEater:1,xpMagnet:6}));
  await page.evaluate(()=>window.__hellRunnerDebug.jumpTo(60000));
  await expect(page.locator('#levelUpOverlay')).toBeHidden();
  const afterJump=await page.evaluate(()=>window.__hellRunnerDebug.getRogueState());
  expect(afterJump.owned.deathEater).toBe(1);
  expect(afterJump.owned.xpMagnet).toBe(6);
  expect(await page.evaluate(()=>window.__hellRunnerDebug.getState().kaiokenActive)).toBeTruthy();
  await page.evaluate(()=>window.__hellRunnerDebug.giveXp(100));
  await expect(page.locator('#levelUpOverlay')).toBeVisible();
  await page.locator('.abilityChoice').first().click();
  await expect(page.locator('#levelUpOverlay')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.__hellRunnerDebug.getRogueState().state)).toBe('abilityResume');
});

test('HELL RUNNER 2は空中でXPが満ちても着地してからLEVEL UPを開く', async ({ page })=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  expect(await page.evaluate(()=>window.__hellRunnerDebug.getState().jump.grounded)).toBeFalsy();
  await page.evaluate(()=>window.__hellRunnerDebug.giveXp(24));
  await expect(page.locator('#levelUpOverlay')).toBeHidden();
  await expect(page.locator('#levelUpOverlay')).toBeVisible({timeout:2500});
});

test('HELL RUNNER 2のLEVEL UP下部は現在のビルドをHUDと同じ内容で表示する', async ({ page })=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  await page.evaluate(()=>window.__hellRunnerDebug.setRogueBuild({
    glide:1, xpMultiplier:2, deathEater:1
  }));
  await page.locator('#debugAbilityPreview').dispatchEvent('click');
  await expect(page.locator('#levelUpOverlay')).toBeVisible();
  await expect(page.locator('#choiceSlots .abilityIcon[alt="滑空"]')).toHaveCount(1);
  await expect(page.locator('#choiceSlots .abilityIcon[alt="経験値倍率"]')).toHaveCount(1);
  await expect(page.locator('#choiceSlots .abilityIcon[alt="デスイーター"]')).toHaveCount(1);
  await expect(page.locator('#choiceSlots .abilityIcon[alt="経験値倍率"] + .slotLv')).toHaveText('II');
});

test('HELL RUNNER 2はLEGENDだけの候補を見送って次の抽選を待てる', async ({ page })=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  await page.locator('#debugCollapse').click();
  await page.locator('#debugLegendChance').evaluate(input=>{ input.value='100'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#debugLegendChanceValue')).toHaveText('100%');
  await page.evaluate(()=>window.__hellRunnerDebug.setRogueBuild({
    tripleJump:3, glide:3,
    coinScore:5, coinCombo:5, comboDuration:5
  }));
  let legendAppeared=false;
  for(let i=0;i<100 && !legendAppeared;i++){
    legendAppeared=await page.evaluate(()=>{
      document.getElementById('debugAbilityPreview').click();
      return !document.getElementById('levelUpOverlay').classList.contains('hidden');
    });
  }
  expect(legendAppeared).toBeTruthy();
  await expect(page.locator('#levelUpOverlay')).toBeVisible();
  await expect(page.locator('.abilityChoice:not(.hidden)')).toHaveCount(1);
  const beforeSkip=await page.evaluate(()=>window.__hellRunnerDebug.getRogueState().owned);
  await page.locator('#abilitySkip').click();
  await expect(page.locator('#levelUpOverlay')).toBeHidden();
  expect(await page.evaluate(()=>window.__hellRunnerDebug.getRogueState().owned)).toEqual(beforeSkip);
});

test('HELL RUNNER 2は能力カードを同じティア内で1回だけ引き直せる', async ({ page })=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  await page.locator('#debugLegendChance').evaluate(input=>{ input.value='100'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.locator('#debugAbilityPreview').dispatchEvent('click');
  const legendCard=page.locator('.abilityChoice.legend:not(.hidden)');
  await expect(legendCard).toHaveCount(1);
  const before=await legendCard.locator('.choiceName').textContent();
  const reroll=legendCard.locator('xpath=..').locator('.choiceReroll');
  await expect(reroll).toBeVisible();
  await expect(reroll).toHaveText('↻');
  const rerollBox=await reroll.boundingBox();
  expect(rerollBox.width).toBeGreaterThanOrEqual(40);
  expect(rerollBox.height).toBeGreaterThanOrEqual(24);
  await reroll.click();
  await expect(legendCard.locator('.choiceName')).not.toHaveText(before || '');
  await expect(reroll).toBeHidden();
});

test('HELL RUNNER 2の開発者ツールの能力選択は通常のLEGEND率を使う', async ({ page })=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  await page.locator('#debugLegendChance').evaluate(input=>{ input.value='1'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.evaluate(()=>{ Math.random=()=>.99; });
  await page.locator('#debugAbilityPreview').dispatchEvent('click');
  await expect(page.locator('#levelUpOverlay')).toBeVisible();
  await expect(page.locator('.abilityChoice.legend:not(.hidden)')).toHaveCount(0);
});

test('HELL RUNNER 2の大きいコンボ表示は開発者ツールで位置とサイズを調整できる', async ({ page })=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  await page.locator('#debugComboPreview').click();
  await expect(page.locator('#comboHud')).toBeVisible();
  await expect(page.locator('#comboLabel')).toHaveText('08');
  await expect(page.locator('#comboHud')).toHaveClass(/tier-3/);
  await expect(page.locator('#comboLabel')).toHaveCSS('animation-name','comboRainbowShift');
  await expect(page.locator('#debugComboWindowValue')).toHaveText('3.00秒');
  await expect(page.locator('#debugComboXValue')).toHaveText('84%');
  await expect(page.locator('#debugComboYValue')).toHaveText('22%');
  await expect(page.locator('#debugLegendChanceValue')).toHaveText('35%');
  await expect(page.locator('#debugLegendRerollValue')).toHaveText('35%');
  await page.locator('#debugComboWindow').evaluate(input=>{ input.value='2.00'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#debugComboWindowValue')).toHaveText('2.00秒');
  await page.locator('#debugComboScale').evaluate(input=>{ input.value='1.50'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.locator('#debugComboX').evaluate(input=>{ input.value='65'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.locator('#debugComboY').evaluate(input=>{ input.value='40'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.locator('#debugComboGaugeScale').evaluate(input=>{ input.value='1.40'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#debugComboScaleValue')).toHaveText('1.50x');
  await expect(page.locator('#debugComboXValue')).toHaveText('65%');
  await expect(page.locator('#debugComboGaugeScaleValue')).toHaveText('1.40x');
  const comboStyle=await page.locator('#comboHud').evaluate(el=>({left:el.style.left,top:el.style.top,scale:el.style.getPropertyValue('--comboScale'),gauge:el.style.getPropertyValue('--gaugeScale')}));
  expect(comboStyle).toEqual({left:'65%',top:'40%',scale:'1.5',gauge:'1.4'});
});

test('HELL RUNNER 2は携帯通知を能力スロットの下へ出し、ゲームオーバー時に育成UIを隠す', async ({ page })=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  await page.evaluate(()=>window.__hellRunnerDebug.showDeathEaterBanner());
  await expect(page.locator('#unlockBanner')).toHaveClass(/show/);
  await page.locator('#debugCollapse').click();
  const mobileDebug=await page.locator('#debugPanel').evaluate(el=>({
    hasTuning:!!el.querySelector('.rogueBalance'),
    overflowY:getComputedStyle(el).overflowY,
    touchAction:getComputedStyle(el).touchAction
  }));
  expect(mobileDebug).toEqual({hasTuning:true,overflowY:'auto',touchAction:'pan-y'});
  const [banner,legendSlots]=await Promise.all([
    page.locator('#unlockBanner').boundingBox(),
    page.locator('#rogueLegendSlots').boundingBox()
  ]);
  expect(banner.y).toBeGreaterThanOrEqual(legendSlots.y+legendSlots.height);
  await page.evaluate(()=>window.__hellRunnerDebug.setRogueBuild({converter:1}));
  await expect(page.locator('#soulBankHud')).toBeVisible();
  await page.evaluate(()=>window.__hellRunnerDebug.jumpTo(150));
  await page.evaluate(()=>window.__hellRunnerDebug.endGameNow());
  await expect(page.locator('#overScreen')).toBeVisible();
  await expect(page.locator('#submitBox')).toBeVisible();
  await expect(page.locator('#overScreen')).toHaveClass(/hasScoreSubmit/);
  const overStyle=await page.locator('#overScreen').evaluate(el=>({
    overflowY:getComputedStyle(el).overflowY,
    touchAction:getComputedStyle(el).touchAction,
    scrollTop:el.scrollTop
  }));
  expect(overStyle).toEqual({overflowY:'auto',touchAction:'pan-y',scrollTop:0});
  const overHeight=await page.locator('#overScreen').evaluate(el=>({scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}));
  expect(overHeight.scrollHeight).toBeLessThanOrEqual(overHeight.clientHeight);
  await expect(page.locator('#rogueHud')).toBeHidden();
  await expect(page.locator('#comboHud')).toBeHidden();
  await expect(page.locator('#soulBankHud')).toBeHidden();
  await expect(page.locator('#unlockBanner')).toBeHidden();
});

test('HELL RUNNER 2のPC取得通知は能力スロットより下に表示する', async ({ page })=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  await page.evaluate(()=>window.__hellRunnerDebug.showDeathEaterBanner());
  await expect(page.locator('#unlockBanner')).toHaveClass(/show/);
  const [banner,legendSlots]=await Promise.all([
    page.locator('#unlockBanner').boundingBox(),
    page.locator('#rogueLegendSlots').boundingBox()
  ]);
  expect(banner.y).toBeGreaterThanOrEqual(legendSlots.y+legendSlots.height);
});

test('HELL RUNNER 2の通知プレビューは全種表示でき、位置とサイズを調整できる', async ({ page })=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/games/hell-runner-2.html?debug=1');
  await page.locator('#startBtn').click();
  await expect(page.locator('#debugNotifyScaleValue')).toHaveText('1.40x');
  await expect(page.locator('#debugNotifyXValue')).toHaveText('51%');
  await expect(page.locator('#debugNotifyYValue')).toHaveText('264px');
  await expect(page.locator('#debugNotifyButtons [data-notify]')).toHaveCount(7);
  const previews=[
    ['rival','ライバル登場！'],['deathEater','【デスイーター降臨！】'],['gambler','SCORE x0.95'],['random','経験値倍率'],
    ['lucky','+46 SCORE'],['soulLucky','+4,218 SCORE'],['legendCall','運命の能力が現れた']
  ];
  for(const [kind,text] of previews){
    await page.locator(`[data-notify="${kind}"]`).dispatchEvent('click');
    await expect(page.locator('#unlockName')).toHaveText(text);
  }
  await page.locator('#debugNotifyScale').evaluate(input=>{ input.value='1.50'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.locator('#debugNotifyX').evaluate(input=>{ input.value='65'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.locator('#debugNotifyY').evaluate(input=>{ input.value='300'; input.dispatchEvent(new Event('input',{bubbles:true})); });
  const notifyStyle=await page.locator('#unlockBanner').evaluate(el=>({scale:el.style.getPropertyValue('--notifyScale'),x:el.style.getPropertyValue('--notifyX'),y:el.style.getPropertyValue('--notifyY')}));
  expect(notifyStyle).toEqual({scale:'1.5',x:'65%',y:'300px'});
});
