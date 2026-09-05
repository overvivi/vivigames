const { test, expect } = require('@playwright/test');

// `games/elegant-solitaire.html` と `games/immune-defense.html` は、
// React + Vite のプロジェクトを単一HTMLへ畳んで書き出したもの（npm run games:build）。
// 手で編集する対象ではないので、ここでは「置き場のゲームとして成立しているか」だけを見る。
//   - 開いたら実際に描画されるか（モジュールではなく通常のスクリプトとして走る）
//   - 置き場へ戻る導線と音の入切があるか
//   - 外部から取りに行くのは背景画像だけか

const GAMES = [
  { name: 'Elegant Solitaire', path: '/games/elegant-solitaire.html' },
  { name: 'Immune Defense', path: '/games/immune-defense.html' }
];

for (const game of GAMES) {
  test(`${game.name}: 開くと描画され、置き場へ戻れる`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(game.path);
    await expect(page.locator('#root > *')).not.toHaveCount(0);

    // 置き場へ戻る導線。プレイ中に迷子にならないための最低条件
    await expect(page.locator('a[href="../index.html"]')).toBeVisible();
    // 音の入切
    await expect(page.locator('button[aria-label="音のON/OFF"]')).toBeVisible();

    expect(errors).toEqual([]);
  });
}

test('単一HTMLとして完結している（外部依存は背景画像とフォントだけ）', async ({ page }) => {
  const external = [];
  page.on('request', req => {
    const url = req.url();
    if (url.startsWith('data:')) return;
    if (url.includes('/games/')) return;              // 本体
    if (url.includes('fonts.googleapis') || url.includes('fonts.gstatic')) return; // 見出しの書体
    external.push(url.replace(/^https?:\/\/[^/]+/, ''));
  });

  await page.goto('/games/immune-defense.html');
  await page.waitForTimeout(400);
  // 背景だけは images/ の外部ファイル。base64で埋めるとHTMLが1MB以上太るため
  expect(external).toEqual(['/images/immune-defense/bg.webp']);

  external.length = 0;
  await page.goto('/games/elegant-solitaire.html');
  await page.waitForTimeout(400);
  expect(external).toEqual([]);
});
