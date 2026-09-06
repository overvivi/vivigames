import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const referenceDir = path.join(root, 'source/assets/championship-re/references/result');
const publicDir = path.join(root, 'public/assets/championship-re/result');

const assets = [
    ['battle-result-background-master-v1.png', 'battle-result-background-v1.webp', false],
    ['battle-result-panel-master-v1.png', 'battle-result-panel-v1.webp', true],
    ['battle-return-title-master-v1.png', 'battle-return-title-v1.webp', true]
];

async function build() {
    await mkdir(publicDir, { recursive: true });
    await Promise.all(assets.map(async ([input, output, transparent]) => {
        let image = sharp(path.join(referenceDir, input)).ensureAlpha();
        if (transparent) image = image.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } });
        await image.webp({ quality: 94, alphaQuality: 100, effort: 6 }).toFile(path.join(publicDir, output));
    }));
    console.log('リザルト画面素材をWebPへ変換しました。');
}

build().catch((error) => { console.error(error); process.exit(1); });
