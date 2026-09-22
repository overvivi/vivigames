// マスターを残し、用途別サイズを同じ絵から再現できるようにする。
// node tools/app-icons.mjs
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'icons/source/app-icon-1024.png');
const output = path.join(root, 'icons');
await mkdir(output, { recursive: true });
const meta = await sharp(source).metadata();
if (meta.width !== 1024 || meta.height !== 1024) throw new Error('マスターは1024×1024で保存してください');
const png = size => sharp(source).resize(size, size, { kernel: 'lanczos3' })
  .flatten({ background: '#05040a' }).removeAlpha().png({ compressionLevel: 9 });
for (const [name, size] of [
  ['apple-touch-icon.png', 180], ['favicon-32x32.png', 32],
  ['favicon-16x16.png', 16], ['icon-192.png', 192], ['icon-512.png', 512]
]) await png(size).toFile(path.join(output, name));

// 絵の外周の暗い余白も含めて縮小。カセット全体を半径40%の安全円内へ収める。
const inset = await png(352).toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 3, background: '#05040a' } })
  .composite([{ input: inset, left: 80, top: 80 }]).removeAlpha()
  .png({ compressionLevel: 9 }).toFile(path.join(output, 'icon-maskable-512.png'));

// PNGを収容する標準ICO。サイズごとの画像を持たせ、ブラウザ側の拡大を避ける。
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map(size => png(size).toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
frames.forEach((frame, i) => {
  const pos = 6 + i * 16;
  header[pos] = header[pos + 1] = sizes[i];
  header.writeUInt16LE(1, pos + 4);
  header.writeUInt16LE(24, pos + 6);
  header.writeUInt32LE(frame.length, pos + 8);
  header.writeUInt32LE(offset, pos + 12);
  offset += frame.length;
});
await writeFile(path.join(root, 'favicon.ico'), Buffer.concat([header, ...frames]));
console.log('アイコンPNG 6点・ICO 1点を書き出しました（マスター保持）。');
