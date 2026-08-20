const { test, expect } = require('@playwright/test');

// 外側ヒントは携帯ではマスのすぐ脇へ置かれる。数字の字面だけを狙わせると
// 誤タップで一発勝負の盤面を壊すため、盤外の判定帯と固定表示を回帰確認する。
test.use({ hasTouch:true });

test('携帯では外側ヒントを広く押せて、範囲を固定表示できる', async ({ page })=>{
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/games/hexamine.html');
  await page.getByRole('button', { name:'TUTORIAL' }).click();
  await page.getByRole('button', { name:/ベンゼン/ }).click();
  await expect(page.locator('#board .lineHint').first()).toBeVisible({ timeout:10000 });

  const hint = page.locator('#board .lineHint').first();
  const box = await hint.boundingBox();
  expect(box).not.toBeNull();
  const before = await page.locator('.cell').evaluateAll(cells =>
    cells.filter(cell => cell.querySelector('.hexFill').getAttribute('fill') === 'var(--unknown)').length);

  // 文字の中心ではなく、盤外側に追加した判定帯の端を押す。
  await page.touchscreen.tap(box.x + 2, box.y + box.height / 2);
  await expect.poll(()=>page.locator('#hl polygon').count()).toBeGreaterThan(0);
  await expect.poll(()=>page.locator('.cell').evaluateAll(cells =>
    cells.filter(cell => cell.querySelector('.hexFill').getAttribute('fill') === 'var(--unknown)').length)).toBe(before);

  // 同じヒントをもう一度押すと閉じる。指を離しただけで消えないこともここで担保する。
  await page.touchscreen.tap(box.x + 2, box.y + box.height / 2);
  await expect.poll(()=>page.locator('#hl polygon').count()).toBe(0);
});

test('デイリーのHINTは3回だけ使え、残数を引き継ぐ', async ({ page })=>{
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/games/hexamine.html');
  await page.getByRole('button', { name:'DAILY' }).click();
  const hint = page.locator('#hintBtn');
  await expect(hint).toHaveText('HINT（残り 3）');
  await expect(page.locator('.cell').first()).toBeVisible({ timeout:10000 });

  for(const left of [2,1,0]){
    await hint.click();
    await expect(hint).toHaveText('HINT（残り ' + left + '）', { timeout:10000 });
  }
  await expect(hint).toBeDisabled();

  // 入り直しても残数を復活させない。日替わりまで同じ一発勝負を維持する。
  await page.getByRole('button', { name:/MENU/ }).click();
  await page.getByRole('button', { name:'DAILY' }).click();
  await expect(hint).toHaveText('HINT（残り 0）');
  await expect(hint).toBeDisabled();
});
