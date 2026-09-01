import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/summon-interior-test-master-v1.png');
const sourceDir = path.join(root, 'source/assets/championship-re/summon');
const publicDir = path.join(root, 'public/assets/championship-re/summon');
const width = 585;
const height = 692;
const gateWidth = 772;
const gateHeight = 790;
const gates = ['raven', 'mika', 'brick', 'noise', 'kiri', 'vivi', 'tomega9'];

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    const metadata = await sharp(masterPath).metadata();
    const cropWidth = Math.round(metadata.height * width / height);
    const left = Math.round((metadata.width - cropWidth) / 2);
    // 地面と消失点の遠近感を変えないよう、正方形原画は横だけを中心トリミングして等比縮小する。
    const interior = await sharp(masterPath)
        .extract({ left, top: 0, width: cropWidth, height: metadata.height })
        .resize({ width, height, fit: 'contain' })
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
    console.log('大型召喚ゲート内のテスト背景を規格化: 585×692 / 門ごとの実開口maskで切り抜き');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
