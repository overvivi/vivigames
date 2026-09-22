const { test, expect } = require('@playwright/test');

test('HTMLで指定したアイコンとmanifestをHTTPで取得できる', async ({ page, request }) => {
  await page.goto('/index.html');
  await expect(page).toHaveTitle('VIVI GAME BASE');
  const icons = page.locator('head link[rel="icon"], head link[rel="apple-touch-icon"]');
  await expect(icons).toHaveCount(4);
  for (const icon of await icons.all()) {
    const response = await request.get(await icon.getAttribute('href'));
    expect(response.status()).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  const response = await request.get(await page.locator('link[rel="manifest"]').getAttribute('href'));
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/manifest+json');
  const manifest = await response.json();
  expect(manifest.name).toBe('VIVI GAME BASE');
  for (const icon of manifest.icons) {
    const asset = await request.get(icon.src);
    expect(asset.status()).toBe(200);
    expect(asset.headers()['content-type']).toContain('image/png');
  }
});
