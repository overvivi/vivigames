import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/summon-gate-frame-master-v1.png');
const sourceDir = path.join(root, 'source/assets/championship-re/summon');
const publicDir = path.join(root, 'public/assets/championship-re/summon');
const width = 772;
const height = 830;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // 生成原画は必要な外寸とほぼ同じ比率のため、開口のalphaを保ったまま基準枠へだけ規格化する。
    const gate = await sharp(masterPath).resize({ width, height, fit: 'fill' }).png().toBuffer();
    await Promise.all([
        sharp(gate).png().toFile(path.join(sourceDir, 'summon-gate-frame-final-v1.png')),
        sharp(gate).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, 'summon-gate-frame-final-v1.webp'))
    ]);
    console.log('大型召喚ゲート外枠を規格化: 772×830 / 内側は透明alphaのまま');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
