const { test, expect } = require('@playwright/test');

// ゲーム置き場は、筐体を並べる形から「1台のゲーム機にカセットを挿す」形へ変えた。
// 筐体は3D・陰影・パースを持つ絵で、新作のたびに生成AIへ同じ型を再現させられず、
// デザインが揃わなかったため。いまは新作で増えるのは平らな絵1枚だけ。

test('カセットが並び、選んだものが本体に挿さる', async ({ page })=>{
  await page.setViewportSize({ width:1280, height:900 });
  await page.goto('/index.html');

  // 遊べる4本 + COMING SOON。COMING SOON は常に最後
  await expect(page.locator('.cart')).toHaveCount(5);
  await expect(page.locator('.cart .cname')).toHaveText([
    'HELL RUNNER', '討伐2048', 'HEXAMINE', 'HELL RUNNER 2', 'COMING SOON'
  ]);

  // 最初から一番新しいものが挿さっていて、すぐ遊べる
  await expect(page.locator('#deck')).toHaveClass(/on/);
  await expect(page.locator('#capTitle')).toHaveText('HEXAMINE');
  await expect(page.locator('#playLink')).toHaveAttribute('href','games/hexamine.html');

  // 別のカセットを選ぶと、本体の中身が入れ替わる
  await page.locator('.cart').first().click();
  await expect(page.locator('#capTitle')).toHaveText('HELL RUNNER');
  await expect(page.locator('#playLink')).toHaveAttribute('href','games/temple-run-clone.html');
  // 挿さっているものは置き場に空のくぼみとして残す。消すと列に穴が空いて見える
  await expect(page.locator('.cart').first()).toHaveClass(/inserted/);
  await expect(page.locator('.cart').first()).toHaveAttribute('aria-pressed','true');
});

test('ゲームごとに本体の色が変わる', async ({ page })=>{
  await page.goto('/index.html');
  const colorOf = ()=> page.locator('#floor').evaluate(el =>
    getComputedStyle(el).getPropertyValue('--game').trim());

  await page.locator('.cart').first().click();
  const hell = await colorOf();
  await page.locator('.cart').nth(1).click();
  const boss = await colorOf();

  expect(hell).not.toBe('');
  expect(hell).not.toBe(boss);
});

test('COMING SOONは挿さらず、遊べるゲームを外さない', async ({ page })=>{
  await page.goto('/index.html');
  await page.locator('.cart').nth(1).click();
  await expect(page.locator('#capTitle')).toHaveText('討伐2048');

  await page.locator('.cart').last().click();
  await expect(page.locator('#rackNote')).toHaveText('次のゲームは準備中です');
  // 挿さっているものを外す理由が無いので、本体はそのまま
  await expect(page.locator('#capTitle')).toHaveText('討伐2048');
  await expect(page.locator('#deck')).toHaveClass(/on/);
});

test('キーボードだけでカセットを選んで遊びに行ける', async ({ page })=>{
  await page.goto('/index.html');
  const cart = page.locator('.cart').first();
  await cart.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#capTitle')).toHaveText('HELL RUNNER');

  // PLAY は本物のリンク。押さずに、辿れることと行き先だけ確かめる
  const play = page.locator('#playLink');
  await expect(play).toBeVisible();
  expect(await play.evaluate(el => el.tagName)).toBe('A');
});

test('スマホでは横にはみ出さず、PLAYを押しやすい', async ({ page })=>{
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/index.html');

  const overflow = await page.evaluate(()=>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // 本体が小さいと画面上のボタンは押しにくいので、下へ出して全幅にしている。
  // PLAY は挿さり切ってから出るので、点灯を待ってから測る
  await expect(page.locator('#deck')).toHaveClass(/on/);
  await expect(page.locator('#playLink')).toBeVisible();
  const box = await page.locator('#playLink').boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(40);
  expect(box.width).toBeGreaterThan(200);
});

// 作品が増えても置き場は1列に保つ。折り返すと本体との距離が作品数で変わり、
// 10本並んだときに縦へ伸びてしまう。
// いまは4本なので画面には収まる。作品が増えたときの挙動を確かめたいので、
// テスト側でカセットを複製してあふれさせる。
const overflowRack = page => page.evaluate(()=>{
  const rack = document.getElementById('rack');
  const first = rack.querySelector('.cart');
  for(let i = 0; i < 8; i++) rack.appendChild(first.cloneNode(true));
  window.dispatchEvent(new Event('resize'));   // 矢印の出し分けを更新させる
});

test('カセットが増えても1列のまま横へ流れる', async ({ page })=>{
  await page.setViewportSize({ width:1280, height:900 });
  await page.goto('/index.html');
  await overflowRack(page);

  const rows = await page.evaluate(()=>
    new Set([...document.querySelectorAll('.cart')]
      .map(c => Math.round(c.getBoundingClientRect().top))).size);
  expect(rows).toBe(1);

  // 置き場だけが流れ、ページ自体は横に伸びない
  const pageOverflow = await page.evaluate(()=>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(pageOverflow).toBeLessThanOrEqual(1);

  const over = await page.evaluate(()=>{
    const r = document.getElementById('rack');
    return r.scrollWidth - r.clientWidth;
  });
  expect(over).toBeGreaterThan(0);

  // あふれている間だけ矢印を出す
  await expect(page.locator('#rackNext')).toHaveClass(/show/);
});

test('掴んで動かしただけではゲームが切り替わらない', async ({ page })=>{
  await page.setViewportSize({ width:1280, height:900 });
  await page.goto('/index.html');
  await expect(page.locator('#capTitle')).toHaveText('HEXAMINE');
  await overflowRack(page);

  const box = await page.locator('#rack').boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 30, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, y, { steps:14 });
  await page.mouse.up();

  const moved = await page.evaluate(()=> document.getElementById('rack').scrollLeft);
  expect(moved).toBeGreaterThan(0);
  // 掴んで動かしただけなのに挿し変わると、操作として気持ち悪い
  await expect(page.locator('#capTitle')).toHaveText('HEXAMINE');
});

test('画像ロゴを読めない時もHTMLタイトルを表示する', async ({ page })=>{
  await page.route('**/vivi-game-base-logo.webp',route=>route.abort());
  await page.goto('/index.html');

  await expect(page.locator('.site-logo')).toBeHidden();
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('h1')).toContainText('VIVI GAME BASE');
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
    '/images/portal/vivi-game-base-logo.webp',
    '/images/portal/console-body.webp',
    '/images/portal/cart-label-hell-runner.webp',
    '/images/portal/cart-label-boss-2048.webp',
    '/images/portal/cart-label-hexamine.webp'
  ];
  for(const file of files){
    const response=await request.get(file);
    expect(response.ok(),file).toBe(true);
  }
});
