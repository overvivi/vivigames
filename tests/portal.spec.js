const { test, expect } = require('@playwright/test');

test('PCでは2台の筐体を比較でき、ロゴを二重表示しない', async ({ page })=>{
  await page.setViewportSize({ width:1280, height:900 });
  await page.goto('/index.html');

  await expect(page.locator('.cabinet')).toHaveCount(2);
  await expect(page.locator('.cabinet-artwork')).toHaveCount(2);
  await expect(page.locator('.cabinet-title')).toHaveCount(3);
  await expect(page.locator('.coming-artwork')).toBeVisible();
  await expect(page.locator('.site-logo')).toBeVisible();
  await expect(page.locator('.brand-frame')).toHaveClass(/logo-ready/);
  await expect(page.locator('h1')).toBeHidden();

  const layout = await page.evaluate(()=>{
    const cabinets=[...document.querySelectorAll('.cabinet')].map(el=>el.getBoundingClientRect());
    const artworks=[...document.querySelectorAll('.cabinet-artwork,.coming-artwork')].map(el=>el.getBoundingClientRect());
    const playButtons=[...document.querySelectorAll('.cabinet-play')].map(el=>el.getBoundingClientRect());
    return {
      sameRow:Math.abs(cabinets[0].top-cabinets[1].top)<2,
      sameCabinetSize:artworks.every(rect=>Math.abs(rect.width-artworks[0].width)<1&&Math.abs(rect.height-artworks[0].height)<1),
      playInsideCabinet:playButtons.every((rect,index)=>rect.left>=artworks[index].left&&rect.right<=artworks[index].right&&rect.top>=artworks[index].top&&rect.bottom<=artworks[index].bottom),
      noLegacyPlayShine:getComputedStyle(document.querySelector('.cabinet-play'),'::after').display==='none',
      noOverflow:document.documentElement.scrollWidth<=window.innerWidth,
      desktopBackground:getComputedStyle(document.querySelector('.hero')).backgroundImage.includes('arcade-bg-desktop.webp')
    };
  });
  expect(layout).toEqual({ sameRow:true, sameCabinetSize:true, playInsideCabinet:true, noLegacyPlayShine:true, noOverflow:true, desktopBackground:true });
  await expect(page.locator('a.play')).toHaveCount(2);
  await expect(page.locator('a.play').nth(0)).toHaveAttribute('href','games/temple-run-clone.html');
  await expect(page.locator('a.play').nth(1)).toHaveAttribute('href','games/boss-battle-demo.html');
});

test('通常URLでは位置調整機能を公開しない', async ({ page })=>{
  await page.goto('/index.html');
  await expect(page.locator('.portal-debug')).toHaveCount(0);
  expect(await page.evaluate(()=>('__portalDebug' in window))).toBe(false);
});

test('デバッグURLでタイトルとPLAYの位置を直接調整できる', async ({ page })=>{
  await page.setViewportSize({ width:1280, height:900 });
  await page.goto('/index.html?portalDebug=1');
  const panel=page.locator('.portal-debug');
  await expect(panel).toBeVisible();
  const slider=panel.locator('input[type="range"][data-key="boss"][data-property="playX"]');
  await slider.fill('32.5');
  await expect(page.locator('[data-tune="boss"]')).toHaveCSS('--play-x','32.5%');
  expect(await page.evaluate(()=>window.__portalDebug.state.boss.playX)).toBe(32.5);
  const cabinetNumber=panel.locator('input[type="number"][data-key="coming"][data-property="cabinetY"]');
  await cabinetNumber.fill('64');
  await expect(page.locator('.coming')).toHaveCSS('--cabinet-y','64px');
  await expect(panel.locator('input[type="range"][data-key="coming"][data-property="cabinetY"]')).toHaveValue('64');
});

test('安全でない携帯接続でも調整値を手動コピーできる', async ({ page })=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true}));
  await page.goto('/index.html?portalDebug=1');
  await page.locator('[data-action="copy"]').click();
  const output=page.locator('.portal-debug-output');
  await expect(output).toBeVisible();
  await expect(output.locator('textarea')).toHaveValue(/"hell"/);
});

