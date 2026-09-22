import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../../', import.meta.url);
const read = name => readFile(new URL(name, root));
const manifest = JSON.parse(await read('site.webmanifest'));

test('マスターと全用途のPNGを復号でき、指定サイズ・不透明の四隅を保つ', async () => {
  for (const [name, size] of [
    ['source/app-icon-1024.png', 1024], ['apple-touch-icon.png', 180],
    ['favicon-16x16.png', 16], ['favicon-32x32.png', 32],
    ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]
  ]) {
    const buffer = await read(`icons/${name}`);
    const meta = await sharp(buffer).metadata();
    assert.equal(meta.format, 'png', name);
    assert.equal(meta.width, size, name);
    assert.equal(meta.height, size, name);
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += info.channels) assert.equal(data[i], 255, `${name}: transparent pixel`);
  }
});

test('maskableは発光モチーフ全体が半径40%の安全円内に収まる', async () => {
  const { data, info } = await sharp(await read('icons/icon-maskable-512.png')).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  let motifPixels = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * info.channels;
    // 暗い背景・弱い光のにじみは除外し、輪郭・V・端子の明るい画素を調べる。
    if (Math.max(data[i], data[i + 1], data[i + 2]) < 64) continue;
    motifPixels++;
    assert.ok(Math.hypot(x + .5 - 256, y + .5 - 256) <= 204.8, `安全円からはみ出す画素: ${x},${y}`);
  }
  assert.ok(motifPixels > 10000, '空画像や過剰な縮小で検査を通さない');
});

test('favicon.icoは16・32・48pxの画像を正しく収容する', async () => {
  const ico = await read('favicon.ico');
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (const [i, size] of [16, 32, 48].entries()) {
    const pos = 6 + i * 16;
    assert.equal(ico[pos], size);
    assert.equal(ico[pos + 1], size);
    const length = ico.readUInt32LE(pos + 8), offset = ico.readUInt32LE(pos + 12);
    assert.ok(offset + length <= ico.length);
    const frame = ico.subarray(offset, offset + length);
    assert.equal((await sharp(frame).metadata()).width, size);
    await sharp(frame).raw().toBuffer();
  }
});

test('正式名を維持し、HTMLとmanifestの全参照がサブパス内で解決する', async () => {
  const html = (await read('index.html')).toString();
  assert.equal(manifest.name, 'VIVI GAME BASE');
  assert.equal(manifest.short_name, 'VIVI BASE');
  assert.equal(manifest.theme_color, '#05040a');
  assert.deepEqual(manifest.icons.map(icon => [icon.sizes, icon.purpose]), [
    ['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable']
  ]);
  const links = [...html.matchAll(/<link\b[^>]*rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g)].map(m => m[0]);
  assert.equal(links.length, 5);
  assert.ok(links.some(link => /apple-touch-icon/.test(link) && /180x180/.test(link)));
  for (const prefix of ['/', '/vivigames/']) {
    const page = new URL(`https://example.test${prefix}index.html`);
    const manifestUrl = new URL('site.webmanifest', page);
    for (const value of [manifest.id, manifest.scope, manifest.start_url]) {
      assert.equal(new URL(value, manifestUrl).pathname, prefix);
    }
    for (const src of [...links.map(link => link.match(/href="([^"]+)"/)[1]), ...manifest.icons.map(icon => icon.src)]) {
      const url = new URL(src, page);
      assert.ok(url.pathname.startsWith(prefix));
      assert.equal(url.searchParams.get('v'), '20260922');
      await readFile(fileURLToPath(new URL(url.pathname.slice(prefix.length), root)));
    }
  }
});
