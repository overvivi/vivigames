import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const referenceDir = path.join(root, 'source/assets/championship-re/references/icons');
const sourceDir = path.join(root, 'source/assets/championship-re/icons');
const publicDir = path.join(root, 'public/assets/championship-re/icons');
const fighters = ['raven', 'mika', 'brick', 'noise', 'kiri', 'vivi', 'tomega9'];

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    await Promise.all(fighters.map(async (id) => {
        // 生成原画の余白だけを切り、絵柄の縦横比は保つ。小さなSVGへ単純化しない。
        const art = await sharp(path.join(referenceDir, `gate-icon-${id}-master-v1.png`))
            .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
        await Promise.all([
            sharp(art).png().toFile(path.join(sourceDir, `gate-icon-${id}-art-v1.png`)),
            sharp(art).webp({ quality: 96, alphaQuality: 100, effort: 6 }).toFile(path.join(publicDir, `gate-icon-${id}-art-v1.webp`))
        ]);
    }));
    console.log('生成マーク7種を透明・等比のゲーム用素材へ規格化した。');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
