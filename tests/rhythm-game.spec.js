const { test, expect } = require('@playwright/test');

test('全4モードを切り替え、携帯でもステージ全体を操作面にする', async ({ page })=>{
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/games/rhythm-game-test.html');

  await expect(page.locator('.mode')).toHaveCount(4);
  await expect(page.getByRole('button', { name:/TAIKO/ })).toHaveClass(/active/);
  await page.getByRole('button', { name:/POP/ }).click();
  await expect(page.getByRole('button', { name:/POP/ })).toHaveClass(/active/);
  await expect(page.locator('#hint')).toContainText('D　F　J　K');
  await page.getByRole('button', { name:/DDR/ }).click();
  await expect(page.locator('#hint')).toContainText('←　↓　↑　→');
  await page.getByRole('button', { name:/ORBIT/ }).click();
  await expect(page.locator('#hint')).toContainText('Space / Enter');

  await page.getByRole('button', { name:'START TEST' }).click();
  await expect(page.locator('#cover')).toHaveClass(/hidden/);
  for(let i=0;i<4;i++){
    await page.getByRole('button', { name:/TAP BEAT/ }).click();
    if(i<3) await page.waitForTimeout(500);
  }
  await expect(page.locator('#tapState')).toContainText('SYNCED');
  await expect(page.locator('#bpmOut')).toHaveText(/^(80|[89]\d|1\d\d|180)$/);
  const [stage, canvas] = await Promise.all([
    page.locator('#stage').boundingBox(), page.locator('#game').boundingBox()
  ]);
  // Canvasは枠線の内側を埋める。外枠の2pxを含めず比較する。
  expect(canvas.height).toBeCloseTo(stage.height - 2, 0);
  expect(canvas.width).toBeCloseTo(stage.width - 2, 0);
});
