import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/summon-gate-common-master-v4.png');
const sourceDir = path.join(root, 'source/assets/championship-re/summon');
const publicDir = path.join(root, 'public/assets/championship-re/summon');
const width = 772;
const height = 790;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // 背景Bの寸法ではなく門の外寸だけを満たす。原画の比率はほぼ同じため、
    // 門の足元を歪めずに画面上の接地感だけを検証できる。
    const gate = await sharp(masterPath)
        .resize({ width, height, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    await Promise.all([
        sharp(gate).png().toFile(path.join(sourceDir, 'summon-gate-common-final-v4.png')),
        sharp(gate).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, 'summon-gate-common-final-v4.webp'))
    ]);
    console.log('共通大型召喚ゲートを規格化: 772×790 / alpha維持');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
