const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // tests/unit/ はブラウザを使わないNodeの単体テスト（npm run test:unit）。
  // 拡張子の既定パターンだと将来拾われかねないので、Playwrightは .spec.js だけを見る。
  testMatch: '**/*.spec.js',
  timeout: 30000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node tests/static-server.cjs',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true
  }
});
