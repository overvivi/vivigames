const { test, expect } = require('@playwright/test');

test('カード村の掲載・ベータ案内・公開ファイルを確認する', async ({ page, request }, testInfo) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/index.html');
    await expect(page.locator('#capTitle')).toHaveText('こもれびのカード村');
    await expect(page.locator('#deck')).toHaveClass(/on/);
    await expect(page.locator('#deckTags')).toContainText('ベータ版');
    await page.screenshot({ path: testInfo.outputPath(`portal-${viewport.width}.png`), fullPage: true });
    // 棚のラベルも小さい表示で読めることを目視できるよう、別ゲームを挿して新作を棚へ戻す。
    await page.locator('.cart').first().click();
    await expect(page.locator('#deck')).toHaveClass(/on/);
    const cartridge = page.locator('.cart').filter({ hasText: 'こもれびのカード村' });
    await cartridge.scrollIntoViewIfNeeded();
    await cartridge.screenshot({ path: testInfo.outputPath(`cartridge-${viewport.width}.png`), animations: 'disabled' });
    await cartridge.click();
    await expect(page.locator('#capTitle')).toHaveText('こもれびのカード村');
  }
  await page.locator('[data-dialog="patch-dialog"]').click();
  const note = page.locator('#patch-dialog .patch-entry').first();
  await expect(note).toContainText('β版 0.1');
  await expect(note).toContainText('ご要望があれば');
  await expect(note).toContainText('操作しづらさや不具合');
  await expect(note).toContainText('報告をもとに修正');
  const art = await request.get('/images/portal/cart-label-card-grove.webp');
  expect(art.ok()).toBeTruthy();
  const game = await request.get(await page.locator('#playLink').getAttribute('href'));
  expect(game.ok()).toBeTruthy();
  expect(await game.text()).toContain('<title>こもれびのカード村 β版</title>');
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`公開HTMLの新規開始・保存再開・説明開閉 ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // 通常プレイの保存とは別のQA領域で、実際に公開する単一HTMLを操作する。
    await page.goto('/games/card-grove.html?qa=1');
    await expect(page).toHaveTitle('こもれびのカード村 β版');
    await expect(page.locator('#dialog .eyebrow')).toContainText('β版');
    await page.screenshot({ path: testInfo.outputPath('welcome.png') });
    await page.getByRole('button', { name: '村の暮らしをはじめる →', exact: true }).click();
    await expect(page.locator('#dialog')).not.toBeVisible();
    await expect(page.locator('#stacks .card').first()).toBeVisible();
    await page.locator('#pause').click();
    await expect.poll(() => page.locator('#stacks .art img').evaluateAll(images =>
      images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0)
    )).toBe(true);
    const cardsBefore = await page.locator('#stacks .card').count();
    await expect.poll(() => page.evaluate(() => !!localStorage.getItem('vivi.card-grove.qa'))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('village.png') });
    if (viewport.width < 1000) {
      const dock = page.locator('#info-dock');
      await expect(dock).toBeVisible();
      await expect(page.locator('#pack-info')).toBeHidden();
      await dock.click();
      await expect(page.locator('#pack-info')).toBeVisible();
      await dock.click();
      await expect(page.locator('#pack-info')).toBeHidden();
    }
    await page.locator('#menu').click();
    await expect(page.locator('#export')).toBeVisible();
    await page.locator('#close-dialog').click();
    await page.reload();
    await page.getByRole('button', { name: '村のつづきから →', exact: true }).click();
    await expect(page.locator('#stacks .card')).toHaveCount(cardsBefore);
    expect(await page.evaluate(() => localStorage.getItem('vivi.card-grove.v1'))).toBeNull();
    expect(errors).toEqual([]);
  });
}
