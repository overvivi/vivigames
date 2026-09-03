import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterDir = path.join(root, 'source/assets/championship-re/references/summon-gates-v2');
const sourceDir = path.join(root, 'source/assets/championship-re/summon');
const publicDir = path.join(root, 'public/assets/championship-re/summon');
const width = 772;
const height = 790;
const gates = ['raven', 'mika', 'brick', 'noise', 'kiri', 'vivi', 'tomega9'];

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    await Promise.all(gates.map(async (id) => {
        const masterPath = path.join(masterDir, `${id}-master-v2.png`);
        // 正方形に近い原画を縦横へ引き伸ばさない。底を揃えて薄い敷居と接地させる。
        const gate = await sharp(masterPath)
            .resize({ width, height: width, fit: 'contain' })
            .extend({ top: height - width, bottom: 0, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
        await Promise.all([
            sharp(gate).png().toFile(path.join(sourceDir, `summon-gate-${id}-final-v2.png`)),
            sharp(gate).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, `summon-gate-${id}-final-v2.webp`))
        ]);
    }));
    console.log('大型召喚ゲート7種を規格化: 772×790 / 内側と外側のalphaを維持');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
