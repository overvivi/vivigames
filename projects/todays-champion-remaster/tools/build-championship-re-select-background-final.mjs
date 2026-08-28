import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/select-bg-clean-master-v1.png');
const sourceDir = path.join(root, 'source/assets/championship-re/select');
const publicDir = path.join(root, 'public/assets/championship-re/select');
const width = 941;
const height = 1672;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // 背景だけを画面原寸へ収める。ゲート位置の色やUIは焼かず、濡れた街として完結させる。
    const background = await sharp(masterPath)
        .resize({ width, height, fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
    await Promise.all([
        sharp(background).png().toFile(path.join(sourceDir, 'select-bg-final-v1.png')),
        sharp(background).webp({ quality: 92 }).toFile(path.join(publicDir, 'select-bg-final-v1.webp'))
    ]);
    console.log('新規背景を共通原図へ規格化: 941×1672 / 色反射の焼き込みなし');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
