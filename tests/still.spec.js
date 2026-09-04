const { test, expect } = require('@playwright/test');

// STILL の要は「動いた分だけ世界が進む」の一点。ここが崩れると、
// 止まって考えられる＝理不尽で死なない、というゲームの土台が消える。
// requestAnimationFrame の実時間に頼るとテストが不安定になるため、
// 公開されている update() を固定dtで手回しして確かめる。

const step = (n) => `for(let i=0;i<${n};i++) window.update(1/60);`;

async function startGame(page){
  await page.goto('/games/still.html');
  await page.locator('#startBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
}

test('タイトルから開始でき、プレイ中は置き場リンクが指の下に残らない', async ({ page })=>{
  await page.goto('/games/still.html');
  await expect(page.locator('.logo')).toHaveText('STILL');
  // 遊び方を読まずに始められないと初見が詰まるので、3つの決まりごとは常に出す
  await expect(page.locator('.rules li')).toHaveCount(3);
  await expect(page.locator('.portalLink')).toBeVisible();

  await page.locator('#startBtn').click();
  await expect(page.locator('#titleScreen')).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();
  // 画面のどこを触っても操作になるため、遊んでいる間はリンクを消す
  await expect(page.locator('.portalLink')).toBeHidden();
});

test('止まれば世界も止まり、動けば世界が進む', async ({ page })=>{
  await startGame(page);
  const r = await page.evaluate(`(()=>{
    const snap=()=>JSON.stringify(window.bullets.map(b=>[b.x,b.y]));
    const out={};
    window.keys={};
    ${step(20)}
    out.tauIdle = window.tau;
    const still1 = snap();
    ${step(90)}
    out.frozen = still1 === snap();          // 手を離している間は1pxも動かない
    // 壁へ押し付けると速度が消えて世界も止まる（仕様）ので、助走できる位置から始める
    const p=window.player;
    p.x=window.AR.l+24; p.y=window.CY; p.px=p.x; p.py=p.y; p.vx=0; p.vy=0;
    window.keys={r:1};
    ${step(24)}
    out.tauMoving = window.tau;
    const moved1 = snap();
    ${step(30)}
    out.moving = moved1 !== snap();
    return out;
  })()`);
  expect(r.tauIdle).toBe(0);
  expect(r.frozen).toBe(true);
  expect(r.tauMoving).toBeGreaterThan(0.99);
  expect(r.moving).toBe(true);
});

test('光の粒を拾うと加点され、弾が増える', async ({ page })=>{
  await startGame(page);
  const r = await page.evaluate(`(()=>{
    const before = window.bullets.length;
    window.keys={};
    ${step(4)}
    // 目の前へ移してから1歩だけ進める
    window.orb.x = window.player.x + 12; window.orb.y = window.player.y;
    ${step(3)}
    return { before, after: window.bullets.length, score: window.score, level: window.level };
  })()`);
  expect(r.level).toBe(1);
  expect(r.score).toBeGreaterThan(0);
  expect(r.after).toBeGreaterThan(r.before);
  await expect(page.locator('#hudLevel')).toHaveText('1');
});

test('高速な弾でもすり抜けず、当たると結果画面が出る', async ({ page })=>{
  await startGame(page);
  const state = await page.evaluate(`(()=>{
    const p = window.player;
    p.x = window.CX; p.y = window.CY; p.px = p.x; p.py = p.y; p.vx = 0; p.vy = 0;
    window.bullets.length = 0;
    // 1フレームで自機を飛び越える速度。位置だけの判定だとすり抜ける
    window.bullets.push({ x:p.x+150, y:p.y, px:p.x+150, py:p.y, vx:-1800, vy:0,
      r:6.4, warm:1, grz:false, hit:0 });
    window.keys={r:1};
    for(let i=0;i<40 && window.STATE==='play';i++) window.update(1/60);
    return window.STATE;
  })()`);
  expect(state).toBe('over');

  // 当たった瞬間の盤面を見せてから結果へ移る
  await expect(page.locator('#overScreen')).toBeVisible();
  await expect(page.locator('#resScore')).toBeVisible();
  await page.locator('#retryBtn').click();
  await expect(page.locator('#overScreen')).toBeHidden();
  const fresh = await page.evaluate('({ state:window.STATE, score:window.score, level:window.level })');
  expect(fresh).toEqual({ state:'play', score:0, level:0 });
});

test('指で遊ぶ端末では、盤面の下に親指の居場所を空ける', async ({ page })=>{
  await startGame(page);
  // 闘技場を画面いっぱいへ広げた結果、盤面の外に指を置く場所が無くなっていた。
  // 携帯だけ下に操作帯を確保し、自分の指で弾が隠れないようにする。
  const r = await page.evaluate(`(()=>{
    const band = () => window.innerHeight - window.AR.b;
    window.touchMode = false; window.resize();
    const mouse = { band: band(), h: window.AR.h };
    window.touchMode = true;  window.resize();
    const touch = { band: band(), h: window.AR.h, w: window.AR.w };
    return { mouse, touch };
  })()`);
  expect(r.touch.band).toBeGreaterThan(90);
  expect(r.touch.band).toBeGreaterThan(r.mouse.band + 50);
  // 帯のために盤面が痩せすぎないこと（横幅は変えない）
  expect(r.touch.w).toBeGreaterThan(300);
  expect(r.touch.h).toBeGreaterThan(r.mouse.h * 0.85);
});

test('画面の向きが変わっても弾が闘技場の外へ取り残されない', async ({ page })=>{
  await startGame(page);
  await page.evaluate(`(()=>{
    window.level = 10;
    for(let i=0;i<14;i++) window.addBullet();
    window.addSeeker();
    window.keys={r:1,d:1};
    ${step(60)}
    window.keys={};
  })()`);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(120);
  const outside = await page.evaluate(`(()=>{
    const A = window.AR;
    return [].concat(window.bullets, window.seekers, [window.player])
      .filter(o => o.x < A.l-1 || o.x > A.r+1 || o.y < A.t-1 || o.y > A.b+1).length;
  })()`);
  expect(outside).toBe(0);
});
