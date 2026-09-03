import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/championship-re-cta-master-v5.png');
const sourceDir = path.join(root, 'source/assets/championship-re/ui');
const publicDir = path.join(root, 'public/assets/championship-re/ui');
const width = 1600;
const height = 400;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // 原画自身のalphaだけを使う。色判定・輪郭推定で黒鉄面に穴を開けない。
    const cta = await sharp(masterPath).ensureAlpha()
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .resize({ width, height, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    await Promise.all([
        sharp(cta).png().toFile(path.join(sourceDir, 'start-duel-final-v5.png')),
        sharp(cta).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, 'start-duel-final-v5.webp'))
    ]);
    console.log('新規CTA写真枠を共通原図へ規格化: 1600×400 / 表示680×170');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
