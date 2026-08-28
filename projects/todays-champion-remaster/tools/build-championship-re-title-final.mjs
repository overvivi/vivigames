import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/championship-re-title-master-v1.png');
const sourceDir = path.join(root, 'source/assets/championship-re/ui');
const publicDir = path.join(root, 'public/assets/championship-re/ui');
const width = 1440;
const height = 360;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // PCでも主題として読める横幅を優先し、透明余白で小さくしない。
    const finalLogo = await sharp(masterPath).resize({ width, height, fit: 'fill' }).png().toBuffer();
    await Promise.all([
        sharp(finalLogo).png().toFile(path.join(sourceDir, 'championship-re-title-final-v1.png')),
        sharp(finalLogo).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, 'championship-re-title-final-v1.webp'))
    ]);
    console.log('新規タイトルを共通原図へ規格化: 1440×360 / 表示720×180');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
