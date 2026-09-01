import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const sourceDir = path.join(root, 'source/assets/championship-re/summon');
const publicDir = path.join(root, 'public/assets/championship-re/summon');
const width = 585;
const height = 692;
const gateWidth = 772;
const gateHeight = 790;
const gates = ['raven', 'mika', 'brick', 'noise', 'kiri', 'vivi', 'tomega9'];

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // 背景Bは門の内側だけに存在する別世界で、ここに足場を描かない。
    // 足元は背景Aの濡れた路面へ接地させるため、検証中は奥行きだけを持つ暗い虚空に留める。
    const interior = await sharp(Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="void" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#080c18"/>
          <stop offset="0.58" stop-color="#11172a"/>
          <stop offset="1" stop-color="#1a1230"/>
        </linearGradient>
        <radialGradient id="haze" cx="50%" cy="68%" r="58%">
          <stop offset="0" stop-color="#5274a8" stop-opacity="0.26"/>
          <stop offset="0.55" stop-color="#232d58" stop-opacity="0.1"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#void)"/>
      <rect width="100%" height="100%" fill="url(#haze)"/>
    </svg>`))
        .png()
        .toBuffer();
    await Promise.all([
        sharp(interior).png().toFile(path.join(sourceDir, 'summon-interior-test-final-v1.png')),
        sharp(interior).webp({ quality: 94 }).toFile(path.join(publicDir, 'summon-interior-test-final-v1.webp'))
    ]);
    await Promise.all(gates.map(async (id) => {
        const gatePath = path.join(sourceDir, `summon-gate-${id}-final-v2.png`);
        const { data } = await sharp(gatePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const seen = new Uint8Array(gateWidth * gateHeight);
        const center = Math.floor(gateHeight / 2) * gateWidth + Math.floor(gateWidth / 2);
        const queue = [center];
        seen[center] = 1;
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const index = queue[cursor];
            const x = index % gateWidth;
            const y = (index - x) / gateWidth;
            for (const candidate of [index - 1, index + 1, index - gateWidth, index + gateWidth]) {
                if (candidate < 0 || candidate >= seen.length || seen[candidate]) continue;
                const candidateX = candidate % gateWidth;
                const candidateY = (candidate - candidateX) / gateWidth;
                if (Math.abs(candidateX - x) + Math.abs(candidateY - y) !== 1) continue;
                if (data[candidate * 4 + 3] < 16) {
                    seen[candidate] = 1;
                    queue.push(candidate);
                }
            }
        }
        const mask = Buffer.alloc(gateWidth * gateHeight * 4);
        seen.forEach((inside, index) => { mask[index * 4 + 3] = inside ? 255 : 0; });
        const maskPng = await sharp(mask, { raw: { width: gateWidth, height: gateHeight, channels: 4 } }).png().toBuffer();
        // 背景の原寸は共通のまま、各門で中央に連続する透明開口だけへ抜く。
        // 門の飾り間の小さな透明穴へ街が見えるのを防ぐため、外周alphaをそのまま使わない。
        const framedInterior = await sharp({ create: { width: gateWidth, height: gateHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
            .composite([{ input: interior, left: 94, top: 99 }, { input: maskPng, blend: 'dest-in' }])
            .png()
            .toBuffer();
        await Promise.all([
            sharp(framedInterior).png().toFile(path.join(sourceDir, `summon-interior-test-${id}-final-v2.png`)),
            sharp(framedInterior).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, `summon-interior-test-${id}-final-v2.webp`))
        ]);
    }));
    console.log('大型召喚ゲート内の床なし背景Bテストを規格化: 585×692 / 門ごとの実開口maskで切り抜き');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