test('スマホでは1列で横にはみ出さず、PLAYを押しやすい', async ({ page })=>{
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/index.html');

  const layout = await page.evaluate(()=>{
    const cabinets=[...document.querySelectorAll('.cabinet')].map(el=>el.getBoundingClientRect());
    const play=document.querySelector('.play').getBoundingClientRect();
    const hellStyle=getComputedStyle(document.querySelector('[data-tune="hell"]'));
    const bossStyle=getComputedStyle(document.querySelector('[data-tune="boss"]'));
    const status=document.querySelector('.status').getBoundingClientRect();
    const tags=[...document.querySelectorAll('.status-row .mini-tag')].slice(0,3).map(el=>el.getBoundingClientRect());
    return {
      stacked:cabinets[1].top>cabinets[0].bottom,
      playHeight:play.height,
      hellPlay:[hellStyle.getPropertyValue('--play-x').trim(),hellStyle.getPropertyValue('--play-y').trim(),hellStyle.getPropertyValue('--play-scale').trim()],
      bossPlay:[bossStyle.getPropertyValue('--play-x').trim(),bossStyle.getPropertyValue('--play-y').trim(),bossStyle.getPropertyValue('--play-scale').trim()],
      statusAboveTags:tags.every(tag=>tag.top>=status.bottom),
      tagsSameRow:tags.every(tag=>Math.abs(tag.top-tags[0].top)<1),
      noOverflow:document.documentElement.scrollWidth<=window.innerWidth,
      mobileBackground:getComputedStyle(document.querySelector('.hero')).backgroundImage.includes('arcade-bg-mobile.webp')
    };
  });
  expect(layout.stacked).toBe(true);
  expect(layout.playHeight).toBeGreaterThanOrEqual(56);
  expect(layout.hellPlay).toEqual(['17.3%','59.7%','.74']);
  expect(layout.bossPlay).toEqual(['16.5%','59.2%','.77']);
  expect(layout.statusAboveTags).toBe(true);
  expect(layout.tagsSameRow).toBe(true);
  expect(layout.noOverflow).toBe(true);
  expect(layout.mobileBackground).toBe(true);
});

test('画像ロゴを読めない時もHTMLタイトルを表示する', async ({ page })=>{
  await page.route('**/vivi-game-arcade-logo.png',route=>route.abort());
  await page.goto('/index.html');

  await expect(page.locator('.site-logo')).toBeHidden();
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('h1')).toContainText('VIVI GAME ARCADE');
});

test('情報モーダルを開閉でき、背景スクロールを戻す', async ({ page })=>{
  await page.goto('/index.html');
  await page.getByRole('button',{ name:/PATCH NOTES/ }).click();
  await expect(page.locator('#patch-dialog')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/modal-open/);
  await page.locator('#patch-dialog .dialog-close').click();
  await expect(page.locator('#patch-dialog')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/modal-open/);
});

test('公開に必要なポータル画像を取得できる', async ({ request })=>{
  const files=[
    '/images/portal/arcade-bg-desktop.webp',
    '/images/portal/arcade-bg-mobile.webp',
    '/images/portal/vivi-game-arcade-logo.png',
    '/images/portal/keyart-hell-runner.webp',
    '/images/portal/keyart-boss-2048.webp',
    '/images/portal/cabinet-hell-runner.webp',
    '/images/portal/cabinet-boss-2048.webp',
    '/images/portal/cabinet-coming-soon.webp',
    '/images/portal/play-button-hell-runner.webp',
    '/images/portal/play-button-boss-2048.webp',
    '/images/portal/title-hell-runner.webp',
    '/images/portal/title-boss-2048.webp',
    '/images/portal/title-coming-soon.webp'
  ];
  for(const file of files){
    const response=await request.get(file);
    expect(response.ok(),file).toBe(true);
  }
});
